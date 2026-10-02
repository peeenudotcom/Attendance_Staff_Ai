import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS, GLASS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors: C, isDark, toggleTheme } = useTheme();
  const headerTop = useHeaderInset(16);
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const menuSections = [
    { title: 'ACCOUNT', items: [
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
      { icon: '◈', label: 'Notifications' },
      { icon: '◎', label: 'Language' },
      { icon: '◉', label: 'Privacy & Security' },
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
        <Text style={[styles.role, { color: C.textSecondary }]}>{user?.designation || 'Staff'}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: C.bgCard, borderColor: C.border }]}>
            <Text style={[styles.metaText, { color: C.textSecondary }]}>{user?.phone || 'No phone on file'}</Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: C.bgCard, borderColor: C.border }]}>
            <Text style={[styles.metaText, { color: C.textSecondary }]}>{user?.company || 'TARAhut AI Labs'}</Text>
          </View>
        </View>

        {/* Stats */}
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
      </View>

      {/* Menu */}
      {menuSections.map((section) => {
        const items = section.items.filter(i => !i.admin || isAdmin);
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

      <Text style={[styles.version, { color: C.textMuted }]}>TARAhut AI Labs · v1.0.0</Text>
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
  logoutText: { fontSize: 14, fontWeight: '600', color: COLORS.danger },
  version: { ...FONTS.small, textAlign: 'center', marginTop: 16, fontSize: 10 },
});
