import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, AppState, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
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

// Floating frosted-glass tab bar; the chosen tab sits in a white glass bubble.
function TabBar({ state, navigation }) {
  const { t } = useLang();
  const { count } = useRequestsCount();
  const bottom = useBottomInset(10);
  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    const cfg = TABS[route.name];
    const badge = route.name === 'Requests' && count > 0 ? count : null;
    return (
      <TouchableOpacity key={route.key} style={[tab.item, focused && tab.itemOn]} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: focused }}
        onPress={() => { if (!focused) navigation.navigate(route.name); }}>
        <View>
          <View style={[tab.iconWrap, focused && { backgroundColor: T.yellow }]}>
            <Icon name={cfg.icon} size={20} color={focused ? T.onYellow : T.textMuted} />
          </View>
          {badge ? <View style={tab.badge}><Text style={tab.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
        </View>
        <Text style={[tab.label, focused && tab.labelOn]} numberOfLines={1}>{t(cfg.label)}</Text>
      </TouchableOpacity>
    );
  });
  return (
    <View pointerEvents="box-none" style={[tab.float, { bottom }]}>
      <View style={tab.shadow}>
        {Platform.OS === 'ios'
          ? <BlurView intensity={45} tint="light" style={tab.bar}>{items}</BlurView>
          : <View style={[tab.bar, { backgroundColor: 'rgba(255,255,255,0.94)' }]}>{items}</View>}
      </View>
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
              <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
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
  float: { position: 'absolute', left: 14, right: 14 },
  shadow: { borderRadius: 34, shadowColor: '#0E1A33', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10, backgroundColor: 'transparent' },
  bar: { flexDirection: 'row', borderRadius: 34, overflow: 'hidden', padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.55)' },
  item: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 28 },
  itemOn: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,1)' },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  labelOn: { color: T.navyDeep, fontWeight: '700' },
  badge: { position: 'absolute', top: -4, right: -8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: T.white },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
