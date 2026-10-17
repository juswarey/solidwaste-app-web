import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase, explain } from './lib/supabase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// Database role name -> short name used by the app
const NORMAL = { lgu_admin: 'lgu_admin', barangay_admin: 'barangay_admin', garbage_collector: 'collector', resident: 'resident' };

// The website is for admins, the phone app is for collectors and residents.
export const IS_WEB = Platform.OS === 'web';
const ALLOWED = IS_WEB ? ['lgu_admin', 'barangay_admin'] : ['collector', 'resident'];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);   // undefined = still checking
  const [profiles, setProfiles] = useState(null);      // null = still loading
  const [profileError, setProfileError] = useState('');
  const [chosen, setChosen] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Keep tokens fresh while the phone app is in the foreground.
  useEffect(() => {
    if (IS_WEB) return undefined;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_profile');
    if (error) throw new Error(explain(error));
    setProfiles(data ?? []);
    setProfileError('');
  }, []);

  const uid = session?.user?.id ?? null;
  const checking = session === undefined;

  useEffect(() => {
    if (checking) return;
    if (!uid) { setProfiles([]); setChosen(null); setProfileError(''); return; }
    setProfiles(null);
    loadProfiles().catch((e) => { setProfiles([]); setProfileError(e.message); });
  }, [uid, checking, loadProfiles]);

  const roles = useMemo(() => (profiles ?? []).map((p) => NORMAL[p.r_role]), [profiles]);
  const role = useMemo(
    () => (chosen && roles.includes(chosen) && ALLOWED.includes(chosen) ? chosen : ALLOWED.find((r) => roles.includes(r)) ?? null),
    [chosen, roles]
  );
  const active = (profiles ?? []).find((p) => NORMAL[p.r_role] === role) ?? null;

  const afterSignUp = (data) => ({ needsEmailConfirm: !data.session });

  const value = useMemo(
    () => ({
      loading: checking || (!!uid && profiles === null),
      signedIn: !!uid,
      email: session?.user?.email ?? '',
      role,                                   // role for THIS platform, or null (wrong platform / no access yet)
      roles,
      availableRoles: roles.filter((r) => ALLOWED.includes(r)),
      profileId: active?.r_id ?? null,        // lgu_admin_id / barangay_admin_id / garbage_collector_id / resident_id
      name: active?.r_first_name ?? '',
      fullName: active ? `${active.r_first_name ?? ''} ${active.r_last_name ?? ''}`.trim() : '',
      profileError,
      setRole: setChosen,
      setName: (n) => setProfiles((ps) => (ps ?? []).map((p) => (NORMAL[p.r_role] === role ? { ...p, r_first_name: n } : p))),
      refreshProfiles: loadProfiles,

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(explain(error));
      },

      /** Public sign-up. This ONLY ever creates a resident (the database trigger enforces it). */
      register: async ({ email, password, first_name, last_name, contact_number, home_address, route_id }) => {
        const meta = { first_name, last_name, contact_number, home_address, route_id: route_id ?? null };
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
        if (error) throw new Error(explain(error));
        return afterSignUp(data);
      },

      signOut: async () => {
        await supabase.auth.signOut();
        setChosen(null);
      },
    }),
    [checking, uid, session, role, roles, active, profiles, profileError, loadProfiles]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
