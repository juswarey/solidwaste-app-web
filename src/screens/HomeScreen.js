import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../AuthContext';
import { useApi } from '../hooks';
import { getSchedule } from '../data/resident';
import { Button, Card, Screen, StateView } from '../components/ui';
import { colors, radius, type } from '../theme';
import { fmtRange, nextPickup } from '../utils/schedule';

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen({ navigation }) {
  const { name } = useAuth();
  const { data, error, loading, refreshing, reload, pull } = useApi(getSchedule);

  const schedules = data?.schedules ?? [];
  const next = useMemo(() => (schedules.length ? nextPickup(schedules) : null), [data]);
  const byDay = WEEK.map((d) => ({ day: d, rows: schedules.filter((s) => s.day_of_week === d) })).filter((g) => g.rows.length);
  const noZone = data && !data.zone;

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <View style={{ flex: 1 }}>
          <Text style={type.small}>{greeting()}{name ? `, ${name}` : ''}</Text>
          <Text style={type.title}>{data?.zone?.zone_name ?? 'Your schedule'}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={12} accessibilityLabel="Profile">
          <Ionicons name="person-circle-outline" size={34} color={colors.primary} />
        </Pressable>
      </View>

      <StateView loading={loading} error={error} onRetry={reload} />

      {noZone && !loading && !error && (
        <Card>
          <Text style={[type.heading, { marginBottom: 6 }]}>Choose your zone</Text>
          <Text style={[type.small, { marginBottom: 14 }]}>
            We need to know which zone your home is in to show your pickup days.
          </Text>
          <Button title="Choose zone" onPress={() => navigation.navigate('Profile')} />
        </Card>
      )}

      {data?.zone && schedules.length === 0 && (
        <Card>
          <Text style={[type.heading, { marginBottom: 6 }]}>No pickups scheduled yet</Text>
          <Text style={type.small}>
            Your barangay hasn’t published a schedule for {data.zone.zone_name}. Pull down to check again.
          </Text>
        </Card>
      )}

      {next && (
        <View style={{ backgroundColor: colors.primary, borderRadius: radius.lg, padding: 22, marginBottom: 22 }}>
          <Text style={{ color: '#cfe8d0', fontSize: 14, fontWeight: '600' }}>Next pickup</Text>
          <Text style={{ color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>
            {next.label}
          </Text>
          <Text style={{ color: '#e8f5e9', fontSize: 16, marginTop: 2 }}>{next.dateText}</Text>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 16 }} />
          {next.items.map((s) => (
            <View key={s.collection_schedule_id} style={{ marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                {s.category_name || 'General waste'}
                {next.label === 'Today' && s.collected_today ? '  ✓ Collected' : ''}
              </Text>
              <Text style={{ color: '#cfe8d0', fontSize: 14 }}>{fmtRange(s.start_time, s.end_time)}</Text>
            </View>
          ))}
        </View>
      )}

      {byDay.length > 0 && <Text style={[type.heading, { marginBottom: 10 }]}>Every week</Text>}
      {byDay.map((g) => (
        <Card key={g.day}>
          <Text style={[type.label, { marginBottom: 8 }]}>{g.day}</Text>
          {g.rows.map((s) => (
            <View key={s.collection_schedule_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={[type.body, { flex: 1 }]}>{s.category_name || 'General waste'}{s.collected_today ? '  ✓ Collected today' : ''}</Text>
              <Text style={type.small}>{fmtRange(s.start_time, s.end_time)}</Text>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
