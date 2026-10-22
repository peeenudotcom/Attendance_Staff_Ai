import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { correctionsAPI } from '../services/api';
import { useRequestsCount } from '../navigation/AppNavigator';
import { normalizeTime, TIME_KEYBOARD } from '../utils/time';
import { useLang, fmtDay, fmtDayYear, monthShort } from '../i18n';
import '../i18n/strings/corrections';
import '../i18n/strings/leave';
import {
  Screen, AppHeader, WeekStrip, Chip, Button, ListRow, Field, DateBox, SectionTitle, Subtle, Divider, Empty, Loading,
  Icon, T, istToday, addDays, weekOf,
} from '../ui';
import { PeriodNav, STATUS_TONE } from './LeaveScreen';

// "I forgot to check out", "I couldn't check in" or "the time is wrong": staff ask, an admin approves and the
// attendance is fixed. Opened from the Leave tab, from a day in the register (params { date, kind }), or after a
// failed check-in. Admins decide these in the Requests tab.
const KINDS = [
  { key: 'missed_check_out', in: false, out: true },
  { key: 'missed_check_in', in: true, out: 'optional' },
  { key: 'wrong_time', in: 'optional', out: 'optional' },
];
const MAX_DAYS_BACK = 45;

export default function CorrectionsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useLang();
  const tRef = useRef(t);
  tRef.current = t;
  const { count } = useRequestsCount();
  const isAdmin = user?.role === 'admin';
  const preset = route?.params || {};
  const today = istToday();
  const oldest = addDays(today, -MAX_DAYS_BACK);

  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState(KINDS.some((x) => x.key === preset.kind) ? preset.kind : 'missed_check_out');
  const [date, setDate] = useState(preset.date && preset.date <= today ? preset.date : today);
  const [anchor, setAnchor] = useState(preset.date && preset.date <= today ? preset.date : today);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const k = KINDS.find((x) => x.key === kind);

  const load = useCallback(async () => {
    try {
      const own = await correctionsAPI.mine();
      setMine(own.requests || []);
    } catch (e) {
      Alert.alert(tRef.current('corrections.couldNotLoad'), e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickDay = (d) => {
    if (d > today) { Alert.alert(t('corrections.noFuture')); return; }
    if (d < oldest) { Alert.alert(t('corrections.tooOld')); return; }
    setDate(d);
  };
  const week = weekOf(anchor);
  const short = (d) => `${Number(d.slice(8, 10))} ${monthShort(t, Number(d.slice(5, 7)))}`;

  const submit = async () => {
    setBusy(true);
    try {
      await correctionsAPI.ask({ date, kind, checkIn: normalizeTime(checkIn) || null, checkOut: normalizeTime(checkOut) || null, reason: reason.trim() });
      setCheckIn(''); setCheckOut(''); setReason('');
      Alert.alert(t('corrections.sentTitle'), isAdmin ? t('corrections.sentAdmin') : t('corrections.sentStaff'));
      load();
    } catch (e) {
      Alert.alert(t('corrections.couldNotSend'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const timesText = (r) => [r.checkIn ? t('corrections.inAt', { time: r.checkIn }) : null, r.checkOut ? t('corrections.outAt', { time: r.checkOut }) : null]
    .filter(Boolean).join(' · ');
  const withdraw = (r) => Alert.alert(t('corrections.withdrawTitle'), `${fmtDay(t, r.date)} · ${t(`corrections.kind_${r.kind}`)}`, [
    { text: t('corrections.keepIt'), style: 'cancel' },
    { text: t('corrections.withdrawBtn'), style: 'destructive', onPress: async () => {
      try { await correctionsAPI.cancel(r.id); load(); } catch (e) { Alert.alert(t('corrections.couldNotWithdraw'), e.message); }
    } },
  ]);

  // Days with a request: a dot on the week strip.
  const dots = useMemo(() => {
    const out = {};
    for (const r of mine) if (r.status === 'pending' || r.status === 'approved') out[r.date] = r.status === 'approved' ? T.green : T.amber;
    return out;
  }, [mine]);

  const timeField = (labelKey, value, set, need, placeholder) => (need ? (
    <Field style={{ flex: 1 }} label={need === 'optional' ? t('corrections.optional', { label: t(labelKey) }) : t(labelKey)}
      value={value} onChangeText={set} placeholder={placeholder} keyboardType={TIME_KEYBOARD} maxLength={5} />
  ) : null);

  return (
    <Screen keyboard refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      header={(
        <AppHeader title={t('corrections.title')} subtitle={t('corrections.subtitle')} onBack={() => navigation.goBack()}
          avatarName={user?.name || ''} onAvatarPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
          <PeriodNav label={`${short(week[0])} – ${short(week[6])}`}
            onPrev={() => setAnchor(addDays(anchor, -7))} prevDisabled={week[0] <= oldest}
            onNext={() => setAnchor(addDays(anchor, 7))} nextDisabled={week[6] >= today} />
          <WeekStrip dates={week} selected={[date]} dots={dots} onPress={pickDay} />
        </AppHeader>
      )}>
      {isAdmin && (
        <View style={{ marginBottom: 18 }}>
          <ListRow last
            left={<View style={st.linkIcon}><Icon name="file-text" size={22} color={T.navyDeep} /></View>}
            title={t('corrections.toReview')} subtitle={t('corrections.toReviewSub')}
            right={count ? <Chip label={String(count)} tone="yellow" /> : null}
            onPress={() => navigation.navigate('Main', { screen: 'Requests' })} />
          <Divider style={{ marginVertical: 0 }} />
        </View>
      )}

      <Text style={st.h1}>{t('corrections.askTitle')}</Text>
      <Subtle style={st.h1Sub}>{t('corrections.askSub')}</Subtle>

      <Text style={st.label}>{t('corrections.whatHappened')}</Text>
      <View style={{ gap: 10 }}>
        {KINDS.map((x) => {
          const on = x.key === kind;
          return (
            <TouchableOpacity key={x.key} onPress={() => setKind(x.key)} activeOpacity={0.8} style={[st.kind, on && st.kindOn]}>
              <Icon name={on ? 'check-circle' : 'circle'} size={22} color={on ? T.onYellow : T.textFaint} />
              <Text style={[st.kindText, on && { color: T.onYellow, fontWeight: '700' }]}>{t(`corrections.kind_${x.key}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <DateBox label={t('corrections.day')} value={date === today ? `${t('common.today')}, ${fmtDay(t, date)}` : fmtDayYear(t, date)}
        onPress={() => setAnchor(date)} style={{ marginTop: 18, flex: 0 }} />
      <Subtle style={{ marginTop: 8 }}>{t('corrections.tapDay')}</Subtle>

      <View style={st.row2}>
        {timeField('corrections.cameIn', checkIn, setCheckIn, k.in, '09:30')}
        {timeField('corrections.leftAt', checkOut, setCheckOut, k.out, '18:30')}
      </View>
      <Subtle style={{ marginTop: -6, marginBottom: 16 }}>{t('corrections.timeHint')}</Subtle>

      <Field label={t('corrections.reason')} placeholder={t('corrections.reasonPlaceholder')} value={reason}
        onChangeText={setReason} maxLength={300} multiline />
      <Button title={`${t('corrections.send')}  →`} onPress={submit} busy={busy} />
      <Subtle style={{ marginTop: 10 }}>{t('corrections.willBeSent')}</Subtle>

      <SectionTitle style={{ marginTop: 28 }}>{t('corrections.myRequests')}</SectionTitle>
      {loading && !mine.length ? <Loading /> : null}
      {!loading && mine.length === 0 ? <Empty>{t('corrections.noRequests')}</Empty> : null}
      {mine.map((r, i) => (
        <View key={r.id} style={[st.req, i < mine.length - 1 && st.reqLine]}>
          <View style={st.reqTop}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={st.reqTitle}>{fmtDay(t, r.date)}</Text>
              <Text style={st.reqSub}>{t(`corrections.kind_${r.kind}`)}{timesText(r) ? ` · ${timesText(r)}` : ''}</Text>
            </View>
            <Chip tone={STATUS_TONE[r.status]}
              label={r.status === 'cancelled' ? t('corrections.withdrawn') : t(`common.${r.status === 'pending' ? 'waiting' : r.status}`)} />
          </View>
          {!!r.reason && <Text style={st.reqNote}>“{r.reason}”</Text>}
          {!!r.decisionNote && <Text style={st.reqNote}>{t('corrections.adminNote', { note: r.decisionNote })}</Text>}
          {r.status === 'pending' && (
            <TouchableOpacity onPress={() => withdraw(r)} hitSlop={8} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <Text style={st.link}>{t('corrections.withdraw')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </Screen>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '800', color: T.navyDeep, letterSpacing: -0.3 },
  h1Sub: { fontSize: 17, marginTop: 4 },
  label: { fontSize: 17, fontWeight: '600', color: T.textMuted, marginTop: 22, marginBottom: 10 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 16, borderRadius: T.radius, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface },
  kindOn: { backgroundColor: T.yellow, borderColor: T.yellow },
  kindText: { fontSize: 17, color: T.text, fontWeight: '500', flexShrink: 1 },
  row2: { flexDirection: 'row', gap: 12, marginTop: 18 },
  linkIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },

  req: { paddingVertical: 16 },
  reqLine: { borderBottomWidth: 1, borderBottomColor: T.line },
  reqTop: { flexDirection: 'row', alignItems: 'center' },
  reqTitle: { fontSize: 18, fontWeight: '700', color: T.navyDeep },
  reqSub: { fontSize: 16, color: T.textMuted, marginTop: 3 },
  reqNote: { fontSize: 16, color: T.text, marginTop: 8, lineHeight: 22 },
  link: { fontSize: 16, fontWeight: '700', color: T.red },
});
