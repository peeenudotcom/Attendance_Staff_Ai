import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { remindersOn, setRemindersOn, registerForPush } from '../services/notifications';
import { authAPI } from '../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS, GLASS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { SHOW_SAMPLE_DATA } from '../config/features';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { colors: C, isDark, toggleTheme } = useTheme();
  const headerTop = useHeaderInset(16);
  const isAdmin = user?.role === 'admin';
  const [reminders, setReminders] = useState(true);
  useEffect(() => { remindersOn().then(setReminders); }, []);
  const toggleReminders = async () => {
    const next = !reminders;
    await setRemindersOn(next);
    setReminders(next);
    if (next) registerForPush();
    Alert.alert(next ? 'Reminders on' : 'Reminders off', next
      ? "You'll get a reminder if you haven't checked in by your start time, and one to check out at the end of your shift."
      : "You won't get check-in or check-out reminders on this phone.");
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  // Google Play and the App Store require a way to delete your account from inside the app.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      "You will be signed out and won't be able to sign in again. Your name, phone, email, selfies and check-in "
        + 'locations are erased within 30 days. Your employer keeps the dates and hours you worked, without your name, for payroll.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account', style: 'destructive', onPress: async () => {
            try {
              const res = await authAPI.deleteAccount();
              if (res.demo) {
                Alert.alert('Demo account', 'This is the review demo account, so it stays on for other reviewers. A real account is switched off and signed out at this point.');
                return;
              }
              Alert.alert('Account deleted', `Your account has been deleted. Your personal data will be erased by ${res.eraseBy}.`);
              logout();
            } catch (e) {
              Alert.alert('Could not delete your account', `${e.message}\n\nYou can also email support@tarahutaibuilds.com.`);
            }
          },
        },
      ],
    );
  };

  const menuSections = [
    { title: 'ACCOUNT', items: [
      { icon: '◷', label: 'My attendance', onPress: () => navigation.navigate('History') },
      { icon: '◇', label: 'My leave', onPress: () => navigation.navigate('Leave') },
      { icon: '◈', label: 'Team today', admin: true, onPress: () => navigation.navigate('Team') },
      { icon: '◎', label: 'Staff', admin: true, onPress: () => navigation.navigate('StaffList') },
      { icon: '⬡', label: 'Web dashboard (reports, salary, settings)', admin: true, onPress: () => Linking.openURL('https://haazri.tarahutaibuilds.com/dashboard') },
      { icon: '◉', label: 'Edit Profile' },
      { icon: '◈', label: 'Company Settings', admin: true },
      { icon: '◎', label: 'Manage Team', admin: true },
    ]},
    { title: 'WORK', items: [
      { icon: '⊙', label: 'Office Locations', admin: true },
      { icon: '◷', label: 'Shift Timings', admin: true },
      { icon: '◇', label: 'Holiday Calendar' },
      { icon: '◆', label: 'Leave Policy', admin: true },
    ]},
    { title: 'PAYROLL', items: [
      { icon: '◈', label: 'Salary Structure', admin: true },
      { icon: '◎', label: 'Bank Details' },
      { icon: '◉', label: 'Payslips' },
    ]},
    { title: 'INTEGRATIONS', items: [
      { icon: '⬡', label: 'TARAhut CRM', connected: true },
      { icon: '◉', label: 'WhatsApp', connected: true },
      { icon: '◎', label: 'Email Notifications' },
    ]},
    { title: 'APP', items: [
      { icon: '◈', label: `Check-in reminders: ${reminders ? 'On' : 'Off'}`, onPress: toggleReminders },
      { icon: '◎', label: 'Language' },
      { icon: '◉', label: 'Privacy policy', onPress: () => Linking.openURL('https://haazri.tarahutaibuilds.com/privacy') },
      { icon: '◎', label: 'Help & support', onPress: () => Linking.openURL('https://haazri.tarahutaibuilds.com/support') },
      { icon: isDark ? '☀️' : '🌙', label: isDark ? 'Light Mode' : 'Dark Mode', onPress: toggleTheme },
    ]},
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <View style={[styles.avatarLg, { backgroundColor: C.bgElevated, borderColor: C.accentBorder }]}>
          <Text style={[styles.avatarText, { color: C.textPrimary }]}>{(user?.name || 'U')[0]}</Text>
        </View>
        <Text style={[styles.name, { color: C.textPrimary }]}>{user?.name || 'User'}</Text>
        <Text style={[styles.role, { color: C.textSecondary }]}>{user?.designation || (isAdmin ? 'Admin' : 'Staff')}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: C.bgCard, borderColor: C.border }]}>
            <Text style={[styles.metaText, { color: C.textSecondary }]}>{user?.phone || 'No phone on file'}</Text>
          </View>
          {!!user?.company?.name && (
            <View style={[styles.metaPill, { backgroundColor: C.bgCard, borderColor: C.border }]}>
              <Text style={[styles.metaText, { color: C.textSecondary }]}>{user.company.name}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        {SHOW_SAMPLE_DATA && (
        <View style={[styles.statsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderColor: C.border }]}>
          {[
            { value: '22', label: 'Present' },
            { value: '8.5h', label: 'Avg Hours' },
            { value: '96%', label: 'Score' },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={[styles.statDivider, { backgroundColor: C.border }]} />}
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: C.textPrimary }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: C.textMuted }]}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        )}
      </View>

      {/* Menu */}
      {menuSections.map((section) => {
        // Items without an action are placeholders for features not built yet; they only
        // appear in demo builds (src/config/features.js) so the store build has no dead taps.
        const items = section.items.filter(i => (!i.admin || isAdmin) && (SHOW_SAMPLE_DATA || i.onPress));
        if (!items.length) return null;
        return (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.textMuted }]}>{section.title}</Text>
            <View style={[styles.menuCard, { backgroundColor: C.bgCard, borderColor: C.border }]}>
              {items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, idx < items.length - 1 && [styles.menuBorder, { borderBottomColor: C.border }]]}
                  activeOpacity={0.6}
                  onPress={item.onPress}
                >
                  <Text style={[styles.menuIcon, { color: C.textMuted }]}>{item.icon}</Text>
                  <Text style={[styles.menuLabel, { color: C.textPrimary }]}>{item.label}</Text>
                  <View style={{ flex: 1 }} />
                  {item.connected && <View style={[styles.connectedDot, { backgroundColor: C.success }]} />}
                  <Text style={[styles.menuArrow, { color: C.textMuted }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: C.dangerSoft, borderColor: C.danger + '20' }]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={[styles.logoutText, { color: C.danger }]}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.6}>
        <Text style={[styles.deleteText, { color: C.danger }]}>Delete my account</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: C.textMuted }]}>TARAhut Haazri · by TARAhut AI Builds · v{Constants.expoConfig?.version || '1.0.0'}</Text>
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { alignItems: 'center', paddingBottom: 24, paddingHorizontal: SPACING.xl },
  avatarLg: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.accentBorder },
  avatarText: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  name: { ...FONTS.h2, marginTop: 14 },
  role: { ...FONTS.caption, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaPill: { backgroundColor: COLORS.bgCard, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  metaText: { ...FONTS.small, color: COLORS.textSecondary, fontSize: 11 },
  statsCard: { flexDirection: 'row', ...GLASS.strong, borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: 20, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { ...FONTS.small, marginTop: 4, fontSize: 10 },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  section: { paddingHorizontal: SPACING.xl, marginTop: 24 },
  sectionTitle: { ...FONTS.small, letterSpacing: 2, fontSize: 10, marginBottom: 10 },
  menuCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuIcon: { fontSize: 16, color: COLORS.textMuted, marginRight: 14, width: 20, textAlign: 'center' },
  menuLabel: { ...FONTS.bodyMedium, fontSize: 14 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success, marginRight: 8 },
  menuArrow: { fontSize: 20, color: COLORS.textMuted },

  logoutBtn: { marginHorizontal: SPACING.xl, marginTop: 24, padding: 14, borderRadius: RADIUS.sm, backgroundColor: COLORS.dangerSoft, alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger + '20' },
  deleteBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 },
  deleteText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  logoutText: { fontSize: 14, fontWeight: '600', color: COLORS.danger },
  version: { ...FONTS.small, textAlign: 'center', marginTop: 16, fontSize: 10 },
});
