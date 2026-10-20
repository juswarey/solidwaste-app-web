# ECollect setup (Supabase, admin website, mobile app)

There is one database, **Supabase**. The admin website (`web/`) and the mobile app (Expo, `mobile/`) both use it.

| Who | Uses | Signs in with |
|---|---|---|
| LGU Admin, Barangay Admin | Website (`web/`) | Email and password created in the system |
| Garbage collector | Mobile app | Login created by the Barangay Admin (website → Garbage collectors) |
| Resident | Mobile app | Self sign-up in the app |

Keys:
- **anon key** (Project Settings → API): public. It goes in `web/.env` and the app's `.env`.
- **service_role key**: secret. It only ever goes in `.env.seed` on your own computer and in Supabase itself. Never put it in `web/.env`, the app, GitHub or a chat.

---

## 1. Database

Open Supabase → **SQL Editor** → New query. Paste each file, click **Run**, and wait for it to finish before the next one.

1. `supabase/setup/01_schema.sql`
2. `supabase/setup/02_security.sql`
3. `supabase/setup/03_logic.sql`
4. **One** of:
   - `supabase/setup/04_upgrade_existing.sql`: your project **already has ECollect data** (the current project). It keeps every row; see the list at the top of the file. The last two result tables should show Zone 1 … Zone 10 with the official days and times, and `17` active fixed rows.
   - `supabase/setup/04_data.sql`: a **new, empty** project only. It loads the Barangay Poblacion data copied from the old MySQL database.

Files 01–03 are safe to run again later, and **must** be run again after an update that changes them, for example the collector-app updates: truck-stop visits and field reports (19 Oct 2026), then missed stops, truck load, shifts and notifications (20 Oct 2026). Run 04 only once.

> **Back up first.** Free projects have no automatic backups. Before step 1, export each table from the Table Editor (… → Export to CSV).

If `04_upgrade_existing.sql` stops with "Zone records need attention", nothing was changed. Send the message to whoever maintains the system.

## 2. Staff-account function

Creating and deleting logins needs the service key, so it runs as a Supabase **Edge Function** rather than in the website. Install the Supabase CLI and deploy once (again after any change to `supabase/functions/`):

```
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF      # the part before .supabase.co
npx supabase functions deploy manage-staff
```

Who can do what with it:
- the **LGU Admin** creates Barangay Admin accounts and deletes resident accounts;
- the **Barangay Admin** creates, edits and deletes garbage collector accounts.

The LGU Admin login already exists in the current project. For a new project, create it once with `npm install` then `npm run seed:lgu` in the project root (instructions at the top of `scripts/seed-lgu-admin.mjs`).

## 3. Website

```
cd web
cp .env.example .env        # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev                 # http://localhost:5173
```

Sign in on the home page with **Login**, choosing *Barangay Admin* or *LGU Admin*.

**Put it online (free):** on Vercel or Netlify, import the GitHub repository and set:
- **Root directory:** `web`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

`web/vercel.json` and `web/public/_redirects` make page links such as `/barangay/schedules` work when opened directly.

Then add the website's address in Supabase → Authentication → URL Configuration (Site URL).

## 4. After the upgrade, on the website

1. **Barangay Admin → Collection schedule → Truck crew:** choose the collector who drives the truck. Until then, no collector sees the fixed schedule in the app.
2. **Truck stops:** confirm each stop's exact spot with the barangay, then tick "confirmed". Consunji St. has no Google Maps link yet.
3. **Single truck, Mon/Wed/Fri 5:00–6:00 PM** (decided 20 Oct 2026): 1st stop **Back of Kim Guan** 5:00–5:30 PM for **Zones 5 and 6**, 2nd stop **Sapporo – Araneta St.** 5:30–6:00 PM for **Zones 1 and 2**, 30 min standby each. A project set up before that date: run `supabase/setup/05_split_mwf_stops.sql` once in the SQL Editor (after 01–03).
4. **Zone areas:** the traced zone areas are provisional (dashed on the map) until the barangay confirms them.
5. **Collectors without a login:** collectors that appear with "No login yet" get one when you set a password on their Edit form.

## 5. Collector app (mobile)

In the `mobile/` folder:

```
cd mobile
copy .env.example .env      # then fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start              # scan the QR code with the Expo Go app on the phone
```

Sign in with a collector account the Barangay Admin created. In **Expo Go**, location sharing works while the app is open (Expo Go cannot share in the background).

**Installable app (APK) with background GPS** — built free in the cloud by Expo (EAS):

```
npm install -g eas-cli      # once
eas login                   # free Expo account
eas build -p android --profile preview
```

Before the first build, put the two public values in `eas.json`, because EAS does not upload `.env` (it is git-ignored). Under `"preview"`, add:

```
"env": {
  "EXPO_PUBLIC_SUPABASE_URL": "https://YOUR-PROJECT.supabase.co",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your anon / publishable key"
}
```

Use the anon key, never the service_role key. When the build finishes, open the link it prints on the phone and install the APK. On first "Start sharing", allow location **"All the time"** so the truck stays on the map when the phone is locked; Android then shows an "ECollect is sharing the truck's location" notification while it runs.

