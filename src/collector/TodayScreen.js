import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getToday, markDone } from '../data/collector';
import { useApi } from '../hooks';
import { Button, Card, ErrorBanner, Screen, StateView } from '../components/ui';
import { colors, radius, type } from '../theme';
import { fmtRange, fmtTime } from '../utils/schedule';
import { useLocationShare } from './LocationShare';

export default function TodayScreen() {
  const { data, error, loading, refreshing, reload, pull } = useApi(getToday);
  const share = useLocationShare();
  const [busyId, setBusyId] = useState(null);

  const toggleDone = async (item) => {
    setBusyId(item.collection_schedule_id);
    try {
      await markDone(item.collection_schedule_id, !item.done);
      await reload();
    } catch (e) {
      Alert.alert('Couldn’t update', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const pickups = data?.pickups ?? [];
  const doneCount = pickups.filter((p) => p.done).length;
  const sentText = share.lastSentAt
    ? `Last sent ${fmtTime(`${share.lastSentAt.getHours()}:${share.lastSentAt.getMinutes()}:00`)}`
    : 'Waiting for the first GPS reading…';

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <Text style={type.small}>{data ? `${data.day_name}, ${data.date}` : ' '}</Text>
      <Text style={[type.title, { marginBottom: 18 }]}>{data?.name ? `Hi, ${data.name}` : 'Today'}</Text>

      {/* Location sharing: the one thing residents depend on */}
      <View
        style={{
          backgroundColor: share.sharing ? colors.primary : colors.surface,
          borderRadius: radius.lg,
          padding: 20,
          marginBottom: 22,
          borderWidth: share.sharing ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Ionicons name="navigate-circle" size={22} color={share.sharing ? '#fff' : colors.muted} />
          <Text style={{ fontSize: 18, fontWeight: '800', marginLeft: 8, color: share.sharing ? '#fff' : colors.text }}>
            {share.sharing ? 'Sharing your location' : 'Location sharing is off'}
          </Text>
        </View>
        <Text style={{ fontSize: 14, lineHeight: 20, color: share.sharing ? '#dcefdc' : colors.muted, marginBottom: 14 }}>
          {share.sharing
            ? `${sentText}. Residents in your zone can see your truck. Keep this app open.`
            : 'Turn this on when you start your route so residents can see where the truck is.'}
        </Text>
        {share.error ? (
          <View style={{ marginBottom: 12 }}><ErrorBanner message={share.error} /></View>
        ) : null}
        <Pressable
          onPress={share.sharing ? share.stop : share.start}
          style={({ pressed }) => ({
            backgroundColor: share.sharing ? '#fff' : colors.primary,
            borderRadius: radius.md,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: share.sharing ? colors.primaryDark : '#fff' }}>
            {share.sharing ? 'Stop sharing' : 'Start sharing'}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <Text style={type.heading}>Today’s pickups</Text>
        {pickups.length > 0 && <Text style={type.small}>{doneCount} of {pickups.length} done</Text>}
      </View>

      <StateView
        loading={loading} error={error} onRetry={reload}
        empty={data && pickups.length === 0}
        emptyTitle="No pickups today"
        emptyText="Nothing is assigned to you for today. Pull down to check again."
      />

      {pickups.map((p) => (
        <Card key={p.collection_schedule_id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[type.heading, p.done && { color: colors.muted }]}>
                {p.category_name || 'General waste'}
              </Text>
              <Text style={[type.small, { marginTop: 2 }]}>
                {p.zone_name || 'No zone'} · {fmtRange(p.start_time, p.end_time)}
              </Text>
            </View>
            {p.done && <Ionicons name="checkmark-circle" size={26} color={colors.primary} />}
          </View>
          <Button
            title={p.done ? 'Undo' : 'Mark as collected'}
            variant={p.done ? 'ghost' : 'primary'}
            loading={busyId === p.collection_schedule_id}
            onPress={() => toggleDone(p)}
            style={{ marginTop: 14, minHeight: 46, paddingVertical: 11 }}
          />
        </Card>
      ))}
    </Screen>
  );
}
