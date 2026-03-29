import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { COLORS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import GlowDot from '../components/GlowDot';
import { generateSmartNotifications } from '../utils/aiEngine';

const PRIORITY_CONFIG = {
  critical: { icon: '🔴', color: 'danger', label: 'Critical' },
  high: { icon: '🟡', color: 'warning', label: 'Important' },
  medium: { icon: '🔵', color: 'info', label: 'Info' },
  low: { icon: '⚪', color: 'textMuted', label: 'Low' },
};

const TYPE_ICONS = {
  alert: '⚠️',
  payroll: '💳',
  leave: '📋',
  prediction: '✦',
  trend: '📉',
  late: '⏰',
  reminder: '🔔',
  info: 'ℹ️',
};

export default function NotificationsScreen({ navigation }) {
  const { colors: C } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notifications, setNotifications] = useState([]);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    setNotifications(generateSmartNotifications(isAdmin));
  }, []);

  const handleAction = (notif) => {
    switch (notif.action) {
      case 'view_absent':
      case 'view_late':
        navigation.goBack();
        break;
      case 'open_payroll':
        navigation.navigate('Payroll');
        break;
      case 'open_leaves':
        navigation.navigate('Leave');
        break;
      case 'view_prediction':
      case 'view_reports':
        navigation.navigate('Reports');
        break;
      case 'check_in':
        navigation.navigate('MarkAttendance', { type: 'check-in' });
        break;
      case 'check_out':
        navigation.navigate('MarkAttendance', { type: 'check-out' });
        break;
      case 'view_history':
        navigation.navigate('History');
        break;
      case 'send_reminder':
        Alert.alert('Sent', 'Reminder sent to all absent staff.');
        break;
      default:
        break;
    }
  };

  const dismiss = (id) => {
    setDismissed((prev) => [...prev, id]);
  };

  const activeNotifs = notifications.filter((n) => !dismissed.includes(n.id));
  const criticalCount = activeNotifs.filter((n) => n.priority === 'critical').length;
  const highCount = activeNotifs.filter((n) => n.priority === 'high').length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Smart Notifications</Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>AI-prioritized alerts</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: C.dangerSoft || 'rgba(239,68,68,0.12)' }]}>
          <Text style={[styles.countText, { color: C.danger }]}>{activeNotifs.length}</Text>
        </View>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryRow}>
        {criticalCount > 0 && (
          <View style={[styles.summaryChip, { backgroundColor: C.dangerSoft || 'rgba(239,68,68,0.12)' }]}>
            <Text style={[styles.summaryText, { color: C.danger }]}>{criticalCount} Critical</Text>
          </View>
        )}
        {highCount > 0 && (
          <View style={[styles.summaryChip, { backgroundColor: C.warningSoft || 'rgba(245,158,11,0.12)' }]}>
            <Text style={[styles.summaryText, { color: C.warning }]}>{highCount} Important</Text>
          </View>
        )}
        <View style={[styles.summaryChip, { backgroundColor: C.accentSoft }]}>
          <Text style={[styles.summaryText, { color: C.textAccent }]}>{activeNotifs.length} Total</Text>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        {activeNotifs.length === 0 ? (
          <GlassCard style={styles.emptyCard} borderRadius={RADIUS.xl}>
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>All Clear!</Text>
              <Text style={[styles.emptyText, { color: C.textMuted }]}>No pending notifications. Everything is on track.</Text>
            </View>
          </GlassCard>
        ) : (
          activeNotifs.map((notif) => {
            const config = PRIORITY_CONFIG[notif.priority];
            const typeIcon = TYPE_ICONS[notif.type] || '📌';
            const borderColor = C[config.color] || C.textMuted;

            return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: borderColor, borderLeftWidth: 3 }]}
                onPress={() => handleAction(notif)}
                activeOpacity={0.7}
              >
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTypeIcon}>{typeIcon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: C.textPrimary }]}>{notif.title}</Text>
                    <Text style={[styles.notifTime, { color: C.textMuted }]}>{notif.time}</Text>
                  </View>
                  <TouchableOpacity onPress={() => dismiss(notif.id)} style={styles.dismissBtn}>
                    <Text style={[styles.dismissText, { color: C.textMuted }]}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.notifBody, { color: C.textSecondary }]}>{notif.body}</Text>
                <View style={styles.notifFooter}>
                  <View style={[styles.priorityBadge, { backgroundColor: (borderColor + '20') }]}>
                    <GlowDot color={borderColor} size={5} />
                    <Text style={[styles.priorityText, { color: borderColor }]}>{config.label}</Text>
                  </View>
                  <Text style={[styles.tapHint, { color: C.textAccent }]}>Tap to view →</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* AI Summary */}
      {activeNotifs.length > 0 && (
        <GlassCard style={styles.aiSummaryCard} borderRadius={RADIUS.xl}>
          <View style={styles.aiSummaryInner}>
            <View style={styles.aiSummaryHeader}>
              <Text style={{ fontSize: 14, color: '#A78BFA' }}>✦</Text>
              <Text style={[styles.aiSummaryLabel, { color: C.textMuted }]}>AI SUMMARY</Text>
            </View>
            <Text style={[styles.aiSummaryText, { color: C.textPrimary }]}>
              {criticalCount > 0
                ? `You have ${criticalCount} critical alert${criticalCount > 1 ? 's' : ''} that need immediate attention. ${highCount > 0 ? `Plus ${highCount} important notification${highCount > 1 ? 's' : ''}.` : ''} Tap each to take action.`
                : highCount > 0
                ? `${highCount} important notification${highCount > 1 ? 's' : ''} to review. No critical issues right now.`
                : 'All routine updates. No urgent action needed today.'}
            </Text>
          </View>
        </GlassCard>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backIcon: { fontSize: 20 },
  headerTitle: { ...FONTS.h3 },
  headerSub: { fontSize: 11, marginTop: 2 },
  countBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  countText: { fontSize: 16, fontWeight: '800' },

  summaryRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, paddingTop: 16, gap: 8 },
  summaryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  summaryText: { fontSize: 11, fontWeight: '700' },

  section: { paddingHorizontal: SPACING.xl, marginTop: 16, gap: 10 },

  notifCard: { borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notifTypeIcon: { fontSize: 20, marginTop: 2 },
  notifTitle: { ...FONTS.bodyMedium, fontSize: 14 },
  notifTime: { fontSize: 11, marginTop: 2 },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 14 },
  notifBody: { ...FONTS.caption, lineHeight: 20, marginTop: 10, marginLeft: 30 },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginLeft: 30 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  priorityText: { fontSize: 10, fontWeight: '700' },
  tapHint: { fontSize: 11, fontWeight: '600' },

  emptyCard: { marginTop: 40 },
  emptyInner: { padding: SPACING.xxl, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { ...FONTS.h3, marginBottom: 8 },
  emptyText: { ...FONTS.caption, textAlign: 'center' },

  aiSummaryCard: { marginHorizontal: SPACING.xl, marginTop: 20 },
  aiSummaryInner: { padding: SPACING.xl },
  aiSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  aiSummaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  aiSummaryText: { ...FONTS.body, lineHeight: 22 },
});
