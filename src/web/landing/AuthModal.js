import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../AuthContext';
import { FONT } from '../design';

/**
 * Login modal from the PHP landing page (footer.php #auth-modal).
 * It signs in through the existing AuthContext.signIn — same call the old WebLogin used.
 * The "Register Resident" tab and the account-type dropdown are not here: on the website only LGU /
 * barangay admins can sign in (their role comes from the database), and residents register in the phone app.
 */
export default function AuthModal({ visible, onClose, t }) {
  const { signIn } = useAuth();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState('');
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

  const input = (key) => ({
    width: '100%', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderRadius: 6, fontSize: 15.2, fontFamily: FONT,
    color: t.text, backgroundColor: t.bgBody, outlineStyle: 'none',
    borderColor: focus === key ? t.primary : t.border,
    boxShadow: focus === key ? '0 0 0 3px rgba(46, 125, 50, 0.15)' : 'none',
  });
  const label = { fontSize: 14, fontWeight: '600', color: t.text, marginBottom: 6, fontFamily: FONT };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
        <View style={{ width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 12, padding: 32, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgSurface, boxShadow: t.shadowHover }}>
          <Pressable onPress={onClose} accessibilityLabel="Close modal" style={{ position: 'absolute', top: 12, right: 20, zIndex: 2 }}>
            <Text style={{ fontSize: 29, color: t.muted, lineHeight: 32 }}>×</Text>
          </Pressable>

          <View style={{ borderBottomWidth: 2, borderBottomColor: t.border, marginBottom: 24, marginRight: 24 }}>
            <View style={{ alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 2, borderBottomColor: t.primary, marginBottom: -2 }}>
              <Text style={{ fontWeight: '700', color: t.primary, fontFamily: FONT }}>Log In</Text>
            </View>
          </View>

          {error ? (
            <View style={{ padding: 14, borderRadius: 6, marginBottom: 20, backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#f5c6cb' }}>
              <Text style={{ color: '#c62828', fontSize: 14.4, fontFamily: FONT }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginBottom: 20 }}>
            <Text style={label}>Email Address</Text>
            <TextInput
              value={f.email} onChangeText={set('email')} placeholder="e.g. user@iligan.gov.ph" placeholderTextColor="#9aa59a"
              autoCapitalize="none" keyboardType="email-address" autoComplete="email"
              onFocus={() => setFocus('email')} onBlur={() => setFocus('')} style={input('email')}
            />
          </View>
          <View style={{ marginBottom: 20 }}>
            <Text style={label}>Password</Text>
            <TextInput
              value={f.password} onChangeText={set('password')} placeholder="••••••••" placeholderTextColor="#9aa59a" secureTextEntry autoCapitalize="none"
              onSubmitEditing={submit} onFocus={() => setFocus('password')} onBlur={() => setFocus('')} style={input('password')}
            />
          </View>

          <Pressable
            onPress={submit} disabled={busy}
            style={({ hovered }) => ({ marginTop: 8, paddingVertical: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', backgroundColor: hovered ? t.primaryHover : t.primary, opacity: busy ? 0.7 : 1 })}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONT }}>Sign In</Text>}
          </Pressable>

          <Text style={{ marginTop: 18, fontSize: 13, lineHeight: 19, color: t.muted, fontFamily: FONT }}>
            Barangay and LGU accounts are created by the LGU office. Residents and garbage collectors use the ECollect mobile app.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
