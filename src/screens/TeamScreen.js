import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Modal,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { RADIUS, SPACING } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { attendanceAPI, reportsAPI } from '../services/api';
import { DAY_STYLE, toneColor } from './HistoryScreen';

// Admins: everyone's day (default today) with times, selfies and flags; add or fix a day for someone.
const DAY = 86_400_000;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const nice = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDist = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
// "930", "0930", "9.30", "9:30" -> "09:30" (Android's number keyboard has no colon).
export function normalizeTime(v) {
  const t = String(v || '').trim().replace(/[.\s]/g, ':');
  if (!t) return '';
  const m = /^(\d{1,2}):?(\d{2})$/.exec(t);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
}
const TIME_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
const ORDER = { late: 0, half: 1, present: 2, pending: 3, absent: 4, leave: 5, holiday: 6, off: 7 };

function TimeForm({ visible, person, date, record, onClose, onSaved, C }) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setCheckIn(record?.in && record.in !== '—' ? record.in : '');
    setCheckOut(record?.out && record.out !== '—' ? record.out : '');
    setNote(record?.note || '');
  }, [visible, record]);

  const save = async () => {
    setBusy(true);
    try {
      const inT = normalizeTime(checkIn); const outT = normalizeTime(checkOut);
      if (record) await attendanceAPI.edit(record.id, { checkIn: inT, checkOut: outT || '', note });
      else await attendanceAPI.add({ staffId: person.id, date, checkIn: inT, checkOut: outT || null, note });
      onSaved();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = () => Alert.alert(`Remove ${person.name}'s day?`, 'It will show as absent.', [
    { text: 'Back', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await attendanceAPI.remove(record.id); onSaved(); } catch (e) { Alert.alert('Could not remove', e.message); }
    } },
  ]);
  const input = [styles.input, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: C.bgCard }]}>
          <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>{record ? 'Edit' : 'Add'} attendance · {person?.name}</Text>
          <Text style={[styles.meta, { color: C.textMuted }]}>{date ? nice(date) : ''} · no selfie, marked as added by admin</Text>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.textMuted }]}>Check-in (HH:MM)</Text>
              <TextInput style={input} value={checkIn} onChangeText={setCheckIn} placeholder="09:30" placeholderTextColor={C.textMuted} keyboardType={TIME_KEYBOARD} maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.textMuted }]}>Check-out (optional)</Text>
              <TextInput style={input} value={checkOut} onChangeText={setCheckOut} placeholder="18:00" placeholderTextColor={C.textMuted} keyboardType={TIME_KEYBOARD} maxLength={5} />
            </View>
          </View>
          <Text style={[styles.label, { color: C.textMuted }]}>Note (optional)</Text>
          <TextInput style={input} value={note} onChangeText={setNote} placeholder="e.g. Phone battery dead" placeholderTextColor={C.textMuted} maxLength={200} />
          <TouchableOpacity style={[styles.primary, { backgroundColor: C.accent }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{record ? 'Save' : 'Add'}</Text>}
          </TouchableOpacity>
          <View style={styles.sheetFoot}>
            {record ? <TouchableOpacity onPress={remove}><Text style={[styles.link, { color: C.danger }]}>Remove day</Text></TouchableOpacity> : <View />}
            <TouchableOpacity onPress={onClose}><Text style={[styles.link, { color: C.textMuted }]}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TeamScreen({ navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const [date, setDate] = useState(istToday());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [form, setForm] = useState(null); // { person, record }

  const load = useCallback(async (d) => {
    setError('');
    try { setData(await reportsAPI.day(d)); } catch (e) { setError(e.message || 'Could not load'); } finally { setRefreshing(false); }
  }, []);
  useEffect(() => { setData(null); load(date); }, [date, load]);
  useEffect(() => navigation.addListener('focus', () => load(date)), [navigation, date, load]);

  const s = data?.summary;
  const people = data ? [...data.staff].sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || a.name.localeCompare(b.name)) : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerTop, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(date); }} tintColor={C.accent} />}
      >
        <View style={styles.headRow}>
          <Text style={[styles.title, { color: C.textPrimary }]}>Team</Text>
          <TouchableOpacity style={[styles.headBtn, { borderColor: C.border, backgroundColor: C.bgCard }]} onPress={() => navigation.navigate('StaffList')}>
            <Text style={[styles.headBtnText, { color: C.textAccent }]}>Staff</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity style={[styles.arrow, { borderColor: C.border, backgroundColor: C.bgCard }]} onPress={() => setDate(addDays(date, -1))}>
            <Text style={[styles.arrowText, { color: C.textPrimary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.dateText, { color: C.textPrimary }]}>{date === istToday() ? 'Today' : nice(date)}</Text>
          <TouchableOpacity disabled={date >= istToday()} style={[styles.arrow, { borderColor: C.border, backgroundColor: C.bgCard, opacity: date >= istToday() ? 0.35 : 1 }]} onPress={() => setDate(addDays(date, 1))}>
            <Text style={[styles.arrowText, { color: C.textPrimary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {!data && !error && <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />}
        {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

        {s && (
          <View style={styles.chips}>
            {[
              ['In', s.present + s.late, C.success], ['Late', s.late, C.warning], ['Absent', s.absent, C.danger],
              ...(date === istToday() ? [['Not in', s.notYet, C.textMuted]] : []), ...(s.leave ? [['Leave', s.leave, C.info]] : []),
            ].map(([label, n, color]) => (
              <View key={label} style={[styles.chip, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                <Text style={[styles.chipNum, { color }]}>{n}</Text>
                <Text style={[styles.chipLabel, { color: C.textMuted }]}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {!!data?.holiday && <Text style={[styles.holiday, { color: '#8A6D1F' }]}>Holiday: {data.holiday}</Text>}
        {data && !people.length && <Text style={[styles.error, { color: C.textMuted }]}>{s?.off ? 'Weekly off.' : 'No staff yet.'}</Text>}

        {people.map((p) => {
          const st = DAY_STYLE[p.status] || DAY_STYLE.pending;
          const color = toneColor(C, st.tone);
          const away = data.office && p.checkInDistance != null && p.checkInDistance > data.office.radiusM;
          const canAdd = !p.attendanceId && (p.status === 'absent' || p.status === 'pending' || p.status === 'off' || p.status === 'leave' || p.status === 'holiday');
          return (
            <View key={p.id} style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.border }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: C.textPrimary }]}>{p.name}</Text>
                  <Text style={[styles.meta, { color: C.textMuted }]}>{[p.designation || p.department, p.shift].filter(Boolean).join(' · ')}</Text>
                </View>
                {!!p.checkInSelfie && (
                  <TouchableOpacity onPress={() => setPhoto({ url: p.checkInSelfie, caption: `${p.name} · in ${p.checkIn}` })}>
                    <Image source={{ uri: p.checkInSelfie }} style={styles.thumb} />
                  </TouchableOpacity>
                )}
                {!!p.checkOutSelfie && (
                  <TouchableOpacity onPress={() => setPhoto({ url: p.checkOutSelfie, caption: `${p.name} · out ${p.checkOut}` })}>
                    <Image source={{ uri: p.checkOutSelfie }} style={styles.thumb} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.pill, { color, backgroundColor: `${color}1F` }]}>{st.label || (p.status === 'pending' ? 'Not in yet' : '')}</Text>
                {p.checkIn !== '—' && (
                  <Text style={[styles.times, { color: C.textPrimary }]}>
                    {p.checkIn} – {p.noCheckOut ? '?' : p.checkOut === '—' ? 'still in' : p.checkOut}{p.hours !== '—' ? `  ·  ${p.hours}` : ''}
                  </Text>
                )}
              </View>
              {(p.noCheckOut || p.leftEarlyBy > 0 || away || p.addedByAdmin) && (
                <Text style={[styles.flags, { color: p.noCheckOut || away || p.leftEarlyBy ? C.danger : C.textMuted }]}>
                  {[
                    p.noCheckOut && 'No check-out',
                    p.leftEarlyBy > 0 && `Left ${p.leftEarlyBy} min early`,
                    away && `${fmtDist(p.checkInDistance)} from office`,
                    p.addedByAdmin && `Added by admin${p.note ? `: ${p.note}` : ''}`,
                  ].filter(Boolean).join(' · ')}
                </Text>
              )}
              {(canAdd || p.attendanceId) && date <= istToday() && (
                <TouchableOpacity onPress={() => setForm({ person: { id: p.id, name: p.name },
                  record: p.attendanceId ? { id: p.attendanceId, in: p.checkIn, out: p.checkOut, note: p.note } : null })}>
                  <Text style={[styles.link, { color: C.textAccent, marginTop: 8 }]}>
                    {p.attendanceId ? (p.noCheckOut ? 'Set out time' : 'Edit day') : 'Add attendance'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <TouchableOpacity style={styles.photoWrap} activeOpacity={1} onPress={() => setPhoto(null)}>
          {photo && <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="contain" />}
          {photo && <Text style={styles.photoCaption}>{photo.caption}</Text>}
        </TouchableOpacity>
      </Modal>

      <TimeForm
        visible={!!form}
        person={form?.person}
        record={form?.record}
        date={date}
        C={C}
        onClose={() => setForm(null)}
        onSaved={() => { setForm(null); load(date); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl },
  title: { fontSize: 26, fontWeight: '800' },
  headBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
  headBtnText: { fontSize: 14, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, marginTop: 14, gap: 10 },
  arrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 22, fontWeight: '600', marginTop: -2 },
  dateText: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  error: { textAlign: 'center', marginTop: 30, paddingHorizontal: SPACING.xl },
  holiday: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: SPACING.xl, marginTop: 14, marginBottom: 6 },
  chip: { flexGrow: 1, minWidth: 64, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center' },
  chipNum: { fontSize: 18, fontWeight: '800' },
  chipLabel: { fontSize: 11, fontWeight: '600' },
  card: { marginHorizontal: SPACING.xl, marginTop: 10, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  thumb: { width: 40, height: 40, borderRadius: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  pill: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  times: { fontSize: 14, fontWeight: '600' },
  flags: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  link: { fontSize: 14, fontWeight: '700' },
  photoWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  photo: { width: '100%', height: '75%' },
  photoCaption: { color: '#fff', marginTop: 12, fontSize: 14 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: SPACING.xl, paddingBottom: 36 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  row2: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  primary: { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sheetFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
});
