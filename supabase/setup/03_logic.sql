set client_min_messages = warning;
-- =====================================================================
-- ECollect | Supabase setup 3 of 4: rules and actions
-- Run after 02_security.sql. Safe to re-run.
--   * Exactly 10 permanent zones (no add / rename / delete).
--   * Fixed schedule: truck stops drive the zones' days and times and the
--     per-zone schedule rows the mobile apps read.
--   * Actions the website calls (supabase.rpc): update_collection_point,
--     set_fixed_crew, update_zone_route, app_clock.
--   * Emergency collection checks.
-- =====================================================================

-- ---------- Clock (Philippine time; the database itself runs in UTC) ----------
create or replace function public.ph_now() returns timestamp
language sql stable as $$ select (now() at time zone 'Asia/Manila') $$;

create or replace function public.ph_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Manila')::date $$;

/** The website uses the server's clock, so a wrong PC clock cannot change "today". */
create or replace function public.app_clock() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'date', to_char(public.ph_now(), 'YYYY-MM-DD'),
    'time', to_char(public.ph_now(), 'HH24:MI:SS'),
    'now',  to_char(public.ph_now(), 'YYYY-MM-DD HH24:MI:SS'),
    'day',  trim(to_char(public.ph_now(), 'Day')))
$$;
grant execute on function public.app_clock() to anon, authenticated;

-- ---------- The 10 permanent zones ----------
-- To deliberately change zones (e.g. after an official re-zoning), run in the SQL Editor:
--   set ecollect.allow_zone_change = 'on';   ...your change...;   reset ecollect.allow_zone_change;
create or replace function public.zone_change_allowed() returns boolean
language sql stable as $$ select coalesce(current_setting('ecollect.allow_zone_change', true), '') = 'on' $$;

create or replace function public.route_lock() returns trigger
language plpgsql as $$
begin
  if public.zone_change_allowed() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Zones are permanent: Barangay Poblacion has exactly 10 zones. New zones cannot be added.';
  elsif tg_op = 'DELETE' then
    raise exception 'Zones are permanent: Barangay Poblacion has exactly 10 zones. Zones cannot be deleted.';
  end if;
  if new.route_id is distinct from old.route_id or new.zone_name is distinct from old.zone_name then
    raise exception 'Zones are permanent: zone names and numbers cannot be changed.';
  end if;
  if public.api_request() then
    raise exception 'Zones can only be changed through the website''s Zones & routes page.';
  end if;
  return new;
end $$;

drop trigger if exists route_lock on public.route;
create trigger route_lock before insert or update or delete on public.route
  for each row execute function public.route_lock();

-- ---------- Helpers ----------
create or replace function public.week_days() returns text[]
language sql immutable as $$ select array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] $$;

/** "Monday, Friday,Junk" -> {Monday,Friday} in week order. */
create or replace function public.days_list(p_csv text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(d order by array_position(public.week_days(), d)), '{}')
  from (select distinct btrim(x) as d from unnest(string_to_array(coalesce(p_csv, ''), ',')) x) s
  where d = any (public.week_days())
$$;

create or replace function public.parse_hhmm(p text) returns time
language sql immutable as $$
  select case when btrim(coalesce(p, '')) ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
              then left(btrim(p), 5)::time end
$$;

/** Raises one error whose lines are the messages (the website shows each line). */
create or replace function public.raise_errors(p_errors text[]) returns void
language plpgsql as $$
begin
  if coalesce(array_length(p_errors, 1), 0) > 0 then
    raise exception using message = array_to_string(p_errors, E'\n'), errcode = 'P0001';
  end if;
end $$;

-- ---------- Fixed schedule ----------
/**
 * Rebuilds what is derived from the truck stops: each served zone's days and
 * time window, and its 'fixed' schedule rows (one per zone per weekday).
 * Never deletes rows: days that no longer apply are set to Inactive.
 */
create or replace function public.fs_sync() returns void
language plpgsql security definer set search_path = public as $$
declare
  z record;
  p record;
  v_days text[];
  v_start time;
  v_end time;
  v_point integer;
  v_crew integer;
  v_any boolean;
  d text;
  v_existing integer;
