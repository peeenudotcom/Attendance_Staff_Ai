import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { leaveAPI, correctionsAPI } from '../services/api';
import { useRequestsCount } from '../navigation/AppNavigator';
import { useLang, fmtDayYear } from '../i18n';
import '../i18n/strings/requests';
import '../i18n/strings/corrections';
import '../i18n/strings/leave';
import { Screen, AppHeader, WeekStrip, Avatar, Chip, Button, InfoRow, Field, Subtle, Icon, T, weekOf, datesBetween } from '../ui';
import { daysText, STATUS_TONE } from './LeaveScreen';

// Review one leave or correction request (admin): the details, then Approve or Reject (with an optional note).
// Params: { kind: 'leave' | 'correction', request } (a request as Requests lists it).

export default function ReviewRequestScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useLang();
  const { refresh: refreshCount } = useRequestsCount();
  const { kind = 'leave', request: r } = route?.params || {};
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null); // 'approve' | 'reject'

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Requests' }));
  useEffect(() => { if (!r) back(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;

  const isLeave = kind === 'leave';
  const api = isLeave ? leaveAPI : correctionsAPI;
  const days = isLeave ? datesBetween(r.from, r.to) : [r.date];
  const statusLabel = r.status === 'pending' ? t('common.pending')
    : (!isLeave && r.status === 'cancelled' ? t('corrections.withdrawn') : t(`common.${r.status}`));

  const decide = async (approve) => {
    setBusy(approve ? 'approve' : 'reject');
    try {
      await api.decide(r.id, { approve, note: approve ? undefined : (note.trim() || undefined) });
      refreshCount();
      back();
    } catch (e) {
      Alert.alert(t('common.couldNotSave'), e.message);
      setBusy(null);
    }
  };
  const withdrawApproval = () => Alert.alert(t('requests.withdrawTitle'), t('requests.withdrawBody', { name: r.staffName }), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('requests.withdrawApproval'), style: 'destructive', onPress: () => decide(false) },
  ]);

  const bal = r.balance;
  const rows = isLeave ? [
    [t('requests.leaveType'), t(`leave.${r.type}`)],
    [t('requests.from'), fmtDayYear(t, r.from)],
    [t('requests.to'), fmtDayYear(t, r.to)],
    [t('requests.duration'), daysText(t, r.days)],
    ...(bal?.limited && r.type !== 'unpaid'
      ? [[t('requests.paidLeft'), t('requests.paidLeftValue', { left: bal.earned - bal.used, earned: bal.earned })]] : []),
  ] : [
    [t('requests.whatHappened'), t(`corrections.kind_${r.kind}`)],
    [t('requests.day'), fmtDayYear(t, r.date)],
    ...(r.checkIn ? [[t('requests.checkIn'), r.checkIn]] : []),
    ...(r.checkOut ? [[t('requests.checkOut'), r.checkOut]] : []),
  ];
  const note0 = isLeave ? r.note : r.decisionNote;

  return (
    <Screen keyboard header={(
      <AppHeader title={t('requests.title')} subtitle={t('requests.subtitle')}
        avatarName={user?.name || ''} onAvatarPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
        <WeekStrip dates={weekOf(days[0])} selected={days} />
      </AppHeader>
    )}>
      <TouchableOpacity onPress={back} hitSlop={10} style={st.backRow} activeOpacity={0.7}>
        <Icon name="chevron-left" size={20} color={T.navyDeep} />
        <Text style={st.backText}>{t('requests.allRequests')}</Text>
      </TouchableOpacity>

      <Text style={st.h1}>{isLeave ? t('requests.reviewLeave') : t('requests.reviewCorrection')}</Text>

      <View style={st.person}>
        <Avatar name={r.staffName || ''} size={52} />
        <View style={{ flex: 1, marginLeft: 16, paddingRight: 8 }}>
          <Text style={st.name} numberOfLines={2}>{r.staffName}</Text>
          {!!r.designation && <Text style={st.job} numberOfLines={1}>{r.designation}</Text>}
        </View>
        <Chip label={statusLabel} tone={r.status === 'pending' ? 'amber' : STATUS_TONE[r.status]}
          icon={r.status === 'pending' ? 'clock' : undefined} />
      </View>

      <View style={st.line} />
      {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
      {!!r.reason && (
        <View style={st.reason}>
          <Text style={st.reasonLabel}>{t('requests.reason')}</Text>
          <Text style={st.reasonText}>“{r.reason}”</Text>
        </View>
      )}
      {!!note0 && (
        <View style={st.reason}>
          <Text style={st.reasonLabel}>{t('requests.adminNote')}</Text>
          <Text style={st.reasonText}>{note0}</Text>
        </View>
      )}

      {r.status === 'pending' && (
        <>
          <Subtle style={{ marginTop: 18, marginBottom: 14 }}>
            {t('requests.reviewHint')}{isLeave ? '' : ` ${t('requests.correctionHint')}`}
          </Subtle>
          {rejecting ? (
            <View>
              <Field label={t('requests.rejectNote', { name: r.staffName })} placeholder={t('requests.notePlaceholder')}
                value={note} onChangeText={setNote} maxLength={300} multiline autoFocus />
              <View style={st.btnRow}>
                <Button title={t('common.cancel')} variant="outline" style={{ flex: 1 }} disabled={!!busy}
                  onPress={() => { setRejecting(false); setNote(''); }} />
                <Button title={t('requests.confirmReject')} variant="danger" icon="x" style={{ flex: 1.4 }}
                  busy={busy === 'reject'} disabled={!!busy} onPress={() => decide(false)} />
              </View>
            </View>
          ) : (
            <View style={st.btnRow}>
              <Button title={isLeave ? t('requests.approveLeave') : t('requests.approve')} icon="check" style={{ flex: 1.4 }}
                busy={busy === 'approve'} disabled={!!busy} onPress={() => decide(true)} />
              <Button title={t('requests.reject')} variant="danger" icon="x" style={{ flex: 1 }}
                disabled={!!busy} onPress={() => setRejecting(true)} />
            </View>
          )}
        </>
      )}

      {isLeave && r.status === 'approved' && (
        <Button title={t('requests.withdrawApproval')} variant="danger" icon="rotate-ccw" style={{ marginTop: 22 }}
          busy={busy === 'reject'} onPress={withdrawApproval} />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -4 },
  backText: { fontSize: 15, color: T.textMuted, marginLeft: 6 },
  h1: { fontSize: 26, fontWeight: '800', color: T.navyDeep, marginTop: 22, letterSpacing: -0.3 },
  person: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 18 },
  name: { fontSize: 17, fontWeight: '800', color: T.navyDeep },
  job: { fontSize: 15, color: T.textMuted, marginTop: 3 },
  line: { height: 1, backgroundColor: T.line },
  reason: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.line },
  reasonLabel: { fontSize: 15, color: T.textMuted },
  reasonText: { fontSize: 15, color: T.navyDeep, fontWeight: '600', marginTop: 6, lineHeight: 22 },
  btnRow: { flexDirection: 'row', gap: 12 },
});
