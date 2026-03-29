import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS, GLASS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

const MOCK_DATA = [
  { id: '1', date: '2026-03-29', checkIn: '09:02', checkOut: '18:15', status: 'present', hours: '9h 13m', location: 'Main Office', score: 91 },
  { id: '2', date: '2026-03-28', checkIn: '09:15', checkOut: '18:30', status: 'late', hours: '9h 15m', location: 'Main Office', score: 78 },
  { id: '3', date: '2026-03-27', checkIn: '08:55', checkOut: '18:00', status: 'present', hours: '9h 05m', location: 'Main Office', score: 94 },
  { id: '4', date: '2026-03-26', checkIn: '—', checkOut: '—', status: 'absent', hours: '—', location: '—', score: 0 },
  { id: '5', date: '2026-03-25', checkIn: '09:00', checkOut: '18:10', status: 'present', hours: '9h 10m', location: 'Client Site', score: 88 },
  { id: '6', date: '2026-03-24', checkIn: '—', checkOut: '—', status: 'leave', hours: '—', location: '—', score: 0 },
  { id: '7', date: '2026-03-23', checkIn: '08:50', checkOut: '17:45', status: 'present', hours: '8h 55m', location: 'Main Office', score: 92 },
];

const statusConfig = {
  present: { color: COLORS.success, label: 'Present', dot: COLORS.success },
  late: { color: COLORS.warning, label: 'Late', dot: COLORS.warning },
  absent: { color: COLORS.danger, label: 'Absent', dot: COLORS.danger },
  leave: { color: COLORS.info, label: 'Leave', dot: COLORS.info },
};

export default function HistoryScreen() {
  const { colors: C } = useTheme();
  const [filter, setFilter] = useState('all');
  const filters = ['all', 'present', 'late', 'absent', 'leave'];
  const filtered = filter === 'all' ? MOCK_DATA : MOCK_DATA.filter(d => d.status === filter);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
    const month = date.toLocaleDateString('en-IN', { month: 'short' });
    return { day, weekday, month };
  };

  const renderItem = ({ item, index }) => {
    const config = statusConfig[item.status];
    const { day, weekday, month } = formatDate(item.date);
    const isLast = index === filtered.length - 1;

    return (
      <View style={styles.timelineItem}>
        {/* Date Column */}
        <View style={styles.dateCol}>
          <Text style={[styles.dateDay, { color: C.textPrimary }]}>{day}</Text>
          <Text style={[styles.dateWeekday, { color: C.textMuted }]}>{weekday}</Text>
        </View>

        {/* Timeline Line */}
        <View style={styles.timelineCol}>
          <View style={[styles.timelineDot, { backgroundColor: config.dot, ...SHADOWS.glow(config.dot + '60') }]} />
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: C.border }]} />}
        </View>

        {/* Content */}
        <View style={[styles.contentCard, { backgroundColor: C.bgCard, borderColor: C.border }]}>
          <View style={styles.contentHeader}>
            <View style={[styles.statusBadge, { backgroundColor: config.color + '18' }]}>
              <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
            </View>
            {item.score > 0 && (
              <View style={[styles.scoreBadge, { backgroundColor: C.accentSoft }]}>
                <Text style={[styles.scoreText, { color: C.textAccent }]}>{item.score}</Text>
              </View>
            )}
          </View>

          {item.status !== 'absent' && item.status !== 'leave' ? (
            <>
              <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                  <Text style={[styles.timeLabel, { color: C.textMuted }]}>IN</Text>
                  <Text style={[styles.timeValue, { color: C.textPrimary }]}>{item.checkIn}</Text>
                </View>
                <View style={styles.timeSep}>
                  <Text style={[styles.timeSepText, { color: C.textMuted }]}>→</Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={[styles.timeLabel, { color: C.textMuted }]}>OUT</Text>
                  <Text style={[styles.timeValue, { color: C.textPrimary }]}>{item.checkOut}</Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={[styles.timeLabel, { color: C.textMuted }]}>TOTAL</Text>
                  <Text style={[styles.timeValue, { color: C.textAccent }]}>{item.hours}</Text>
                </View>
              </View>
              <Text style={[styles.locationText, { color: C.textMuted }]}>⊙ {item.location}</Text>
            </>
          ) : (
            <Text style={[styles.noDataText, { color: C.textMuted }]}>
              {item.status === 'leave' ? 'Approved leave' : 'No check-in recorded'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Attendance Log</Text>
        <Text style={[styles.headerSub, { color: C.textMuted }]}>March 2026</Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              { backgroundColor: C.bgCard, borderColor: C.border },
              filter === f && { borderColor: C.accentBorder, backgroundColor: C.accentSoft },
            ]}
            onPress={() => setFilter(f)}
          >
            {f !== 'all' && <View style={[styles.filterDot, { backgroundColor: statusConfig[f]?.dot }]} />}
            <Text style={[styles.filterText, { color: C.textMuted }, filter === f && { color: C.textAccent, fontWeight: '600' }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: 8 },
  headerTitle: { ...FONTS.h1, fontSize: 26 },
  headerSub: { ...FONTS.caption, color: COLORS.textMuted, marginTop: 4 },

  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, paddingVertical: 14, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentSoft },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterText: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted },
  filterTextActive: { color: COLORS.textAccent, fontWeight: '600' },

  // Timeline
  timelineItem: { flexDirection: 'row', marginBottom: 0 },
  dateCol: { width: 36, alignItems: 'center', paddingTop: 4 },
  dateDay: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  dateWeekday: { fontSize: 10, fontWeight: '500', color: COLORS.textMuted, marginTop: 2 },
  timelineCol: { width: 28, alignItems: 'center', paddingTop: 8 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  timelineLine: { width: 1, flex: 1, backgroundColor: COLORS.border, marginTop: 4 },

  contentCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginLeft: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: '600' },
  scoreBadge: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  scoreText: { fontSize: 11, fontWeight: '700', color: COLORS.textAccent },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeBlock: { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 1 },
  timeValue: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  timeSep: { paddingHorizontal: 4 },
  timeSepText: { fontSize: 14, color: COLORS.textMuted },
  locationText: { ...FONTS.small, color: COLORS.textMuted, marginTop: 10, fontSize: 11 },
  noDataText: { ...FONTS.caption, color: COLORS.textMuted, fontStyle: 'italic' },
});