What the collector sees:
- **Today:**
  - **Start shift / End shift** (the barangay sees the truck's working hours in Reports).
  - The GPS switch.
  - The day's truck stops: time, place, standby, zones and "Open in Google Maps" to the exact spot. Each stop has **Done at this stop** (then a quick "how full is the truck?" ¼ / ½ / ¾ / Full, or skip) and **Couldn't collect** (reason and note; it also appears under *Field reports from the truck*, and the zones show *Missed: reason* on the website).
  - Emergency pickups (*On the way* → *Mark completed*).
  - A zone counts as collected when every stop serving it that day is done.
- **Arrival and standby:** while location sharing is on, reaching a stop (within 50 m) shows "You're at …" and starts the standby countdown; a reminder comes when the standby time is over. The collector can also start the timer by hand. Nothing is marked done automatically.
- **No signal:** the day stays on the phone, and taps are saved and sent with the time they were tapped once the signal is back.
- **Emergency:** every emergency pickup assigned to the collector: needs action (today and overdue), coming up (later days) and the last 14 days done or cancelled, each with details, directions and progress. The tab shows a red badge with the number that need action, and an emergency notification opens it.
- **Week, Map** (Poblacion only, no Google key; the truck is a top-view truck turned to its direction of travel; open emergency pickups are red pins).
- **More:** Report a problem (also a quick link on Today), Announcements, My history (last 14 days), Account (change password, log out).
- GPS stops by itself one hour after the day's last stop.

### Notifications

The phone reminds the collector 15 minutes before the first stop, and shows the arrival and standby alerts. These work in Expo Go too.

Notifications **from the barangay** need the installed app (APK) and a free Firebase project. They cover emergency pickups that are new, changed, reassigned or cancelled, a truck stop's new days or time, and new announcements. Do this once:

1. **Firebase.**
   1. [console.firebase.google.com](https://console.firebase.google.com) → Add project.
   2. Add an **Android app** with package name `ph.ecollect.poblacion`.
   3. Download **google-services.json** into `mobile/` (next to `app.json`).
   4. In `app.json`, under `"android"`, add `"googleServicesFile": "./google-services.json"`.
2. **Firebase key for Expo.**
   1. Firebase → Project settings → Service accounts → **Generate new private key**.
   2. Run `eas credentials` → Android → production → Google Service Account → *Manage your Google Service Account Key for Push Notifications (FCM V1)* → *Set up …* → *Upload a new service account key*.
   3. That key file is secret: do not commit it.
3. **Build the APK** (`eas build -p android --profile preview`). The first `eas build` links the project to Expo (it adds `extra.eas.projectId` to `app.json`).
4. **Supabase.** The **pg_net** extension sends the notifications; `01_schema.sql` turns it on. If it says pg_net is not available, turn it on under Database → Extensions → pg_net and run `01_schema.sql` again.

On the phone, **More** shows whether notifications are on. Every notification is also recorded in the `notification` table.

## 6. Resident app (mobile)

Residents use the same app as collectors (`mobile/`); the app shows the resident tabs (Home, Truck, Report, News, Guide) when the login is a resident. Residents sign up in the app (*Create an account*) and pick their zone; no admin action is needed. The database trigger in `02_security.sql` makes every self sign-up a resident.

What each tab reads (all allowed by the row-level security in `02_security.sql`, so nothing extra has to be run):
- **Home:** the zone's Active `collection_schedule` rows. Fixed rows show the truck stop (name and landmark from `collection_point`); older custom rows show their waste category. A zone set to *drop-off* shows a drop-off notice instead of pickup times.
- **Truck:** the zone's route line and the truck positions from `resident_trucks()` (last 12 hours, only trucks serving the resident's zone).
- **Report:** inserts into `feedback_report` (status is set to *Pending* by the database); *My reports* shows Pending / In Progress / Resolved / Dismissed / Closed as the Barangay Admin changes them on the website.
- **News:** announcements that have not passed their expiry date.
- **Guide:** waste categories and disposal guidelines.

The old `step3_extras.sql` and `step4_accounts.sql` are no longer needed: `resident_trucks()` and the sign-up trigger are now part of `02_security.sql`.

## Notes

- **Free plan pausing:** Supabase pauses a free project after about a week without activity. Open the dashboard and restore it before a demo.
- **Zone lock:** the 10 zones are locked in the database: they cannot be added, renamed or deleted, even in the Table Editor. For an official re-zoning, see the comment at the top of the zone section in `03_logic.sql`.
- **Server clock:** times come from the server clock in Philippine time, not from phones.

## Live truck tracking for residents

Run `supabase/setup/05_resident_live.sql` once in the Supabase SQL editor. It lets residents
receive the GPS pings of the trucks that serve their zone and turns on Realtime for
`location_history`. Without it the Truck tab still works, but only by re-checking every 15 seconds
and it shows "Reconnecting" instead of "Live". "Truck is near" alerts need notification permission
on the resident's phone (Profile > Truck alerts).
