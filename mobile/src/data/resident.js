import { supabase, must, currentUserId } from '../lib/supabase';
import { DAYS, parseTs, todayStr } from '../utils/schedule';
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

/**
 * Home screen: the resident's zone + its weekly schedule.
 *
 * The barangay now runs a fixed truck-stop schedule: each Active collection_schedule row
 * (one per zone per weekday, schedule_type 'fixed') points at a collection_point (the stop)
 * and has no waste category. Older / custom rows may still carry a waste category.
 * Zones set to 'drop_off' have no truck pickup at all.
 */
export async function getSchedule() {
  const me = await getMe();
  if (!me.route_id) return { zone: null, dropOff: false, schedules: [] };

  const [zone, rows, cats, points, done] = await Promise.all([
    supabase.from('route').select('route_id, zone_name, collection_mode').eq('route_id', me.route_id).maybeSingle(),
    supabase.from('collection_schedule').select('*').eq('route_id', me.route_id).eq('schedule_status', 'Active'),
    supabase.from('waste_category').select('waste_category_id, category_name'),
    supabase.from('collection_point').select('collection_point_id, name, landmark, standby_minutes, maps_url, latitude, longitude'),
    supabase.from('pickup_log').select('collection_schedule_id').eq('pickup_date', todayStr()),
  ]);
  const catName = Object.fromEntries(must(cats).map((c) => [c.waste_category_id, c.category_name]));
  const pointById = Object.fromEntries(must(points).map((p) => [p.collection_point_id, p]));
  const doneIds = new Set(must(done).map((d) => d.collection_schedule_id));

  const schedules = must(rows)
    .map((s) => ({
      ...s,
      category_name: catName[s.waste_category_id] ?? null,
      stop: pointById[s.collection_point_id] ?? null,
      collected_today: doneIds.has(s.collection_schedule_id),
    }))
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  const z = must(zone);
  return { zone: z, dropOff: z?.collection_mode === 'drop_off', schedules };
}

/** Announcements that have not expired (expiry_date is optional). */
export async function getAnnouncements() {
  return must(
    await supabase
      .from('announcement')
      .select('*')
      .or(`expiry_date.is.null,expiry_date.gte.${todayStr()}`)
      .order('published_timestamp', { ascending: false })
  );
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
      status: 'Pending', // the database also forces this
      lgu_admin_id: null,
    })
  );
}

/**
 * Truck map snapshot: route line, this zone's truck stops, and the latest known position of each
 * truck serving the zone (resident_trucks() in 02_security.sql). The live updates after this
 * snapshot arrive through src/data/liveTrucks.js.
 */
export async function getTrucks() {
  const me = await getMe();
  if (!me.route_id) return { zone_name: null, route_path: [], stops: [], trucks: [] };

  const [route, trucks, sched, points] = await Promise.all([
    supabase.from('route').select('*').eq('route_id', me.route_id).maybeSingle(),
    supabase.rpc('resident_trucks'),
    supabase.from('collection_schedule').select('collection_point_id, day_of_week, start_time, end_time').eq('route_id', me.route_id).eq('schedule_status', 'Active'),
    supabase.from('collection_point').select('collection_point_id, name, landmark, latitude, longitude'),
  ]);
  const r = must(route);
  const pointById = Object.fromEntries(must(points).map((p) => [p.collection_point_id, p]));
  const today = DAYS[new Date().getDay()];
  const stops = must(sched)
    .map((s) => ({ s, p: pointById[s.collection_point_id] }))
    .filter(({ p }) => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
    .map(({ s, p }) => ({
      key: `${p.collection_point_id}-${s.day_of_week}`,
      collection_point_id: p.collection_point_id,
      name: p.name,
      landmark: p.landmark,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      isToday: s.day_of_week === today,
    }));
  return {
    zone_name: r?.zone_name ?? null,
    route_path: parsePath(r?.path_coordinates),
    stops,
    trucks: (must(trucks) ?? []).map((t) => ({
      garbage_collector_id: t.garbage_collector_id,
      first_name: t.first_name,
      plate_number: t.plate_number,
      latitude: Number(t.latitude),
      longitude: Number(t.longitude),
      recordedAt: parseTs(t.recorded_at)?.getTime() ?? 0,
    })),
  };
}
