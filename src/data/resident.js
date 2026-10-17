import { supabase, must, currentUserId } from '../lib/supabase';
import { minutesSince, todayStr } from '../utils/schedule';
import { parsePath } from '../utils/route';

export const REPORT_TYPES = ['Missed collection', 'Illegal dumping', 'Overflowing bin', 'Truck concern', 'Suggestion', 'Other'];

/** Zones shown on the sign-up screen (readable before login). */
export async function getZones() {
  return must(await supabase.from('route').select('route_id, zone_name').order('zone_name'));
}

export async function getMe() {
  const uid = await currentUserId();
  const me = must(await supabase.from('resident').select('*').eq('auth_user_id', uid).maybeSingle());
  if (!me) throw new Error('Resident profile not found.');
  return me;
}

export async function saveMe(f) {
  const uid = await currentUserId();
  const row = must(
    await supabase
      .from('resident')
      .update({
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        contact_number: f.contact_number?.trim() || null,
        home_address: f.home_address?.trim() || null,
        route_id: f.route_id ?? null,
      })
      .eq('auth_user_id', uid)
      .select()
      .maybeSingle()
  );
  if (!row) throw new Error('Could not save your profile.');
  return row;
}

/** Home screen: the resident's zone + its weekly schedule. */
export async function getSchedule() {
  const me = await getMe();
  if (!me.route_id) return { zone: null, schedules: [] };

  const [zone, rows, cats, done] = await Promise.all([
    supabase.from('route').select('route_id, zone_name').eq('route_id', me.route_id).maybeSingle(),
    supabase.from('collection_schedule').select('*').eq('route_id', me.route_id).eq('schedule_status', 'Active'),
    supabase.from('waste_category').select('waste_category_id, category_name'),
    supabase.from('pickup_log').select('collection_schedule_id').eq('pickup_date', todayStr()),
  ]);
  const catName = Object.fromEntries(must(cats).map((c) => [c.waste_category_id, c.category_name]));
  const doneIds = new Set(must(done).map((d) => d.collection_schedule_id));

  const schedules = must(rows)
    .map((s) => ({ ...s, category_name: catName[s.waste_category_id] ?? null, collected_today: doneIds.has(s.collection_schedule_id) }))
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  return { zone: must(zone), schedules };
}

export async function getAnnouncements() {
  return must(await supabase.from('announcement').select('*').order('published_timestamp', { ascending: false }));
}

export async function getWasteCategories() {
  return must(await supabase.from('waste_category').select('*').order('category_name'));
}

export async function getFeedback() {
  const me = await getMe();
  const reports = must(
    await supabase.from('feedback_report').select('*').eq('resident_id', me.resident_id).order('created_at', { ascending: false })
  );
  return { types: REPORT_TYPES, reports };
}

export async function sendFeedback({ report_type, description, latitude, longitude }) {
  const me = await getMe();
  must(
    await supabase.from('feedback_report').insert({
      resident_id: me.resident_id,
      report_type,
      description,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      status: 'pending',
      lgu_admin_id: null,
    })
  );
}

/** Truck map: route line + the trucks serving the resident's zone (needs supabase/step3_extras.sql). */
export async function getTrucks() {
  const me = await getMe();
  if (!me.route_id) return { zone_name: null, route_path: [], trucks: [] };

  const [route, trucks] = await Promise.all([
    supabase.from('route').select('*').eq('route_id', me.route_id).maybeSingle(),
    supabase.rpc('resident_trucks'),
  ]);
  const r = must(route);
  return {
    zone_name: r?.zone_name ?? null,
    route_path: parsePath(r?.path_coordinates),
    trucks: (must(trucks) ?? []).map((t) => ({
      garbage_collector_id: t.garbage_collector_id,
      first_name: t.first_name,
      plate_number: t.plate_number,
      latitude: Number(t.latitude),
      longitude: Number(t.longitude),
      minutes_ago: minutesSince(t.recorded_at),
    })),
  };
}
