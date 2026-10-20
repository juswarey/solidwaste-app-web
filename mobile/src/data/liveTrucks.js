// Live truck positions for the resident app.
//
// How "real time" works:
//   1. The collector's phone inserts a row into location_history about every 10-15 seconds
//      (src/collector/gps.js).
//   2. Supabase Realtime pushes each new row to every resident allowed to see that truck
//      (policy lh_resident_read in supabase/setup/05_resident_live.sql), usually within a second.
//   3. This store updates the truck's position, speed and direction, and the screens redraw.
// If Realtime is blocked or drops (weak signal), the store falls back to re-reading the latest
// positions every 15 seconds, and says "Reconnecting" instead of "Live" so nobody is misled.
//
// One shared store (not one per screen) so the Home card, the Truck map and the
// "truck is near" alerts all see the same data over a single connection.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getTrucks } from './resident';
import { bearing, distanceM, etaMinutes } from '../utils/geo';
import { parseTs, todayStr } from '../utils/schedule';
import { ensurePermission, notifyNow } from '../collector/notify';

/** A truck whose last ping is older than this is shown as "last seen", not live. */
export const FRESH_MS = 3 * 60 * 1000;
const POLL_LIVE_MS = 60000;      // safety net while Realtime is connected
const POLL_OFFLINE_MS = 15000;   // main source when Realtime is not connected
const ALERTS_KEY = 'ecollect-truck-alerts';
const SENT_KEY = 'ecollect-truck-alerts-sent';

// Alert rings around a stop (metres). The first ring a truck is inside fires one alert per stop per day.
const RINGS = [
  { key: 'here', meters: 400, title: 'Garbage truck is almost at your stop' },
  { key: 'near', meters: 1500, title: 'Garbage truck is on the way' },
];

let state = {
  status: 'idle',        // idle | connecting | live | offline
  loaded: false,
  error: '',
  zone_name: null,
  route_path: [],
  stops: [],
  trucks: [],
  tick: 0,
};
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

let users = 0;           // screens/providers currently using the store
let channel = null;
let pollTimer = null;
let appSub = null;
let loading = null;
let alertsOn = true;
let sent = new Set();

// ---------- positions ----------
function withMotion(prev, next) {
  if (!prev || next.recordedAt <= prev.recordedAt) return { ...(prev ?? {}), ...next, recordedAt: Math.max(next.recordedAt, prev?.recordedAt ?? 0) };
  const meters = distanceM(prev, next);
  const secs = (next.recordedAt - prev.recordedAt) / 1000;
  let speedKmh = prev.speedKmh ?? null;
  let heading = prev.heading ?? null;
  if (meters >= 8 && secs >= 2 && secs <= 180) {
    const inst = (meters / secs) * 3.6;
    speedKmh = speedKmh == null ? inst : 0.6 * inst + 0.4 * speedKmh;
    heading = bearing(prev, next);
  } else if (meters < 8 && secs >= 2 && secs <= 180) {
    speedKmh = speedKmh == null ? 0 : speedKmh * 0.5;   // GPS jitter while parked
  }
  return { ...prev, ...next, speedKmh, heading };
}

function mergeSnapshot(list) {
  const old = new Map(state.trucks.map((t) => [t.garbage_collector_id, t]));
  return list.map((t) => withMotion(old.get(t.garbage_collector_id), t));
}

