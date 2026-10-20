set client_min_messages = warning;
-- =====================================================================
-- ECollect | Supabase setup 2 of 4: logins, roles and row-level security
-- Run after 01_schema.sql. Safe to re-run.
--
-- Who may do what (same rules as the PHP version):
--   LGU Admin       monitors everything; manages trucks, Barangay Admin accounts,
--                   resident accounts and the report log. Read-only elsewhere.
--   Barangay Admin  manages the fixed schedule, truck crew, zones' route paths,
--                   collectors, emergency collections, waste categories,
--                   announcements and resident report statuses.
--   Collector       (mobile app) reads their schedule, marks pickups done, sends GPS.
--   Resident        (mobile app) reads their zone's schedule, sends reports.
-- Staff logins are created only through the "manage-staff" Edge Function.
-- Public sign-up can only ever create a resident.
-- =====================================================================

-- ---------- Start clean ----------
-- Every existing policy on the ECollect tables is replaced by the ones at the end of
-- this file (also those of an older setup), so drop them first: some use functions
-- that are replaced below.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('lgu_admin','barangay_admin','truck','route','waste_category','garbage_collector','resident',
                      'collection_point','collection_point_zone','collection_schedule','pickup_log','location_history',
                      'announcement','feedback_report','emergency_collection','reports')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Older setups: functions whose signature changed, and pieces that are no longer used.
drop function if exists public.my_profile();
drop function if exists public.resident_can_see_collector(integer);
drop function if exists public.my_lgu_admin_id();
drop function if exists public.my_barangay_admin_id();
-- This trigger moved a collector's home zone to whichever zone they were last scheduled for;
-- with one truck serving every zone it kept changing it. The home zone is set on the Collectors page.
drop trigger if exists trg_sync_collector_route on public.collection_schedule;
drop function if exists public.sync_collector_route();
-- Sign-up codes are retired: staff logins are created by the manage-staff Edge Function.
do $$
begin
  if to_regprocedure('public.claim_invite(text)') is not null then
    revoke execute on function public.claim_invite(text) from public, anon, authenticated;
  end if;
end $$;

-- ---------- Who is signed in? ----------
create or replace function public.my_lgu_id() returns integer
language sql stable security definer set search_path = public as $$
  select lgu_admin_id from public.lgu_admin where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.my_barangay_id() returns integer
language sql stable security definer set search_path = public as $$
  select barangay_admin_id from public.barangay_admin where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.my_collector_id() returns integer
language sql stable security definer set search_path = public as $$
  select garbage_collector_id from public.garbage_collector where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.my_resident_id() returns integer
language sql stable security definer set search_path = public as $$
  select resident_id from public.resident where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_lgu() returns boolean
language sql stable as $$ select public.my_lgu_id() is not null $$;

create or replace function public.is_barangay() returns boolean
language sql stable as $$ select public.my_barangay_id() is not null $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.is_lgu() or public.is_barangay() $$;

/** The signed-in resident's zone (route_id). */
create or replace function public.my_route_id() returns integer
language sql stable security definer set search_path = public as $$
  select route_id from public.resident where auth_user_id = auth.uid() limit 1
$$;

/** Every role this login has. Used by the app and the website right after sign-in. */
create or replace function public.my_profile()
returns table (r_role text, r_id integer, r_first_name text, r_last_name text)
language sql stable security definer set search_path = public as $$
  select 'lgu_admin', lgu_admin_id, first_name::text, last_name::text from public.lgu_admin where auth_user_id = auth.uid()
  union all
  select 'barangay_admin', barangay_admin_id, firstname::text, lastname::text from public.barangay_admin where auth_user_id = auth.uid()
  union all
  select 'garbage_collector', garbage_collector_id, first_name::text, last_name::text from public.garbage_collector where auth_user_id = auth.uid()
  union all
  select 'resident', resident_id, first_name::text, last_name::text from public.resident where auth_user_id = auth.uid()
$$;

/** Can the signed-in resident see this collector's truck? Only trucks serving their zone. */
create or replace function public.resident_can_see_collector(p_collector integer) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_route_id() is not null and (
    exists (select 1 from public.collection_schedule cs
            where cs.garbage_collector_id = p_collector and cs.route_id = public.my_route_id() and cs.schedule_status = 'Active')
    or exists (select 1 from public.garbage_collector gc
               where gc.garbage_collector_id = p_collector and gc.route_id = public.my_route_id()))
$$;

