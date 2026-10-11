import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { RADIUS, SPACING, FONTS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { correctionsAPI } from '../services/api';
import { normalizeTime, TIME_KEYBOARD } from './TeamScreen';

// "I forgot to check out", "I couldn't check in" or "the time is wrong": staff ask, an admin approves and the
// attendance is fixed. Opened from Home, from a day in My attendance (date filled in), or after a failed check-in.
const KINDS = [
  { key: 'missed_check_out', label: 'Forgot to check out', in: false, out: true },
  { key: 'missed_check_in', label: 'Could not check in', in: true, out: 'optional' },
  { key: 'wrong_time', label: 'Wrong time', in: 'optional', out: 'optional' },
];
const DAY = 86_400_000;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const nice = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const timesText = (r) => [r.checkIn ? `In ${r.checkIn}` : null, r.checkOut ? `Out ${r.checkOut}` : null].filter(Boolean).join(' · ');

export default function CorrectionsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const isAdmin = user?.role === 'admin';
  const preset = route?.params || {};

  const [mine, setMine] = useState([]);
  const [toApprove, setToApprove] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(!!preset.date || !!preset.kind);
  const [kind, setKind] = useState(preset.kind || 'missed_check_out');
  const [date, setDate] = useState(preset.date || istToday());
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const k = KINDS.find((x) => x.key === kind);

  const STATUS = {
    pending: { label: 'Waiting', color: C.warning },
    approved: { label: 'Approved', color: C.success },
    rejected: { label: 'Not approved', color: C.danger },
    cancelled: { label: 'Withdrawn', color: C.textMuted },
  };

  const load = useCallback(async () => {
    try {
      const [own, company] = await Promise.all([correctionsAPI.mine(), isAdmin ? correctionsAPI.company() : null]);
      setMine(own.requests);
      if (company) setToApprove(company.pending);
    } catch (e) {
      Alert.alert('Could not load corrections', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      await correctionsAPI.ask({ date, kind, checkIn: normalizeTime(checkIn) || null, checkOut: normalizeTime(checkOut) || null, reason: reason.trim() });
      setShowForm(false); setCheckIn(''); setCheckOut(''); setReason('');
      Alert.alert('Request sent', isAdmin ? 'It is waiting for approval.' : 'Your admin has been told. You will be notified when they decide.');
      load();
    } catch (e) {
      Alert.alert('Could not send the request', e.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = (r) => Alert.alert('Withdraw this request?', `${nice(r.date)} · ${r.label}`, [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Withdraw', style: 'destructive', onPress: async () => {
      try { await correctionsAPI.cancel(r.id); load(); } catch (e) { Alert.alert('Could not withdraw', e.message); }
    } },
  ]);
  const decide = async (r, approve) => {
    try { await correctionsAPI.decide(r.id, { approve }); load(); } catch (e) { Alert.alert('Could not save', e.message); }
  };
  const confirm = (r, approve) => Alert.alert(
    approve ? `Approve ${r.staffName}'s correction?` : `Reject ${r.staffName}'s correction?`,
    `${nice(r.date)} · ${timesText(r)}${approve ? '\n\nTheir attendance for that day will be updated.' : ''}`,
    [{ text: 'Back', style: 'cancel' }, { text: approve ? 'Approve' : 'Reject', style: approve ? 'default' : 'destructive', onPress: () => decide(r, approve) }],
  );

  const input = [styles.input, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }];
  const timeField = (label, value, set, need) => (need ? (
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, { color: C.textMuted }]}>{label}{need === 'optional' ? ' (optional)' : ''}</Text>
      <TextInput style={input} value={value} onChangeText={set} placeholder={label.startsWith('Came') ? '09:30' : '18:30'}
        placeholderTextColor={C.textMuted} keyboardType={TIME_KEYBOARD} maxLength={5} />
    </View>
  ) : null);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Corrections</Text>
        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: C.accent }]} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.applyText}>{showForm ? 'Close' : '+ Ask'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}>
        {showForm && (
          <View style={[styles.card, styles.form, { backgroundColor: C.bgCard, borderColor: C.border }]}>
            <Text style={[styles.formTitle, { color: C.textPrimary }]}>Ask for a correction</Text>
            <Text style={[styles.label, { color: C.textMuted }]}>What happened?</Text>
            <View style={styles.kindCol}>
              {KINDS.map((x) => (
                <TouchableOpacity key={x.key} onPress={() => setKind(x.key)}
                  style={[styles.kindChip, { borderColor: C.border, backgroundColor: C.bgElevated }, kind === x.key && { borderColor: C.accentBorder, backgroundColor: C.accentSoft }]}>
                  <Text style={[styles.kindText, { color: kind === x.key ? C.textAccent : C.textPrimary }]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: C.textMuted }]}>Day</Text>
            <View style={styles.stepRow}>
              <TouchableOpacity disabled={date <= addDays(istToday(), -45)} onPress={() => setDate(addDays(date, -1))}
                style={[styles.stepBtn, { borderColor: C.border, backgroundColor: C.bgElevated }]}>
                <Text style={[styles.stepIcon, { color: C.textPrimary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.stepValue, { color: C.textPrimary }]}>{date === istToday() ? `Today, ${nice(date)}` : nice(date)}</Text>
              <TouchableOpacity disabled={date >= istToday()} onPress={() => setDate(addDays(date, 1))}
                style={[styles.stepBtn, { borderColor: C.border, backgroundColor: C.bgElevated, opacity: date >= istToday() ? 0.35 : 1 }]}>
                <Text style={[styles.stepIcon, { color: C.textPrimary }]}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.row2}>
              {timeField('Came in at', checkIn, setCheckIn, k.in)}
              {timeField('Left at', checkOut, setCheckOut, k.out)}
            </View>
            <Text style={[styles.hint, { color: C.textMuted }]}>24-hour time, e.g. 09:30 or 18:30.</Text>
            <Text style={[styles.label, { color: C.textMuted }]}>Reason</Text>
            <TextInput style={[styles.reason, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }]}
              placeholder="e.g. Phone battery died" placeholderTextColor={C.textMuted} value={reason} onChangeText={setReason} maxLength={300} multiline />
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: C.accent }]} onPress={submit} disabled={busy} activeOpacity={0.8}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send request</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} /> : (
          <>
            {isAdmin && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>To approve ({toApprove.length})</Text>
                {toApprove.length === 0 && <Text style={[styles.empty, { color: C.textMuted }]}>No corrections waiting.</Text>}
                {toApprove.map((r) => (
                  <View key={r.id} style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                    <Text style={[styles.name, { color: C.textPrimary }]}>{r.staffName}</Text>
                    <Text style={[styles.dates, { color: C.textPrimary }]}>{nice(r.date)} · {r.label}</Text>
                    <Text style={[styles.meta, { color: C.textMuted }]}>{timesText(r)}</Text>
                    <Text style={[styles.meta, { color: C.textSecondary }]}>“{r.reason}”</Text>
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.success }]} onPress={() => confirm(r, true)}>
                        <Text style={styles.actText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border }]} onPress={() => confirm(r, false)}>
                        <Text style={[styles.actText, { color: C.danger }]}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>My requests</Text>
              {mine.length === 0 && <Text style={[styles.empty, { color: C.textMuted }]}>Forgot to check in or out? Tap “+ Ask” and your admin can fix the day.</Text>}
              {mine.map((r) => (
                <View key={r.id} style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.dates, { color: C.textPrimary, marginTop: 0 }]}>{nice(r.date)}</Text>
                    <Text style={[styles.status, { color: STATUS[r.status].color }]}>{STATUS[r.status].label}</Text>
                  </View>
                  <Text style={[styles.meta, { color: C.textMuted }]}>{r.label} · {timesText(r)}</Text>
                  <Text style={[styles.meta, { color: C.textSecondary }]}>“{r.reason}”</Text>
                  {!!r.decisionNote && <Text style={[styles.meta, { color: C.textSecondary }]}>Note from admin: {r.decisionNote}</Text>}
                  {r.status === 'pending' && (
                    <TouchableOpacity onPress={() => withdraw(r)} style={{ marginTop: 8 }}>
                      <Text style={[styles.link, { color: C.textAccent }]}>Withdraw request</Text>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  empty: { fontSize: 13 },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg, marginBottom: 10 },
  form: { margin: SPACING.xl, marginBottom: 0 },
  formTitle: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  hint: { fontSize: 11, marginTop: 6 },
  kindCol: { gap: 8 },
  kindChip: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: RADIUS.sm, borderWidth: 1.5 },
  kindText: { fontSize: 14, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepIcon: { fontSize: 22, fontWeight: '600', marginTop: -2 },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: 10 },
  input: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
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
