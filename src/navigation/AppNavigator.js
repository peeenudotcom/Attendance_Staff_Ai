import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n';
import { Icon, T } from '../ui';
import { useBottomInset } from '../utils/safeArea';
import { correctionsAPI, leaveAPI } from '../services/api';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RequestsScreen from '../screens/RequestsScreen';
import ReviewRequestScreen from '../screens/ReviewRequestScreen';
import LeaveScreen from '../screens/LeaveScreen';
import StaffListScreen from '../screens/StaffListScreen';
import AddStaffScreen from '../screens/AddStaffScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MarkAttendanceScreen from '../screens/MarkAttendanceScreen';
import CorrectionsScreen from '../screens/CorrectionsScreen';
import PayslipsScreen from '../screens/PayslipsScreen';
import { onNotificationTap, registerForPush } from '../services/notifications';

const navigationRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Requests waiting for an admin (leave + attendance corrections): the badge on the Requests tab.
// Screens call refresh() after approving or rejecting something.
const RequestsCount = createContext({ count: 0, refresh: () => {} });
export const useRequestsCount = () => useContext(RequestsCount);

function RequestsCountProvider({ isAdmin, children }) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [l, c] = await Promise.all([leaveAPI.company(), correctionsAPI.company()]);
      setCount((l.pending?.length || 0) + (c.pending?.length || 0));
    } catch { /* keep the last count */ }
  }, [isAdmin]);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);
  return <RequestsCount.Provider value={{ count, refresh }}>{children}</RequestsCount.Provider>;
}

const TABS = {
  Register: { icon: 'calendar', label: 'common.tabRegister' },
  Requests: { icon: 'file-text', label: 'common.tabRequests' },
  Leave: { icon: 'file-text', label: 'common.tabLeave' },
  Staff: { icon: 'users', label: 'common.tabStaff' },
  Profile: { icon: 'user', label: 'common.tabYou' },
};

function TabBar({ state, navigation }) {
  const { t } = useLang();
  const { count } = useRequestsCount();
  const bottom = useBottomInset(10);
  return (
    <View style={[tab.bar, { paddingBottom: bottom }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg = TABS[route.name];
        const badge = route.name === 'Requests' && count > 0 ? count : null;
        return (
          <TouchableOpacity key={route.key} style={tab.item} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: focused }}
            onPress={() => { if (!focused) navigation.navigate(route.name); }}>
            <View>
              <Icon name={cfg.icon} size={30} color={focused ? T.navyDeep : T.textMuted} />
              {badge ? <View style={tab.badge}><Text style={tab.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
            </View>
            <Text style={[tab.label, focused && tab.labelOn]} numberOfLines={1}>{t(cfg.label)}</Text>
            <View style={[tab.underline, focused && { backgroundColor: T.yellow }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Tabs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Register" component={RegisterScreen} />
      {isAdmin ? <Tab.Screen name="Requests" component={RequestsScreen} /> : <Tab.Screen name="Leave" component={LeaveScreen} />}
      {isAdmin && <Tab.Screen name="Staff" component={StaffListScreen} />}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Once signed in: link this phone for push messages, and open the right screen when a notification is tapped.
  useEffect(() => {
    if (!user) return undefined;
    registerForPush();
    return onNotificationTap((name, params) => {
      if (navigationRef.isReady()) navigationRef.navigate(name, params);
    });
  }, [user?.id]);

  if (isLoading) return null;

  return (
    <RequestsCountProvider isAdmin={isAdmin} key={user?.id || 'out'}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {user ? (
            <>
              <Stack.Screen name="Main" component={Tabs} />
              <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="Corrections" component={CorrectionsScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="Payslips" component={PayslipsScreen} options={{ animation: 'slide_from_right' }} />
              {/* Notification taps still use the old names: Team opens the Register's team view, Leave opens Requests for admins. */}
              <Stack.Screen name="Team" component={RegisterScreen} initialParams={{ mode: 'team' }} options={{ animation: 'slide_from_right' }} />
              {isAdmin && <Stack.Screen name="Leave" component={RequestsScreen} options={{ animation: 'slide_from_right' }} />}
              {/* Admin-only screens are not registered for staff, so no shortcut or notification can open them. */}
              {isAdmin && <Stack.Screen name="ReviewRequest" component={ReviewRequestScreen} options={{ animation: 'slide_from_right' }} />}
              {isAdmin && <Stack.Screen name="AddStaff" component={AddStaffScreen} options={{ animation: 'slide_from_right' }} />}
              {isAdmin && <Stack.Screen name="StaffList" component={StaffListScreen} options={{ animation: 'slide_from_right' }} />}
              {!isAdmin && <Stack.Screen name="MyLeave" component={LeaveScreen} options={{ animation: 'slide_from_right' }} />}
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </RequestsCountProvider>
  );
}

const tab = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 12 },
  item: { flex: 1, alignItems: 'center' },
  label: { fontSize: 15, color: T.textMuted, marginTop: 6 },
  labelOn: { color: T.navyDeep, fontWeight: '700' },
  underline: { width: 52, height: 5, borderRadius: 3, marginTop: 6, backgroundColor: 'transparent' },
  badge: { position: 'absolute', top: -8, right: -12, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: T.bg },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
