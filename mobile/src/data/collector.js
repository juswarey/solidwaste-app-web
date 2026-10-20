// Collector app data. Everything goes to Supabase; the server clock decides "today".
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, must, explain, currentUserId } from '../lib/supabase';
import { cachedDay, cachedEmergencies, emergenciesWithPending, flushOutbox, isOffline, runAction, saveDay, saveEmergencies, withPending } from '../collector/offline';
import { parsePath } from '../utils/route';

const ME_KEY = 'ecollect-collector';

/** This login's collector row (cached for the GPS task, which runs without the screens). */
export async function getCollector() {
  const uid = await currentUserId();
  const c = must(await supabase.from('garbage_collector')
    .select('garbage_collector_id, first_name, last_name, email, route_id, truck_id, truck(plate_number, max_capacity_kg), route(zone_name)')
    .eq('auth_user_id', uid).maybeSingle());
  if (!c) throw new Error('Collector profile not found. Ask your Barangay Admin to check your account.');
  try { await AsyncStorage.setItem(ME_KEY, JSON.stringify({ id: c.garbage_collector_id, uid })); } catch { /* ignore */ }
  return c;
}

/** Collector id from the cache (used by the background GPS task). */
export async function cachedCollectorId() {
  try {
    const raw = await AsyncStorage.getItem(ME_KEY);
    if (raw) return JSON.parse(raw).id ?? null;
  } catch { /* ignore */ }
  return null;
}

/**
 * Today's work: { date, day, time, me, stops[], other[], emergencies[], shift, missed_reasons[] }.
 * stops[]: { id, name, landmark, lat, lng, maps_url, start, end, standby, state, done_at, missed_at,
 *            missed_reason, note, load, zones[] }   state: 'upcoming' | 'now' | 'late' | 'done' | 'missed'
 * Without signal: the last day loaded, with the taps not yet sent shown on it (offline: true).
 */
export async function getDay() {
  await flushOutbox().catch(() => null);
  const res = await supabase.rpc('collector_day');
  if (res.error) {
    if (!isOffline(res.error)) throw new Error(explain(res.error));
    const cached = await withPending(await cachedDay());
    if (!cached) throw new Error('No signal, and today\'s work has not been loaded on this phone yet. Try again when you have signal.');
    return { ...cached, offline: true };
  }
  await saveDay(res.data);
  return withPending(res.data);
}

/** One truck stop: 'done' (load 1-4 optional), 'missed' (reason, note) or 'undo'. Works offline. */
export async function stopAction(stop, action, { load = null, reason = null, note = null } = {}) {
  const label = action === 'done' ? `Done at ${stop.name}` : action === 'missed' ? `Couldn't collect at ${stop.name}` : `Undo at ${stop.name}`;
  return runAction({ kind: 'stop', point: stop.id, action, load, reason, note: note || null, label });
}

/** Start or end my shift. Works offline. */
export async function shiftAction(action) {
  return runAction({ kind: 'shift', action, label: action === 'start' ? 'Start shift' : 'End shift' });
}

/** Pickups that no truck stop covers (older schedules): mark one done or undo. */
export async function markOther(scheduleId, done, date) {
  const c = await getCollector();
  if (done) {
    must(await supabase.from('pickup_log').insert({ collection_schedule_id: scheduleId, garbage_collector_id: c.garbage_collector_id, pickup_date: date }));
  } else {
    must(await supabase.from('pickup_log').delete().eq('collection_schedule_id', scheduleId).eq('pickup_date', date));
  }
}

