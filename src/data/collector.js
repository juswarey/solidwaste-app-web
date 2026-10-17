import { supabase, must, currentUserId } from '../lib/supabase';
import { DAYS, fmtDate, todayStr } from '../utils/schedule';
import { parsePath } from '../utils/route';

export async function getCollector() {
  const uid = await currentUserId();
  const c = must(await supabase.from('garbage_collector').select('*').eq('auth_user_id', uid).maybeSingle());
  if (!c) throw new Error('Collector profile not found.');
  return c;
}

async function lookups() {
  const [cats, routes] = await Promise.all([
    supabase.from('waste_category').select('waste_category_id, category_name'),
    supabase.from('route').select('route_id, zone_name'),
  ]);
  return {
    cat: Object.fromEntries(must(cats).map((c) => [c.waste_category_id, c.category_name])),
    zone: Object.fromEntries(must(routes).map((r) => [r.route_id, r.zone_name])),
  };
}

async function mySchedules(c) {
  const [rows, look] = await Promise.all([
    supabase.from('collection_schedule').select('*').eq('garbage_collector_id', c.garbage_collector_id).eq('schedule_status', 'Active'),
    lookups(),
  ]);
  return must(rows).map((s) => ({ ...s, category_name: look.cat[s.waste_category_id] ?? null, zone_name: look.zone[s.route_id] ?? null }));
}

export async function getToday() {
  const c = await getCollector();
  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const all = await mySchedules(c);
  const todays = all.filter((s) => s.day_of_week === dayName).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  let doneIds = new Set();
  if (todays.length) {
    const done = must(
      await supabase.from('pickup_log').select('collection_schedule_id')
        .eq('garbage_collector_id', c.garbage_collector_id).eq('pickup_date', todayStr(now))
    );
    doneIds = new Set(done.map((d) => d.collection_schedule_id));
  }
  return {
    name: c.first_name,
    day_name: dayName,
    date: fmtDate(now),
    pickups: todays.map((s) => ({ ...s, done: doneIds.has(s.collection_schedule_id) })),
  };
}

export async function markDone(collectionScheduleId, done) {
  const c = await getCollector();
  const date = todayStr();
  must(
    await supabase.from('pickup_log').delete()
      .eq('collection_schedule_id', collectionScheduleId).eq('garbage_collector_id', c.garbage_collector_id).eq('pickup_date', date)
  );
  if (done) {
    must(
      await supabase.from('pickup_log').insert({
        collection_schedule_id: collectionScheduleId,
        garbage_collector_id: c.garbage_collector_id,
        pickup_date: date,
        completed_at: new Date().toISOString(),
      })
    );
  }
}

export async function getCollectorSchedule() {
  const c = await getCollector();
  return mySchedules(c);
}

export async function getCollectorRoute() {
  const c = await getCollector();
  const [sched, route, truck] = await Promise.all([
    mySchedules(c),
    c.route_id ? supabase.from('route').select('*').eq('route_id', c.route_id).maybeSingle() : Promise.resolve({ data: null }),
    c.truck_id ? supabase.from('truck').select('*').eq('truck_id', c.truck_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const r = must(route);
  const onRoute = sched.filter((s) => s.route_id === c.route_id);
  const times = onRoute.map((s) => s).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  return {
    route: r
      ? {
          zone_name: r.zone_name,
          collection_days: r.collection_days || [...new Set(onRoute.map((s) => s.day_of_week))].join(','),
          start_time: r.start_time ?? times[0]?.start_time ?? null,
          end_time: r.end_time ?? times[0]?.end_time ?? null,
        }
      : null,
    route_path: parsePath(r?.path_coordinates),
    truck: must(truck),
  };
}

export async function sendLocation(latitude, longitude) {
  const c = await getCollector();
  must(
    await supabase.from('location_history').insert({
      garbage_collector_id: c.garbage_collector_id,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    })
  );
}
