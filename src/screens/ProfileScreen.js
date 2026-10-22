import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert, Linking, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import { remindersOn, setRemindersOn, registerForPush } from '../services/notifications';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLang, LANGS, fmtDayYear } from '../i18n';
import '../i18n/strings/profile';
import {
  Screen, AppHeader, ListRow, InfoRow, ChoiceRow, SectionTitle, Subtle, Divider, Button, Icon, T,
} from '../ui';

const DASHBOARD_URL = 'https://haazri.tarahutaibuilds.com/dashboard';
const PRIVACY_URL = 'https://haazri.tarahutaibuilds.com/privacy';
const SUPPORT_MAIL = 'mailto:support@tarahutaibuilds.com';

const MenuIcon = ({ name }) => (
  <View style={st.menuIcon}><Icon name={name} size={22} color={T.navyDeep} /></View>
);

// The "You" tab: who you are, the app language, shortcuts, reminders, sign out and account deletion.
export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const isAdmin = user?.role === 'admin';
  const [reminders, setReminders] = useState(true);
  useEffect(() => { remindersOn().then(setReminders); }, []);

  const toggleReminders = async () => {
    const next = !reminders;
    await setRemindersOn(next);
    setReminders(next);
    if (next) registerForPush();
  };

  const handleLogout = () => {
    Alert.alert(t('profile.signOutQ'), t('profile.signOutMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: logout },
    ]);
  };

  // Google Play and the App Store require a way to delete your account from inside the app.
  const handleDeleteAccount = () => {
    Alert.alert(t('profile.deleteQ'), t('profile.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteBtn'), style: 'destructive', onPress: async () => {
          try {
            const res = await authAPI.deleteAccount();
            if (res.demo) {
              Alert.alert(t('profile.demoTitle'), t('profile.demoMsg'));
              return;
            }
            const date = /^\d{4}-\d{2}-\d{2}$/.test(res.eraseBy || '') ? fmtDayYear(t, res.eraseBy) : res.eraseBy;
            Alert.alert(t('profile.deletedTitle'), t('profile.deletedMsg', { date }));
            logout();
          } catch (e) {
            Alert.alert(t('profile.couldNotDelete'), `${e.message}\n\n${t('profile.deleteHelp')}`);
          }
        },
      },
    ]);
  };

  const menu = [
    { icon: 'calendar', label: t('profile.myAttendance'), onPress: () => navigation.navigate('Register') },
    { icon: 'file-text', label: isAdmin ? t('profile.leaveRequests') : t('profile.myLeave'), onPress: () => navigation.navigate(isAdmin ? 'Requests' : 'Leave') },
    { icon: 'edit-3', label: t('profile.corrections'), onPress: () => navigation.navigate('Corrections') },
    { icon: 'credit-card', label: t('profile.payslips'), onPress: () => navigation.navigate('Payslips') },
    isAdmin && { icon: 'monitor', label: t('profile.dashboard'), subtitle: t('profile.dashboardSub'), onPress: () => Linking.openURL(DASHBOARD_URL) },
    { icon: 'help-circle', label: t('profile.help'), subtitle: 'support@tarahutaibuilds.com', onPress: () => Linking.openURL(SUPPORT_MAIL) },
    { icon: 'shield', label: t('profile.privacy'), onPress: () => Linking.openURL(PRIVACY_URL) },
  ].filter(Boolean);

  const roleLabel = isAdmin ? t('common.admin') : t('common.staff');
  const subtitle = [roleLabel, user?.company?.name].filter(Boolean).join(' · ');

  return (
    <Screen header={<AppHeader title={user?.name || ''} subtitle={subtitle} />}>
      <InfoRow label={t('profile.phone')} value={user?.phone || t('profile.noPhone')} />
      <InfoRow label={t('profile.email')} value={user?.email || t('profile.noEmail')} last />

      <Divider style={{ marginVertical: 18 }} />
      <SectionTitle style={{ marginBottom: 12 }}>{t('common.language')}</SectionTitle>
      <ChoiceRow options={LANGS.map((l) => ({ value: l.code, label: l.label }))} value={lang} onChange={setLang} />
      <Subtle style={{ marginTop: 8 }}>{t('profile.languageNote')}</Subtle>

      <Divider style={{ marginVertical: 18 }} />
      {menu.map((m) => (
        <ListRow key={m.label} left={<MenuIcon name={m.icon} />} title={m.label} subtitle={m.subtitle} onPress={m.onPress} />
      ))}
      <View style={st.switchRow}>
        <MenuIcon name="bell" />
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={st.switchLabel}>{t('profile.reminders')}</Text>
          <Subtle style={{ marginTop: 3 }}>{reminders ? t('profile.remindersOnSub') : t('profile.remindersOffSub')}</Subtle>
        </View>
        <Switch value={reminders} onValueChange={toggleReminders}
          trackColor={{ true: T.navy, false: T.line }} thumbColor="#fff" ios_backgroundColor={T.line} />
      </View>

      <Button title={t('profile.signOut')} icon="log-out" variant="outline" onPress={handleLogout} style={{ marginTop: 26 }} />
      <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.6} style={st.deleteBtn}>
        <Text style={st.deleteText}>{t('profile.deleteAccount')}</Text>
      </TouchableOpacity>

      <Text style={st.version}>{t('profile.version', { v: Constants.expoConfig?.version || '1.0.0' })}</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  menuIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  switchLabel: { fontSize: 19, fontWeight: '700', color: T.navyDeep },
  deleteBtn: { alignSelf: 'center', marginTop: 18, paddingVertical: 10, paddingHorizontal: 16 },
  deleteText: { fontSize: 17, fontWeight: '600', color: T.red },
  version: { fontSize: 13, color: T.textFaint, textAlign: 'center', marginTop: 18 },
});
