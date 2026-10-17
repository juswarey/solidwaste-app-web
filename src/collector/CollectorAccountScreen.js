import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { getCollector } from '../data/collector';
import { useAuth } from '../AuthContext';
import { Button, Card, Screen, ScreenTitle } from '../components/ui';
import { type } from '../theme';
import { useLocationShare } from './LocationShare';

export default function CollectorAccountScreen() {
  const { signOut } = useAuth();
  const share = useLocationShare();
  const [me, setMe] = useState(null);

  useEffect(() => { getCollector().then((c) => setMe({ full_name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(), email: c.email })).catch(() => {}); }, []);

  const confirmLogout = () =>
    Alert.alert(
      'Log out?',
      share.sharing ? 'Location sharing will stop and residents won’t see your truck.' : 'You’ll need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: signOut },
      ]
    );

  return (
    <Screen>
      <ScreenTitle>Account</ScreenTitle>
      <Card>
        <Text style={type.heading}>{me?.full_name || ' '}</Text>
        <Text style={[type.small, { marginTop: 2 }]}>{me?.email || ' '}</Text>
        <Text style={[type.small, { marginTop: 10 }]}>Garbage collector</Text>
      </Card>
      <Text style={[type.small, { marginBottom: 16 }]}>
        To change your route or truck, contact your barangay admin.
      </Text>
      <Button title="Log out" variant="ghost" onPress={confirmLogout} />
    </Screen>
  );
}
