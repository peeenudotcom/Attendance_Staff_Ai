import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { RADIUS, SPACING } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { attendanceAPI } from '../services/api';

// The signed-in person's own month: a calendar of their days and the month's totals.
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const istMonth = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7);
const shiftMonth = (m, n) => { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const niceDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const DAY_STYLE = {
  present: { label: 'Present', short: 'P', tone: 'success' },
  late: { label: 'Late', short: 'L', tone: 'warning' },
  half: { label: 'Half day', short: 'H', tone: 'half' },
  absent: { label: 'Absent', short: 'A', tone: 'danger' },
  leave: { label: 'On leave', short: 'LV', tone: 'info' },
  off: { label: 'Weekly off', short: '·', tone: 'muted' },
  holiday: { label: 'Holiday', short: 'HO', tone: 'holiday' },
  pending: { label: '', short: '', tone: 'none' },
  before: { label: '', short: '', tone: 'none' },
};

export function toneColor(C, tone) {
  return { success: C.success, warning: C.warning, danger: C.danger, info: C.info, half: '#7A3E8A', holiday: '#8A6D1F', muted: C.textMuted }[tone] || C.textMuted;
}

export default function HistoryScreen({ navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const [month, setMonth] = useState(istMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (m) => {
    setError('');
    try {
      const res = await attendanceAPI.getMonth(m);
      setData(res);
      setSelected(null);
    } catch (e) {
      setError(e.message || 'Could not load your attendance');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setData(null); load(month); }, [month, load]);

  const t = data?.totals;
  const first = data ? new Date(`${data.days[0].date}T00:00:00Z`).getUTCDay() : 0;
  const cells = data ? [...Array(first).fill(null), ...data.days] : [];
  const sel = data?.days.find((d) => d.date === selected);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: headerTop, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(month); }} tintColor={C.accent} />}
    >
      <Text style={[styles.title, { color: C.textPrimary }]}>My attendance</Text>

      <View style={styles.monthRow}>
        <TouchableOpacity style={[styles.arrow, { borderColor: C.border, backgroundColor: C.bgCard }]} onPress={() => setMonth(shiftMonth(month, -1))}>
          <Text style={[styles.arrowText, { color: C.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: C.textPrimary }]}>{monthName(month)}</Text>
        <TouchableOpacity disabled={month >= istMonth()} style={[styles.arrow, { borderColor: C.border, backgroundColor: C.bgCard, opacity: month >= istMonth() ? 0.35 : 1 }]} onPress={() => setMonth(shiftMonth(month, 1))}>
          <Text style={[styles.arrowText, { color: C.textPrimary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {!data && !error && <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />}
      {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

      {t && (
        <View style={styles.totals}>
          {[
            ['Present', t.present + t.late, C.success],
            ['Late', t.late, C.warning],
            ['Absent', t.absent, C.danger],
            ['Leave', t.leave, C.info],
            ...(t.half ? [['Half day', t.half, '#7A3E8A']] : []),
            ...(t.holiday ? [['Holiday', t.holiday, '#8A6D1F']] : []),
          ].map(([label, n, color]) => (
            <View key={label} style={[styles.total, { backgroundColor: C.bgCard, borderColor: C.border }]}>
              <Text style={[styles.totalNum, { color }]}>{n}</Text>
              <Text style={[styles.totalLabel, { color: C.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>
      )}
      {t && <Text style={[styles.hours, { color: C.textMuted }]}>{t.hours === '—' ? 'No hours yet' : `${t.hours} worked`}</Text>}

      {data && (
        <View style={[styles.calendar, { backgroundColor: C.bgCard, borderColor: C.border }]}>
          <View style={styles.week}>
            {WEEK.map((w, i) => <Text key={i} style={[styles.weekDay, { color: C.textMuted }]}>{w}</Text>)}
          </View>
          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={styles.cell} />;
              const st = DAY_STYLE[d.status] || DAY_STYLE.pending;
              const color = toneColor(C, st.tone);
              const isSel = d.date === selected;
              return (
                <TouchableOpacity key={d.date} style={styles.cell} onPress={() => setSelected(isSel ? null : d.date)} activeOpacity={0.7}>
                  <View style={[styles.dayBox, st.tone !== 'none' && st.tone !== 'muted' && { backgroundColor: `${color}22` },
                    isSel && { borderColor: C.accent, borderWidth: 2 }]}>
                    <Text style={[styles.dayNum, { color: C.textPrimary }]}>{Number(d.date.slice(8))}</Text>
                    <Text style={[styles.dayCode, { color }]}>{st.short}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {sel && (
        <View style={[styles.detail, { backgroundColor: C.bgCard, borderColor: C.border }]}>
          <Text style={[styles.detailDate, { color: C.textPrimary }]}>{niceDay(sel.date)}</Text>
          <Text style={[styles.detailStatus, { color: toneColor(C, (DAY_STYLE[sel.status] || DAY_STYLE.pending).tone) }]}>
            {sel.holiday ? `Holiday: ${sel.holiday}` : DAY_STYLE[sel.status]?.label || (sel.status === 'pending' ? 'Not checked in yet' : 'Before you joined')}
          </Text>
          {sel.checkIn && <Text style={[styles.detailLine, { color: C.textSecondary }]}>In {sel.checkIn}{sel.checkOut ? `  ·  Out ${sel.checkOut}` : '  ·  No check-out'}{sel.hours ? `  ·  ${sel.hours}` : ''}</Text>}
          {sel.edited && <Text style={[styles.detailLine, { color: C.textMuted }]}>Added or changed by your admin{sel.note ? `: ${sel.note}` : ''}</Text>}
          {sel.leaveType && <Text style={[styles.detailLine, { color: C.textMuted }]}>{sel.leaveType === 'unpaid' ? 'Unpaid leave' : 'Paid leave'}</Text>}
          {['present', 'late', 'half', 'absent'].includes(sel.status) && (
            <TouchableOpacity onPress={() => navigation.navigate('Corrections', { date: sel.date, kind: sel.checkIn && !sel.checkOut ? 'missed_check_out' : sel.checkIn ? 'wrong_time' : 'missed_check_in' })} style={{ marginTop: 10 }}>
              <Text style={[styles.fixLink, { color: C.textAccent }]}>Something wrong? Ask for a correction</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {data && !sel && <Text style={[styles.hint, { color: C.textMuted }]}>Tap a day to see its times.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', paddingHorizontal: SPACING.xl },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, marginTop: 14, gap: 10 },
  arrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 22, fontWeight: '600', marginTop: -2 },
  monthText: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  error: { textAlign: 'center', marginTop: 30, paddingHorizontal: SPACING.xl },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: SPACING.xl, marginTop: 16 },
  total: { flexGrow: 1, minWidth: 70, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  totalNum: { fontSize: 20, fontWeight: '800' },
  totalLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  hours: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  calendar: { marginHorizontal: SPACING.xl, marginTop: 14, borderWidth: 1, borderRadius: RADIUS.lg, padding: 8 },
  week: { flexDirection: 'row' },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 3 },
  dayBox: { borderRadius: 10, paddingVertical: 6, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  dayNum: { fontSize: 13, fontWeight: '600' },
  dayCode: { fontSize: 10, fontWeight: '800', minHeight: 13 },
  detail: { marginHorizontal: SPACING.xl, marginTop: 12, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  detailDate: { fontSize: 15, fontWeight: '700' },
  detailStatus: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  detailLine: { fontSize: 13, marginTop: 4 },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 12 },
  fixLink: { fontSize: 13, fontWeight: '700' },
});
