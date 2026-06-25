import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { COLORS, SHADOWS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { attendanceAPI } from '../services/api';

const parseMins = (h) => {
  if (!h || h === '—') return null;
  const m = /(\d+)h\s*(\d+)m/.exec(h);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};
const fmtMins = (mins) => (mins == null ? '—' : `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`);
const monthKey = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
const monthLabel = () => new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function ReportsScreen() {
  const { colors: C } = useTheme();
  const [selectedMonth] = useState(monthLabel());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await attendanceAPI.getHistory(`month=${monthKey()}`);
        if (active) setRecords(Array.isArray(res?.records) ? res.records : []);
      } catch (e) {
        if (active) setError(e?.message || 'Could not load reports');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const count = (s) => records.filter((r) => r.status === s).length;
  const present = count('present');
  const late = count('late');
  const absent = count('absent');
  const leave = count('leave');
  const workedMins = records.map((r) => parseMins(r.hours)).filter((m) => m != null);
  const overview = {
    totalDays: records.length,
    present, absent, late, leave,
    avgHours: workedMins.length ? fmtMins(workedMins.reduce((a, b) => a + b, 0) / workedMins.length) : '—',
  };

  const weeks = {};
  records.forEach((r) => {
    const w = Math.floor((new Date(r.date).getDate() - 1) / 7) + 1;
    weeks[w] = weeks[w] || { week: `Week ${w}`, present: 0, absent: 0, late: 0 };
    if (r.status === 'present') weeks[w].present += 1;
    else if (r.status === 'absent') weeks[w].absent += 1;
    else if (r.status === 'late') weeks[w].late += 1;
  });
  const weeklyData = Object.values(weeks);
  const rateDenom = present + late + absent + leave;

  if (loading) {
    return <View style={[styles.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color={C.accent} /></View>;
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: C.bg }]}>
        <Text style={[styles.title, { color: C.textPrimary }]}>Reports</Text>
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
          {rateDenom ? Math.round(((overview.present + overview.late) / rateDenom) * 100) : 0}% attendance rate
        </Text>
      </View>

      {/* Weekly Breakdown */}
      {weeklyData.length > 0 && (
        <>
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
        </>
      )}

      {/* Empty / error state */}
      {overview.totalDays === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>{error ? '⚠️' : '📊'}</Text>
          <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>
            {error ? 'Could not load reports' : 'No data this month'}
          </Text>
          <Text style={[styles.emptySub, { color: C.textMuted }]}>
            {error || 'Reports populate from your check-ins as the month progresses.'}
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 34, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: COLORS.primary, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
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
