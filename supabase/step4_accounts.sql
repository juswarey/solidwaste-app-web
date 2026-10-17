-- =====================================================================
-- ECollect  |  Step 4: account model
--   * Public sign-up can ONLY create a resident.
--   * LGU admin = one seeded default account (see scripts/seed-lgu-admin.mjs).
--   * Barangay admins + garbage collectors are created ONLY by the LGU admin
--     (website -> Edge Function "manage-staff"); one-time sign-up codes are retired.
-- Run ONCE in Supabase -> SQL Editor, AFTER steps 2 and 3, and BEFORE seeding the
-- LGU admin. Safe to re-run.
-- =====================================================================

-- 1) Remove the old "sign up with an invite code" trigger(s) on auth.users.
--    (Only triggers that call a function in the public schema; Supabase's own are untouched.)
do $$
declare t record;
begin
  for t in
    select tg.tgname, p.proname
    from pg_trigger tg
    join pg_proc p on p.oid = tg.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where tg.tgrelid = 'auth.users'::regclass
      and not tg.tgisinternal
      and n.nspname = 'public'
  loop
    execute format('drop trigger %I on auth.users', t.tgname);
    raise notice 'Dropped old auth.users trigger % (function public.%)', t.tgname, t.proname;
  end loop;
end $$;

-- 2) New trigger: every self sign-up becomes a resident. Whatever metadata the
--    client sends can only fill resident fields — it can never grant a staff role.
--    Accounts made by the Edge Function / seed script carry
--    app_metadata.provisioned_by = 'ecollect_admin' (settable only with the service
--    key), and get their staff row from that code instead, so no resident row here.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(new.raw_app_meta_data ->> 'provisioned_by', '') = 'ecollect_admin' then
    return new;
  end if;

  insert into public.resident
    (email, first_name, last_name, contact_number, home_address, route_id, auth_user_id)
  values (
    new.email,
    coalesce(nullif(btrim(m ->> 'first_name'), ''), 'Resident'),
    coalesce(nullif(btrim(m ->> 'last_name'), ''), ''),
    nullif(btrim(m ->> 'contact_number'), ''),
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

-- 3) Retire invite codes: nobody can claim a staff role with a code any more.
do $$
begin
  if to_regprocedure('public.claim_invite(text)') is not null then
    revoke execute on function public.claim_invite(text) from public, anon, authenticated;
  end if;
end $$;

-- New rows must no longer get an auto-generated code.
alter table public.lgu_admin         alter column invite_code drop default;
alter table public.barangay_admin    alter column invite_code drop default;
alter table public.garbage_collector alter column invite_code drop default;

update public.lgu_admin       set invite_code = null where invite_code is not null;
update public.barangay_admin  set invite_code = null where invite_code is not null;
update public.garbage_collector set invite_code = null where invite_code is not null;
