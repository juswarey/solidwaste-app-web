import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_REGION } from '../config';
import { useNow } from '../hooks';
import { FRESH_MS, nearestStop, reloadLive, useLiveTrucks } from '../data/liveTrucks';
import { Screen, ScreenTitle, StateView } from '../components/ui';
import { colors, radius, shadow, type } from '../theme';
import { fmtDistance } from '../utils/geo';
import { fmtTime } from '../utils/schedule';

const STALE_COLOR = '#8a958f';
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function regionFor(points) {
  if (!points.length) return DEFAULT_REGION;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
  };
}

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} sec ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.floor(h / 24)} day(s) ago`;
}

/** What the truck is doing right now, in words a resident understands. */
function describe(t, now) {
  const age = now - t.recordedAt;
  if (age > FRESH_MS) return { live: false, label: `Last seen ${ago(age)}`, tone: colors.amber };
  const moving = (t.speedKmh ?? 0) >= 3;
  const dir = moving && t.heading != null ? ` ${COMPASS[Math.round(t.heading / 45) % 8]}` : '';
  return {
    live: true,
    label: moving ? `Moving${dir} · ${Math.round(t.speedKmh)} km/h` : 'Stopped / collecting',
    tone: colors.primary,
    updated: ago(age),
  };
}

/** A truck pin that glides to each new position instead of jumping. */
function TruckMarker({ truck, live, onPress }) {
  const ref = useRef(null);
  const start = useRef({ latitude: truck.latitude, longitude: truck.longitude });
  useEffect(() => {
    ref.current?.animateMarkerToCoordinate?.({ latitude: truck.latitude, longitude: truck.longitude }, 1500);
  }, [truck.latitude, truck.longitude]);
  return (
    <Marker
      ref={ref}
      coordinate={start.current}
      title={truck.plate_number ? `Truck ${truck.plate_number}` : 'Garbage truck'}
      pinColor={live ? colors.primary : STALE_COLOR}
      zIndex={10}
      onPress={onPress}
    />
  );
}

function StatusPill({ status }) {
  const m = {
    live: { label: 'Live', bg: colors.doneLight, fg: colors.done, dot: colors.done },
    connecting: { label: 'Connecting…', bg: colors.amberLight, fg: colors.amber, dot: colors.amber },
    offline: { label: 'Reconnecting', bg: colors.amberLight, fg: colors.amber, dot: colors.amber },
    idle: { label: 'Offline', bg: colors.surface2, fg: colors.muted, dot: colors.faint },
  }[status] ?? { label: '', bg: colors.surface2, fg: colors.muted, dot: colors.faint };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: m.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.dot, marginRight: 6 }} />
      <Text style={{ color: m.fg, fontSize: 12, fontWeight: '800' }}>{m.label}</Text>
    </View>
  );
}

function RoundButton({ icon, active, onPress, label }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: 44, height: 44, borderRadius: 22, marginBottom: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? colors.primary : colors.surface, ...shadow.raised,
      }}
    >
      <Ionicons name={icon} size={22} color={active ? colors.onPrimary : colors.primary} />
    </Pressable>
  );
}

export default function TruckScreen() {
  const live = useLiveTrucks();
  const now = useNow(5000);
  const mapRef = useRef(null);
  const [follow, setFollow] = useState(null);   // garbage_collector_id of the truck being followed

  const { trucks, stops, route_path: path } = live;
  const noZone = live.loaded && !live.zone_name;
  const todays = useMemo(() => stops.filter((s) => s.isToday), [stops]);

  // Set once, so the map doesn't jump while you pan it.
  const region = useMemo(
    () => regionFor([...path, ...stops, ...trucks]),
    [live.loaded] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const followed = trucks.find((t) => t.garbage_collector_id === follow);
  useEffect(() => {
    if (followed) mapRef.current?.animateCamera?.({ center: { latitude: followed.latitude, longitude: followed.longitude } }, { duration: 900 });
  }, [followed?.latitude, followed?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitAll = useCallback(() => {
    setFollow(null);
    const pts = [...trucks, ...todays].map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (pts.length) mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: true });
  }, [trucks, todays]);

  const focus = (t) => {
    setFollow(t.garbage_collector_id);
    mapRef.current?.animateCamera?.({ center: { latitude: t.latitude, longitude: t.longitude }, zoom: 16 }, { duration: 700 });
  };

  const anyLive = trucks.some((t) => now - t.recordedAt <= FRESH_MS);

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <ScreenTitle sub={live.zone_name ? `${live.zone_name} · positions update as the truck moves` : undefined}>Truck map</ScreenTitle>
        </View>
        {live.zone_name ? <View style={{ marginTop: 8 }}><StatusPill status={live.status} /></View> : null}
      </View>

      <StateView loading={!live.loaded} error={live.error} onRetry={reloadLive} />

      {noZone && (
        <StateView empty emptyTitle="No zone selected" emptyText="Choose your zone in Profile to see your trucks." />
      )}

      {live.loaded && !noZone && !live.error && (
        <>
          <View style={{ flex: 1, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={region}
              showsUserLocation
              onPanDrag={() => follow && setFollow(null)}
            >
              {path.length > 1 && <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={4} />}
              {stops.map((s) => (
                <Marker
                  key={s.key}
                  coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                  title={s.name}
                  description={`${s.day_of_week} ${fmtTime(s.start_time)}${s.isToday ? ' · today' : ''}`}
                  pinColor={s.isToday ? colors.blue : '#b8c4bd'}
                  opacity={s.isToday ? 1 : 0.6}
                />
              ))}
              {trucks.map((t) => (
                <TruckMarker
                  key={t.garbage_collector_id}
                  truck={t}
                  live={now - t.recordedAt <= FRESH_MS}
                  onPress={() => setFollow(t.garbage_collector_id)}
                />
              ))}
            </MapView>

            <View style={{ position: 'absolute', right: 10, top: 10 }}>
              <RoundButton icon="scan-outline" label="Show all" onPress={fitAll} />
              {trucks.length > 0 && (
                <RoundButton
                  icon={follow ? 'navigate' : 'navigate-outline'}
                  label="Follow truck"
                  active={!!follow}
                  onPress={() => (follow ? setFollow(null) : focus(trucks[0]))}
                />
              )}
            </View>
          </View>

          <View style={{ marginTop: 12, maxHeight: 210 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {trucks.length === 0 ? (
                <View style={cardStyle}>
                  <Text style={type.label}>No truck is sharing its location</Text>
                  <Text style={[type.small, { marginTop: 4 }]}>
                    This map moves by itself the moment a collector starts their shift. The green line is the route and the blue pins are today’s stops.
                  </Text>
                </View>
              ) : (
                trucks.map((t) => {
                  const d = describe(t, now);
                  const near = nearestStop(t, stops);
                  const isFollowed = follow === t.garbage_collector_id;
                  return (
                    <Pressable key={t.garbage_collector_id} onPress={() => focus(t)} style={[cardStyle, isFollowed && { borderColor: colors.primary }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
                          {t.plate_number ? `Truck ${t.plate_number}` : 'Garbage truck'}{t.first_name ? ` · ${t.first_name}` : ''}
                        </Text>
                        <Text style={{ color: d.tone, fontWeight: '800', fontSize: 12 }}>{d.live ? 'LIVE' : 'OFFLINE'}</Text>
                      </View>
                      <Text style={[type.small, { color: d.tone, marginTop: 2 }]}>
                        {d.label}{d.updated ? ` · updated ${d.updated}` : ''}
                      </Text>
                      {d.live && near ? (
                        <Text style={[type.small, { marginTop: 4, color: colors.text }]}>
                          {near.meters < 120
                            ? `At ${near.stop.name}`
                            : `${fmtDistance(near.meters)} from ${near.stop.name} · about ${near.eta} min`}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
          {!anyLive && trucks.length > 0 && (
            <Text style={[type.small, { marginTop: 6, textAlign: 'center' }]}>
              No live signal right now. The pin shows where the truck was last seen.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

const cardStyle = {
  backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
  padding: 12, marginBottom: 8,
};
