import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { configured } from '../lib/supabase';
import { colors, type } from '../theme';
import AdminApp from '../web/AdminApp';
import LandingPage from '../web/landing/LandingPage';
import { WebNoAccess } from '../web/WebAuth';

/** Website entry point: only LGU admins and barangay admins get in. */
export default function RootNavigator() {
  const { loading, signedIn, role } = useAuth();

  if (!configured) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={type.heading}>Supabase isn’t set up</Text>
        <Text style={[type.small, { marginTop: 8, textAlign: 'center', maxWidth: 460 }]}>
          Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with: npx expo start -c --web
        </Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!signedIn) return <LandingPage />;
  if (!role) return <WebNoAccess />;
  return <AdminApp />;
}