/** Truck positions for the resident's Truck map (latest ping per collector, last 12 hours). */
create or replace function public.resident_trucks()
returns table (garbage_collector_id int, first_name text, plate_number text,
               latitude double precision, longitude double precision, recorded_at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (gc.garbage_collector_id)
         gc.garbage_collector_id, gc.first_name::text, t.plate_number::text,
         lh.latitude::double precision, lh.longitude::double precision, lh."timestamp"
  from public.garbage_collector gc
  join public.location_history lh on lh.garbage_collector_id = gc.garbage_collector_id
  left join public.truck t on t.truck_id = gc.truck_id
  where public.resident_can_see_collector(gc.garbage_collector_id)
    and lh."timestamp" > now() - interval '12 hours'
  order by gc.garbage_collector_id, lh."timestamp" desc
$$;

revoke all on function public.resident_trucks() from public, anon;
grant execute on function public.resident_trucks() to authenticated;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ---------- Self sign-up = resident only ----------
-- Accounts made by the Edge Function / seed script carry
-- app_metadata.provisioned_by = 'ecollect_admin' (only settable with the service key);
-- they get their staff row from that code instead.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  existing integer;
begin
  if coalesce(new.raw_app_meta_data ->> 'provisioned_by', '') = 'ecollect_admin' then
    return new;
  end if;

  -- A resident row imported from the old system (no login yet) is adopted, not duplicated.
  select resident_id into existing from public.resident
   where lower(email) = lower(new.email) and auth_user_id is null limit 1;
  if existing is not null then
    update public.resident set auth_user_id = new.id where resident_id = existing;
    return new;
  end if;

  insert into public.resident (email, first_name, last_name, contact_number, home_address, route_id, auth_user_id)
  values (
    new.email,
    left(coalesce(nullif(btrim(m ->> 'first_name'), ''), 'Resident'), 50),
    left(coalesce(nullif(btrim(m ->> 'last_name'), ''), ''), 50),
    left(nullif(btrim(m ->> 'contact_number'), ''), 20),
    nullif(btrim(m ->> 'home_address'), ''),
    (select r.route_id from public.route r where r.route_id::text = m ->> 'route_id'),
    new.id
  );
  return new;
end $$;

drop trigger if exists ecollect_on_auth_user_created on auth.users;
create trigger ecollect_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Supabase Auth saves app_metadata in a second step when an admin creates a login,
-- so the insert trigger above cannot see "provisioned_by" yet and makes a resident row.
-- When the staff marker arrives, remove that automatic resident row again
-- (only if it was never used: no reports, never edited).
create or replace function public.handle_provisioned_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provisioned_by', '') = 'ecollect_admin'
     and coalesce(old.raw_app_meta_data ->> 'provisioned_by', '') <> 'ecollect_admin' then
    delete from public.resident r
     where r.auth_user_id = new.id
       and r.created_at > now() - interval '10 minutes'
       and not exists (select 1 from public.feedback_report f where f.resident_id = r.resident_id);
  end if;
  return new;
end $$;

drop trigger if exists ecollect_on_auth_user_provisioned on auth.users;
create trigger ecollect_on_auth_user_provisioned
  after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_provisioned_auth_user();

-- ---------- Columns only the system may change ----------
-- Requests from the website/app run as "authenticated"; trusted code (SQL functions,
-- the Edge Function, the SQL Editor) runs as another role and is allowed through.
create or replace function public.api_request() returns boolean
language sql stable as $$ select current_user in ('authenticated', 'anon') $$;

create or replace function public.guard_identity() returns trigger
language plpgsql as $$
begin
  if public.api_request() and (new.email is distinct from old.email or new.auth_user_id is distinct from old.auth_user_id) then
    raise exception 'The email and login of an account can only be changed by an LGU or Barangay Admin through account management.';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['lgu_admin', 'barangay_admin', 'garbage_collector', 'resident'] loop
    execute format('drop trigger if exists guard_identity on public.%I', t);
    execute format('create trigger guard_identity before update on public.%I for each row execute function public.guard_identity()', t);
  end loop;
end $$;

-- Residents may edit their own profile, but not move another resident's data around.
create or replace function public.guard_resident_update() returns trigger
language plpgsql as $$
begin
  if public.api_request() and new.resident_id is distinct from old.resident_id then
    raise exception 'Not allowed.';
  end if;
  return new;
end $$;
drop trigger if exists guard_resident_update on public.resident;
create trigger guard_resident_update before update on public.resident for each row execute function public.guard_resident_update();

-- Feedback: residents create reports; the Barangay Admin may only change the status.
create or replace function public.guard_feedback() returns trigger
language plpgsql as $$
begin
  -- Statuses are stored in one spelling, whatever the client sent ('pending' -> 'Pending').
  new.status := case lower(btrim(coalesce(new.status, '')))
    when '' then 'Pending' when 'pending' then 'Pending' when 'in progress' then 'In Progress'
    when 'resolved' then 'Resolved' when 'dismissed' then 'Dismissed' when 'closed' then 'Closed'
    else btrim(new.status) end;
  if tg_op = 'INSERT' then
    if public.api_request() then
      new.status := 'Pending';
      new.created_at := now();
      new.lgu_admin_id := null;
    end if;
  elsif public.api_request() and (
        new.resident_id is distinct from old.resident_id or new.report_type is distinct from old.report_type
     or new.description is distinct from old.description or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude or new.created_at is distinct from old.created_at) then
    raise exception 'Only the status of a resident report can be changed.';
  end if;
  return new;
end $$;
drop trigger if exists guard_feedback on public.feedback_report;
create trigger guard_feedback before insert or update on public.feedback_report for each row execute function public.guard_feedback();

-- GPS and pickups use the server clock, never the phone's.
create or replace function public.stamp_location() returns trigger
language plpgsql as $$
begin
  if public.api_request() then
    new."timestamp" := now();
  end if;
  if new.latitude is null or new.longitude is null or abs(new.latitude) > 90 or abs(new.longitude) > 180 then
    raise exception 'Invalid location.';
  end if;
  return new;
end $$;
drop trigger if exists stamp_location on public.location_history;
create trigger stamp_location before insert on public.location_history for each row execute function public.stamp_location();

create or replace function public.stamp_pickup() returns trigger
language plpgsql as $$
begin
  if public.api_request() then
    new.completed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists stamp_pickup on public.pickup_log;
create trigger stamp_pickup before insert on public.pickup_log for each row execute function public.stamp_pickup();

-- ---------- Row-level security ----------
alter table public.lgu_admin             enable row level security;
alter table public.barangay_admin        enable row level security;
alter table public.truck                 enable row level security;
alter table public.route                 enable row level security;
alter table public.waste_category        enable row level security;
alter table public.garbage_collector     enable row level security;
alter table public.resident              enable row level security;
alter table public.collection_point      enable row level security;
alter table public.collection_point_zone enable row level security;
alter table public.collection_schedule   enable row level security;
alter table public.pickup_log            enable row level security;
alter table public.location_history      enable row level security;
alter table public.announcement          enable row level security;
alter table public.feedback_report       enable row level security;
alter table public.emergency_collection  enable row level security;
alter table public.reports               enable row level security;


-- Admin accounts: visible to admins (names on records); each person sees their own row.
create policy lgu_read on public.lgu_admin for select to authenticated using (public.is_admin() or auth_user_id = auth.uid());
create policy brgy_read on public.barangay_admin for select to authenticated using (public.is_admin() or auth_user_id = auth.uid());
create policy brgy_lgu_update on public.barangay_admin for update to authenticated using (public.is_lgu()) with check (public.is_lgu());

-- Trucks: LGU manages; admins and collectors read.
create policy truck_read on public.truck for select to authenticated using (public.is_admin() or public.my_collector_id() is not null);
create policy truck_insert on public.truck for insert to authenticated with check (public.is_lgu());
create policy truck_update on public.truck for update to authenticated using (public.is_lgu()) with check (public.is_lgu());
create policy truck_delete on public.truck for delete to authenticated using (public.is_lgu());

-- Zones: anyone may read (the sign-up screen lists them). Only the Barangay Admin edits,
-- and only through update_zone_route() (03_logic.sql), so there is no update policy here.
create policy route_read on public.route for select to anon, authenticated using (true);

-- Waste categories: everyone signed in reads; Barangay Admin manages.
create policy wc_read on public.waste_category for select to authenticated using (true);
create policy wc_insert on public.waste_category for insert to authenticated with check (public.is_barangay());
create policy wc_update on public.waste_category for update to authenticated using (public.is_barangay()) with check (public.is_barangay());
create policy wc_delete on public.waste_category for delete to authenticated using (public.is_barangay());

-- Collectors: admins read; a collector reads their own row; Barangay Admin edits zone/truck/name.
-- (Accounts are created and deleted by the manage-staff Edge Function.)
create policy gc_read on public.garbage_collector for select to authenticated using (public.is_admin() or auth_user_id = auth.uid());
create policy gc_update on public.garbage_collector for update to authenticated using (public.is_barangay()) with check (public.is_barangay());

-- Residents: admins read; a resident reads and edits their own profile.
create policy res_read on public.resident for select to authenticated using (public.is_admin() or auth_user_id = auth.uid());
create policy res_update_self on public.resident for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Fixed schedule: everyone signed in reads. Changes go through update_collection_point().
create policy cp_read on public.collection_point for select to authenticated using (true);
create policy cpz_read on public.collection_point_zone for select to authenticated using (true);
create policy cs_read on public.collection_schedule for select to authenticated using (true);

-- Pickups: admins read all; a resident reads their zone's; a collector manages their own,
-- only for schedules assigned to them, and only around today (Philippine time).
create policy pl_read on public.pickup_log for select to authenticated using (
  public.is_admin() or garbage_collector_id = public.my_collector_id()
  or exists (select 1 from public.collection_schedule cs where cs.collection_schedule_id = pickup_log.collection_schedule_id and cs.route_id = public.my_route_id()));
create policy pl_insert on public.pickup_log for insert to authenticated with check (
  garbage_collector_id = public.my_collector_id()
  and pickup_date between (now() at time zone 'Asia/Manila')::date - 1 and (now() at time zone 'Asia/Manila')::date
  and exists (select 1 from public.collection_schedule cs where cs.collection_schedule_id = pickup_log.collection_schedule_id
              and cs.garbage_collector_id = public.my_collector_id() and cs.schedule_status = 'Active'));
create policy pl_delete on public.pickup_log for delete to authenticated using (
  garbage_collector_id = public.my_collector_id()
  and pickup_date >= (now() at time zone 'Asia/Manila')::date - 1);

-- GPS: a collector sends their own; admins and the collector read. Residents use resident_trucks().
create policy lh_insert on public.location_history for insert to authenticated with check (garbage_collector_id = public.my_collector_id());
create policy lh_read on public.location_history for select to authenticated using (public.is_admin() or garbage_collector_id = public.my_collector_id());

-- Announcements: everyone signed in reads; a Barangay Admin posts, and edits or deletes only their own.
create policy ann_read on public.announcement for select to authenticated using (true);
create policy ann_insert on public.announcement for insert to authenticated with check (public.is_barangay() and barangay_admin_id = public.my_barangay_id() and lgu_admin_id is null);
create policy ann_update on public.announcement for update to authenticated
  using (public.is_barangay() and barangay_admin_id = public.my_barangay_id())
  with check (public.is_barangay() and barangay_admin_id = public.my_barangay_id() and lgu_admin_id is null);
create policy ann_delete on public.announcement for delete to authenticated using (public.is_barangay() and barangay_admin_id = public.my_barangay_id());

-- Resident reports: admins read all; residents read and send their own; Barangay Admin sets status.
create policy fb_read on public.feedback_report for select to authenticated using (public.is_admin() or resident_id = public.my_resident_id());
create policy fb_insert on public.feedback_report for insert to authenticated with check (resident_id = public.my_resident_id());
create policy fb_update on public.feedback_report for update to authenticated using (public.is_barangay()) with check (public.is_barangay());

-- Emergency collections: admins and the assigned collector read; Barangay Admin manages.
create policy em_read on public.emergency_collection for select to authenticated using (public.is_admin() or garbage_collector_id = public.my_collector_id());
create policy em_insert on public.emergency_collection for insert to authenticated with check (public.is_barangay());
create policy em_update on public.emergency_collection for update to authenticated using (public.is_barangay()) with check (public.is_barangay());

-- Report log: both admins read and save; only the LGU removes entries.
create policy rep_read on public.reports for select to authenticated using (public.is_admin());
create policy rep_insert on public.reports for insert to authenticated with check (
  (public.is_lgu() and lgu_admin_id = public.my_lgu_id() and barangay_admin_id is null)
  or (public.is_barangay() and barangay_admin_id = public.my_barangay_id() and lgu_admin_id is null));
create policy rep_delete on public.reports for delete to authenticated using (public.is_lgu());

-- Nothing is readable without signing in, except the zone list.
revoke all on all tables in schema public from anon;
grant select on public.route to anon;

-- Tell the API about the changes.
notify pgrst, 'reload schema';