begin
  select case when count(distinct coalesce(garbage_collector_id, -1)) = 1 then max(garbage_collector_id) end
    into v_crew
    from collection_schedule where schedule_type = 'fixed' and schedule_status = 'Active';

  for z in select route_id, barangay_admin_id, collection_mode from route order by route_id loop
    continue when z.collection_mode = 'drop_off';
    v_days := '{}'; v_start := null; v_end := null; v_point := null; v_any := false;
    for p in
      select cp.* from collection_point cp
      join collection_point_zone cpz on cpz.collection_point_id = cp.collection_point_id
      where cpz.route_id = z.route_id and cp.is_active
      order by cp.start_time nulls last, cp.stop_order, cp.name
    loop
      v_any := true;
      v_days := v_days || public.days_list(p.collection_days);
      if p.start_time is not null and (v_start is null or p.start_time < v_start) then
        v_start := p.start_time; v_point := p.collection_point_id;
      end if;
      if p.end_time is not null and (v_end is null or p.end_time > v_end) then
        v_end := p.end_time;
      end if;
    end loop;
    continue when not v_any;   -- zone not served by a stop: leave it as the admin set it
    v_days := public.days_list(array_to_string(v_days, ','));

    update route set collection_days = nullif(array_to_string(v_days, ','), ''), start_time = v_start, end_time = v_end
     where route_id = z.route_id;

    foreach d in array public.week_days() loop
      select min(collection_schedule_id) into v_existing from collection_schedule
       where schedule_type = 'fixed' and route_id = z.route_id and day_of_week = d;
      if d = any (v_days) then
        if v_existing is not null then
          update collection_schedule set schedule_status = 'Active', start_time = v_start, end_time = v_end, collection_point_id = v_point
           where collection_schedule_id = v_existing;
        else
          insert into collection_schedule (waste_category_id, day_of_week, schedule_status, barangay_admin_id, garbage_collector_id,
                                           route_id, start_time, end_time, schedule_type, collection_point_id, effective_from)
          values (null, d, 'Active', z.barangay_admin_id, v_crew, z.route_id, v_start, v_end, 'fixed', v_point, public.ph_today());
        end if;
      elsif v_existing is not null then
        update collection_schedule set schedule_status = 'Inactive' where collection_schedule_id = v_existing;
      end if;
    end loop;
  end loop;
end $$;
revoke all on function public.fs_sync() from public, anon, authenticated;

/** Website: Collection schedule -> Truck stops -> Edit. Barangay Admin only. */
create or replace function public.update_collection_point(
  p_id integer, p_days text[], p_start text, p_end text, p_standby integer,
  p_landmark text, p_lat numeric, p_lng numeric, p_confirmed boolean,
  p_set_maps boolean default false, p_maps_url text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  cp record;
  errs text[] := '{}';
  v_days text[];
  v_start time := public.parse_hhmm(p_start);
  v_end time := public.parse_hhmm(p_end);
  v_source text;
  v_url text := nullif(btrim(coalesce(p_maps_url, '')), '');
begin
  if not public.is_barangay() then
    raise exception 'Only the Barangay Admin can change the collection schedule.';
  end if;
  select * into cp from collection_point where collection_point_id = p_id;
  if not found then
    raise exception 'That truck stop does not exist.';
  end if;
  v_days := public.days_list(array_to_string(coalesce(p_days, '{}'), ','));
  if 'Sunday' = any (v_days) then errs := array_append(errs, 'There is no collection on Sunday.'); end if;
  if v_start is null or v_end is null then
    errs := array_append(errs, 'Enter the start and end time of the stop.');
  elsif v_end <= v_start then
    errs := array_append(errs, 'The end time must be later than the start time.');
  end if;
  if p_standby is not null and (p_standby < 5 or p_standby > 240) then
    errs := array_append(errs, 'Standby time should be between 5 and 240 minutes.');
  end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and (abs(p_lat - 8.229) > 0.05 or abs(p_lng - 124.236) > 0.05)) then
    errs := array_append(errs, 'The location must be latitude and longitude in Iligan City (latitude first, e.g. 8.2275, 124.2383).');
  end if;
  if p_set_maps and v_url is not null and (
       length(v_url) > 1000
       or v_url !~* '^https://((www\.)?google\.com(\.ph)?/maps|maps\.google\.com/|maps\.app\.goo\.gl/|goo\.gl/maps)'
       or v_url ~ '[\s<>"]') then
    errs := array_append(errs, 'The Google Maps link must be a link copied from Google Maps (google.com/maps or maps.app.goo.gl).');
  end if;
  perform public.raise_errors(errs);

  v_source := cp.location_source;
  if p_lat is not null and (cp.latitude is null or abs(p_lat - cp.latitude) > 1e-7 or abs(p_lng - cp.longitude) > 1e-7) then
    v_source := 'Set by Barangay Admin on ' || to_char(public.ph_today(), 'Mon FMDD, YYYY');
  end if;

  update collection_point set
    landmark = left(btrim(coalesce(p_landmark, '')), 160),
    latitude = p_lat, longitude = p_lng, location_source = v_source,
    location_confirmed = coalesce(p_confirmed, false),
    collection_days = nullif(array_to_string(v_days, ','), ''),
    start_time = v_start, end_time = v_end, standby_minutes = p_standby,
    maps_url = case when p_set_maps then v_url else maps_url end,
    updated_at = now()
  where collection_point_id = p_id;
  perform public.fs_sync();
