// Collector app: full-screen map of Barangay Poblacion with today's truck stops and the truck itself.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getDay, getEmergencies, getMapData } from '../data/collector';
import { useApi } from '../hooks';
import { Button } from '../components/ui';
import { colors, radius, shadow, status as STATUS, type } from '../theme';
import { fmtRange } from '../utils/schedule';
import { GpsPill, openInMaps } from './parts';
import { mapHtml } from './mapHtml';
import { distanceM } from './arrival';

async function loadMap() {
  const [map, day, ems] = await Promise.all([getMapData(), getDay().catch(() => null), getEmergencies().catch(() => null)]);
  const todays = day?.stops ?? [];
  const today = new Map(todays.map((s, i) => [s.id, { ...s, order: i + 1 }]));
  const next = todays.find((s) => s.state !== 'done' && s.state !== 'missed') ?? null;
  const stops = map.stops.map((s) => {
    const t = today.get(s.id);
    return {
      ...s,
      state: t ? t.state : 'off',
      order: t?.order ?? null,
      next: next?.id === s.id,
      when: t ? `Today ${fmtRange(s.start, s.end)}` : `${String(s.days ?? '').split(',').map((d) => d.trim().slice(0, 3)).join(', ')} ${fmtRange(s.start, s.end)}`,
      url: s.maps_url || `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`,
    };
  });
  // Open emergency pickups that have a map location (today/overdue in red, later days outlined)
  const phToday = ems?.today;
  const emergencies = (ems?.list ?? []).filter((e) => (e.status === 'Scheduled' || e.status === 'In progress') && e.lat != null).map((e) => ({
    id: e.id, lat: e.lat, lng: e.lng, location: e.location, reason: e.reason, later: e.date > phToday,
    when: `${e.date === phToday ? 'Today' : e.date} ${e.end ? fmtRange(e.start, e.end) : `from ${fmtRange(e.start)}`}`,
    url: `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`,
  }));
  return { zones: map.zones, stops, emergencies, next: next ? stops.find((s) => s.id === next.id) ?? null : null, todayCount: todays.length };
}

