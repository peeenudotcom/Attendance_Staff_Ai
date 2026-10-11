import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Switch,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { RADIUS, SPACING } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import { staffAPI } from '../services/api';

// Admins: the company's staff. Edit details, switch someone off or on, resend the welcome email.
// Pay, shifts and roles are set on the web dashboard.
function EditSheet({ person, onClose, onSaved, C, me }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (person) setF({ name: person.name || '', phone: person.phone || '', email: person.email || '', designation: person.designation || '', department: person.department || '', locationFree: !!person.locationFree });
  }, [person]);
  if (!person) return null;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const input = [styles.input, { backgroundColor: C.bgElevated, borderColor: C.border, color: C.textPrimary }];
  const field = (label, k, props = {}) => (
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, { color: C.textMuted }]}>{label}</Text>
      <TextInput style={input} value={f[k]} onChangeText={set(k)} placeholderTextColor={C.textMuted} {...props} />
    </View>
  );

  const run = async (fn, done) => {
    setBusy(true);
    try { await fn(); done?.(); } catch (e) { Alert.alert('Could not save', e.message); } finally { setBusy(false); }
  };
  const save = () => {
    // Only what changed, so an untouched empty field (e.g. no email) isn't re-checked.
    const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => (k === 'locationFree' ? !!person[k] : person[k] ?? '') !== v));
    if (!Object.keys(changed).length) return onClose();
    run(() => staffAPI.update(person.id, changed), onSaved);
  };
  const invite = () => run(() => staffAPI.invite(person.id), () => Alert.alert('Invite sent', `Welcome email sent to ${person.email}`));
  const toggle = () => {
    const go = () => run(() => staffAPI.update(person.id, { active: !person.active }), onSaved);
    if (!person.active) return go();
    Alert.alert(`Switch off ${person.name}?`, "They won't be able to sign in. Their attendance history is kept.", [
      { text: 'Back', style: 'cancel' }, { text: 'Switch off', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={[styles.sheet, { backgroundColor: C.bgCard }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>{person.name}</Text>
          {field('Full name', 'name')}
          <View style={styles.row2}>
            {field('Phone', 'phone', { keyboardType: 'phone-pad', maxLength: 14 })}
            {field('Email (sign-in codes)', 'email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
          </View>
          <View style={styles.row2}>
            {field('Designation', 'designation')}
            {field('Department', 'department')}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: C.textPrimary }]}>Can check in from anywhere</Text>
              <Text style={[styles.meta, { color: C.textMuted }]}>For field staff, when location lock is on</Text>
            </View>
            <Switch value={!!f.locationFree} onValueChange={set('locationFree')} trackColor={{ true: C.accent }} />
          </View>
          <TouchableOpacity style={[styles.primary, { backgroundColor: C.accent }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}
          </TouchableOpacity>
          <View style={styles.sheetFoot}>
            {person.id !== me ? (
              <TouchableOpacity onPress={toggle} disabled={busy}><Text style={[styles.link, { color: person.active ? C.danger : C.success }]}>{person.active ? 'Switch off' : 'Switch on'}</Text></TouchableOpacity>
            ) : <View />}
            {person.active && person.id !== me && person.email ? (
              <TouchableOpacity onPress={invite} disabled={busy}><Text style={[styles.link, { color: C.textAccent }]}>Send invite</Text></TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose}><Text style={[styles.link, { color: C.textMuted }]}>Close</Text></TouchableOpacity>
          </View>
          <Text style={[styles.meta, { color: C.textMuted, marginTop: 14, marginBottom: 30 }]}>Pay, shift and admin access are set on the web dashboard.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function StaffListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: C } = useTheme();
  const headerTop = useHeaderInset(12);
  const [showOff, setShowOff] = useState(false);
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setList((await staffAPI.list(showOff)).staff); } catch (e) { Alert.alert('Could not load staff', e.message); } finally { setRefreshing(false); }
  }, [showOff]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: headerTop, backgroundColor: C.bgCard, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgElevated }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Staff</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={() => navigation.navigate('AddStaff')}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}>
        <View style={[styles.switchRow, { paddingHorizontal: SPACING.xl }]}>
          <Text style={[styles.meta, { color: C.textMuted, flex: 1 }]}>Show switched-off staff</Text>
          <Switch value={showOff} onValueChange={setShowOff} trackColor={{ true: C.accent }} />
        </View>
        {!list && <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />}
        {list?.map((s) => (
          <TouchableOpacity key={s.id} style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.border, opacity: s.active ? 1 : 0.6 }]} onPress={() => setEditing(s)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: C.textPrimary }]}>{s.name}</Text>
              <Text style={[styles.meta, { color: C.textMuted }]}>{[s.designation, s.department].filter(Boolean).join(' · ') || s.phone}</Text>
              <Text style={[styles.meta, { color: C.textMuted }]}>{s.phone}{s.email ? ` · ${s.email}` : ''}</Text>
            </View>
            <Text style={[styles.badge, { color: !s.active ? C.textMuted : s.role === 'admin' ? C.textAccent : C.success }]}>
              {!s.active ? 'Off' : s.role === 'admin' ? 'Admin' : 'Staff'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <EditSheet person={editing} me={user?.id} C={C} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  addText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.xl, marginTop: 10, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: SPACING.xl, maxHeight: '88%' },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  row2: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  primary: { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sheetFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link: { fontSize: 14, fontWeight: '700' },
});
