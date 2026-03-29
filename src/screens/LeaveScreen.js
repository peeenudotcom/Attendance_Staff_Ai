import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AIRecommendationBadge from '../components/AIRecommendationBadge';
import { evaluateLeaveRequest } from '../utils/aiEngine';
import { getLeaveRequests } from '../data/mockData';

const LEAVE_BALANCE = [
  { type: 'Casual Leave', icon: '🏖️', total: 12, used: 3, color: COLORS.info },
  { type: 'Sick Leave', icon: '🏥', total: 8, used: 1, color: COLORS.danger },
  { type: 'Earned Leave', icon: '💼', total: 15, used: 5, color: COLORS.success },
  { type: 'Comp Off', icon: '🔄', total: 4, used: 0, color: COLORS.warning },
];

const LEAVE_REQUESTS = getLeaveRequests();

const MY_LEAVES = [
  { id: '1', type: 'Casual Leave', from: '2026-03-15', to: '2026-03-16', days: 2, reason: 'Personal', status: 'approved' },
  { id: '2', type: 'Sick Leave', from: '2026-02-20', to: '2026-02-20', days: 1, reason: 'Unwell', status: 'approved' },
];

export default function LeaveScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: C } = useTheme();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'requests' : 'balance');
  const [showApply, setShowApply] = useState(false);
  const [leaveType, setLeaveType] = useState('');
  const [reason, setReason] = useState('');

  const statusConfig = {
    pending: { color: COLORS.warning, bg: COLORS.warningLight, label: 'Pending' },
    approved: { color: COLORS.success, bg: COLORS.successLight, label: 'Approved' },
    rejected: { color: COLORS.danger, bg: COLORS.dangerLight, label: 'Rejected' },
  };

  const handleApprove = (id) => Alert.alert('Approved', 'Leave request has been approved');
  const handleReject = (id) => Alert.alert('Rejected', 'Leave request has been rejected');

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Leave Management</Text>
        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowApply(!showApply)}>
          <Text style={styles.applyText}>+ Apply</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(isAdmin ? ['requests', 'balance', 'history'] : ['balance', 'history']).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, { backgroundColor: C.bgElevated }, tab === t && { backgroundColor: C.bg }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: C.textMuted }, tab === t && { color: C.textPrimary }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Apply Leave Form */}
      {showApply && (
        <View style={[styles.applyCard, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
          <Text style={[styles.applyTitle, { color: C.textPrimary }]}>Apply for Leave</Text>
          <Text style={[styles.label, { color: C.textMuted }]}>Leave Type</Text>
          <View style={styles.typeGrid}>
            {LEAVE_BALANCE.map((l) => (
              <TouchableOpacity
                key={l.type}
                style={[
                  styles.typeChip,
                  { backgroundColor: C.bgElevated, borderColor: C.border },
                  leaveType === l.type && { backgroundColor: C.accentSoft, borderColor: C.accentBorder },
                ]}
                onPress={() => setLeaveType(l.type)}
              >
                <Text style={styles.typeIcon}>{l.icon}</Text>
                <Text style={[styles.typeText, { color: C.textPrimary }, leaveType === l.type && { color: C.textAccent }]}>
                  {l.type.replace(' Leave', '')}
                </Text>
                <Text style={[styles.typeCount, { color: C.textMuted }]}>{l.total - l.used} left</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.label, { color: C.textMuted }]}>Reason</Text>
          <TextInput
            style={[styles.reasonInput, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
            placeholder="Enter reason for leave"
            placeholderTextColor={C.textMuted}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => { setShowApply(false); Alert.alert('Submitted', 'Leave request submitted'); }}
          >
            <Text style={styles.submitText}>Submit Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Balance Tab */}
      {tab === 'balance' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Leave Balance</Text>
          {LEAVE_BALANCE.map((leave) => (
            <View key={leave.type} style={[styles.balanceCard, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
              <View style={styles.balanceLeft}>
                <Text style={styles.balanceIcon}>{leave.icon}</Text>
                <View>
                  <Text style={[styles.balanceType, { color: C.textPrimary }]}>{leave.type}</Text>
                  <Text style={[styles.balanceMeta, { color: C.textMuted }]}>{leave.used} used of {leave.total}</Text>
                </View>
              </View>
              <View style={styles.balanceRight}>
                <Text style={[styles.balanceCount, { color: leave.color }]}>{leave.total - leave.used}</Text>
                <Text style={[styles.balanceLabel, { color: C.textMuted }]}>left</Text>
              </View>
              {/* Progress Bar */}
              <View style={[styles.progressBar, { backgroundColor: C.bgElevated }]}>
                <View style={[styles.progressFill, { width: `${(leave.used / leave.total) * 100}%`, backgroundColor: leave.color }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Requests Tab (Admin) */}
      {tab === 'requests' && isAdmin && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Pending Requests</Text>
          {LEAVE_REQUESTS.map((req) => {
            const config = statusConfig[req.status];
            return (
              <View key={req.id} style={[styles.requestCard, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestAvatar}>
                    <Text style={styles.requestInitial}>{req.name[0]}</Text>
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={[styles.requestName, { color: C.textPrimary }]}>{req.name}</Text>
                    <Text style={[styles.requestType, { color: C.textMuted }]}>{req.type}</Text>
                  </View>
                  <View style={[styles.requestBadge, { backgroundColor: config.bg }]}>
                    <Text style={[styles.requestBadgeText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </View>
                <View style={[styles.requestDetails, { borderTopColor: C.border }]}>
                  <View style={styles.requestDetail}>
                    <Text style={[styles.detailLabel, { color: C.textMuted }]}>📅 Duration</Text>
                    <Text style={[styles.detailValue, { color: C.textPrimary }]}>{formatDate(req.from)} - {formatDate(req.to)} ({req.days}d)</Text>
                  </View>
                  <View style={styles.requestDetail}>
                    <Text style={[styles.detailLabel, { color: C.textMuted }]}>📝 Reason</Text>
                    <Text style={[styles.detailValue, { color: C.textPrimary }]}>{req.reason}</Text>
                  </View>
                </View>
                {req.status === 'pending' && (
                  <>
                    <AIRecommendationBadge
                      evaluation={evaluateLeaveRequest(req)}
                      onAutoApprove={evaluateLeaveRequest(req).recommendation === 'approve' ? () => handleApprove(req.id) : null}
                    />
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req.id)}>
                        <Text style={styles.rejectText}>✕ Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(req.id)}>
                        <Text style={styles.approveText}>✓ Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Leave History</Text>
          {MY_LEAVES.map((leave) => {
            const config = statusConfig[leave.status];
            return (
              <View key={leave.id} style={[styles.historyCard, { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border }]}>
                <View style={styles.historyLeft}>
                  <Text style={[styles.historyType, { color: C.textPrimary }]}>{leave.type}</Text>
                  <Text style={[styles.historyDates, { color: C.textMuted }]}>{formatDate(leave.from)} - {formatDate(leave.to)}</Text>
                  <Text style={[styles.historyReason, { color: C.textMuted }]}>{leave.reason}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={[styles.historyDays, { color: C.textAccent }]}>{leave.days}d</Text>
                  <View style={[styles.historyBadge, { backgroundColor: config.bg }]}>
                    <Text style={[styles.historyBadgeText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingTop: 60, paddingBottom: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gray100, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20, color: COLORS.text },
  headerTitle: { ...FONTS.h3 },
  applyBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  applyText: { fontSize: 13, fontWeight: '600', color: COLORS.white },

  tabRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, paddingTop: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: COLORS.gray100, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  tabTextActive: { color: COLORS.white },

  section: { paddingHorizontal: SPACING.xl, marginTop: 20 },
  sectionTitle: { ...FONTS.h3, fontSize: 16, marginBottom: 12 },

  // Apply form
  applyCard: { backgroundColor: COLORS.white, margin: SPACING.xl, borderRadius: RADIUS.lg, padding: SPACING.xl, ...SHADOWS.md },
  applyTitle: { ...FONTS.h3, marginBottom: 16 },
  label: { ...FONTS.captionMedium, color: COLORS.gray600, marginBottom: 8, marginTop: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: RADIUS.sm, backgroundColor: COLORS.gray50, borderWidth: 1.5, borderColor: COLORS.border },
  typeChipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  typeIcon: { fontSize: 16 },
  typeText: { fontSize: 13, fontWeight: '500', color: COLORS.text, flex: 1 },
  typeTextActive: { color: COLORS.accent },
  typeCount: { fontSize: 11, color: COLORS.textMuted },
  reasonInput: { backgroundColor: COLORS.gray50, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: 12, fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 16, ...SHADOWS.accent },
  submitText: { ...FONTS.button, color: COLORS.white },

  // Balance
  balanceCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: 10, ...SHADOWS.sm },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceIcon: { fontSize: 28 },
  balanceType: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  balanceMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  balanceRight: { position: 'absolute', top: 16, right: 16, alignItems: 'center' },
  balanceCount: { fontSize: 24, fontWeight: '800' },
  balanceLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' },
  progressBar: { height: 4, backgroundColor: COLORS.gray100, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  // Requests
  requestCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: 10, ...SHADOWS.sm },
  requestHeader: { flexDirection: 'row', alignItems: 'center' },
  requestAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accentSoft, justifyContent: 'center', alignItems: 'center' },
  requestInitial: { fontSize: 16, fontWeight: '700', color: COLORS.accent },
  requestInfo: { flex: 1, marginLeft: 12 },
  requestName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  requestType: { fontSize: 12, color: COLORS.textMuted },
  requestBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  requestBadgeText: { fontSize: 11, fontWeight: '600' },
  requestDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  requestDetail: { flexDirection: 'row', marginBottom: 6 },
  detailLabel: { fontSize: 13, color: COLORS.textMuted, width: 100 },
  detailValue: { fontSize: 13, fontWeight: '500', color: COLORS.text, flex: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: COLORS.dangerLight, alignItems: 'center' },
  rejectText: { fontSize: 13, fontWeight: '600', color: COLORS.danger },
  approveBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: COLORS.success, alignItems: 'center' },
  approveText: { fontSize: 13, fontWeight: '600', color: COLORS.white },

  // History
  historyCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: 8, ...SHADOWS.xs },
  historyLeft: { flex: 1 },
  historyType: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  historyDates: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  historyReason: { fontSize: 12, color: COLORS.gray500, marginTop: 4 },
  historyRight: { alignItems: 'flex-end' },
  historyDays: { fontSize: 18, fontWeight: '700', color: COLORS.accent },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, marginTop: 4 },
  historyBadgeText: { fontSize: 10, fontWeight: '600' },
});
