import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLang, fmtDayYear } from '../i18n';
import '../i18n/strings/staff';
import { staffAPI, companyAPI } from '../services/api';
import {
  Screen, AppHeader, Field, ChoiceRow, Button, SectionTitle, Subtle, Divider, Card, T,
} from '../ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Form values from a staff record (edit) or blanks (new person).
const formOf = (p) => ({
  name: p?.name || '',
  phone: p?.phone || '',
  email: p?.email || '',
  designation: p?.designation || '',
  department: p?.department || '',
  salaryType: p ? (p.salaryType || '') : 'monthly',
  salary: p?.salary == null ? '' : String(p.salary),
  role: p?.role === 'admin' ? 'admin' : 'staff',
  locationFree: !!p?.locationFree,
});

// Admins: add a new person (no params) or see and change someone (params.staff).
export default function AddStaffScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [person, setPerson] = useState(route?.params?.staff || null);
  const editing = !!person;
  const [f, setF] = useState(() => formOf(route?.params?.staff));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null); // 'active' | 'invite' | 'face'
  const [faceMatch, setFaceMatch] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    companyAPI.get().then((c) => setFaceMatch(!!c.faceMatch)).catch(() => {});
  }, [editing]);

  const isMe = editing && person.id === user?.id;
  const locked = editing && !!person.deletedAt; // deleted their account: the server refuses changes

  const save = async () => {
    const name = f.name.trim();
    const phone = f.phone.trim();
    const email = f.email.trim();
    if (!name) return Alert.alert(t('staff.required'), t('staff.needName'));
    if (phone.replace(/\D/g, '').length < 10) return Alert.alert(t('staff.required'), t('staff.needPhone'));
    if (!editing && !EMAIL_RE.test(email)) return Alert.alert(t('staff.required'), t('staff.needEmail'));
    if (editing && email && email !== (person.email || '') && !EMAIL_RE.test(email)) return Alert.alert(t('staff.required'), t('staff.needEmail'));

    const data = {
      name, phone, email,
      designation: f.designation.trim(),
      department: f.department.trim(),
      salaryType: f.salaryType || null,
      salary: f.salary.trim() ? Number(f.salary.trim()) : null,
      role: f.role,
    };

    setSaving(true);
    try {
      if (!editing) {
        const res = await staffAPI.create(data);
        Alert.alert(
          t('staff.addedTitle'),
          t(res?.invited === false ? 'staff.addedNoEmailMsg' : 'staff.addedMsg', { name, phone, email }),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
        );
        return;
      }
      // Only what changed, so an untouched empty field (e.g. no email) isn't re-checked.
      const before = formOf(person);
      const after = { ...f, name, phone, email, designation: data.designation, department: data.department, salary: f.salary.trim() };
      const changed = {};
      for (const k of Object.keys(after)) {
        if (after[k] === before[k]) continue;
        if (k === 'salary') changed.salary = data.salary;
        else if (k === 'salaryType') changed.salaryType = data.salaryType;
        else changed[k] = after[k];
      }
      if (Object.keys(changed).length) await staffAPI.update(person.id, changed);
      navigation.goBack();
    } catch (e) {
      Alert.alert(editing ? t('common.couldNotSave') : t('staff.couldNotAdd'), e.message || t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  const run = async (what, fn, after) => {
    setBusy(what);
    try {
      const res = await fn();
      if (res?.staff) setPerson(res.staff);
      after?.(res);
    } catch (e) {
      Alert.alert(t('common.couldNotSave'), e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = () => {
    const go = () => run('active', () => staffAPI.update(person.id, { active: !person.active }));
    if (!person.active) return go();
    Alert.alert(t('staff.switchOffQ', { name: person.name }), t('staff.switchOffMsg'), [
      { text: t('common.back'), style: 'cancel' },
      { text: t('staff.switchOff'), style: 'destructive', onPress: go },
    ]);
  };

  const invite = () => run('invite', () => staffAPI.invite(person.id),
    () => Alert.alert(t('staff.inviteSent'), t('staff.inviteSentMsg', { email: person.email })));

  const resetFace = () => {
    Alert.alert(t('staff.resetFaceQ'), t('staff.resetFaceMsg'), [
      { text: t('common.back'), style: 'cancel' },
      { text: t('staff.reset'), style: 'destructive', onPress: () => run('face', () => staffAPI.update(person.id, { faceReset: true }),
        () => Alert.alert(t('staff.faceResetDone'))) },
    ]);
  };

  const subtitle = editing
    ? [person.designation, person.department].filter(Boolean).join(' · ') || (person.role === 'admin' ? t('common.admin') : t('common.staff'))
    : t('staff.addSubtitle');

  const payTypes1 = [
    { value: 'monthly', label: t('staff.monthly') },
    { value: 'weekly', label: t('staff.weekly') },
    { value: 'daily', label: t('staff.daily') },
  ];
  const payTypes2 = [
    { value: 'hourly', label: t('staff.hourly') },
    { value: '', label: t('staff.notSet') },
  ];
  const salaryPh = f.salaryType === 'monthly' ? t('staff.salaryPhMonthly') : f.salaryType === 'daily' ? t('staff.salaryPhDaily') : t('staff.salaryPhOther');
  const faceDate = person?.faceSavedAt ? String(person.faceSavedAt).slice(0, 10) : null;

  return (
    <Screen keyboard header={<AppHeader title={editing ? person.name : t('staff.addTitle')} subtitle={subtitle} onBack={() => navigation.goBack()} />}>
      {locked ? <Card tone="red" style={{ marginBottom: 20 }}><Text style={st.note}>{t('staff.deletedNote')}</Text></Card> : null}
      {editing && !person.active && !locked ? <Card tone="yellow" style={{ marginBottom: 20 }}><Text style={st.note}>{t('staff.switchedOffNote')}</Text></Card> : null}

      <SectionTitle style={{ marginBottom: 14 }}>{t('staff.details')}</SectionTitle>
      <Field label={t('staff.name')} placeholder={t('staff.namePh')} value={f.name} onChangeText={set('name')} editable={!locked} />
      <Field label={t('staff.mobile')} placeholder={t('staff.mobilePh')} value={f.phone} onChangeText={set('phone')}
        keyboardType="phone-pad" maxLength={editing ? 14 : 10} editable={!locked} />
      <Field label={t('staff.email')} placeholder={t('staff.emailPh')} value={f.email} onChangeText={set('email')}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!locked} style={{ marginBottom: 6 }} />
      <Subtle style={{ marginBottom: 16 }}>{t('staff.codeNote')}</Subtle>
      <Field label={t('staff.designation')} placeholder={t('staff.designationPh')} value={f.designation} onChangeText={set('designation')} editable={!locked} />
      <Field label={t('staff.department')} placeholder={t('staff.departmentPh')} value={f.department} onChangeText={set('department')} editable={!locked} />

      <Divider style={{ marginVertical: 18 }} />
      <SectionTitle style={{ marginBottom: 14 }}>{t('staff.pay')}</SectionTitle>
      <Text style={st.label}>{t('staff.payType')}</Text>
      <ChoiceRow options={payTypes1} value={f.salaryType} onChange={locked ? () => {} : set('salaryType')} />
      <View style={{ height: 10 }} />
      <ChoiceRow options={payTypes2} value={f.salaryType} onChange={locked ? () => {} : set('salaryType')} />
      <Field label={t('staff.salary')} placeholder={salaryPh} value={f.salary} onChangeText={(v) => set('salary')(v.replace(/[^\d.]/g, ''))}
        keyboardType="numeric" editable={!locked} style={{ marginTop: 16 }} />

      <Divider style={{ marginVertical: 18 }} />
      <SectionTitle style={{ marginBottom: 14 }}>{t('staff.access')}</SectionTitle>
      <Text style={st.label}>{t('staff.role')}</Text>
      <ChoiceRow
        options={[{ value: 'staff', label: t('common.staff') }, { value: 'admin', label: t('common.admin') }]}
        value={f.role}
        onChange={locked ? () => {} : set('role')}
      />
      <Subtle style={{ marginTop: 8 }}>{t('staff.adminNote')}</Subtle>

      {editing ? (
        <View style={st.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={st.switchLabel}>{t('staff.anywhere')}</Text>
            <Subtle style={{ marginTop: 2 }}>{t('staff.anywhereNote')}</Subtle>
          </View>
          <Switch value={!!f.locationFree} onValueChange={set('locationFree')} disabled={locked}
            trackColor={{ true: T.navy, false: T.line }} thumbColor="#fff" ios_backgroundColor={T.line} />
        </View>
      ) : null}

      {!locked ? (
        <Button title={editing ? t('staff.saveBtn') : t('staff.addBtn')} onPress={save} busy={saving} style={{ marginTop: 24 }} />
      ) : null}

      {editing && !locked && faceMatch && faceDate ? (
        <>
          <Divider style={{ marginVertical: 22 }} />
          <SectionTitle>{t('staff.faceTitle')}</SectionTitle>
          <Subtle style={{ marginBottom: 12 }}>{t('staff.faceSaved', { date: fmtDayYear(t, faceDate) })}</Subtle>
          <Button title={t('staff.resetFace')} icon="refresh-cw" variant="outline" onPress={resetFace} busy={busy === 'face'} disabled={!!busy} />
        </>
      ) : null}

      {editing && !locked && !isMe ? (
        <>
          <Divider style={{ marginVertical: 22 }} />
          {person.active && person.email ? (
            <Button title={t('staff.inviteAgain')} icon="send" variant="outline" onPress={invite} busy={busy === 'invite'} disabled={!!busy} style={{ marginBottom: 12 }} />
          ) : null}
          <Button
            title={person.active ? t('staff.switchOff') : t('staff.switchOn')}
            icon={person.active ? 'user-x' : 'user-check'}
            variant={person.active ? 'danger' : 'outline'}
            onPress={toggleActive}
            busy={busy === 'active'}
            disabled={!!busy}
          />
        </>
      ) : null}

      {editing ? <Subtle style={{ marginTop: 18 }}>{t('staff.dashboardNote')}</Subtle> : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: T.textMuted, marginBottom: 8 },
  note: { fontSize: 14, color: T.navyDeep, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: T.navyDeep },
});
