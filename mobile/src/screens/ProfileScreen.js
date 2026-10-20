import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { getMe, saveMe } from '../data/resident';
import { useAuth } from '../AuthContext';
import { Button, ErrorBanner, Field, Screen, StateView } from '../components/ui';
import ZonePicker from '../components/ZonePicker';
import { getTruckAlerts, setTruckAlerts } from '../data/liveTrucks';
import { colors, type } from '../theme';

export default function ProfileScreen() {
  const { signOut, setName } = useAuth();
  const [f, setF] = useState(null);
  const [email, setEmail] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const load = () => {
    setLoadError(null);
    getMe()
      .then((me) => {
        setEmail(me.email);
        setF({
          first_name: me.first_name ?? '',
          last_name: me.last_name ?? '',
          contact_number: me.contact_number ?? '',
          home_address: me.home_address ?? '',
          route_id: me.route_id,
        });
      })
      .catch((e) => setLoadError(e.message));
  };
  useEffect(load, []);
  useEffect(() => { getTruckAlerts().then(setAlerts); }, []);
  const toggleAlerts = (v) => { setAlerts(v); setTruckAlerts(v); };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const me = await saveMe(f);
      setName(me.first_name);
      Alert.alert('Saved', 'Your profile was updated.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You’ll need to sign in again to see your schedule.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);

  return (
    <Screen style={{ paddingTop: 16 }}>
      <StateView loading={!f && !loadError} error={loadError} onRetry={load} />
      {f && (
        <>
          <Text style={[type.small, { marginBottom: 16 }]}>Signed in as {email}</Text>
          <ErrorBanner message={error} />
          <Field label="First name" value={f.first_name} onChangeText={set('first_name')} />
          <Field label="Last name" value={f.last_name} onChangeText={set('last_name')} />
          <Field label="Contact number" value={f.contact_number} onChangeText={set('contact_number')} keyboardType="phone-pad" />
          <Field label="Home address" value={f.home_address} onChangeText={set('home_address')} multiline />
          <ZonePicker value={f.route_id} onChange={set('route_id')} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={type.label}>Truck alerts</Text>
              <Text style={type.small}>Get a notification when the truck is on the way to, or almost at, your zone’s stop.</Text>
            </View>
            <Switch value={alerts} onValueChange={toggleAlerts} trackColor={{ true: colors.primary }} />
          </View>
          <Button title="Save changes" onPress={save} loading={busy} />
          <View style={{ height: 14 }} />
          <Button title="Log out" variant="ghost" onPress={confirmLogout} />
        </>
      )}
    </Screen>
  );
}
