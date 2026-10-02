import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS, GLASS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';

const MOCK_CALLS = [
  { id: '1', name: 'Rahul Sharma', number: '+91 98765 43210', type: 'outgoing', duration: '5:23', time: '10:30 AM', date: '2026-03-29', tagged: 'Lead' },
  { id: '2', name: 'Priya Verma', number: '+91 87654 32109', type: 'incoming', duration: '2:10', time: '11:15 AM', date: '2026-03-29', tagged: null },
  { id: '3', name: 'Unknown', number: '+91 76543 21098', type: 'missed', duration: '—', time: '12:00 PM', date: '2026-03-29', tagged: null },
  { id: '4', name: 'Amit Kumar', number: '+91 65432 10987', type: 'outgoing', duration: '8:45', time: '2:30 PM', date: '2026-03-29', tagged: 'Client' },
  { id: '5', name: 'Client - Mohali', number: '+91 54321 09876', type: 'outgoing', duration: '12:30', time: '3:45 PM', date: '2026-03-28', tagged: 'Deal' },
  { id: '6', name: 'Sunita Devi', number: '+91 43210 98765', type: 'incoming', duration: '1:05', time: '4:20 PM', date: '2026-03-28', tagged: null },
];

const typeConfig = {
  incoming: { symbol: '↙', color: COLORS.success, label: 'Incoming' },
  outgoing: { symbol: '↗', color: COLORS.info, label: 'Outgoing' },
  missed: { symbol: '✕', color: COLORS.danger, label: 'Missed' },
};

export default function CallLogsScreen() {
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(16);
  const [calls, setCalls] = useState(MOCK_CALLS);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        const CallLog = require('react-native-call-log').default;
        CallLog.requestPermission().then(granted => {
          if (granted) {
            CallLog.load(50).then(logs => {
              if (logs.length > 0) {
                setCalls(logs.map((log, idx) => ({
                  id: String(idx), name: log.name || 'Unknown', number: log.phoneNumber,
                  type: log.type === 'INCOMING' ? 'incoming' : log.type === 'OUTGOING' ? 'outgoing' : 'missed',
                  duration: `${Math.floor(log.duration / 60)}:${String(log.duration % 60).padStart(2, '0')}`,
                  time: new Date(log.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                  date: new Date(log.dateTime).toISOString().split('T')[0], tagged: null,
                })));
              }
            });
          }
        });
      } catch {}
    }
  }, []);

  const filtered = filter === 'all' ? calls : calls.filter(c => c.type === filter);
  const inCount = calls.filter(c => c.type === 'incoming').length;
  const outCount = calls.filter(c => c.type === 'outgoing').length;
  const missCount = calls.filter(c => c.type === 'missed').length;

  const renderItem = ({ item }) => {
    const config = typeConfig[item.type];
    const isMissed = item.type === 'missed';

    return (
      <View style={[styles.card, isMissed && styles.cardMissed, { backgroundColor: C.bgCard, borderColor: isMissed ? COLORS.danger + '30' : C.border }]}>
        <View style={styles.cardRow}>
          {/* Type indicator */}
          <View style={[styles.typeCircle, { backgroundColor: config.color + '15' }]}>
            <Text style={[styles.typeSymbol, { color: config.color }]}>{config.symbol}</Text>
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: isMissed ? COLORS.danger : C.textPrimary }]}>{item.name}</Text>
              {item.tagged && (
                <View style={[styles.tagBadge, { backgroundColor: C.accentSoft }]}>
                  <Text style={[styles.tagText, { color: C.textAccent }]}>{item.tagged}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.number, { color: C.textSecondary }]}>{item.number}</Text>
          </View>

          {/* Right */}
          <View style={styles.right}>
            <Text style={[styles.time, { color: C.textMuted }]}>{item.time}</Text>
            {item.duration !== '—' && <Text style={[styles.duration, { color: C.textMuted }]}>{item.duration}</Text>}
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.actions, { borderTopColor: C.border }]}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.bgElevated }]}>
            <Text style={[styles.actionText, { color: C.textSecondary }]}>↩ Call Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.bgElevated }]}>
            <Text style={[styles.actionText, { color: C.textSecondary }]}>+ Note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.bgElevated }]}>
            <Text style={[styles.actionText, { color: C.textSecondary }]}># Tag Lead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <View>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Call Activity</Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>CRM-synced call tracking</Text>
        </View>
        <TouchableOpacity style={[styles.syncBtn, { backgroundColor: C.accentSoft, borderColor: C.accentBorder }]} onPress={() => Alert.alert('Synced', `${calls.length} calls synced to CRM`)}>
          <Text style={[styles.syncText, { color: C.textAccent }]}>Sync ↑</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.success }]}>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>{inCount}</Text>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>In</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.info }]}>
          <Text style={[styles.summaryValue, { color: COLORS.info }]}>{outCount}</Text>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Out</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.danger }]}>
          <Text style={[styles.summaryValue, { color: COLORS.danger }]}>{missCount}</Text>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Missed</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.bgCard, borderColor: C.border, borderLeftColor: COLORS.accent }]}>
          <Text style={[styles.summaryValue, { color: C.textAccent }]}>{calls.length}</Text>
          <Text style={[styles.summaryLabel, { color: C.textMuted }]}>Total</Text>
        </View>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {['all', 'incoming', 'outgoing', 'missed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              { backgroundColor: C.bgCard, borderColor: C.border },
              filter === f && { backgroundColor: C.accentSoft, borderColor: C.accentBorder },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              { color: C.textMuted },
              filter === f && { color: C.textAccent, fontWeight: '600' },
            ]}>
              {f === 'all' ? 'All' : typeConfig[f]?.label || f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingBottom: 8 },
  headerTitle: { ...FONTS.h1, fontSize: 26 },
  headerSub: { ...FONTS.small, color: COLORS.textMuted, marginTop: 4 },
  syncBtn: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.accentBorder },
  syncText: { fontSize: 12, fontWeight: '600', color: COLORS.textAccent },

  summaryRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: 8, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm, padding: SPACING.md, alignItems: 'center', borderLeftWidth: 2, borderWidth: 1, borderColor: COLORS.border },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '500', color: COLORS.textMuted, marginTop: 2, letterSpacing: 0.5 },

  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, paddingVertical: 14, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentSoft },
  filterText: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted },
  filterTextActive: { color: COLORS.textAccent, fontWeight: '600' },

  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  cardMissed: { borderColor: COLORS.danger + '30' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  typeCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  typeSymbol: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  tagBadge: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  tagText: { fontSize: 10, fontWeight: '600', color: COLORS.textAccent },
  number: { ...FONTS.mono, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  time: { ...FONTS.small, fontSize: 11 },
  duration: { ...FONTS.mono, color: COLORS.textSecondary, marginTop: 2, fontSize: 12 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionBtn: { flex: 1, paddingVertical: 7, borderRadius: RADIUS.xs, backgroundColor: COLORS.bgElevated, alignItems: 'center' },
  actionText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
});
