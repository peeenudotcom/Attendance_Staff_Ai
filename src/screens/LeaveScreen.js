import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { leaveAPI } from '../services/api';
import { useLang, fmtDay, fmtMonth, monthLong, monthShort } from '../i18n';
import '../i18n/strings/leave';
import {
  Screen, AppHeader, ViewToggle, WeekStrip, MonthGrid, Chip, Button, StatRow, ListRow, Field, DateBox, ChoiceRow,
  SectionTitle, Subtle, Divider, Empty, Loading, Card, Icon, T,
  istToday, addDays, weekOf, monthWeeks, shiftMonth, datesBetween,
} from '../ui';

// Leave: staff ask for leave by tapping days on the calendar in the header, see their paid leave balance, and follow
// their requests. Admins see the same thing under Requests -> My leave (RequestsScreen uses the pieces below).

export const LEAVE_TYPES = ['casual', 'sick', 'paid', 'unpaid'];
/** Chip colour for a request's status. */
export const STATUS_TONE = { pending: 'yellow', approved: 'green', rejected: 'red', cancelled: 'grey' };
/** "1 day" / "3 days" */
export const daysText = (t, n) => (n === 1 ? t('common.day') : t('common.days', { n }));
/** "Wed, 14 Oct" or "Wed, 14 Oct – Thu, 15 Oct" */
export const leaveDates = (t, r) => (r.from === r.to ? fmtDay(t, r.from) : `${fmtDay(t, r.from)} – ${fmtDay(t, r.to)}`);
/** "Casual leave" */
export const leaveTypeLong = (t, type) => t(`leave.${type}Leave`);
/** "12 October", "12 – 15 October", "30 October – 2 November" */
function rangeLong(t, from, to) {
  const day = (d) => Number(d.slice(8, 10));
  const mon = (d) => monthLong(t, Number(d.slice(5, 7)));
  if (from === to) return `${day(from)} ${mon(from)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from)} – ${day(to)} ${mon(to)}`;
  return `${day(from)} ${mon(from)} – ${day(to)} ${mon(to)}`;
}
/** "12 Oct – 18 Oct" for a week */
const weekLabel = (t, dates) => {
  const short = (d) => `${Number(d.slice(8, 10))} ${monthShort(t, Number(d.slice(5, 7)))}`;
  return `${short(dates[0])} – ${short(dates[6])}`;
};

/** Previous / next buttons with a label between them (on the navy header). */
export function PeriodNav({ label, onPrev, onNext, prevDisabled, nextDisabled, right }) {
  const { t } = useLang();
  const btn = (icon, onPress, disabled, a11y) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} hitSlop={10} accessibilityLabel={a11y}
      style={[st.navBtn, disabled && { opacity: 0.3 }]}>
      <Icon name={icon} size={19} color={T.onNavy} />
    </TouchableOpacity>
  );
  return (
    <View style={st.navRow}>
      {btn('chevron-left', onPrev, prevDisabled, t('leave.prev'))}
      <Text style={st.navLabel} numberOfLines={1}>{label}</Text>
      {btn('chevron-right', onNext, nextDisabled, t('leave.next'))}
      {right ? <View style={{ marginLeft: 12 }}>{right}</View> : null}
    </View>
  );
}

/**
 * Everything the leave form needs: my requests and balance (loaded when the screen is focused), the chosen type and
 * dates, and the calendar shown in the header. Used by LeaveScreen and by RequestsScreen's "My leave".
 */
