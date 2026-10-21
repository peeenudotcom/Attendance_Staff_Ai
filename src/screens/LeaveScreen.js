import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { RADIUS, SPACING, FONTS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { leaveAPI } from '../services/api';

const TYPES = [
  { key: 'casual', label: 'Casual' },
  { key: 'sick', label: 'Sick' },
  { key: 'paid', label: 'Paid' },
  { key: 'unpaid', label: 'Unpaid' },
];

// Dates are plain "YYYY-MM-DD" strings in India time, the same as the server uses.
const DAY = 86_400_000;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const nice = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const datesText = (r) => (r.from === r.to ? nice(r.from) : `${nice(r.from)} – ${nice(r.to)}`);

function DateStepper({ label, value, min, onChange, C }) {
  const canBack = !min || value > min;
  return (
    <View style={styles.stepRow}>
      <Text style={[styles.label, { color: C.textMuted, marginTop: 0, marginBottom: 0, width: 46 }]}>{label}</Text>
      <TouchableOpacity disabled={!canBack} onPress={() => onChange(addDays(value, -1))}
        style={[styles.stepBtn, { borderColor: C.border, backgroundColor: C.bgElevated, opacity: canBack ? 1 : 0.35 }]}>
        <Text style={[styles.stepIcon, { color: C.textPrimary }]}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.stepValue, { color: C.textPrimary }]}>{nice(value)}</Text>
      <TouchableOpacity onPress={() => onChange(addDays(value, 1))}
        style={[styles.stepBtn, { borderColor: C.border, backgroundColor: C.bgElevated }]}>
        <Text style={[styles.stepIcon, { color: C.textPrimary }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LeaveScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const isAdmin = user?.role === 'admin';

  const [mine, setMine] = useState([]);
  const [balance, setBalance] = useState(null);
  const [toApprove, setToApprove] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('casual');
  const [from, setFrom] = useState(addDays(istToday(), 1));
  const [to, setTo] = useState(addDays(istToday(), 1));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const STATUS = {
    pending: { label: 'Waiting', color: C.warning },
    approved: { label: 'Approved', color: C.success },
    rejected: { label: 'Not approved', color: C.danger },
    cancelled: { label: 'Cancelled', color: C.textMuted },
  };

  const load = useCallback(async () => {
    try {
      const [own, company] = await Promise.all([leaveAPI.mine(), isAdmin ? leaveAPI.company() : null]);
      setMine(own.requests);
      setBalance(own.balance ?? null);
      if (company) setToApprove(company.pending);
    } catch (e) {
      Alert.alert('Could not load leave', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const changeFrom = (d) => { setFrom(d); if (to < d) setTo(d); };

  const submit = async () => {
    setBusy(true);
    try {
      await leaveAPI.ask({ from, to, type, reason: reason.trim() });
      setShowForm(false);
      setReason('');
      Alert.alert('Leave requested', isAdmin ? 'It is waiting for approval.' : 'Your admin has been told. You will get an email when they decide.');
      load();
    } catch (e) {
      Alert.alert('Could not ask for leave', e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = (r) => Alert.alert('Cancel this leave?', datesText(r), [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Cancel leave', style: 'destructive', onPress: async () => {
      try { await leaveAPI.cancel(r.id); load(); } catch (e) { Alert.alert('Could not cancel', e.message); }
    } },
  ]);

  const decide = async (r, approve) => {
    try {
      await leaveAPI.decide(r.id, { approve });
      load();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    }
  };
  const confirmReject = (r) => Alert.alert(`Reject ${r.staffName}'s leave?`, datesText(r), [
    { text: 'Back', style: 'cancel' },
    { text: 'Reject', style: 'destructive', onPress: () => decide(r, false) },
  ]);

  const canCancel = (r) => r.status === 'pending' || (r.status === 'approved' && r.from > istToday());

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Leave</Text>
        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: C.accent }]} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.applyText}>{showForm ? 'Close' : '+ Ask'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}
      >
        {showForm && (
          <View style={[styles.card, styles.form, { backgroundColor: C.bgCard, borderColor: C.border }]}>
            <Text style={[styles.formTitle, { color: C.textPrimary }]}>Ask for leave</Text>
            <Text style={[styles.label, { color: C.textMuted }]}>Type</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t.key} onPress={() => setType(t.key)}
                  style={[styles.typeChip, { borderColor: C.border, backgroundColor: C.bgElevated },
                    type === t.key && { borderColor: C.accentBorder, backgroundColor: C.accentSoft }]}>
                  <Text style={[styles.typeText, { color: type === t.key ? C.textAccent : C.textPrimary }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: C.textMuted }]}>Dates</Text>
            <DateStepper label="From" value={from} min={addDays(istToday(), -30)} onChange={changeFrom} C={C} />
            <DateStepper label="To" value={to} min={from} onChange={setTo} C={C} />
            <Text style={[styles.label, { color: C.textMuted }]}>Reason (optional)</Text>
            <TextInput
              style={[styles.reason, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
              placeholder="e.g. Family function"
              placeholderTextColor={C.textMuted}
              value={reason}
              onChangeText={setReason}
              maxLength={500}
              multiline
            />
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: C.accent }]} onPress={submit} disabled={busy} activeOpacity={0.8}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send request</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />
        ) : (
          <>
            {balance?.limited && (
              <View style={[styles.card, styles.balance, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                <View style={styles.balanceItem}>
                  <Text style={[styles.balanceNum, { color: C.success }]}>{balance.available}</Text>
                  <Text style={[styles.meta, { color: C.textMuted, marginTop: 0 }]}>Paid leave left</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={[styles.balanceNum, { color: C.textPrimary }]}>{balance.used}</Text>
                  <Text style={[styles.meta, { color: C.textMuted, marginTop: 0 }]}>Used in {balance.year}</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={[styles.balanceNum, { color: C.textPrimary }]}>{balance.earned}</Text>
                  <Text style={[styles.meta, { color: C.textMuted, marginTop: 0 }]}>Earned so far</Text>
                </View>
              </View>
            )}
            {balance?.limited && balance.pending > 0 && (
              <Text style={[styles.meta, { color: C.textMuted, marginHorizontal: SPACING.xl, marginTop: 6 }]}>
                {balance.pending} day{balance.pending === 1 ? '' : 's'} waiting for approval {balance.pending === 1 ? 'is' : 'are'} already taken off. Unpaid leave doesn't use your balance.
              </Text>
            )}

            {isAdmin && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>To approve ({toApprove.length})</Text>
                {toApprove.length === 0 && <Text style={[styles.empty, { color: C.textMuted }]}>No requests waiting.</Text>}
                {toApprove.map((r) => (
                  <View key={r.id} style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                    <Text style={[styles.name, { color: C.textPrimary }]}>{r.staffName}</Text>
                    <Text style={[styles.dates, { color: C.textPrimary }]}>{datesText(r)}</Text>
                    <Text style={[styles.meta, { color: C.textMuted }]}>{r.days} day{r.days === 1 ? '' : 's'} · {r.typeLabel}</Text>
                    {r.balance?.limited && r.type !== 'unpaid' && (
                      <Text style={[styles.meta, { color: C.textMuted }]}>Paid leave: {r.balance.earned - r.balance.used} left of {r.balance.earned} earned this year</Text>
                    )}
                    {!!r.reason && <Text style={[styles.meta, { color: C.textSecondary }]}>“{r.reason}”</Text>}
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.success }]} onPress={() => decide(r, true)}>
                        <Text style={styles.actText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border }]} onPress={() => confirmReject(r)}>
                        <Text style={[styles.actText, { color: C.danger }]}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>My leave</Text>
              {mine.length === 0 && <Text style={[styles.empty, { color: C.textMuted }]}>No leave yet. Tap “+ Ask” to request some.</Text>}
              {mine.map((r) => (
                <View key={r.id} style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.dates, { color: C.textPrimary, marginTop: 0 }]}>{datesText(r)}</Text>
                    <Text style={[styles.status, { color: STATUS[r.status].color }]}>{STATUS[r.status].label}</Text>
                  </View>
                  <Text style={[styles.meta, { color: C.textMuted }]}>{r.days} day{r.days === 1 ? '' : 's'} · {r.typeLabel}</Text>
                  {!!r.reason && <Text style={[styles.meta, { color: C.textSecondary }]}>“{r.reason}”</Text>}
                  {!!r.note && <Text style={[styles.meta, { color: C.textSecondary }]}>Note from admin: {r.note}</Text>}
                  {canCancel(r) && (
                    <TouchableOpacity onPress={() => cancel(r)} style={{ marginTop: 8 }}>
                      <Text style={[styles.link, { color: C.textAccent }]}>Cancel request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20 },
  headerTitle: { ...FONTS.h3 },
  applyBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  applyText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  section: { paddingHorizontal: SPACING.xl, marginTop: 20 },
  balance: { flexDirection: 'row', marginHorizontal: SPACING.xl, marginTop: 20, marginBottom: 0 },
  balanceItem: { flex: 1, alignItems: 'center' },
  balanceNum: { fontSize: 22, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  empty: { fontSize: 13 },

  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg, marginBottom: 10 },
  form: { margin: SPACING.xl, marginBottom: 0 },
  formTitle: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, borderWidth: 1.5, alignItems: 'center' },
  typeText: { fontSize: 13, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepIcon: { fontSize: 22, fontWeight: '600', marginTop: -2 },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  reason: { borderRadius: RADIUS.sm, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  submitBtn: { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitText: { ...FONTS.button, color: '#fff' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700' },
  dates: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 13, marginTop: 4 },
  status: { fontSize: 12, fontWeight: '700' },
  link: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  actText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