end $$;
revoke all on function public.update_collection_point(integer, text[], text, text, integer, text, numeric, numeric, boolean, boolean, text) from public, anon;
grant execute on function public.update_collection_point(integer, text[], text, text, integer, text, numeric, numeric, boolean, boolean, text) to authenticated;

/** Website: Collection schedule -> Truck crew. One collector gets every fixed-schedule stop. */
create or replace function public.set_fixed_crew(p_collector integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_barangay() then
    raise exception 'Only the Barangay Admin can assign the truck crew.';
  end if;
  if p_collector is not null and not exists (select 1 from garbage_collector where garbage_collector_id = p_collector) then
    raise exception 'Choose a valid collector.';
  end if;
  update collection_schedule set garbage_collector_id = p_collector where schedule_type = 'fixed';
end $$;
revoke all on function public.set_fixed_crew(integer) from public, anon;
grant execute on function public.set_fixed_crew(integer) to authenticated;

/** Is a zone's schedule controlled by the truck stops (or is it the drop-off zone)? */
create or replace function public.zone_schedule_locked(p_route integer) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from route where route_id = p_route and collection_mode = 'drop_off')
      or exists (select 1 from collection_point_zone where route_id = p_route)
$$;

/**
 * Website: Zones & routes -> Edit route. Barangay Admin only.
 * p_path: [{"latitude":..,"longitude":..}, ...] or null to clear.
 * Days and times are ignored for zones served by truck stops (they follow the stops).
 * Returns warnings (the change is saved).
 */
create or replace function public.update_zone_route(
  p_route_id integer, p_path jsonb, p_days text[] default null, p_start text default null, p_end text default null)
returns text[]
language plpgsql security definer set search_path = public as $$
declare
  z record;
  errs text[] := '{}';
  warns text[] := '{}';
  v_days text[];
  v_start time;
  v_end time;
  v_path jsonb := '[]'::jsonb;
  pt jsonb;
  n integer := 0;
  lat numeric;
  lng numeric;
  r record;
