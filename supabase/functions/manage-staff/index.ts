// Supabase Edge Function: manage-staff
// Lets the signed-in LGU admin create / delete logins for barangay admins and garbage
// collectors, and set their passwords. Creating auth users needs the service-role key,
// which must never ship in the app — so it lives here, and every call first checks that
// the caller really is an LGU admin.
//
// Deploy:  supabase functions deploy manage-staff
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (status: number, error: string) => json({ error }, status);

// The only roles the LGU admin may create. (LGU admin and resident are deliberately absent.)
const ROLES: Record<string, { table: string; id: string; first: string; last: string; extras: string[] }> = {
  barangay_admin: { table: 'barangay_admin', id: 'barangay_admin_id', first: 'firstname', last: 'lastname', extras: [] },
  garbage_collector: { table: 'garbage_collector', id: 'garbage_collector_id', first: 'first_name', last: 'last_name', extras: ['truck_id', 'route_id'] },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const intOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isInteger(Number(v)) ? Number(v) : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'Use POST.');

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) Who is calling?
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: userData } = await caller.auth.getUser();
    const user = userData?.user;
    if (!user) return fail(401, 'Please log in again.');

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    // 2) Are they the LGU admin?
    const { data: lgu, error: lguErr } = await admin.from('lgu_admin').select('lgu_admin_id').eq('auth_user_id', user.id).maybeSingle();
    if (lguErr) return fail(500, lguErr.message);
    if (!lgu) return fail(403, 'Only the LGU admin can manage staff accounts.');

    // 3) What do they want?
    const body = await req.json().catch(() => ({}));
    const cfg = ROLES[String(body.role)];
    if (!cfg) return fail(400, 'Staff accounts can only be for barangay admins or garbage collectors.');

    if (body.action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const first = String(body.first_name ?? '').trim();
      const last = String(body.last_name ?? '').trim();
      if (!first || !last) return fail(400, 'First and last name are required.');
      if (!EMAIL_RE.test(email)) return fail(400, 'Enter a valid email address.');
      if (password.length < 8) return fail(400, 'Password must be at least 8 characters.');

      // A row added before this feature (no login yet) can be adopted instead of duplicated.
      const { data: existing, error: exErr } = await admin.from(cfg.table).select('*').ilike('email', escapeLike(email)).maybeSingle();
      if (exErr) return fail(500, exErr.message);
      if (existing?.auth_user_id) return fail(409, 'That email already has an account.');

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { provisioned_by: 'ecollect_admin', staff_role: body.role },
      });
      if (createErr || !created?.user) {
        const msg = createErr?.message ?? 'Could not create the login.';
        return fail(/already|registered|exists/i.test(msg) ? 409 : 400, /already|registered|exists/i.test(msg) ? 'That email already has an account.' : msg);
      }

      const values: Record<string, unknown> = { email, [cfg.first]: first, [cfg.last]: last, auth_user_id: created.user.id };
      for (const k of cfg.extras) values[k] = intOrNull(body[k]);

      const { data: row, error: rowErr } = existing
        ? await admin.from(cfg.table).update(values).eq(cfg.id, existing[cfg.id]).select().single()
        : await admin.from(cfg.table).insert(values).select().single();

      if (rowErr) {
        await admin.auth.admin.deleteUser(created.user.id);   // roll back, so the email stays free
        return fail(400, rowErr.message);
      }
      return json({ ok: true, row });
    }

    // The remaining actions target an existing staff row.
    const id = Number(body.id);
    if (!Number.isInteger(id)) return fail(400, 'Missing account id.');
    const { data: target, error: tErr } = await admin.from(cfg.table).select('*').eq(cfg.id, id).maybeSingle();
    if (tErr) return fail(500, tErr.message);
    if (!target) return fail(404, 'That account no longer exists.');

    if (body.action === 'set_password') {
      const password = String(body.password ?? '');
      if (password.length < 8) return fail(400, 'Password must be at least 8 characters.');
      if (!target.auth_user_id) return fail(400, 'This person has no login yet.');
      const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password });
      if (error) return fail(400, error.message);
      return json({ ok: true });
    }

    if (body.action === 'delete') {
      const { error: delErr } = await admin.from(cfg.table).delete().eq(cfg.id, id);
      if (delErr) {
        return fail(409, /foreign key/i.test(delErr.message) ? 'This record is still used by something else, so it cannot be removed.' : delErr.message);
      }
      if (target.auth_user_id) await admin.auth.admin.deleteUser(target.auth_user_id);
      return json({ ok: true });
    }

    return fail(400, 'Unknown action.');
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : 'Something went wrong.');
  }
});
