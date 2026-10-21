import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, RefreshControl, Share,
} from 'react-native';
import { RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { payslipsAPI } from '../services/api';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Salary slips for every month the company has closed. Each opens as a page the person can save as PDF or share.
export default function PayslipsScreen({ navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setSlips((await payslipsAPI.mine()).payslips);
    } catch (e) {
      Alert.alert('Could not load payslips', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (s, share) => {
    setBusy(s.month);
    try {
      const { link } = await payslipsAPI.get(s.month);
      if (share) await Share.share({ message: `My salary slip for ${s.label}: ${link}` });
      else await Linking.openURL(link);
    } catch (e) {
      Alert.alert('Could not open the payslip', e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>My payslips</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />
        ) : slips.length === 0 ? (
          <Text style={[styles.empty, { color: C.textMuted }]}>
            No payslips yet. Your slip appears here once your company closes the month's salary.
          </Text>
        ) : slips.map((s) => (
          <View key={s.month} style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.month, { color: C.textPrimary }]}>{s.label}</Text>
              <Text style={[styles.amount, { color: C.success }]}>{s.payable == null ? '—' : rupees(s.payable)}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.accent }]} onPress={() => open(s, false)} disabled={busy === s.month}>
                {busy === s.month ? <ActivityIndicator color="#fff" /> : <Text style={styles.actText}>Open</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border }]} onPress={() => open(s, true)} disabled={busy === s.month}>
                <Text style={[styles.actText, { color: C.textPrimary }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20 },
  headerTitle: { ...FONTS.h3 },
  empty: { fontSize: 14, marginTop: 20, lineHeight: 20 },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  month: { fontSize: 16, fontWeight: '700' },
  amount: { fontSize: 16, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  actText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