begin
  if not public.is_barangay() then
    raise exception 'Only the Barangay Admin can edit zone routes.';
  end if;
  select * into z from route where route_id = p_route_id;
  if not found then
    raise exception 'That zone does not exist. Zones cannot be added from the web.';
  end if;

  if public.zone_schedule_locked(p_route_id) then
    v_days := public.days_list(z.collection_days); v_start := z.start_time; v_end := z.end_time;
  else
    v_days := public.days_list(array_to_string(coalesce(p_days, '{}'), ','));
    v_start := public.parse_hhmm(p_start); v_end := public.parse_hhmm(p_end);
    if 'Sunday' = any (v_days) then errs := array_append(errs, 'Sunday is not a collection day in Poblacion.'); end if;
    if (nullif(btrim(coalesce(p_start, '')), '') is not null and v_start is null)
       or (nullif(btrim(coalesce(p_end, '')), '') is not null and v_end is null)
       or ((v_start is null) <> (v_end is null)) then
      errs := array_append(errs, 'Enter both a start and an end time, or leave both blank.');
    elsif v_start is not null and v_end <= v_start then
      errs := array_append(errs, 'The end time must be later than the start time.');
    end if;
  end if;

  if p_path is not null and jsonb_typeof(p_path) = 'array' then
    for pt in select * from jsonb_array_elements(p_path) loop
      n := n + 1;
      begin
        lat := (pt ->> 'latitude')::numeric; lng := (pt ->> 'longitude')::numeric;
      exception when others then lat := null; lng := null;
      end;
      if lat is null or lng is null then
        errs := array_append(errs, ('Route point ' || n || ' is not in "latitude,longitude" form.'));
      elsif abs(lat - 8.229) > 0.05 or abs(lng - 124.236) > 0.05 then
        errs := array_append(errs, ('Route point ' || n || ' (' || lat || ', ' || lng || ') is not in Iligan City. Check that latitude comes first.'));
      else
        v_path := v_path || jsonb_build_object('latitude', round(lat, 6), 'longitude', round(lng, 6));
      end if;
    end loop;
    if n = 1 and coalesce(array_length(errs, 1), 0) = 0 then errs := array_append(errs, 'A route needs at least two points.'); end if;
    if n > 500 then errs := array_append(errs, 'A route can have at most 500 points.'); end if;
  elsif p_path is not null and jsonb_typeof(p_path) <> 'null' then
    errs := array_append(errs, 'The route path is not valid.');
  end if;
  perform public.raise_errors(errs);

  for r in select day_of_week, count(*) c from collection_schedule
           where route_id = p_route_id and schedule_status = 'Active' group by day_of_week loop
    if not (r.day_of_week = any (v_days)) then
      warns := array_append(warns, (r.c || ' active schedule(s) on ' || r.day_of_week || ' no longer match this zone''s days. Review them under Collection schedule.')::text);
    end if;
  end loop;

  update route set
    path_coordinates = case when jsonb_array_length(v_path) > 0 then v_path::text end,
    collection_days = nullif(array_to_string(v_days, ','), ''),
    start_time = v_start, end_time = v_end
  where route_id = p_route_id;

  -- The mobile apps read the window from the schedule rows, so keep them in step.
  if v_start is not null then
    update collection_schedule set start_time = v_start, end_time = v_end where route_id = p_route_id;
  end if;
  return warns;
end $$;
revoke all on function public.update_zone_route(integer, jsonb, text[], text, text) from public, anon;
grant execute on function public.update_zone_route(integer, jsonb, text[], text, text) to authenticated;

-- ---------- Emergency collections ----------
create or replace function public.guard_emergency() returns trigger
language plpgsql as $$
declare
  errs text[] := '{}';
