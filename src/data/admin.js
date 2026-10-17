import { supabase, must } from '../lib/supabase';
import { parsePath } from '../utils/route';
import { minutesSince } from '../utils/schedule';

/** All rows of a table, optionally sorted. */
export async function list(table, orderBy, ascending = true) {
  let q = supabase.from(table).select('*');
  if (orderBy) q = q.order(orderBy, { ascending });
  return must(await q);
}

export async function insertRow(table, row) {
  const rows = must(await supabase.from(table).insert(row).select());
  return rows?.[0];
}

/** RLS can silently match 0 rows, so we ask for the changed rows back and complain if none. */
export async function updateRow(table, idCol, id, patch) {
  const rows = must(await supabase.from(table).update(patch).eq(idCol, id).select());
  if (!rows?.length) throw new Error('Nothing was changed — your account may not be allowed to edit this.');
  return rows[0];
}

export async function deleteRow(table, idCol, id) {
  const rows = must(await supabase.from(table).delete().eq(idCol, id).select());
  if (!rows?.length) throw new Error('Nothing was deleted — your account may not be allowed to remove this.');
}

export async function countRows(table, filter) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const res = await q;
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export const fullName = (r, first = 'first_name', last = 'last_name') => `${r?.[first] ?? ''} ${r?.[last] ?? ''}`.trim();

/** Latest known position of every collector who shared in the last `hours` hours. */
export async function liveTrucks(hours = 3) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const [pings, collectors, trucks] = await Promise.all([
    supabase.from('location_history').select('*').gte('timestamp', since).order('timestamp', { ascending: false }).limit(500),
    supabase.from('garbage_collector').select('*'),
    supabase.from('truck').select('*'),
  ]);
  const col = Object.fromEntries(must(collectors).map((c) => [c.garbage_collector_id, c]));
  const trk = Object.fromEntries(must(trucks).map((t) => [t.truck_id, t]));
  const seen = new Set();
  const out = [];
  for (const p of must(pings)) {
    if (seen.has(p.garbage_collector_id)) continue;      // rows are newest-first
    seen.add(p.garbage_collector_id);
    const c = col[p.garbage_collector_id];
    const minutes = minutesSince(p.timestamp);
    out.push({
      id: p.garbage_collector_id,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      minutes_ago: minutes,
      name: c ? fullName(c) : `Collector ${p.garbage_collector_id}`,
      plate: trk[c?.truck_id]?.plate_number ?? null,
    });
  }
  return out;
}

export async function routesWithPaths() {
  const rows = await list('route', 'zone_name');
  return rows.map((r) => ({ ...r, points: parsePath(r.path_coordinates) }));
}
