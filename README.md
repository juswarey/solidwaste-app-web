# ECollect — one React Native (Expo) project, two front ends

| Who | Where | Entry |
|---|---|---|
| LGU admin, Barangay admin | **Website** (`npm run web`) | `src/navigation/RootNavigator.web.js` → `src/web/` |
| Garbage collector, Resident | **Phone app** (Android / iOS) | `src/navigation/RootNavigator.js` |

Everything talks to Supabase directly (`src/lib/supabase.js`). The PHP API (`api.js`, `API_BASE`) is gone.
Security comes from the RLS policies in your step-2 SQL — the website and the app only ever use the public anon key.

## 1. Database (Supabase → SQL Editor, in this order)
1. Your table + data script
2. Your step-2 script (login + RLS) — its last query prints the **sign-up codes**
3. `supabase/step3_extras.sql` (adds `resident_trucks()` for the resident truck map)
4. `supabase/step4_accounts.sql` (account model: sign-up creates residents only; invite codes retired)

Supabase → Authentication → Providers → Email: for development, turn **Confirm email** off
(otherwise new users must click an email link before they can log in).

## 2. Configure
```
cp .env.example .env      # then fill in the project URL + anon key
npm install
npx expo install @react-native-async-storage/async-storage react-native-web react-dom @expo/metro-runtime
```

## 3. Run
```
npm run web        # admin website
npm run android    # phone app (or: npm start, then scan with Expo Go / dev build)
```
Restart with `npx expo start -c` after changing `.env`.

## Accounts — who can create what
| Account | How it is created |
|---|---|
| **LGU admin** | One default account, created once by `npm run seed:lgu` (below). Nobody can sign up as LGU admin. |
| **Barangay admin** | Only the LGU admin, on the website → *Barangay admins* → *Add* (email + password they choose). |
| **Garbage collector** | Only the LGU admin, on the website → *Garbage collectors* → *Add*. They log in to the phone app. |
| **Resident** | Self sign-up in the phone app (*Create an account*). This is the **only** public sign-up, and the database trigger forces it to be a resident. |

### One-time setup for the accounts feature
1. Run `supabase/step4_accounts.sql` in the SQL Editor.
2. Deploy the staff function (it holds the service key, so it must not run in the app):
   ```
   npm i -g supabase            # or: npx supabase ...
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy manage-staff
   ```
3. Create the default LGU admin. Make a file `.env.seed` (git-ignored; **never** put the service key in `.env`):
   ```
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...        # Project Settings -> API -> service_role
   LGU_ADMIN_EMAIL=lgu.admin@ecollect.ph        # optional
   LGU_ADMIN_PASSWORD=...                       # optional; a random one is printed if omitted
   ```
   then `npm run seed:lgu` (Node 20.6+). Safe to re-run; it never makes a second default admin.
4. `npm run web`, log in with that account, and add barangay admins / collectors.

Staff passwords are chosen by the LGU admin when creating the account and can be reset from *Edit*.
Deleting a staff member also deletes their login.

## What the website can do
LGU admin: dashboard, live truck map, barangay admins, collectors, zones & route drawing, schedules, trucks,
waste categories, announcements, resident reports (status updates), residents.
Barangay admin (logs in on the website with the login the LGU created): dashboard, live truck map, their zones & routes, schedules, collectors (read-only), announcements (read-only).

## Column names I had to assume (edit in `src/data/*.js` and `src/web/pages/*` if yours differ)
* `route.path_coordinates` — text holding JSON; new routes are saved as `[{"latitude":..,"longitude":..}]`, and `[lat,lng]` pairs are also read
* `garbage_collector.truck_id`, `garbage_collector.route_id`
* `collection_schedule`: `route_id, garbage_collector_id, barangay_admin_id, waste_category_id, day_of_week, start_time, end_time, schedule_status`
* `pickup_log.pickup_date` (date), `location_history.timestamp`
* `announcement`: `title, content, published_timestamp, lgu_admin_id`
* `feedback_report`: `resident_id, report_type, description, latitude, longitude, status, created_at, lgu_admin_id`
* `truck`: `plate_number, max_capacity_kg`; `waste_category`: `category_name, disposal_guidelines`