begin
  new.location_text := left(btrim(coalesce(new.location_text, '')), 255);
  new.reason := left(btrim(coalesce(new.reason, '')), 255);
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  if public.api_request() then
    if tg_op = 'INSERT' then
      new.created_by := public.my_barangay_id();
      new.status := 'Scheduled';
      new.created_at := now();
      new.completed_at := null;
      if new.collection_date < public.ph_today() then
        errs := array_append(errs, 'An emergency collection cannot be scheduled in the past.');
      end if;
    else
      new.created_by := old.created_by;
      new.created_at := old.created_at;
    end if;
  end if;
  if new.collection_date is null then errs := array_append(errs, 'Choose the collection date.'); end if;
  if new.start_time is null then errs := array_append(errs, 'Enter the start time.'); end if;
  if new.end_time is not null and new.start_time is not null and new.end_time <= new.start_time then
    errs := array_append(errs, 'The end time must be later than the start time, or left blank.');
  end if;
  if new.location_text = '' then errs := array_append(errs, 'Describe where the truck should go (street, landmark or household).'); end if;
  if new.reason = '' then errs := array_append(errs, 'Give the reason for the emergency collection.'); end if;
  if (new.latitude is null) <> (new.longitude is null)
     or (new.latitude is not null and (abs(new.latitude - 8.229) > 0.05 or abs(new.longitude - 124.236) > 0.05)) then
    errs := array_append(errs, 'Map location must be latitude and longitude in Iligan City, or left blank.');
  end if;
  if new.garbage_collector_id is not null and not exists (select 1 from public.garbage_collector where garbage_collector_id = new.garbage_collector_id) then
    errs := array_append(errs, 'Choose a valid collector.');
  end if;
  perform public.raise_errors(errs);

  -- The collector's truck is recorded with the pickup.
  if tg_op = 'INSERT' or new.garbage_collector_id is distinct from old.garbage_collector_id then
    new.truck_id := (select truck_id from public.garbage_collector where garbage_collector_id = new.garbage_collector_id);
  end if;
  if new.status = 'Completed' then
    -- Website: first time it is marked Completed. Data imports keep their own time.
    new.completed_at := case when public.api_request()
                             then coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now())
                             else coalesce(new.completed_at, now()) end;
  else
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_emergency on public.emergency_collection;
create trigger guard_emergency before insert or update on public.emergency_collection
  for each row execute function public.guard_emergency();

-- ---------- Small guards ----------
-- Announcements keep their author and date.
create or replace function public.guard_announcement() returns trigger
language plpgsql as $$
begin
  new.title := btrim(new.title);
  new.content := btrim(new.content);
  if new.title = '' or new.content = '' then
    raise exception 'Enter a title and a message.';
  end if;
  if tg_op = 'UPDATE' and public.api_request() then
    new.barangay_admin_id := old.barangay_admin_id;
    new.lgu_admin_id := old.lgu_admin_id;
    new.published_timestamp := old.published_timestamp;
  elsif tg_op = 'INSERT' and public.api_request() then
    new.published_timestamp := now();
  end if;
  return new;
end $$;
drop trigger if exists guard_announcement on public.announcement;
create trigger guard_announcement before insert or update on public.announcement
  for each row execute function public.guard_announcement();

create or replace function public.guard_names() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'waste_category' then
    new.category_name := btrim(new.category_name);
    if new.category_name = '' then raise exception 'Enter a category name.'; end if;
  elsif tg_table_name = 'truck' then
    new.plate_number := upper(btrim(new.plate_number));
    if new.plate_number = '' then raise exception 'Enter the plate number.'; end if;
    if new.max_capacity_kg is not null and new.max_capacity_kg <= 0 then raise exception 'Maximum load must be more than 0 kg.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_names on public.waste_category;
create trigger guard_names before insert or update on public.waste_category for each row execute function public.guard_names();
drop trigger if exists guard_names on public.truck;
create trigger guard_names before insert or update on public.truck for each row execute function public.guard_names();

-- ---------- Fleet: latest GPS position per collector (admins only) ----------
drop function if exists public.admin_latest_locations();
create or replace function public.admin_latest_locations()
returns table (garbage_collector_id integer, latitude double precision, longitude double precision,
               ping_at timestamptz, minutes_ago integer)
language sql stable security definer set search_path = public as $$
  select distinct on (lh.garbage_collector_id)
         lh.garbage_collector_id, lh.latitude::double precision, lh.longitude::double precision, lh."timestamp",
         greatest(0, floor(extract(epoch from (now() - lh."timestamp")) / 60))::integer
  from location_history lh
  where public.is_admin()
  order by lh.garbage_collector_id, lh.location_history_id desc
$$;
revoke all on function public.admin_latest_locations() from public, anon;
grant execute on function public.admin_latest_locations() to authenticated;

-- Tell the API about the changes.
notify pgrst, 'reload schema';