/** Emergency collection: 'In progress' | 'Completed' | 'Scheduled'. Works offline. */
export async function setEmergencyStatus(em, status) {
  return runAction({ kind: 'emergency', id: em.id, status, label: `${status}: ${em.location}` });
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const daysOf = (csv) => String(csv ?? '').split(',').map((d) => d.trim()).filter(Boolean);

/**
 * My week: for each weekday, the truck stops that serve one of my zones.
 * [{ day, stops: [{ id, name, start, end, standby, zones: ['Zone 1', ...] }] }]
 */
export async function getWeek() {
  const c = await getCollector();
  const [sched, points, links, routes] = await Promise.all([
    supabase.from('collection_schedule').select('route_id, day_of_week, schedule_type')
      .eq('garbage_collector_id', c.garbage_collector_id).eq('schedule_status', 'Active'),
    supabase.from('collection_point').select('collection_point_id, name, landmark, collection_days, start_time, end_time, standby_minutes, stop_order, is_active'),
    supabase.from('collection_point_zone').select('collection_point_id, route_id'),
    supabase.from('route').select('route_id, zone_name, collection_mode'),
  ]);
  const mine = must(sched);
  const zoneName = Object.fromEntries(must(routes).map((r) => [r.route_id, r.zone_name]));
  const zoneNo = (id) => Number(String(zoneName[id] ?? '').replace(/\D/g, '')) || 99;
  const servedBy = {};
  for (const l of must(links)) (servedBy[l.collection_point_id] ??= []).push(l.route_id);
  const days = WEEK.map((day) => {
    const myZones = new Set(mine.filter((s) => s.day_of_week === day && s.schedule_type === 'fixed').map((s) => s.route_id));
    const stops = must(points)
      .filter((p) => p.is_active && daysOf(p.collection_days).includes(day) && (servedBy[p.collection_point_id] ?? []).some((z) => myZones.has(z)))
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)) || a.stop_order - b.stop_order)
      .map((p) => ({
        id: p.collection_point_id, name: p.name, landmark: p.landmark, start: p.start_time, end: p.end_time, standby: p.standby_minutes,
        zones: (servedBy[p.collection_point_id] ?? []).sort((a, b) => zoneNo(a) - zoneNo(b)).map((z) => zoneName[z]).filter(Boolean),
      }));
    return { day, stops };
  });
  const dropOff = must(routes).filter((r) => r.collection_mode === 'drop_off').map((r) => r.zone_name);
  return { days, dropOff, assigned: mine.length > 0 };
}

/** Everything the map needs: zone areas, truck stops (with today's state when given), my last GPS point. */
export async function getMapData() {
  const [routes, points, links] = await Promise.all([
    supabase.from('route').select('route_id, zone_name, boundary_coordinates, path_coordinates'),
    supabase.from('collection_point').select('collection_point_id, name, landmark, latitude, longitude, maps_url, collection_days, start_time, end_time, is_active'),
    supabase.from('collection_point_zone').select('collection_point_id, route_id'),
  ]);
  const zoneName = Object.fromEntries(must(routes).map((r) => [r.route_id, r.zone_name]));
  const servedBy = {};
  for (const l of must(links)) (servedBy[l.collection_point_id] ??= []).push(zoneName[l.route_id]);
  return {
    zones: must(routes).map((r) => ({
      id: r.route_id, name: r.zone_name,
      area: parsePath(r.boundary_coordinates).map((p) => [p.latitude, p.longitude]),
      path: parsePath(r.path_coordinates).map((p) => [p.latitude, p.longitude]),
    })),
    stops: must(points).filter((p) => p.is_active && p.latitude != null).map((p) => ({
      id: p.collection_point_id, name: p.name, landmark: p.landmark, lat: Number(p.latitude), lng: Number(p.longitude),
      maps_url: p.maps_url, days: p.collection_days, start: p.start_time, end: p.end_time,
      zones: (servedBy[p.collection_point_id] ?? []).filter(Boolean),
    })),
  };
}

export const REPORT_TYPES = ['Blocked road', 'Truck breakdown', 'Truck full', 'Overflowing pile', 'Residents not ready', 'Other'];

/** "Report a problem": sent to the Barangay Admin's dashboard. Works offline. Returns { queued }. */
export async function sendFieldReport({ type, description, pointId, latitude, longitude }) {
  const id = (await cachedCollectorId()) ?? (await getCollector()).garbage_collector_id;
  return runAction({
    kind: 'report', label: `Report: ${type}`,
    row: { garbage_collector_id: id, report_type: type, description: description || null,
           collection_point_id: pointId ?? null, latitude: latitude ?? null, longitude: longitude ?? null },
  });
}

