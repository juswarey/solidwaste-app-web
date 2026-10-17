import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { Button, ErrorBanner, Field } from '../components/ui';
import { colors, radius, type } from '../theme';

function Shell({ children }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 440, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 28 }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: -1 }}>ECollect</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 4, marginBottom: 22 }]}>Admin portal for LGU and barangay offices.</Text>
        {children}
      </View>
    </View>
  );
}

/** Admin log in. There is no sign-up here: the LGU admin has a default account and creates barangay admin logins. */
export function WebLogin() {
  const { signIn } = useAuth();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!f.email.trim() || !f.password) return setError('Enter your email and password.');
    setBusy(true); setError('');
    try {
      await signIn(f.email.trim(), f.password);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Shell>
      <ErrorBanner message={error} />
      <Field label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={f.password} onChangeText={set('password')} secureTextEntry autoCapitalize="none" onSubmitEditing={submit} />
      <Button title="Log in" onPress={submit} loading={busy} />
      <Text style={[type.small, { marginTop: 16 }]}>
        Barangay admin accounts are created by the LGU admin. Ask your LGU office if you cannot log in.
      </Text>
    </Shell>
  );
}

/** Signed in, but not an admin (e.g. a resident or collector account). */
export function WebNoAccess() {
  const { signOut, email, roles, profileError } = useAuth();
  return (
    <Shell>
      <Text style={type.heading}>No admin access</Text>
      <Text style={[type.small, { marginTop: 6, marginBottom: 16 }]}>
        {profileError
          ? profileError
          : roles.includes('resident') || roles.includes('collector')
            ? `${email} is a ${roles.includes('collector') ? 'collector' : 'resident'} account — those use the phone app.`
            : `${email} is not an admin account. Admin accounts are created by the LGU admin.`}
      </Text>
      <Pressable onPress={signOut} style={{ marginTop: 6, alignItems: 'center' }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Log out</Text>
      </Pressable>
    </Shell>
  );
}
