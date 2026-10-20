// Collector app: announcements from the barangay (read-only). New ones since the last visit are marked.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAnnouncements } from '../data/collector';
import { useApi } from '../hooks';
import { Card, Screen, StateView } from '../components/ui';
import { colors, radius, type } from '../theme';
import { fmtDateTime } from '../utils/schedule';
import { IconCircle } from './parts';
import { useCollectorServices } from './CollectorServices';

export default function CollectorAnnouncementsScreen() {
  const { data, error, loading, refreshing, reload, pull } = useApi(getAnnouncements);
  const { markRead } = useCollectorServices();
  const [seenBefore, setSeenBefore] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem('ecollect-announcements-seen').then((v) => setSeenBefore(Number(v) || 0)).catch(() => setSeenBefore(0));
  }, []);
  useEffect(() => {
    if (data?.length && seenBefore !== null) markRead(Math.max(...data.map((a) => a.announcement_id)));
  }, [data, seenBefore, markRead]);
  return (
    <Screen refreshing={refreshing} onRefresh={pull} style={{ paddingTop: 12 }}>
      <StateView loading={loading} error={error} onRetry={reload}
        empty={data && data.length === 0} emptyTitle="No announcements" emptyText="Announcements from your barangay appear here." />
      {(data ?? []).map((a) => {
        const isNew = seenBefore !== null && a.announcement_id > seenBefore;
        return (
          <Card key={a.announcement_id} style={isNew ? { borderColor: colors.primaryMid, borderWidth: 1.5 } : null}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <IconCircle name="megaphone-outline" size={38} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type.heading, { flex: 1, fontSize: 17 }]}>{a.title}</Text>
                  {isNew ? (
                    <View style={{ backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>NEW</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[type.small, { marginTop: 2, marginBottom: 8 }]}>
                  {fmtDateTime(a.published_timestamp)}{a.expiry_date ? ` · until ${a.expiry_date}` : ''}
                </Text>
                <Text style={[type.body, { fontSize: 15.5 }]}>{a.content}</Text>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