async function load() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const snap = await getTrucks();
      set({
        loaded: true, error: '', zone_name: snap.zone_name, route_path: snap.route_path,
        stops: snap.stops, trucks: mergeSnapshot(snap.trucks),
      });
      checkNearby();
    } catch (e) {
      set({ loaded: true, error: state.trucks.length ? '' : e.message });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

function onPing(row) {
  const id = row.garbage_collector_id;
  const at = parseTs(row.timestamp)?.getTime();
  const next = { garbage_collector_id: id, latitude: Number(row.latitude), longitude: Number(row.longitude), recordedAt: Number.isFinite(at) ? at : Date.now() };
  if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return;
  const known = state.trucks.find((t) => t.garbage_collector_id === id);
  if (!known) { load(); return; }   // a truck we have no name/plate for yet: fetch the full snapshot
  set({ trucks: state.trucks.map((t) => (t.garbage_collector_id === id ? withMotion(t, next) : t)) });
  checkNearby();
}

// ---------- connection ----------
function connect() {
  if (channel) return;
  set({ status: 'connecting' });
  channel = supabase
    .channel('resident-trucks')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_history' }, (p) => onPing(p.new))
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') { set({ status: 'live' }); load(); schedulePoll(); }
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { set({ status: 'offline' }); schedulePoll(); }
    });
}

function schedulePoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    load();
    set({ tick: state.tick + 1 });   // also re-evaluates "fresh / last seen" labels
  }, state.status === 'live' ? POLL_LIVE_MS : POLL_OFFLINE_MS);
}

async function readPrefs() {
  try {
    alertsOn = (await AsyncStorage.getItem(ALERTS_KEY)) !== '0';
    const raw = JSON.parse((await AsyncStorage.getItem(SENT_KEY)) || '[]');
    sent = new Set(raw.filter((k) => k.startsWith(todayStr())));
  } catch { /* defaults */ }
}

/** Start sharing the connection. Call stopLive() when done; calls are counted. */
export function startLive() {
  users += 1;
  if (users > 1) return;
  readPrefs();
  load();
  connect();
  schedulePoll();
  appSub = AppState.addEventListener('change', (st) => {
    if (st === 'active') { load(); if (!channel) connect(); }
  });
}

export function stopLive() {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  clearInterval(pollTimer);
  pollTimer = null;
  appSub?.remove();
  appSub = null;
  if (channel) { supabase.removeChannel(channel); channel = null; }
  set({ status: 'idle', trucks: [], loaded: false });
}

export const reloadLive = () => load();

// ---------- "truck is near your stop" alerts ----------
export async function getTruckAlerts() {
  try { return (await AsyncStorage.getItem(ALERTS_KEY)) !== '0'; } catch { return true; }
}
export async function setTruckAlerts(on) {
  alertsOn = on;
  try { await AsyncStorage.setItem(ALERTS_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (on) ensurePermission().catch(() => {});
}

/** The closest of today's stops in the resident's zone to a truck, with distance and ETA. */
export function nearestStop(truck, stops = state.stops) {
  let best = null;
  for (const s of stops) {
    if (!s.isToday) continue;
    const meters = distanceM(truck, s);
    if (!best || meters < best.meters) best = { stop: s, meters, eta: etaMinutes(meters, truck.speedKmh) };
  }
  return best;
}

function checkNearby() {
  if (!alertsOn) return;
  for (const t of state.trucks) {
    if (Date.now() - t.recordedAt > FRESH_MS) continue;
    const near = nearestStop(t);
    if (!near) continue;
    const ring = RINGS.find((r) => near.meters <= r.meters);
    if (!ring) continue;
    const key = `${todayStr()}|${near.stop.collection_point_id}|${ring.key}`;
    const outer = `${todayStr()}|${near.stop.collection_point_id}|near`;
    if (sent.has(key) || (ring.key === 'near' && sent.has(outer))) continue;
    sent.add(key);
    sent.add(outer);   // an inner alert also counts as the outer one
    AsyncStorage.setItem(SENT_KEY, JSON.stringify([...sent])).catch(() => {});
    notifyNow(
      ring.title,
      `${near.stop.name}: about ${Math.max(1, Math.round(near.meters / 10) * 10)} m away. Get your waste ready.`,
      { kind: 'truck-near', stop: near.stop.collection_point_id },
    );
  }
}

// ---------- React hook ----------
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => state;

/** Live truck data for any resident screen. Keeps the shared connection open while mounted. */
export function useLiveTrucks() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
