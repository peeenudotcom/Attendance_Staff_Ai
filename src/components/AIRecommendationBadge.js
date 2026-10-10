import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS, RADIUS } from '../utils/theme';

export default function AIRecommendationBadge({ evaluation, onAutoApprove }) {
  const { colors: C } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (!evaluation) return null;

  const isApprove = evaluation.recommendation === 'approve';
  const color = isApprove ? C.success : C.warning;
  const bgColor = isApprove
    ? (C.successSoft || 'rgba(69, 167, 159,0.12)')
    : (C.warningSoft || 'rgba(245,158,11,0.12)');

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor: color + '30' }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.labelRow}>
          <Text style={[styles.icon, { color }]}>{isApprove ? '✓' : '⚠'}</Text>
          <Text style={[styles.label, { color }]}>
            {isApprove ? 'AI Recommends: Approve' : 'AI: Needs Review'}
          </Text>
        </View>
        <View style={styles.rightRow}>
          <View style={[styles.confBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.confText, { color }]}>{evaluation.confidence}%</Text>
          </View>
          <Text style={[styles.chevron, { color: C.textMuted }]}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          {evaluation.reasons.map((reason, idx) => (
            <View key={idx} style={styles.reasonRow}>
              <Text style={[styles.dot, { color }]}>•</Text>
              <Text style={[styles.reasonText, { color: C.textSecondary }]}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      {isApprove && onAutoApprove && (
        <TouchableOpacity
          style={[styles.autoBtn, { backgroundColor: color + '20', borderColor: color + '40' }]}
          onPress={onAutoApprove}
          activeOpacity={0.7}
        >
          <Text style={[styles.autoBtnText, { color }]}>Quick Approve</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: RADIUS.sm, borderWidth: 1, marginTop: SPACING.sm, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  icon: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700' },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  confText: { fontSize: 11, fontWeight: '800' },
  chevron: { fontSize: 8 },
  details: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, gap: 4 },
  reasonRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  dot: { fontSize: 12, lineHeight: 18 },
  reasonText: { fontSize: 12, lineHeight: 18, flex: 1 },
  autoBtn: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.xs, borderWidth: 1, alignItems: 'center' },
  autoBtnText: { fontSize: 12, fontWeight: '700' },
});
