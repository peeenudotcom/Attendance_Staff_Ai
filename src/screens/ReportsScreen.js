import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { COLORS, SHADOWS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';

export default function ReportsScreen({ navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const [selectedMonth, setSelectedMonth] = useState('March 2026');

  const overview = {
    totalDays: 28, present: 22, absent: 3, late: 2, leave: 1,
    avgHours: '8h 45m', totalCalls: 145, totalPhotos: 38,
  };

  const weeklyData = [
    { week: 'Week 1', present: 5, absent: 0, late: 1 },
    { week: 'Week 2', present: 5, absent: 1, late: 0 },
    { week: 'Week 3', present: 6, absent: 0, late: 1 },
    { week: 'Week 4', present: 6, absent: 2, late: 0 },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bg }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
            <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: C.textPrimary }]}>Reports</Text>
        </View>
        <TouchableOpacity style={[styles.monthPicker, { backgroundColor: C.accentSoft }]}>
          <Text style={[styles.monthText, { color: C.textAccent }]}>{selectedMonth} ▾</Text>
        </TouchableOpacity>
      </View>

      {/* Overview Cards */}
      <View style={styles.overviewGrid}>
        {[
          { label: 'Working Days', value: overview.totalDays, icon: '📅', color: COLORS.primary },
          { label: 'Present', value: overview.present, icon: '✅', color: COLORS.success },
          { label: 'Absent', value: overview.absent, icon: '❌', color: COLORS.danger },
          { label: 'Late', value: overview.late, icon: '⏰', color: COLORS.warning },
          { label: 'Leave', value: overview.leave, icon: '🏖️', color: COLORS.secondary },
          { label: 'Avg Hours', value: overview.avgHours, icon: '⏱️', color: COLORS.primary },
        ].map((item) => (
          <View key={item.label} style={[styles.overviewCard, { backgroundColor: C.bgCard, borderColor: C.border, borderWidth: 1 }]}>
            <Text style={styles.overviewIcon}>{item.icon}</Text>
            <Text style={[styles.overviewValue, { color: item.color }]}>{item.value}</Text>
            <Text style={[styles.overviewLabel, { color: C.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Attendance Rate */}
      <View style={[styles.rateCard, { backgroundColor: C.bgCard, borderColor: C.border, borderWidth: 1 }]}>
        <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Attendance Rate</Text>
        <View style={styles.rateBar}>
          <View style={[styles.rateSegment, { flex: overview.present, backgroundColor: COLORS.success }]} />
          <View style={[styles.rateSegment, { flex: overview.late, backgroundColor: COLORS.warning }]} />
          <View style={[styles.rateSegment, { flex: overview.absent, backgroundColor: COLORS.danger }]} />
          <View style={[styles.rateSegment, { flex: overview.leave, backgroundColor: COLORS.secondary }]} />
        </View>
        <Text style={[styles.ratePercent, { color: C.textAccent }]}>
          {Math.round(((overview.present + overview.late) / overview.totalDays) * 100)}% attendance rate
        </Text>
      </View>

      {/* Weekly Breakdown */}
      <Text style={[styles.sectionTitleOutside, { color: C.textMuted }]}>Weekly Breakdown</Text>
      {weeklyData.map((week) => (
        <View key={week.week} style={[styles.weekCard, { backgroundColor: C.bgCard, borderColor: C.border, borderWidth: 1 }]}>
          <Text style={[styles.weekTitle, { color: C.textPrimary }]}>{week.week}</Text>
          <View style={styles.weekStats}>
            <Text style={[styles.weekStat, { color: COLORS.success }]}>✅ {week.present}</Text>
            <Text style={[styles.weekStat, { color: COLORS.danger }]}>❌ {week.absent}</Text>
            <Text style={[styles.weekStat, { color: COLORS.warning }]}>⏰ {week.late}</Text>
          </View>
        </View>
      ))}

      {/* Activity Summary */}
      <Text style={[styles.sectionTitleOutside, { color: C.textMuted }]}>Activity Summary</Text>
      <View style={styles.activityRow}>
        <View style={[styles.activityCard, { backgroundColor: C.bgCard, borderColor: C.border, borderWidth: 1 }]}>
          <Text style={styles.activityIcon}>📞</Text>
          <Text style={[styles.activityValue, { color: C.accent }]}>{overview.totalCalls}</Text>
          <Text style={[styles.activityLabel, { color: C.textMuted }]}>Total Calls</Text>
        </View>
        <View style={[styles.activityCard, { backgroundColor: C.bgCard, borderColor: C.border, borderWidth: 1 }]}>
          <Text style={styles.activityIcon}>📸</Text>
          <Text style={[styles.activityValue, { color: C.accent }]}>{overview.totalPhotos}</Text>
          <Text style={[styles.activityLabel, { color: C.textMuted }]}>Photos Uploaded</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: COLORS.primary, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  monthPicker: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  monthText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  overviewCard: { width: '31%', backgroundColor: COLORS.white, borderRadius: 12, padding: 14, alignItems: 'center', ...SHADOWS.small },
  overviewIcon: { fontSize: 22 },
  overviewValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  overviewLabel: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  rateCard: { backgroundColor: COLORS.white, margin: 16, marginTop: 4, borderRadius: 12, padding: 16, ...SHADOWS.small },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  sectionTitleOutside: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  rateBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  rateSegment: { borderRadius: 6 },
  ratePercent: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  weekCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 10, ...SHADOWS.small },
  weekTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  weekStats: { flexDirection: 'row', gap: 12 },
  weekStat: { fontSize: 14, fontWeight: '600' },
  activityRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  activityCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 16, alignItems: 'center', ...SHADOWS.small },
  activityIcon: { fontSize: 28 },
  activityValue: { fontSize: 22, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  activityLabel: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
});
