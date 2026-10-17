import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../AuthContext';
import { SITE_NAME } from './design';
import { useClock, FONT_STACK } from './dash';
import { Icon, P } from './icons';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import BarangayAdmins from './pages/BarangayAdmins';
import Collectors from './pages/Collectors';
import Zones from './pages/Zones';
import Schedules from './pages/Schedules';
import { Trucks, WasteCategories, Announcements, Reports, Residents } from './pages/Simple';

const LGU_NAV = [
  ['dashboard', 'Dashboard', P.grid, Dashboard],
  ['live', 'Live trucks', P.pin, LiveMap],
  ['barangays', 'Barangay admins', P.users, BarangayAdmins],
  ['collectors', 'Collectors', P.collector, Collectors],
  ['zones', 'Zones & routes', P.routes, Zones],
  ['schedules', 'Schedules', P.calendar, Schedules],
  ['trucks', 'Trucks', P.truck, Trucks],
  ['waste', 'Waste categories', P.waste, WasteCategories],
  ['news', 'Announcements', P.megaphone, Announcements],
  ['reports', 'Resident reports', P.feedback, Reports],
  ['residents', 'Residents', P.resident, Residents],
];

const BRGY_NAV = [
  ['dashboard', 'Dashboard', P.grid, Dashboard],
  ['live', 'Live trucks', P.pin, LiveMap],
  ['zones', 'Zones & routes', P.routes, Zones],
  ['schedules', 'Schedules', P.calendar, Schedules],
  ['collectors', 'Collectors', P.collector, Collectors],
  ['news', 'Announcements', P.megaphone, Announcements],
];

const ROLE_LABEL = { lgu_admin: 'LGU admin', barangay_admin: 'Barangay admin' };

function Link({ icon, label, active, danger, onPress }) {
  return (
  <Pressable
    onPress={onPress}
    style={({ hovered }) => ({
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 24,
      borderLeftWidth: 3, borderLeftColor: active ? '#2e7d32' : 'transparent',
      backgroundColor: active || hovered ? (danger ? '#fdecea' : '#e8f5e9') : 'transparent',
    })}
  >
    <Icon d={icon} size={18} stroke={!!danger} color={danger ? '#c62828' : active ? '#2e7d32' : '#666'} />
    <Text style={{ fontSize: 14.7, fontWeight: '600', color: danger ? '#c62828' : active ? '#2e7d32' : '#666' }}>{label}</Text>
  </Pressable>
);
}

function TopbarClock() {
  const clock = useClock();   // own component so the 1-second tick doesn't re-render the whole shell
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1976d2' }}>{clock.time}</Text>
      <Text style={{ fontSize: 12.8, color: '#666' }}>{clock.date}</Text>
    </View>
  );
}

export default function AdminApp() {
  const { role, availableRoles, setRole, fullName, email, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const narrow = width <= 992;          // admin.css: sidebar becomes a slide-in drawer
  const nav = role === 'lgu_admin' ? LGU_NAV : BRGY_NAV;
  const [open, setOpen] = useState(false);

  const fromHash = () => (typeof window !== 'undefined' ? window.location.hash.replace('#/', '') : '');
  const [page, setPage] = useState(fromHash() || 'dashboard');
  const go = (k) => { setPage(k); setOpen(false); if (typeof window !== 'undefined') window.location.hash = `#/${k}`; };
  useEffect(() => {
    const on = () => setPage(fromHash() || 'dashboard');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const current = nav.find((n) => n[0] === page) ?? nav[0];
  const Body = current[3];
  const shown = fullName || email || 'Admin';

  const other = availableRoles.find((r) => r !== role);
  const sidebar = (
    <View style={[{ width: 260, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e0e0e0', fontFamily: FONT_STACK },
      narrow ? { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 1000, boxShadow: '0 14px 40px rgba(0,0,0,0.12)' } : { height: '100%' }]}>
      <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon d={P.logo} size={30} stroke color="#2e7d32" />
        <View>
          <Text style={{ fontSize: 21.6, fontWeight: '800', color: '#2e7d32', lineHeight: 22 }}>{SITE_NAME}</Text>
          <Text style={{ marginTop: 3, fontSize: 12, color: '#666' }}>{role === 'lgu_admin' ? 'LGU Admin Panel' : 'Barangay Admin Panel'}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16 }}>
        {nav.map(([key, label, icon]) => <Link key={key} icon={icon} label={label} active={key === current[0]} onPress={() => go(key)} />)}
      </ScrollView>
      <View style={{ paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#e0e0e0' }}>
        {other ? <Link icon={P.users} label={`Switch to ${ROLE_LABEL[other]}`} onPress={() => { setRole(other); go('dashboard'); }} /> : null}
        <Link danger icon={P.logout} label="Log Out" onPress={signOut} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#f5f5f5' }}>
      {!narrow && sidebar}
      {narrow && open && (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
          {sidebar}
        </>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ height: 72, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: width <= 576 ? 20 : 32, zIndex: 800 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {narrow && (
              <Pressable onPress={() => setOpen(true)} accessibilityLabel="Toggle sidebar" style={{ gap: 5, padding: 4 }}>
                {[0, 1, 2].map((i) => <View key={i} style={{ width: 25, height: 3, borderRadius: 3, backgroundColor: '#333' }} />)}
              </Pressable>
            )}
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#333' }}>{current[1]}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            {width > 576 && <TopbarClock />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: '#e0e0e0' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#2e7d32', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14.4 }}>{shown.charAt(0).toUpperCase()}</Text>
              </View>
              {width > 576 && <Text numberOfLines={1} style={{ maxWidth: 160, fontSize: 13.6, fontWeight: '600', color: '#333' }}>{shown}</Text>}
            </View>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: width <= 576 ? 20 : 32, paddingBottom: 60 }}>
          <Body key={`${role}-${current[0]}`} go={go} />
        </ScrollView>
      </View>
    </View>
  );
}
