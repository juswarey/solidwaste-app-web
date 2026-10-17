import React from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../AuthContext';
import { liveTrucks, routesWithPaths } from '../../data/admin';
import { colors, type } from '../../theme';
import LeafletMap from '../LeafletMap';
import { Badge, Loading, Page, Panel } from '../ui';
import { useLoad } from '../useLoad';
import { timeAgo } from '../../utils/schedule';

const PALETTE = ['#2e7d32', '#1976d2', '#8e24aa', '#00897b', '#6d4c41', '#c2185b'];

export default function LiveMap() {
  const { role, profileId } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const [routes, trucks] = await Promise.all([routesWithPaths(), liveTrucks(3)]);
    return { routes: role === 'barangay_admin' ? routes.filter((r) => r.barangay_admin_id === profileId) : routes, trucks };
  }, [role, profileId], { pollMs: 15000 });

  return (
    <Page title="Live trucks" sub="Updates every 15 seconds while collectors share their location">
      {loading || error ? (
        <Loading error={error} onRetry={reload} />
      ) : (
        <>
          <LeafletMap
            height={520}
            lines={data.routes.map((r, i) => ({ id: r.route_id, color: PALETTE[i % PALETTE.length], points: r.points }))}
            markers={data.trucks.map((t) => ({
              id: t.id, latitude: t.latitude, longitude: t.longitude,
              label: `${t.name}${t.plate ? ` · ${t.plate}` : ''} — ${timeAgo(t.minutes_ago)}`,
              color: t.minutes_ago <= 10 ? '#2e7d32' : '#f57c00',
            }))}
          />
          <Panel style={{ marginTop: 16 }}>
            {data.trucks.length === 0 ? (
              <Text style={type.small}>No truck has shared its location in the last 3 hours.</Text>
            ) : (
              data.trucks.map((t) => (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={type.body}>{t.name}{t.plate ? ` · ${t.plate}` : ''}</Text>
                  <Badge text={`${t.minutes_ago <= 10 ? 'Live' : 'Last seen'} ${timeAgo(t.minutes_ago)}`} tone={t.minutes_ago <= 10 ? 'green' : 'amber'} />
                </View>
              ))
            )}
          </Panel>
          <Text style={[type.small, { color: colors.muted }]}>Each colored line is a zone’s collection route.</Text>
        </>
      )}
    </Page>
  );
}
