import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { useApi } from '../hooks';
import { getCollectorRoute } from '../data/collector';
import { Card, Screen, ScreenTitle, StateView } from '../components/ui';
import { colors, radius, type } from '../theme';
import { fmtRange } from '../utils/schedule';
import { regionFor } from '../utils/map';

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={type.small}>{label}</Text>
      <Text style={[type.body, { flexShrink: 1, textAlign: 'right', marginLeft: 12 }]}>{value}</Text>
    </View>
  );
}

export default function CollectorRouteScreen() {
  const { data, error, loading, refreshing, reload, pull } = useApi(getCollectorRoute);
  const region = useMemo(() => regionFor(data?.route_path ?? []), [loading]);

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <ScreenTitle sub="Set by your barangay admin">Route and truck</ScreenTitle>
      <StateView loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          {data.route ? (
            <Card>
              <Text style={[type.heading, { marginBottom: 6 }]}>{data.route.zone_name || 'Your route'}</Text>
              <Row label="Collection days" value={(data.route.collection_days || '—').replace(/,/g, ', ')} />
              <Row label="Time" value={fmtRange(data.route.start_time, data.route.end_time)} />
            </Card>
          ) : (
            <Card>
              <Text style={[type.heading, { marginBottom: 4 }]}>No route assigned</Text>
              <Text style={type.small}>Ask your barangay admin to assign you a route.</Text>
            </Card>
          )}

          {data.route_path.length > 1 && (
            <View style={{ height: 280, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
              <MapView style={{ flex: 1 }} initialRegion={region} showsUserLocation>
                <Polyline coordinates={data.route_path} strokeColor={colors.primary} strokeWidth={4} />
              </MapView>
            </View>
          )}

          {data.truck ? (
            <Card>
              <Text style={[type.heading, { marginBottom: 6 }]}>Your truck</Text>
              <Row label="Plate number" value={data.truck.plate_number || '—'} />
              <Row
                label="Capacity"
                value={data.truck.max_capacity_kg != null ? `${data.truck.max_capacity_kg.toLocaleString('en-US')} kg` : '—'}
              />
            </Card>
          ) : (
            <Card>
              <Text style={[type.heading, { marginBottom: 4 }]}>No truck assigned</Text>
              <Text style={type.small}>Ask your barangay admin to assign you a truck.</Text>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
