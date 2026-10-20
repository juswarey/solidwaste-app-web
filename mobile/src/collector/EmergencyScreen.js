// Collector app: emergency pickups — what needs action now, what is coming up, and what was recently done.
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEmergencies } from '../data/collector';
import { useApi } from '../hooks';
import { Card, Screen, StateView } from '../components/ui';
import { colors, radius, type } from '../theme';
import { fmtRange, fmtTime } from '../utils/schedule';
import { Header, IconCircle, SectionTitle } from './parts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const open = (e) => e.status === 'Scheduled' || e.status === 'In progress';

/** "Today", "Tomorrow", "Thu, Oct 22" */
export function dayLabel(iso, today) {
  if (iso === today) return 'Today';
  const d = new Date(`${iso}T00:00:00Z`), t = new Date(`${today}T00:00:00Z`);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export const emWindow = (e) => (e.end ? fmtRange(e.start, e.end) : `From ${fmtTime(e.start)}`);
/** Overdue: still open and the day (or today's end time) has passed. */
export function isOverdue(e, today) {
  if (!open(e)) return false;
  if (e.date < today) return true;
  if (e.date > today || !e.end) return false;
  const now = new Date(Date.now() + 8 * 3600000).toISOString().slice(11, 19);
  return now > e.end;
}
export const EM_STYLE = {
  Scheduled: { fg: colors.amber, bg: colors.amberLight, icon: 'time-outline', label: 'Scheduled' },
  'In progress': { fg: colors.blue, bg: colors.blueLight, icon: 'car-outline', label: 'On the way' },
  Completed: { fg: colors.done, bg: colors.doneLight, icon: 'checkmark-circle-outline', label: 'Completed' },
  Cancelled: { fg: colors.faint, bg: colors.surface2, icon: 'close-circle-outline', label: 'Cancelled' },
};

function Row({ e, today, onPress }) {
  const st = EM_STYLE[e.status] ?? EM_STYLE.Scheduled;
  const overdue = isOverdue(e, today);
  const finished = !open(e);
  return (
    <Card onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center' }, overdue ? { borderColor: '#e7b3a9', borderWidth: 1.5 } : null, finished ? { backgroundColor: colors.surface2, shadowOpacity: 0, elevation: 0 } : null]}>
      <IconCircle name={overdue ? 'alert' : st.icon} size={42} color={overdue ? '#fff' : st.fg} bg={overdue ? colors.danger : st.bg} />
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={{ fontSize: 16.5, fontWeight: '800', color: finished ? colors.muted : colors.text }} numberOfLines={2}>{e.location}</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: overdue ? colors.danger : colors.muted, marginTop: 2 }}>
          {dayLabel(e.date, today)} · {emWindow(e)}{overdue ? ' · overdue' : ''}
        </Text>
        <Text style={[type.small, { marginTop: 1 }]} numberOfLines={1}>{e.zone || 'No zone'} · {e.reason}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <View style={{ backgroundColor: st.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ color: st.fg, fontSize: 12, fontWeight: '800' }}>{st.label}</Text>
          </View>
          {e.pending ? <Text style={{ color: colors.amber, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>Saved, sending…</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Card>
  );
}

export default function EmergencyScreen({ navigation }) {
  const { data, error, loading, refreshing, reload, pull } = useApi(getEmergencies, { pollMs: 60000 });
  const today = data?.today;
  const list = data?.list ?? [];
  const now = list.filter((e) => open(e) && e.date <= today);
  const later = list.filter((e) => open(e) && e.date > today);
  const past = list.filter((e) => !open(e)).sort((a, b) => (b.date + (b.start ?? '')).localeCompare(a.date + (a.start ?? '')));
  const go = (e) => navigation.navigate('EmergencyDetail', { id: e.id });

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <Header title="Emergency" sub="Pickups outside the schedule" />
      {data?.offline ? (
        <View style={{ flexDirection: 'row', backgroundColor: colors.amberLight, borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.amber} style={{ marginRight: 8 }} />
          <Text style={{ flex: 1, fontSize: 14.5, color: colors.text }}>No signal. Showing the list saved on this phone.</Text>
        </View>
      ) : null}
      <StateView loading={loading} error={error} onRetry={reload}
        empty={data && list.length === 0} emptyTitle="No emergency pickups"
        emptyText="When your Barangay Admin assigns you an emergency pickup, it appears here and your phone is notified." />

      {data && list.length > 0 && (
        <>
          <SectionTitle right={now.length ? `${now.length} open` : undefined}>Needs action</SectionTitle>
          {now.length ? now.map((e) => <Row key={e.id} e={e} today={today} onPress={() => go(e)} />) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconCircle name="checkmark-done" size={38} color={colors.done} bg={colors.doneLight} />
              <Text style={[type.body, { flex: 1, marginLeft: 12, fontWeight: '600' }]}>Nothing to do right now.</Text>
            </Card>
          )}
          {later.length > 0 && (
            <>
              <SectionTitle>Coming up</SectionTitle>
              {later.map((e) => <Row key={e.id} e={e} today={today} onPress={() => go(e)} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <SectionTitle>Done and cancelled · 14 days</SectionTitle>
              {past.map((e) => <Row key={e.id} e={e} today={today} onPress={() => go(e)} />)}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

export { open as isOpenEmergency };
