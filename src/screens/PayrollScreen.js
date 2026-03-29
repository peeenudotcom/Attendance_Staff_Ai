import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const STAFF_SALARY = [
  { id: '1', name: 'Rahul Sharma', dept: 'Sales', type: 'monthly', base: 25000, present: 24, total: 26, advance: 2000, deduction: 500, bonus: 1000, status: 'pending' },
  { id: '2', name: 'Priya Verma', dept: 'Marketing', type: 'monthly', base: 22000, present: 25, total: 26, advance: 0, deduction: 0, bonus: 500, status: 'paid' },
  { id: '3', name: 'Amit Kumar', dept: 'Development', type: 'monthly', base: 35000, present: 22, total: 26, advance: 5000, deduction: 1500, bonus: 0, status: 'pending' },
  { id: '4', name: 'Sunita Devi', dept: 'Support', type: 'daily', base: 800, present: 23, total: 26, advance: 1000, deduction: 0, bonus: 0, status: 'pending' },
  { id: '5', name: 'Vikram Singh', dept: 'Sales', type: 'monthly', base: 20000, present: 26, total: 26, advance: 0, deduction: 0, bonus: 2000, status: 'paid' },
  { id: '6', name: 'Neha Gupta', dept: 'HR', type: 'monthly', base: 28000, present: 24, total: 26, advance: 3000, deduction: 800, bonus: 0, status: 'processing' },
];

