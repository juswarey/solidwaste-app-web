import React from 'react';
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
  Schedule: ['calendar', 'calendar-outline'],
  Route: ['map', 'map-outline'],
  Account: ['person-circle', 'person-circle-outline'],
};

const tabOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  tabBarIcon: ({ color, size, focused }) => (
    <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
  ),
});

function ResidentTabs() {
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

function CollectorTabs() {
  // The provider sits here so location sharing keeps running while the collector
  // switches tabs, and stops when they log out.
  return (
    <LocationShareProvider>
      <Tab.Navigator screenOptions={tabOptions}>
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Schedule" component={CollectorScheduleScreen} />
        <Tab.Screen name="Route" component={CollectorRouteScreen} />
        <Tab.Screen name="Guide" component={GuideScreen} />
        <Tab.Screen name="Account" component={CollectorAccountScreen} />
      </Tab.Navigator>
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
    <NavigationContainer theme={theme}>
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
