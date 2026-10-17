-- =====================================================================
-- ECollect  |  Step 3: extras for the new React Native app + admin website
-- Run ONCE in Supabase -> SQL Editor, AFTER step 2 (login + RLS). Safe to re-run.
--
-- Residents may not read the garbage_collector table (RLS), but the truck map
-- needs each truck's plate number, driver first name and latest position.
-- This function returns exactly that — only for trucks serving the signed-in
-- resident's own zone.
-- =====================================================================

create or replace function public.resident_trucks()
returns table (
  garbage_collector_id int,
  first_name text,
  plate_number text,
  latitude double precision,
  longitude double precision,
  recorded_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select distinct on (gc.garbage_collector_id)
         gc.garbage_collector_id,
         gc.first_name::text,
         t.plate_number::text,
         lh.latitude::double precision,
         lh.longitude::double precision,
         lh."timestamp"::timestamptz as recorded_at
  from public.garbage_collector gc
  join public.location_history lh on lh.garbage_collector_id = gc.garbage_collector_id
  left join public.truck t on t.truck_id = gc.truck_id
  where public.my_route_id() is not null
    and public.resident_can_see_collector(gc.garbage_collector_id)
    and lh."timestamp" > now() - interval '12 hours'
  order by gc.garbage_collector_id, lh."timestamp" desc
$$;

revoke all on function public.resident_trucks() from public, anon;
grant execute on function public.resident_trucks() to authenticated;
