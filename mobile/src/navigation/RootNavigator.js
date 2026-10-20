import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../AuthContext';
import { configured } from '../lib/supabase';
import { Button, Screen, ScreenTitle } from '../components/ui';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import TruckScreen from '../screens/TruckScreen';
import ReportScreen from '../screens/ReportScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import GuideScreen from '../screens/GuideScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { LocationShareProvider } from '../collector/LocationShare';
import TodayScreen from '../collector/TodayScreen';
import CollectorScheduleScreen from '../collector/CollectorScheduleScreen';
import CollectorRouteScreen from '../collector/CollectorRouteScreen';
import CollectorAccountScreen from '../collector/CollectorAccountScreen';
import ReportProblemScreen from '../collector/ReportProblemScreen';
import MoreScreen from '../collector/MoreScreen';
import EmergencyScreen from '../collector/EmergencyScreen';
import EmergencyDetailScreen from '../collector/EmergencyDetailScreen';
import HistoryScreen from '../collector/HistoryScreen';
import CollectorAnnouncementsScreen from '../collector/CollectorAnnouncementsScreen';
import { CollectorServicesProvider, useCollectorServices } from '../collector/CollectorServices';
import { navigationRef } from './navRef';
import { startLive, stopLive } from '../data/liveTrucks';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS = {
  // resident
  Home: ['home', 'home-outline'],
  Truck: ['location', 'location-outline'],
  Report: ['chatbox-ellipses', 'chatbox-ellipses-outline'],
  News: ['megaphone', 'megaphone-outline'],
  Guide: ['leaf', 'leaf-outline'],
  // collector
  Today: ['today', 'today-outline'],
  Week: ['calendar', 'calendar-outline'],
  Map: ['map', 'map-outline'],
  ReportProblem: ['warning', 'warning-outline'],
  Emergency: ['alert-circle', 'alert-circle-outline'],
  More: ['menu', 'menu-outline'],
};

const tabOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: colors.primaryDark,
  tabBarInactiveTintColor: colors.faint,
  tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
  tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11, fontWeight: '800' },
  tabBarIcon: ({ color, focused }) => (
    <View style={{ width: 50, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.primaryLight : 'transparent' }}>
      <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={21} color={color} />
    </View>
  ),
});

function ResidentTabs() {
  // One shared live connection for the Home card, the Truck map and the "truck is near" alerts.
  useEffect(() => {
    startLive();
    return stopLive;
  }, []);
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Truck" component={TruckScreen} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="News" component={AnnouncementsScreen} />
      <Tab.Screen name="Guide" component={GuideScreen} />
    </Tab.Navigator>
  );
}

const MoreStack = createNativeStackNavigator();
const subHeader = { headerTintColor: colors.primary, headerTitleStyle: { color: colors.text, fontWeight: '700' }, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerBackTitle: 'More' };
function CollectorMore() {
  return (
    <MoreStack.Navigator screenOptions={subHeader}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} options={{ headerShown: false }} />
      <MoreStack.Screen name="Announcements" component={CollectorAnnouncementsScreen} />
      <MoreStack.Screen name="History" component={HistoryScreen} options={{ title: 'My history' }} />
      <MoreStack.Screen name="Account" component={CollectorAccountScreen} />
      <MoreStack.Screen name="ReportProblem" component={ReportProblemScreen} options={{ title: 'Report a problem' }} />
    </MoreStack.Navigator>
  );
}

const EmergencyStack = createNativeStackNavigator();
function CollectorEmergency() {
  return (
    <EmergencyStack.Navigator screenOptions={{ ...subHeader, headerBackTitle: 'Emergency' }}>
      <EmergencyStack.Screen name="EmergencyList" component={EmergencyScreen} options={{ headerShown: false }} />
      <EmergencyStack.Screen name="EmergencyDetail" component={EmergencyDetailScreen} options={{ title: 'Emergency pickup' }} />
    </EmergencyStack.Navigator>
  );
}

function CollectorTabsInner() {
  const { unread, openEmergencies } = useCollectorServices();
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Week" component={CollectorScheduleScreen} />
      <Tab.Screen name="Emergency" component={CollectorEmergency} options={{ tabBarBadge: openEmergencies || undefined }} />
      <Tab.Screen name="Map" component={CollectorRouteScreen} />
      <Tab.Screen name="More" component={CollectorMore} options={{ tabBarBadge: unread || undefined }} />
    </Tab.Navigator>
  );
}

function CollectorTabs() {
  // The providers sit here so location sharing, saved taps and notifications keep working while
  // the collector switches tabs, and stop when they log out.
  return (
    <LocationShareProvider>
      <CollectorServicesProvider>
        <CollectorTabsInner />
      </CollectorServicesProvider>
    </LocationShareProvider>
  );
}

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary, card: colors.surface, text: colors.text, border: colors.border },
};

function Notice({ title, text, children }) {
  return (
    <Screen style={{ paddingTop: 80 }}>
      <ScreenTitle sub={text}>{title}</ScreenTitle>
      {children}
    </Screen>
  );
}

export default function RootNavigator() {
  const { loading, signedIn, role, roles, profileError, signOut } = useAuth();

  if (!configured) {
    return (
      <Notice
        title="Supabase isn’t set up"
        text="Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo with: npx expo start -c"
      />
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Signed in, but with no role this app can use (admins use the website).
  if (signedIn && !role) {
    const isAdmin = roles.includes('lgu_admin') || roles.includes('barangay_admin');
    return (
      <Notice
        title={isAdmin ? 'Admins use the website' : 'Account not ready'}
        text={
          isAdmin
            ? 'Your account is an LGU / barangay admin account. Please open the ECollect web portal on a computer.'
            : profileError || 'We could not find a resident or collector profile for this account.'
        }
      >
        <Button title="Log out" variant="ghost" onPress={signOut} />
      </Notice>
    );
  }

  return (
    <NavigationContainer theme={theme} ref={navigationRef}>
      {signedIn && role === 'collector' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CollectorTabs" component={CollectorTabs} />
        </Stack.Navigator>
      ) : signedIn ? (
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={ResidentTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', headerBackTitle: 'Back' }} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