const LEGEND = [['done', 'Done'], ['now', 'Now'], ['upcoming', 'Later'], ['missed', 'Not collected']];
const EM_RED = '#c2412d';
const metres = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m away` : `${(m / 1000).toFixed(1)} km away`);

function RoundButton({ icon, label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
        marginBottom: 10, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, shadow.raised]}>
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

export default function CollectorRouteScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { data, error, loading, reload } = useApi(loadMap, { pollMs: 120000 });
  const web = useRef(null);
  const [readyFor, setReadyFor] = useState(null);   // which page (html) reported it is ready
  const [pos, setPos] = useState(null);
  const lastMoved = useRef(null);   // last position at least 8 m away, for the truck's direction
  const [heading, setHeading] = useState(null);
  const top = insets.top + 8;
  const mapInsets = useMemo(() => ({ top: top + 64, bottom: 196 }), [top]);
  // Build the page once per data set (zones and stops change rarely); positions are pushed in.
  const html = useMemo(() => (data ? mapHtml(data, mapInsets) : null), [data, mapInsets]);
  const ready = readyFor !== null && readyFor === html;
  const js = (code) => web.current?.injectJavaScript(`${code}; true;`);

  // The phone's own position while this screen is open.
  useFocusEffect(useCallback(() => {
    let sub = null, alive = true;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted || !alive) return;
      const last = await Location.getLastKnownPositionAsync();
      if (last && alive) setPos(last.coords);
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 5 }, (p) => setPos(p.coords));
      if (!alive) sub.remove();
    })().catch(() => {});
    return () => { alive = false; sub?.remove(); };
  }, []));

  // Direction of travel: the phone's own heading when moving, else worked out from the last 8 m moved.
  useEffect(() => {
    if (!pos) return;
    const prev = lastMoved.current;
    if (!prev) { lastMoved.current = pos; return; }
    if (distanceM(prev.latitude, prev.longitude, pos.latitude, pos.longitude) < 8) return;
    const r = Math.PI / 180;
    const y = Math.sin((pos.longitude - prev.longitude) * r) * Math.cos(pos.latitude * r);
    const x = Math.cos(prev.latitude * r) * Math.sin(pos.latitude * r) - Math.sin(prev.latitude * r) * Math.cos(pos.latitude * r) * Math.cos((pos.longitude - prev.longitude) * r);
    setHeading(pos.heading != null && pos.heading >= 0 && (pos.speed ?? 0) > 1 ? pos.heading : ((Math.atan2(y, x) / r) + 360) % 360);
    lastMoved.current = pos;
  }, [pos]);

  useEffect(() => {
    if (ready && pos) web.current?.injectJavaScript(`window.setMe && window.setMe(${pos.latitude}, ${pos.longitude}, false, ${heading ?? 'null'}); true;`);
  }, [ready, pos, heading]);

  // Opened from an emergency pickup ("Show on the map"): zoom to its pin once the map is ready.
  const focusEm = route?.params?.focusEmergency;
  useEffect(() => {
    if (!ready || !focusEm) return;
    web.current?.injectJavaScript(`window.focusEmergency && window.focusEmergency(${Number(focusEm)}); true;`);
    navigation?.setParams({ focusEmergency: undefined });
  }, [ready, focusEm, navigation]);

  const onMessage = (e) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.ready) setReadyFor(html);
      if (m.open && /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.app\.goo\.gl\//.test(m.open)) Linking.openURL(m.open).catch(() => {});
    } catch { /* ignore */ }
  };

  const next = data?.next;
  const away = next && pos ? distanceM(pos.latitude, pos.longitude, next.lat, next.lng) : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#eef1ed' }}>
      {html ? (
        <WebView
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://ecollect.app/' }}
          onMessage={onMessage}
          javaScriptEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(req) => req.url.startsWith('https://ecollect.app') || req.url === 'about:blank'}
          style={{ flex: 1, backgroundColor: '#eef1ed' }}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {loading ? <ActivityIndicator size="large" color={colors.primary} /> : (
            <>
              <Text style={[type.heading, { textAlign: 'center' }]}>Couldn’t load the map</Text>
              <Text style={[type.small, { textAlign: 'center', marginVertical: 8 }]}>{error}</Text>
              <Button title="Try again" variant="ghost" onPress={reload} style={{ paddingHorizontal: 28 }} />
            </>
          )}
        </View>
      )}

      {/* Title bar floating over the map */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top, left: 12, right: 12 }}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 14 }, shadow.raised]}>
          <View style={{ flex: 1 }}>
            <Text style={type.overline}>Barangay Poblacion</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Map</Text>
          </View>
          <GpsPill />
        </View>
      </View>

      {/* Map buttons */}
      <View pointerEvents="box-none" style={{ position: 'absolute', right: 12, top: top + 78 }}>
        <RoundButton icon="scan-outline" label="Show the whole barangay" onPress={() => js('window.fitAll && window.fitAll()')} disabled={!ready} />
        <RoundButton icon="locate" label="Show me on the map" disabled={!ready || !pos}
          onPress={() => pos && js(`window.setMe && window.setMe(${pos.latitude}, ${pos.longitude}, true, ${heading ?? 'null'})`)} />
      </View>

      {/* Next stop and key */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14 }, shadow.raised]}>
          {next ? (
            <>
              <Text style={[type.overline, { color: colors.primary }]}>Next stop</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }} numberOfLines={1}>{next.name}</Text>
                  <Text style={type.small} numberOfLines={1}>{fmtRange(next.start, next.end)}</Text>
                  {away !== null ? <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginTop: 1 }}>{metres(away)}</Text> : null}
                </View>
                <Pressable onPress={() => js(`window.focusStop && window.focusStop(${next.id})`)} accessibilityRole="button" accessibilityLabel="Show the stop on the map"
                  style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 8, opacity: pressed ? 0.7 : 1 })}>
                  <Ionicons name="eye-outline" size={21} color={colors.primaryDark} />
                </Pressable>
                <Pressable onPress={() => openInMaps(next)} accessibilityRole="button" accessibilityLabel="Directions in Google Maps"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, backgroundColor: colors.primary, paddingHorizontal: 14, opacity: pressed ? 0.8 : 1 })}>
                  <Ionicons name="navigate" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 6 }}>Go</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={[type.body, { fontWeight: '700' }]}>{data?.todayCount ? 'All of today’s stops are finished.' : 'No truck stops for you today.'}</Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
            {LEGEND.map(([k, label]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS[k].fg, marginRight: 5 }} />
                <Text style={{ fontSize: 12.5, color: colors.muted, fontWeight: '600' }}>{label}</Text>
              </View>
            ))}
            {data?.emergencies?.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: EM_RED, alignItems: 'center', justifyContent: 'center', marginRight: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>!</Text>
                </View>
                <Text style={{ fontSize: 12.5, color: colors.muted, fontWeight: '600' }}>Emergency</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ width: 8, height: 12, borderRadius: 2, backgroundColor: colors.primary, marginRight: 5 }} />
              <Text style={{ fontSize: 12.5, color: colors.muted, fontWeight: '600' }}>You</Text>
            </View>
          </View>
          <Text style={{ fontSize: 11.5, color: colors.faint, marginTop: 2 }}>Dashed zone areas are approximate until the barangay confirms them.</Text>
        </View>
      </View>
    </View>
  );
}
