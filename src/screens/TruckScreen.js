import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { DEFAULT_REGION } from '../config';
import { useApi } from '../hooks';
import { getTrucks } from '../data/resident';
import { Card, Screen, ScreenTitle, StateView } from '../components/ui';
import { colors, radius, type } from '../theme';
import { timeAgo } from '../utils/schedule';

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

export default function TruckScreen() {
  // Refreshes the truck position every 15 seconds while this tab is open.
  const { data, error, loading, reload } = useApi(getTrucks, { pollMs: 15000 });

  const region = useMemo(
    () => regionFor([...(data?.route_path ?? []), ...(data?.trucks ?? [])]),
    [loading] // set once, so the map doesn't jump while you pan it
  );

  const noZone = data && !data.zone_name;

  return (
    <Screen scroll={false}>
      <ScreenTitle sub={data?.zone_name ? `${data.zone_name} · updates every 15 seconds` : undefined}>
        Truck map
      </ScreenTitle>

      <StateView loading={loading} error={error} onRetry={reload} />

      {noZone && (
        <StateView empty emptyTitle="No zone selected" emptyText="Choose your zone in Profile to see your trucks." />
      )}

      {data && !noZone && (
        <>
          <View style={{ flex: 1, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            <MapView style={{ flex: 1 }} initialRegion={region} showsUserLocation>
              {data.route_path.length > 1 && (
                <Polyline coordinates={data.route_path} strokeColor={colors.primary} strokeWidth={4} />
              )}
              {data.trucks.map((t) => (
                <Marker
                  key={t.garbage_collector_id}
                  coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                  title={t.plate_number ? `Truck ${t.plate_number}` : 'Garbage truck'}
                  description={`Updated ${timeAgo(t.minutes_ago)}`}
                  pinColor={colors.primary}
                />
              ))}
            </MapView>
          </View>

          <Card style={{ marginTop: 12, marginBottom: 0 }}>
            {data.trucks.length === 0 ? (
              <Text style={type.small}>
                No truck has shared its location yet. The green line shows the route it follows.
              </Text>
            ) : (
              data.trucks.map((t) => (
                <View key={t.garbage_collector_id} style={{ paddingVertical: 3 }}>
                  <Text style={type.label}>
                    {t.plate_number ? `Truck ${t.plate_number}` : 'Garbage truck'}
                    {t.first_name ? ` · ${t.first_name}` : ''}
                  </Text>
                  <Text style={[type.small, t.minutes_ago > 120 && { color: colors.amber }]}>
                    {t.minutes_ago > 120 ? `Last seen ${timeAgo(t.minutes_ago)}` : `Updated ${timeAgo(t.minutes_ago)}`}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
