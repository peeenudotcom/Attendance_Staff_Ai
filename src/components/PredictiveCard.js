import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS, RADIUS } from '../utils/theme';
import GlassCard from './GlassCard';
import GlowDot from './GlowDot';
import { predictTomorrowAbsences } from '../utils/aiEngine';

export default function PredictiveCard() {
  const { colors: C } = useTheme();
  const [prediction, setPrediction] = useState(null);

  useEffect(() => {
    setPrediction(predictTomorrowAbsences());
  }, []);

  if (!prediction) return null;

  // Sunday — office closed
  if (prediction.note) {
    return (
      <GlassCard style={styles.card} borderRadius={RADIUS.xl}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={styles.labelRow}>
              <Text style={styles.sparkle}>✦</Text>
              <Text style={[styles.label, { color: C.textMuted }]}>AI PREDICTION</Text>
            </View>
          </View>
          <Text style={[styles.noteText, { color: C.textSecondary }]}>{prediction.note}</Text>
        </View>
      </GlassCard>
    );
  }

  const absentCount = prediction.predictedAbsent.length;
  const lateCount = prediction.predictedLate.length;
  const allClear = absentCount === 0 && lateCount === 0;

  return (
    <GlassCard style={styles.card} borderRadius={RADIUS.xl}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <Text style={styles.sparkle}>✦</Text>
            <Text style={[styles.label, { color: C.textMuted }]}>AI PREDICTION FOR {prediction.day.toUpperCase()}</Text>
          </View>
          <View style={[styles.confBadge, { backgroundColor: C.accentSoft || 'rgba(154, 46, 64,0.12)' }]}>
            <Text style={[styles.confText, { color: C.textAccent || '#E39AA6' }]}>{prediction.confidence}%</Text>
          </View>
        </View>

        {/* Summary chips */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: C.dangerSoft || 'rgba(239,68,68,0.12)' }]}>
            <Text style={[styles.summaryValue, { color: C.danger }]}>{absentCount}</Text>
            <Text style={[styles.summaryLabel, { color: C.danger }]}>Predicted Absent</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: C.warningSoft || 'rgba(245,158,11,0.12)' }]}>
            <Text style={[styles.summaryValue, { color: C.warning }]}>{lateCount}</Text>
            <Text style={[styles.summaryLabel, { color: C.warning }]}>Likely Late</Text>
          </View>
        </View>

        {/* At-risk staff */}
        {allClear ? (
          <View style={[styles.clearBanner, { backgroundColor: C.successSoft || 'rgba(69, 167, 159,0.12)' }]}>
            <Text style={[styles.clearText, { color: C.success }]}>All clear! No attendance risks detected for {prediction.day}.</Text>
          </View>
        ) : (
          <View style={styles.riskList}>
            {prediction.predictedAbsent.map((s) => (
              <View key={s.id} style={styles.riskRow}>
                <GlowDot color={C.danger} size={8} />
                <Text style={[styles.riskName, { color: C.textPrimary }]}>{s.name}</Text>
                <Text style={[styles.riskProb, { color: C.danger }]}>{s.absentProb}% absent</Text>
              </View>
            ))}
            {prediction.predictedLate.map((s) => (
              <View key={s.id} style={styles.riskRow}>
                <GlowDot color={C.warning} size={8} />
                <Text style={[styles.riskName, { color: C.textPrimary }]}>{s.name}</Text>
                <Text style={[styles.riskProb, { color: C.warning }]}>{s.lateProb}% late</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.lg },
  inner: { padding: SPACING.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sparkle: { fontSize: 14, color: '#E39AA6' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  confBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  confText: { fontSize: 12, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
  summaryChip: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.sm, alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },
  clearBanner: { padding: SPACING.md, borderRadius: RADIUS.sm },
  clearText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  riskList: { gap: 10 },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riskName: { flex: 1, ...FONTS.bodyMedium },
  riskProb: { fontSize: 13, fontWeight: '700' },
  noteText: { ...FONTS.body },
});