export function useLeaveForm() {
  const { user } = useAuth();
  const { t } = useLang();
  const tRef = useRef(t);
  tRef.current = t;
  const isAdmin = user?.role === 'admin';
  const tomorrow = addDays(istToday(), 1);

  const [mine, setMine] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [type, setType] = useState('casual');
  const [from, setFrom] = useState(tomorrow);
  const [to, setTo] = useState(tomorrow);
  // What the next tap on the calendar does: 'start' a new range, set the 'from' day, or set the 'to' day.
  const [picking, setPicking] = useState('start');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(tomorrow); // a date in the week or month shown

  const load = useCallback(async () => {
    try {
      const own = await leaveAPI.mine();
      setMine(own.requests || []);
      setBalance(own.balance ?? null);
    } catch (e) {
      Alert.alert(tRef.current('leave.couldNotLoad'), e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = () => { setRefreshing(true); load(); };

  const minDate = addDays(istToday(), -30);
  const pickDay = (d) => {
    if (d < minDate) { Alert.alert(t('leave.tooFarBack')); return; }
    if (picking === 'from') {
      setFrom(d);
      if (d > to) setTo(d);
      setPicking('to');
    } else if (picking === 'to' && d >= from) {
      setTo(d);
      setPicking('start');
    } else { // a new range (or a 'to' tap before the first day starts again from there)
      setFrom(d);
      setTo(d);
      setPicking('to');
    }
  };
  const focusFrom = () => { setPicking('from'); setAnchor(from); };
  const focusTo = () => { setPicking('to'); setAnchor(to); };

  const toggleView = () => setView((v) => (v === 'week' ? 'month' : 'week'));
  const move = (n) => setAnchor((a) => (view === 'week' ? addDays(a, 7 * n) : `${shiftMonth(a.slice(0, 7), n)}-01`));
  const periodStart = view === 'week' ? weekOf(anchor)[0] : `${anchor.slice(0, 7)}-01`;

  const submit = async () => {
    setBusy(true);
    try {
      await leaveAPI.ask({ from, to, type, reason: reason.trim() });
      setReason('');
      setPicking('start');
      Alert.alert(t('leave.sentTitle'), isAdmin ? t('leave.sentAdmin') : t('leave.sentStaff'));
      load();
    } catch (e) {
      Alert.alert(t('leave.couldNotAsk'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = (r) => Alert.alert(t('leave.cancelTitle'), leaveDates(t, r), [
    { text: t('leave.keepIt'), style: 'cancel' },
    { text: t('leave.cancelLeave'), style: 'destructive', onPress: async () => {
      try { await leaveAPI.cancel(r.id); load(); } catch (e) { Alert.alert(t('leave.couldNotCancel'), e.message); }
    } },
  ]);

  // Days that already have leave: a dot on the calendar (pending amber, approved blue).
  const dots = useMemo(() => {
    const out = {};
    for (const r of mine) {
      if (r.status !== 'pending' && r.status !== 'approved') continue;
      for (const d of datesBetween(r.from, r.to)) out[d] = r.status === 'approved' ? T.blue : T.amber;
    }
    return out;
  }, [mine]);

  return {
    isAdmin, mine, balance, loading, refreshing, refresh, load, type, setType, from, to, picking, pickDay, focusFrom,
    focusTo, reason, setReason, busy, submit, cancel, view, toggleView, anchor, move, minDate, periodStart, dots,
  };
}

/** The "Month view" pill for the header. */
export function LeaveViewToggle({ form }) {
  const { t } = useLang();
  return <ViewToggle label={form.view === 'week' ? t('common.monthView') : t('common.weekView')} onPress={form.toggleView} />;
}

/** The calendar on the navy header: tap the first day, then the last day. */
export function LeavePicker({ form, showToggle }) {
  const { t } = useLang();
  const { view, anchor, from, to, pickDay, move, minDate, periodStart, dots } = form;
  const range = datesBetween(from, to);
  const week = weekOf(anchor);
  return (
    <View>
      <PeriodNav
        label={view === 'week' ? weekLabel(t, week) : fmtMonth(t, anchor)}
        onPrev={() => move(-1)} onNext={() => move(1)} prevDisabled={periodStart <= minDate}
        right={showToggle ? <LeaveViewToggle form={form} /> : null}
      />
      {view === 'week'
        ? <WeekStrip dates={week} selected={range} dots={dots} onPress={pickDay} />
        : <MonthGrid weeks={monthWeeks(anchor.slice(0, 7))} selected={range} dots={dots} onPress={pickDay} />}
    </View>
  );
}

/** The sheet content: balance, the request form, a link to corrections and my requests. */
export function MyLeave({ navigation, form }) {
  const { t } = useLang();
  const { balance, mine, loading, type, setType, from, to, picking, reason, setReason, busy } = form;
  const n = datesBetween(from, to).length;
  const canCancel = (r) => r.status === 'pending' || (r.status === 'approved' && r.from > istToday());

  return (
    <View>
      {balance?.limited && (
        <Card style={st.balance}>
          <Text style={st.balanceTitle}>{t('leave.balanceTitle', { year: balance.year })}</Text>
          <StatRow style={{ paddingVertical: 2 }} items={[
            { label: t('leave.left'), value: balance.available, valueColor: T.green },
            { label: t('leave.used'), value: balance.used },
            { label: t('leave.earned'), value: balance.earned },
          ]} />
          {balance.pending > 0 && (
            <Subtle style={{ marginTop: 8 }}>
              {balance.pending === 1 ? t('leave.pendingTakenOne') : t('leave.pendingTaken', { n: balance.pending })}
            </Subtle>
          )}
        </Card>
      )}

      <Text style={st.h1}>{t('leave.requestLeave')}</Text>
      <Subtle style={st.h1Sub}>{t('leave.requestSub')}</Subtle>

      <Text style={st.label}>{t('leave.leaveType')}</Text>
      <ChoiceRow options={LEAVE_TYPES.map((k) => ({ value: k, label: t(`leave.${k}`) }))} value={type} onChange={setType} />

      <View style={st.dateRow}>
        <DateBox label={t('leave.from')} value={fmtDay(t, from)} onPress={form.focusFrom}
          style={picking !== 'to' && st.dateFocus} />
        <DateBox label={t('leave.to')} value={fmtDay(t, to)} onPress={form.focusTo}
          style={picking === 'to' && st.dateFocus} />
      </View>
      <Subtle style={{ marginTop: 10 }}>
        {n === 1 ? t('leave.daySelected') : t('leave.daysSelected', { n })}
        {' · '}{picking === 'to' ? t('leave.tapTo') : t('leave.tapFrom')}
      </Subtle>

      <Field label={t('leave.reasonOptional')} style={{ marginTop: 20 }} placeholder={t('leave.reasonPlaceholder')}
        value={reason} onChangeText={setReason} maxLength={500} multiline />

      <Divider style={{ marginTop: 4, marginBottom: 18 }} />
      <Text style={st.summary}>{leaveTypeLong(t, type)} · {rangeLong(t, from, to)}</Text>
      <Button title={`${t('leave.sendRequest')}  →`} onPress={form.submit} busy={busy} />
      <Subtle style={{ marginTop: 10 }}>{t('leave.willBeSent')}</Subtle>

      <View style={{ marginTop: 22 }}>
        <ListRow
          left={<View style={st.linkIcon}><Icon name="edit-3" size={19} color={T.navyDeep} /></View>}
          title={t('leave.corrections')} subtitle={t('leave.correctionsSub')}
          onPress={() => navigation.navigate('Corrections')}
        />
      </View>

      <SectionTitle style={{ marginTop: 22 }}>{t('leave.myRequests')}</SectionTitle>
      {loading && !mine.length ? <Loading /> : null}
      {!loading && mine.length === 0 ? <Empty>{t('leave.noRequests')}</Empty> : null}
      {mine.map((r, i) => (
        <View key={r.id} style={[st.req, i < mine.length - 1 && st.reqLine]}>
          <View style={st.reqTop}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={st.reqTitle}>{leaveDates(t, r)}</Text>
              <Text style={st.reqSub}>{daysText(t, r.days)} · {leaveTypeLong(t, r.type)}</Text>
            </View>
            <Chip label={t(`common.${r.status === 'pending' ? 'waiting' : r.status}`)} tone={STATUS_TONE[r.status]} />
          </View>
          {!!r.reason && <Text style={st.reqNote}>“{r.reason}”</Text>}
          {!!r.note && <Text style={st.reqNote}>{t('leave.adminNote', { note: r.note })}</Text>}
          {canCancel(r) && (
            <TouchableOpacity onPress={() => form.cancel(r)} hitSlop={8} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <Text style={st.link}>{t('leave.cancelRequest')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

export default function LeaveScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useLang();
  const form = useLeaveForm();
  const asPage = route?.name === 'MyLeave'; // opened from a notification or a shortcut, not the tab
  return (
    <Screen keyboard refreshing={form.refreshing} onRefresh={form.refresh}
      header={(
        <AppHeader
          title={fmtMonth(t, form.anchor)} subtitle={t('leave.chooseDates')} right={<LeaveViewToggle form={form} />}
          avatarName={user?.name || ''} onAvatarPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          onBack={asPage ? () => navigation.goBack() : undefined}
        >
          <LeavePicker form={form} />
        </AppHeader>
      )}>
      <MyLeave navigation={navigation} form={form} />
    </Screen>
  );
}

const st = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: T.onNavyGlass },
  navLabel: { flex: 1, textAlign: 'center', color: T.onNavyMuted, fontSize: 14, fontWeight: '600' },

  balance: { paddingVertical: 12, paddingHorizontal: 12, marginBottom: 24 },
  balanceTitle: { fontSize: 13, fontWeight: '700', color: T.textMuted, textAlign: 'center', marginBottom: 4 },
  h1: { fontSize: 24, fontWeight: '800', color: T.navyDeep, letterSpacing: -0.3 },
  h1Sub: { fontSize: 15, marginTop: 4 },
  label: { fontSize: 15, fontWeight: '600', color: T.textMuted, marginTop: 22, marginBottom: 10 },
  dateRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  dateFocus: { borderColor: T.yellow, borderWidth: 2 },
  summary: { fontSize: 17, fontWeight: '800', color: T.navyDeep, marginBottom: 16 },
  linkIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },

  req: { paddingVertical: 16 },
  reqLine: { borderBottomWidth: 1, borderBottomColor: T.line },
  reqTop: { flexDirection: 'row', alignItems: 'center' },
  reqTitle: { fontSize: 15, fontWeight: '700', color: T.navyDeep },
  reqSub: { fontSize: 14, color: T.textMuted, marginTop: 3 },
  reqNote: { fontSize: 14, color: T.text, marginTop: 8, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '700', color: T.red },
});
