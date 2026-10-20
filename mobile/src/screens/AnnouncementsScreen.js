import React from 'react';
import { Text } from 'react-native';
import { useApi } from '../hooks';
import { getAnnouncements } from '../data/resident';
import { Card, Screen, ScreenTitle, StateView } from '../components/ui';
import { type } from '../theme';
import { fmtDateTime } from '../utils/schedule';

export default function AnnouncementsScreen() {
  const { data, error, loading, refreshing, reload, pull } = useApi(getAnnouncements);

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <ScreenTitle sub="From your barangay office">Announcements</ScreenTitle>
      <StateView
        loading={loading} error={error} onRetry={reload}
        empty={data && data.length === 0}
        emptyTitle="Nothing new"
        emptyText="Announcements will appear here when your LGU posts them."
      />
      {data?.map((a) => (
        <Card key={a.announcement_id}>
          <Text style={[type.heading, { marginBottom: 4 }]}>{a.title}</Text>
          <Text style={[type.small, { marginBottom: 10 }]}>{fmtDateTime(a.published_timestamp)}</Text>
          <Text style={type.body}>{a.content}</Text>
        </Card>
      ))}
    </Screen>
  );
}