export default function PayrollScreen({ navigation }) {
  const { colors: C } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState('March 2026');
  const [filter, setFilter] = useState('all');

  const calcNet = (s) => {
    const earned = s.type === 'daily' ? s.base * s.present : Math.round(s.base * (s.present / s.total));
    return earned - s.advance - s.deduction + s.bonus;
  };

  const totalPayroll = STAFF_SALARY.reduce((sum, s) => sum + calcNet(s), 0);
  const totalPaid = STAFF_SALARY.filter(s => s.status === 'paid').reduce((sum, s) => sum + calcNet(s), 0);
  const totalPending = totalPayroll - totalPaid;

  const filtered = filter === 'all' ? STAFF_SALARY : STAFF_SALARY.filter(s => s.status === filter);

  const statusConfig = {
    paid: { color: COLORS.success, bg: COLORS.successLight, label: 'Paid' },
    pending: { color: COLORS.warning, bg: COLORS.warningLight, label: 'Pending' },
    processing: { color: COLORS.info, bg: COLORS.infoLight, label: 'Processing' },
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Payroll</Text>
        <TouchableOpacity style={[styles.monthBtn, { backgroundColor: C.accentSoft }]}>
          <Text style={[styles.monthText, { color: C.textAccent }]}>{selectedMonth} ▾</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.accent }]}>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Total Payroll</Text>
          <Text style={[styles.summaryValue, { color: COLORS.accent }]}>₹{totalPayroll.toLocaleString()}</Text>
          <Text style={[styles.summaryMeta, { color: C.textMuted }]}>{STAFF_SALARY.length} staff members</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.success }]}>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Paid</Text>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>₹{totalPaid.toLocaleString()}</Text>
          <Text style={[styles.summaryMeta, { color: C.textMuted }]}>{STAFF_SALARY.filter(s => s.status === 'paid').length} paid</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.warning }]}>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Pending</Text>
          <Text style={[styles.summaryValue, { color: COLORS.warning }]}>₹{totalPending.toLocaleString()}</Text>
          <Text style={[styles.summaryMeta, { color: C.textMuted }]}>{STAFF_SALARY.filter(s => s.status !== 'paid').length} remaining</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.danger }]}>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Advances</Text>
          <Text style={[styles.summaryValue, { color: COLORS.danger }]}>₹{STAFF_SALARY.reduce((s, x) => s + x.advance, 0).toLocaleString()}</Text>
          <Text style={[styles.summaryMeta, { color: C.textMuted }]}>This month</Text>
        </View>
      </View>

      {/* Bulk Actions */}
      <View style={styles.bulkRow}>
        <TouchableOpacity style={styles.bulkBtn} activeOpacity={0.8}>
          <Text style={styles.bulkIcon}>💳</Text>
          <Text style={styles.bulkText}>Pay All Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnOutline, { backgroundColor: C.bgCard, borderColor: C.accentBorder }]} activeOpacity={0.8}>
          <Text style={styles.bulkIcon}>📄</Text>
          <Text style={[styles.bulkText, { color: C.textAccent }]}>Generate Slips</Text>
        </TouchableOpacity>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {['all', 'pending', 'processing', 'paid'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              { backgroundColor: C.bgCard, borderColor: C.border },
              filter === f && { backgroundColor: C.bg, borderColor: C.textPrimary },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              filter === f && { color: C.textPrimary, fontWeight: '700' },
            ]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Staff Salary List */}
      {filtered.map((staff) => {
        const net = calcNet(staff);
        const config = statusConfig[staff.status];
        return (
          <TouchableOpacity key={staff.id} style={[styles.staffCard, { backgroundColor: C.bgCard, borderColor: C.border }]} activeOpacity={0.7}>
            <View style={styles.staffHeader}>
              <View style={[styles.staffAvatar, { backgroundColor: C.accentSoft }]}>
                <Text style={[styles.staffInitial, { color: C.textAccent }]}>{staff.name[0]}</Text>
              </View>
              <View style={styles.staffInfo}>
                <Text style={[styles.staffName, { color: C.textPrimary }]}>{staff.name}</Text>
                <Text style={[styles.staffDept, { color: C.textMuted }]}>{staff.dept} · {staff.type}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
              </View>
            </View>

            <View style={[styles.salaryBreakdown, { borderTopColor: C.border }]}>
              <View style={styles.salaryRow}>
                <Text style={[styles.salaryLabel, { color: C.textSecondary }]}>Base ({staff.present}/{staff.total} days)</Text>
                <Text style={[styles.salaryAmount, { color: C.textPrimary }]}>₹{staff.type === 'daily' ? (staff.base * staff.present).toLocaleString() : Math.round(staff.base * staff.present / staff.total).toLocaleString()}</Text>
              </View>
              {staff.bonus > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={[styles.salaryLabel, { color: C.textSecondary }]}>Bonus</Text>
                  <Text style={[styles.salaryAmount, { color: COLORS.success }]}>+₹{staff.bonus.toLocaleString()}</Text>
                </View>
              )}
              {staff.advance > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={[styles.salaryLabel, { color: C.textSecondary }]}>Advance</Text>
                  <Text style={[styles.salaryAmount, { color: COLORS.danger }]}>-₹{staff.advance.toLocaleString()}</Text>
                </View>
              )}
              {staff.deduction > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={[styles.salaryLabel, { color: C.textSecondary }]}>Deduction</Text>
                  <Text style={[styles.salaryAmount, { color: COLORS.danger }]}>-₹{staff.deduction.toLocaleString()}</Text>
                </View>
              )}
              <View style={[styles.netRow, { borderTopColor: C.border }]}>
                <Text style={[styles.netLabel, { color: C.textPrimary }]}>Net Payable</Text>
                <Text style={[styles.netAmount, { color: C.textAccent }]}>₹{net.toLocaleString()}</Text>
              </View>
            </View>

            {staff.status === 'pending' && (
              <View style={styles.staffActions}>
                <TouchableOpacity style={styles.payBtn}>
                  <Text style={styles.payBtnText}>💳 Pay Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.advanceBtn, { backgroundColor: C.bgElevated }]}>
                  <Text style={[styles.advanceBtnText, { color: C.textSecondary }]}>Record Advance</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingTop: 60, paddingBottom: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gray100, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20, color: COLORS.text },
  headerTitle: { ...FONTS.h2 },
  monthBtn: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  monthText: { fontSize: 12, fontWeight: '600', color: COLORS.accent },

  summaryRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: 10, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, borderLeftWidth: 3, ...SHADOWS.sm },
  summaryLabel: { ...FONTS.small, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  summaryMeta: { ...FONTS.small, marginTop: 4 },

  bulkRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: 10, marginTop: 16 },
  bulkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.accent, paddingVertical: 14, borderRadius: RADIUS.md, ...SHADOWS.accent },
  bulkBtnOutline: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.accent, shadowColor: 'transparent' },
  bulkIcon: { fontSize: 16 },
  bulkText: { fontSize: 14, fontWeight: '600', color: COLORS.white },

  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: 8, marginTop: 20, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: COLORS.gray500 },
  filterTextActive: { color: COLORS.white },

  staffCard: { backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: 10, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm },
  staffHeader: { flexDirection: 'row', alignItems: 'center' },
  staffAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accentSoft, justifyContent: 'center', alignItems: 'center' },
  staffInitial: { fontSize: 16, fontWeight: '700', color: COLORS.accent },
  staffInfo: { flex: 1, marginLeft: 12 },
  staffName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  staffDept: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: '600' },

  salaryBreakdown: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  salaryLabel: { ...FONTS.caption },
  salaryAmount: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  netLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  netAmount: { fontSize: 18, fontWeight: '800', color: COLORS.accent },

  staffActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  payBtn: { flex: 1, backgroundColor: COLORS.accent, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', ...SHADOWS.accent },
  payBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  advanceBtn: { flex: 1, backgroundColor: COLORS.gray100, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  advanceBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
});
