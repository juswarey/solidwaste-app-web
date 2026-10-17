import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { getFeedback, sendFeedback } from '../data/resident';
import { useApi } from '../hooks';
import { Button, Card, Chip, ErrorBanner, Field, Screen, ScreenTitle, StateView } from '../components/ui';
import { colors, radius, type } from '../theme';
import { fmtDateTime } from '../utils/schedule';

const STATUS = {
  pending: { label: 'Received', bg: colors.amberLight, fg: colors.amber },
  in_progress: { label: 'In progress', bg: '#e3f2fd', fg: colors.blue },
  resolved: { label: 'Resolved', bg: colors.primaryLight, fg: colors.primaryDark },
};

export default function ReportScreen() {
  const { data, error, loading, refreshing, reload, pull } = useApi(getFeedback);
  const [tab, setTab] = useState('new');
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleLocation = async () => {
    if (coords) return setCoords(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return setFormError('Location permission was denied. You can still send the report without it.');
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setFormError('');
    } catch {
      setFormError('Could not get your location. Make sure GPS is on.');
    }
  };

  const submit = async () => {
    if (!reportType) return setFormError('Choose what kind of report this is.');
    if (description.trim().length < 5) return setFormError('Describe the problem in a few words.');
    setBusy(true);
    setFormError('');
    try {
      await sendFeedback({ report_type: reportType, description: description.trim(), ...(coords ?? {}) });
      setReportType('');
      setDescription('');
      setCoords(null);
      await reload();
      setTab('mine');
      Alert.alert('Report sent', 'Your barangay office can now see it.');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reports = data?.reports ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <ScreenTitle>Report a problem</ScreenTitle>

      <View style={{ flexDirection: 'row', backgroundColor: '#e6ebe6', borderRadius: radius.md, padding: 3, marginBottom: 18 }}>
        {[['new', 'New report'], ['mine', `My reports${reports.length ? ` (${reports.length})` : ''}`]].map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={{
              flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm + 1,
              backgroundColor: tab === key ? colors.surface : 'transparent',
            }}
          >
            <Text style={{ fontWeight: '700', color: tab === key ? colors.text : colors.muted }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'new' && (
        <>
          <ErrorBanner message={formError} />
          <Text style={[type.label, { marginBottom: 8 }]}>What happened?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {(data?.types ?? ['Missed collection', 'Illegal dumping', 'Overflowing bin', 'Truck concern', 'Suggestion', 'Other']).map((t) => (
              <Chip key={t} label={t} selected={reportType === t} onPress={() => setReportType(t)} />
            ))}
          </View>
          <Field
            label="Details"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            placeholder="Where is it and what do you see?"
          />
          <Button
            title={coords ? 'Location attached — tap to remove' : 'Attach my location'}
            variant="ghost"
            onPress={toggleLocation}
            style={{ marginBottom: 12 }}
          />
          <Button title="Send report" onPress={submit} loading={busy} />
        </>
      )}

      {tab === 'mine' && (
        <>
          <StateView
            loading={loading} error={error} onRetry={reload}
            empty={!loading && !error && reports.length === 0}
            emptyTitle="No reports yet"
            emptyText="Reports you send will show up here with their status."
          />
          {reports.map((r) => {
            const st = STATUS[r.status] ?? STATUS.pending;
            return (
              <Card key={r.feedback_report_id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[type.label, { flex: 1 }]}>{r.report_type}</Text>
                  <View style={{ backgroundColor: st.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: st.fg, fontSize: 12, fontWeight: '700' }}>{st.label}</Text>
                  </View>
                </View>
                {r.description ? <Text style={type.body}>{r.description}</Text> : null}
                <Text style={[type.small, { marginTop: 8 }]}>{fmtDateTime(r.created_at)}</Text>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
