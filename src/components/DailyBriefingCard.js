import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS, RADIUS } from '../utils/theme';
import GlassCard from './GlassCard';
import GlowDot from './GlowDot';
import { generateDailyBriefing } from '../utils/aiEngine';

export default function DailyBriefingCard() {
  const { colors: C } = useTheme();
  const [briefing, setBriefing] = useState(null);

  useEffect(() => {
    setBriefing(generateDailyBriefing());
  }, []);

  if (!briefing) return null;

  return (
    <GlassCard style={styles.card} borderRadius={RADIUS.xl}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <GlowDot color={C.info || '#6E1F2D'} size={8} />
            <Text style={[styles.label, { color: C.textMuted }]}>AI BRIEFING</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: C.infoSoft || 'rgba(54, 138, 132,0.12)' }]}>
            <Text style={[styles.badgeText, { color: C.info || '#6E1F2D' }]}>Live</Text>
          </View>
        </View>

        <Text style={[styles.briefingText, { color: C.textPrimary }]}>
          {briefing.text}
        </Text>

        {!briefing.isWeekend && (
          <View style={styles.statsRow}>
            <StatChip label="Present" value={briefing.stats.present} color={C.success} bg={C.successSoft || 'rgba(69, 167, 159,0.12)'} />
            <StatChip label="Late" value={briefing.stats.late} color={C.warning} bg={C.warningSoft || 'rgba(245,158,11,0.12)'} />
            <StatChip label="Absent" value={briefing.stats.absent} color={C.danger} bg={C.dangerSoft || 'rgba(239,68,68,0.12)'} />
            <StatChip label="Leave" value={briefing.stats.onLeave} color={C.info || '#6E1F2D'} bg={C.infoSoft || 'rgba(54, 138, 132,0.12)'} />
          </View>
        )}

        <Text style={[styles.timestamp, { color: C.textMuted }]}>Updated just now</Text>
      </View>
    </GlassCard>
  );
}

function StatChip({ label, value, color, bg }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.lg },
  inner: { padding: SPACING.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  briefingText: { ...FONTS.body, lineHeight: 22, marginBottom: SPACING.lg },
  statsRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  chipValue: { fontSize: 18, fontWeight: '800' },
  chipLabel: { fontSize: 9, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
  timestamp: { ...FONTS.small, marginTop: SPACING.md, textAlign: 'right' },
});