/** My recent field reports with their status (the Barangay Admin updates it). */
export async function getMyFieldReports() {
  const c = await getCollector();
  return must(await supabase.from('field_report').select('field_report_id, report_type, description, status, created_at, collection_point(name)')
    .eq('garbage_collector_id', c.garbage_collector_id).order('created_at', { ascending: false }).limit(10));
}

/** Account: change my own password (checks the current one first). */
export async function changePassword(email, current, next) {
  if (next.length < 8) throw new Error('The new password must be at least 8 characters.');
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) throw new Error('Your current password is not correct.');
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(error.message);
}

/** GPS position (also used by the background task). */
export async function sendLocation(latitude, longitude, collectorId = null) {
  const id = collectorId ?? (await cachedCollectorId()) ?? (await getCollector()).garbage_collector_id;
  must(await supabase.from('location_history').insert({ garbage_collector_id: id, latitude, longitude }));
}

/** My last two weeks: [{ date, day, stops[], emergencies[], shifts[] }], newest first. */
export async function getHistory(days = 14) {
  return must(await supabase.rpc('collector_history', { p_days: days })) ?? [];
}

/** Barangay announcements that have not expired, newest first. */
export async function getAnnouncements() {
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  return must(await supabase.from('announcement').select('announcement_id, title, content, published_timestamp, expiry_date')
    .or(`expiry_date.is.null,expiry_date.gte.${today}`).order('published_timestamp', { ascending: false }).limit(30));
}

/** This phone receives notifications for this account (Expo push token). */
export async function registerPushToken(token) {
  must(await supabase.rpc('collector_register_push', { p_token: token }));
}
export async function unregisterPushToken(token) {
  await supabase.rpc('collector_unregister_push', { p_token: token });
}

/** Philippine date as YYYY-MM-DD, n days from today. */
const phDate = (n = 0) => new Date(Date.now() + 8 * 3600000 + n * 86400000).toISOString().slice(0, 10);

/**
 * My emergency pickups: everything still open (any date) plus those finished or cancelled in the last 14 days.
 * [{ id, date, start, end, location, reason, notes, lat, lng, zone, status, created_at, completed_at, updated_at }]
 * Without signal: the list last loaded, with saved taps shown on it (offline: true on the result).
 */
export async function getEmergencies() {
  await flushOutbox().catch(() => null);
  const id = (await cachedCollectorId()) ?? (await getCollector()).garbage_collector_id;
  const res = await supabase.from('emergency_collection')
    .select('emergency_collection_id, collection_date, start_time, end_time, location_text, reason, notes, latitude, longitude, status, created_at, updated_at, completed_at, route(zone_name)')
    .eq('garbage_collector_id', id)
    .or(`status.in.(Scheduled,"In progress"),collection_date.gte.${phDate(-14)}`)
    .order('collection_date', { ascending: true }).order('start_time', { ascending: true });
  if (res.error) {
    if (!isOffline(res.error)) throw new Error(explain(res.error));
    const cached = await cachedEmergencies();
    if (!cached) throw new Error('No signal, and the emergency pickups have not been loaded on this phone yet.');
    return { list: await emergenciesWithPending(cached), offline: true, today: phDate() };
  }
  const list = res.data.map((e) => ({
    id: e.emergency_collection_id, date: e.collection_date, start: e.start_time, end: e.end_time, location: e.location_text,
    reason: e.reason, notes: e.notes, lat: e.latitude != null ? Number(e.latitude) : null, lng: e.longitude != null ? Number(e.longitude) : null,
    zone: e.route?.zone_name ?? null, status: e.status, created_at: e.created_at, updated_at: e.updated_at, completed_at: e.completed_at,
  }));
  await saveEmergencies(list);
  return { list: await emergenciesWithPending(list), offline: false, today: phDate() };
}

/** Number of my emergency pickups that need action now (today or overdue, not finished). */
export async function countOpenEmergencies() {
  const id = (await cachedCollectorId()) ?? (await getCollector().catch(() => null))?.garbage_collector_id;
  if (!id) return null;
  const { count, error } = await supabase.from('emergency_collection').select('emergency_collection_id', { count: 'exact', head: true })
    .eq('garbage_collector_id', id).in('status', ['Scheduled', 'In progress']).lte('collection_date', phDate());
  return error ? null : count ?? 0;
}
