import { supabase, explain } from '../lib/supabase';

/**
 * Calls the `manage-staff` Edge Function (supabase/functions/manage-staff).
 * Only the LGU admin is allowed; the function checks that itself.
 *   staffAction('create', { role, email, password, first_name, last_name, truck_id?, route_id? })
 *   staffAction('set_password', { role, id, password })
 *   staffAction('delete', { role, id })
 * role is 'barangay_admin' or 'garbage_collector'.
 */
export async function staffAction(action, payload) {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body: { action, ...payload } });
  if (error) {
    let msg = '';
    try { msg = (await error.context.json())?.error ?? ''; } catch { /* no JSON body */ }
    if (!msg) msg = /not found|404|failed to send|fetch/i.test(error.message)
      ? 'Cannot reach the account service. Has the manage-staff function been deployed?'
      : explain(error);
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function checkPassword(pw) {
  if (!pw || pw.length < 8) throw new Error('Password must be at least 8 characters.');
}
