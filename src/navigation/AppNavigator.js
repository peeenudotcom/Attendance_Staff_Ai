import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RADIUS } from '../utils/theme';
import { useBottomInset } from '../utils/safeArea';
import { SHOW_SAMPLE_DATA } from '../config/features';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import CallLogsScreen from '../screens/CallLogsScreen';
import GalleryScreen from '../screens/GalleryScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MarkAttendanceScreen from '../screens/MarkAttendanceScreen';
import AddStaffScreen from '../screens/AddStaffScreen';
import PayrollScreen from '../screens/PayrollScreen';
import LeaveScreen from '../screens/LeaveScreen';
import LiveTrackScreen from '../screens/LiveTrackScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ icon, label, focused, colors }) {
  return (
    <View style={tabStyles.container}>
      <Text style={[tabStyles.icon, { color: colors.textMuted }, focused && { color: colors.textAccent, opacity: 1 }]}>{icon}</Text>
      <Text style={[tabStyles.label, { color: colors.textMuted }, focused && { color: colors.textAccent, fontWeight: '700', opacity: 1 }]}>{label}</Text>
      {focused && <View style={[tabStyles.dot, { backgroundColor: colors.accent, shadowColor: colors.accent }]} />}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, minWidth: 54 },
  icon: { fontSize: 20, opacity: 0.5 },
  label: { fontSize: 9, fontWeight: '500', marginTop: 4, opacity: 0.5 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
});

function GlassTabBar({ children, isDark }) {
  const bottomInset = useBottomInset(12);
  const sizing = { height: TAB_CONTENT_HEIGHT + bottomInset, paddingBottom: bottomInset };
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const hlColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)';
  const fallbackBg = isDark ? 'rgba(10,14,26,0.95)' : 'rgba(248,250,252,0.95)';

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={[glassBarStyles.blur, sizing, { borderTopColor: borderColor }]}>
        <View style={[glassBarStyles.highlight, { backgroundColor: hlColor }]} />
        {children}
      </BlurView>
    );
  }
  return <View style={[glassBarStyles.fallback, sizing, { backgroundColor: fallbackBg, borderTopColor: borderColor }]}>{children}</View>;
}

// Icon + label rows; the home-indicator inset is added at render time.
const TAB_CONTENT_HEIGHT = 62;

const glassBarStyles = StyleSheet.create({
  blur: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingTop: 10,
    borderTopWidth: 1,
  },
  highlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 0.5,
  },
  fallback: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingTop: 10,
    borderTopWidth: 1,
  },
});

function TabNavigator() {
  const { colors: C, isDark } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => (
        <GlassTabBar isDark={isDark}>
          {props.state.routes.map((route, index) => {
            const focused = props.state.index === index;
            const icons = { Home: '⬡', History: '◷', CallLogs: '◉', Gallery: '◫', Profile: '◎' };
            const labels = { Home: 'Home', History: 'Logs', CallLogs: 'Calls', Gallery: 'Media', Profile: 'You' };
            return (
              <View key={route.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <TabIcon
                  icon={icons[route.name] || '◉'}
                  label={labels[route.name] || route.name}
                  focused={focused}
                  colors={C}
                />
                <View
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  onTouchEnd={() => props.navigation.navigate(route.name)}
                />
              </View>
            );
          })}
        </GlassTabBar>
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      {SHOW_SAMPLE_DATA && <Tab.Screen name="History" component={HistoryScreen} />}
      {/* iOS has no public API for call history, so the Calls tab only ships on Android. */}
      {Platform.OS === 'android' && <Tab.Screen name="CallLogs" component={CallLogsScreen} />}
      <Tab.Screen name="Gallery" component={GalleryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            {/* Admin-only screens are not registered for staff, so no shortcut or chat action can open them. */}
            {isAdmin && <Stack.Screen name="AddStaff" component={AddStaffScreen} />}
            {/* Screens that still show sample data are left out of the store build (see src/config/features.js). */}
            {SHOW_SAMPLE_DATA && (
              <Stack.Group>
                <Stack.Screen name="Reports" component={ReportsScreen} />
                <Stack.Screen name="Leave" component={LeaveScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
              </Stack.Group>
            )}
            {SHOW_SAMPLE_DATA && isAdmin && (
              <Stack.Group>
                <Stack.Screen name="Payroll" component={PayrollScreen} />
                <Stack.Screen name="Salary" component={PayrollScreen} />
                <Stack.Screen name="LiveTrack" component={LiveTrackScreen} />
              </Stack.Group>
            )}
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
