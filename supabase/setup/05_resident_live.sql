-- ECollect: live truck tracking for residents.
-- Run once in the Supabase SQL editor (safe to run again).
--
-- 1. Residents may read the recent GPS pings of the trucks that serve THEIR zone.
--    Supabase Realtime only delivers rows the signed-in user is allowed to select,
--    so without this policy residents would never receive a live ping.
-- 2. location_history is added to the Realtime publication, so every ping the
--    collector's phone inserts is pushed to the residents' phones within a second.

drop policy if exists lh_resident_read on public.location_history;
create policy lh_resident_read on public.location_history for select to authenticated
  using (public.resident_can_see_collector(garbage_collector_id)
         and "timestamp" > now() - interval '12 hours');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'location_history') then
    alter publication supabase_realtime add table public.location_history;
  end if;
end $$;

-- Speeds up the resident policy and the "latest ping" lookups.
create index if not exists location_history_recent on public.location_history ("timestamp" desc);
