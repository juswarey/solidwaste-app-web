import React from 'react';
import { Text, View } from 'react-native';
import { useApi } from '../hooks';
import { getCollectorSchedule } from '../data/collector';
import { Card, Screen, ScreenTitle, StateView } from '../components/ui';
import { type } from '../theme';
import { fmtRange } from '../utils/schedule';

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function CollectorScheduleScreen() {
  const { data, error, loading, refreshing, reload, pull } = useApi(getCollectorSchedule);
  const groups = WEEK.map((d) => ({ day: d, rows: (data ?? []).filter((s) => s.day_of_week === d) })).filter((g) => g.rows.length);

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <ScreenTitle sub="Your pickups every week">My schedule</ScreenTitle>
      <StateView
        loading={loading} error={error} onRetry={reload}
        empty={data && data.length === 0}
        emptyTitle="No schedule yet"
        emptyText="Your barangay admin hasn’t assigned pickups to you."
      />
      {groups.map((g) => (
        <Card key={g.day}>
          <Text style={[type.label, { marginBottom: 8 }]}>{g.day}</Text>
          {g.rows.map((s) => (
            <View key={s.collection_schedule_id} style={{ paddingVertical: 5 }}>
              <Text style={type.body}>{s.category_name || 'General waste'}</Text>
              <Text style={type.small}>{s.zone_name || 'No zone'} · {fmtRange(s.start_time, s.end_time)}</Text>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
