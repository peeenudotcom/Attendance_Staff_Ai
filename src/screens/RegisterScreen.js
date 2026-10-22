import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Screen, AppHeader, Segmented, ViewToggle, WeekStrip, MonthGrid, Avatar, Chip, Button, StatRow, ListRow, Field,
  SectionTitle, Subtle, Divider, Empty, Loading, Card, Icon, T, STATUS_COLOR,
  istToday, addDays, weekOf, monthWeeks, shiftMonth,
} from '../ui';
import { useLang, fmtDay, fmtDayLong, fmtMonth, monthShort } from '../i18n';
import '../i18n/strings/register';
import { useAuth } from '../context/AuthContext';
import { useRequestsCount } from '../navigation/AppNavigator';
import { attendanceAPI, companyAPI, holidaysAPI, leaveAPI, reportsAPI } from '../services/api';
import { scheduleReminders } from '../services/notifications';
import { normalizeTime, TIME_KEYBOARD } from '../utils/time';

// The Register tab. "My day": today's check-in card and my month (calendar, totals, a day's times, ask for a
// correction). "Team" (admins): everyone's attendance for a date, with selfies, place and the add / edit / remove
// day form. Opened as the stack screen "Team" (from a notification) it starts on Team with a back arrow.

const istHour = () => new Date(Date.now() + 330 * 60_000).getUTCHours();
const fmtDist = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
const has = (v) => v && v !== '—';
// The server sends hours as "8h 16m"; show them in the chosen language.
function fmtHours(t, str) {
  const m = /^(\d+)h (\d+)m$/.exec(String(str || ''));
  return m ? t('common.hoursMinutes', { h: m[1], m: m[2] }) : str;
}
const fmtMinutes = (t, min) => t('common.hoursMinutes', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
const shortDate = (t, d) => `${Number(d.slice(8, 10))} ${monthShort(t, Number(d.slice(5, 7)))}`;
const DOT_STATUSES = ['present', 'late', 'half', 'absent', 'leave', 'holiday'];
const TEAM_ORDER = { late: 0, half: 1, present: 2, pending: 3, absent: 4, leave: 5, holiday: 6, off: 7 };

/** A day's status in words (my calendar). */
function dayLabel(t, d) {
  if (!d) return '';
  if (d.holiday) return t('register.holidayName', { name: d.holiday });
  switch (d.status) {
    case 'present': return t('common.present');
    case 'late': return t('common.late');
    case 'half': return t('common.half');
    case 'absent': return t('common.absent');
    case 'leave': return t('common.onLeave');
    case 'off': return t('common.off');
    case 'holiday': return t('common.holiday');
    case 'pending': return d.date > istToday() ? t('register.upcoming') : t('register.notCheckedInYet');
    case 'left': return t('common.left');
    default: return t('register.beforeJoined');
  }
}
const CHIP = {
  present: ['green', 'check-circle'], late: ['amber', 'clock'], half: ['amber', 'clock'], absent: ['red', 'x-circle'],
  leave: ['blue', 'sun'], holiday: ['blue', 'gift'], off: ['grey', 'moon'],
};

export default function RegisterScreen({ navigation, route }) {
  const { t } = useLang();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const asStack = route?.params?.mode === 'team';
  const today = istToday();

  const [mode, setMode] = useState(isAdmin && asStack ? 'team' : 'me');
  const [views, setViews] = useState({ me: 'week', team: 'week' }); // week first, so the check-in card is in view
  const view = views[mode];
  const toggleView = () => setViews((v) => ({ ...v, [mode]: v[mode] === 'month' ? 'week' : 'month' }));

  // Tabs live inside the "Main" stack screen; going through it works from the tab and from the stack "Team" screen.
  const goTab = (name) => navigation.navigate('Main', { screen: name });

  // ---- My day ----
  const [todayRec, setTodayRec] = useState(null);
  const [meSel, setMeSel] = useState(today);
  const [meMonth, setMeMonth] = useState(today.slice(0, 7));
  const [months, setMonths] = useState({}); // 'YYYY-MM' -> month data
  const [meError, setMeError] = useState('');
  const [showList, setShowList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMonth = useCallback(async (ym) => {
    try {
      const res = await attendanceAPI.getMonth(ym);
      setMonths((m) => ({ ...m, [ym]: res }));
      setMeError('');
    } catch (e) {
      setMeError(e.message || t('register.couldNotLoadMine'));
    }
  }, [t]);

  const tRef = useRef(t);
  tRef.current = t;
  const loadToday = useCallback(async () => {
    const rec = await attendanceAPI.getToday().catch(() => null);
    if (rec) setTodayRec(rec);
    // Re-plan check-in / check-out reminders from the shift, today's status, approved leave and holidays.
    const [company, leave, hols] = await Promise.all([
      companyAPI.get().catch(() => null), leaveAPI.mine().catch(() => null), holidaysAPI.list().catch(() => null),
    ]);
    const leaveDates = (leave?.requests || []).filter((r) => r.status === 'approved').flatMap((r) => {
      const out = [];
      for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push(d);
      return out;
    });
    scheduleReminders({ company, today: rec, leaveDates: [...leaveDates, ...(hols?.holidays || []).map((x) => x.date)], t: tRef.current });
  }, []);

  // Months the calendar shows: the chosen month, plus both ends of the week in week view.
  const meWeek = weekOf(meSel);
  const neededMonths = view === 'week' && mode === 'me'
    ? [...new Set([meMonth, meWeek[0].slice(0, 7), meWeek[6].slice(0, 7)])].filter((m) => m <= today.slice(0, 7))
    : [meMonth];
  const neededKey = neededMonths.join(',');

  // ---- Team ----
  const { count: reqCount, refresh: refreshCount } = useRequestsCount();
  const [teamDate, setTeamDate] = useState(today);
  const [teamData, setTeamData] = useState(null);
  const [teamError, setTeamError] = useState('');
  const [detail, setDetail] = useState(null); // a person from the day report
  const [form, setForm] = useState(null); // { person, record }
  const [photo, setPhoto] = useState(null);

  const loadTeam = useCallback(async (d) => {
    try {
      const res = await reportsAPI.day(d);
      setTeamData(res);
      setTeamError('');
    } catch (e) {
      setTeamError(e.message || t('common.couldNotLoad'));
    }
  }, [t]);

  // Reload whenever the screen comes into view (e.g. back from checking in) and when the month / date changes.
  useFocusEffect(useCallback(() => { if (mode === 'me') loadToday(); }, [mode, loadToday]));
  useFocusEffect(useCallback(() => {
    if (mode !== 'me') return;
    neededKey.split(',').forEach((m) => loadMonth(m));
  }, [mode, neededKey, loadMonth]));
  useFocusEffect(useCallback(() => {
    if (mode !== 'team') return;
    loadTeam(teamDate);
    refreshCount();
  }, [mode, teamDate, loadTeam, refreshCount]));
  useEffect(() => { setTeamData((d) => (d && d.date !== teamDate ? null : d)); }, [teamDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (mode === 'me') await Promise.all([loadToday(), ...neededMonths.map(loadMonth)]);
      else await Promise.all([loadTeam(teamDate), refreshCount()]);
    } finally {
      setRefreshing(false);
    }
  };

  // ---- Header ----
  const curMonth = today.slice(0, 7);
  const shownMonth = mode === 'me' ? meMonth : teamDate.slice(0, 7);
  const navPrev = () => {
    if (mode === 'me') {
      if (view === 'month') { const m = shiftMonth(meMonth, -1); setMeMonth(m); setMeSel(`${m}-01`); } else { const d = addDays(meSel, -7); setMeSel(d); setMeMonth(d.slice(0, 7)); }
    } else if (view === 'month') { setTeamDate(`${shiftMonth(teamDate.slice(0, 7), -1)}-01`); } else setTeamDate(addDays(teamDate, -7));
  };
  const navNext = () => {
    const clamp = (d) => (d > today ? today : d);
    if (mode === 'me') {
      if (view === 'month') { const m = shiftMonth(meMonth, 1); setMeMonth(m); setMeSel(m === curMonth ? today : `${m}-01`); } else { const d = clamp(addDays(meSel, 7)); setMeSel(d); setMeMonth(d.slice(0, 7)); }
    } else if (view === 'month') { const m = shiftMonth(teamDate.slice(0, 7), 1); setTeamDate(m === curMonth ? today : `${m}-01`); } else setTeamDate(clamp(addDays(teamDate, 7)));
  };
  const selDate = mode === 'me' ? meSel : teamDate;
  const atEnd = view === 'month' ? shownMonth >= curMonth : weekOf(selDate)[6] >= today;
  const onToday = view === 'month' ? shownMonth === curMonth && selDate === today : weekOf(selDate).includes(today) && selDate === today;
  const goToday = () => { if (mode === 'me') { setMeSel(today); setMeMonth(curMonth); } else setTeamDate(today); };

  const dots = useMemo(() => {
    const out = {};
    Object.values(months).forEach((m) => m?.days?.forEach((d) => { if (DOT_STATUSES.includes(d.status)) out[d.date] = STATUS_COLOR[d.status]; }));
    return out;
  }, [months]);

  const pickMine = (d) => { setMeSel(d); setMeMonth(d.slice(0, 7)); };
  const pickTeam = (d) => { if (d <= today) setTeamDate(d); };

  const weekDates = weekOf(selDate);
  const navRow = (
    <View style={st.navRow}>
      <TouchableOpacity onPress={navPrev} hitSlop={10} style={st.navBtn} accessibilityLabel={t(view === 'month' ? 'register.prevMonth' : 'register.prevWeek')}>
        <Icon name="chevron-left" size={24} color={T.onNavy} />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {onToday ? (
          view === 'week' ? <Text style={st.navText}>{`${shortDate(t, weekDates[0])} – ${shortDate(t, weekDates[6])}`}</Text> : null
        ) : (
          <TouchableOpacity onPress={goToday} style={st.todayPill} activeOpacity={0.8}>
            <Text style={st.todayPillText}>{t('common.today')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={navNext} disabled={atEnd} hitSlop={10} style={[st.navBtn, atEnd && { opacity: 0.3 }]} accessibilityLabel={t(view === 'month' ? 'register.nextMonth' : 'register.nextWeek')}>
        <Icon name="chevron-right" size={24} color={T.onNavy} />
      </TouchableOpacity>
    </View>
  );

  const calendar = view === 'month'
    ? <MonthGrid weeks={monthWeeks(shownMonth)} selected={selDate} dots={mode === 'me' ? dots : {}} onPress={mode === 'me' ? pickMine : pickTeam} />
    : <WeekStrip dates={weekDates} selected={[selDate]} dots={mode === 'me' ? dots : {}} onPress={mode === 'me' ? pickMine : pickTeam} />;

  const header = (
    <AppHeader
      title={fmtMonth(t, shownMonth)}
      subtitle={isAdmin ? undefined : t('register.myAttendance')}
      right={<ViewToggle label={t(view === 'month' ? 'common.weekView' : 'common.monthView')} onPress={toggleView} />}
      avatarName={user?.name || ''}
      onAvatarPress={() => goTab('Profile')}
      onBack={asStack && navigation.canGoBack() ? () => navigation.goBack() : undefined}
    >
      {isAdmin ? (
        <Segmented
          options={[{ value: 'me', label: t('register.myDay') }, { value: 'team', label: t('register.team') }]}
          value={mode}
          onChange={setMode}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {navRow}
      {calendar}
    </AppHeader>
  );

  return (
    <>
      <Screen header={header} refreshing={refreshing} onRefresh={onRefresh}>
        {mode === 'me' ? (
          <MyDay
            t={t}
            navigation={navigation}
            todayRec={todayRec}
            month={months[meMonth]}
            error={meError}
            onRetry={() => loadMonth(meMonth)}
            selected={meSel}
            onSelect={pickMine}
            showList={showList}
            setShowList={setShowList}
          />
        ) : (
          <TeamDay
            t={t}
            date={teamDate}
            data={teamData && teamData.date === teamDate ? teamData : null}
            error={teamError}
            onRetry={() => loadTeam(teamDate)}
            reqCount={reqCount}
            onRequests={() => goTab('Requests')}
            onOpen={setDetail}
          />
        )}
      </Screen>

      <PersonSheet
        t={t}
        person={detail}
        date={teamDate}
        office={teamData?.office}
        onClose={() => setDetail(null)}
        onPhoto={setPhoto}
        onEdit={(p) => {
          setDetail(null);
          setForm({ person: { id: p.id, name: p.name }, record: p.attendanceId ? { id: p.attendanceId, in: p.checkIn, out: p.checkOut, note: p.note } : null });
        }}
        onRemoved={() => { setDetail(null); loadTeam(teamDate); }}
      />

      <TimeForm
        t={t}
        visible={!!form}
        person={form?.person}
        record={form?.record}
        date={teamDate}
        onClose={() => setForm(null)}
        onSaved={() => { setForm(null); loadTeam(teamDate); }}
      />

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <TouchableOpacity style={st.photoWrap} activeOpacity={1} onPress={() => setPhoto(null)}>
          {photo && <Image source={{ uri: photo.url }} style={st.photo} resizeMode="contain" />}
          {photo && <Text style={st.photoCaption}>{photo.caption}</Text>}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// My day

function TodayCard({ t, rec, navigation }) {
  const today = istToday();
  const h = istHour();
  const greeting = t(h < 12 ? 'register.goodMorning' : h < 17 ? 'register.goodAfternoon' : 'register.goodEvening');
  const checkedIn = !!rec?.checkedIn && !rec?.checkedOut;
  const checkedOut = !!rec?.checkedOut;
  return (
    <Card style={{ marginBottom: 22 }} tone={checkedOut ? 'green' : undefined}>
      <Subtle>{greeting}</Subtle>
      <Text style={st.todayDate}>{fmtDayLong(t, today)}</Text>
      <View style={st.todayStatus}>
        <Icon name={checkedOut ? 'check-circle' : checkedIn ? 'log-in' : 'clock'} size={22} color={checkedOut || checkedIn ? T.green : T.textMuted} />
        <Text style={st.todayStatusText}>
          {checkedOut ? t('register.checkedOutAt', { time: rec.checkOut }) : checkedIn ? t('register.checkedInAt', { time: rec.checkIn }) : t('register.notCheckedIn')}
        </Text>
      </View>
      {checkedOut && has(rec.hours) ? <Subtle style={{ marginTop: 4, marginLeft: 32 }}>{t('register.worked', { hours: fmtHours(t, rec.hours) })}</Subtle> : null}
      {checkedIn && !!rec.location ? <Subtle style={{ marginTop: 4, marginLeft: 32 }} >{rec.location}</Subtle> : null}
      {checkedOut ? (
        <View style={st.doneRow}>
          <Icon name="check" size={22} color={T.green} />
          <Text style={st.doneText}>{t('register.doneForToday')}</Text>
        </View>
      ) : (
        <Button
          title={t(checkedIn ? 'register.checkOut' : 'register.checkIn')}
          icon={checkedIn ? 'log-out' : 'camera'}
          variant={checkedIn ? 'primary' : 'success'}
          style={{ marginTop: 18 }}
          onPress={() => navigation.navigate('MarkAttendance', { type: checkedIn ? 'check-out' : 'check-in' })}
        />
      )}
    </Card>
  );
}

function Legend({ t }) {
  const items = [['present', 'common.present'], ['late', 'common.late'], ['leave', 'common.leave'], ['absent', 'common.absent']];
  return (
    <View style={st.legend}>
      {items.map(([k, label]) => (
        <View key={k} style={st.legendItem}>
          <View style={[st.legendDot, { backgroundColor: STATUS_COLOR[k] }]} />
          <Text style={st.legendText}>{t(label)}</Text>
        </View>
      ))}
      <View style={st.legendItem}>
        <View style={st.legendOutline} />
        <Text style={st.legendText}>{t('register.outlineToday')}</Text>
      </View>
    </View>
  );
}

function MyDay({ t, navigation, todayRec, month, error, onRetry, selected, onSelect, showList, setShowList }) {
  const totals = month?.totals;
  const days = month?.days || [];
  const sel = days.find((d) => d.date === selected);
  return (
    <View>
      <TodayCard t={t} rec={todayRec} navigation={navigation} />
      <Legend t={t} />

      {!month && !error && <Loading />}
      {!month && !!error && (
        <View>
          <Empty>{error}</Empty>
          <Button title={t('common.tryAgain')} variant="outline" onPress={onRetry} />
        </View>
      )}

      {totals && (
        <>
          <StatRow
            style={{ marginTop: 6 }}
            items={[
              { label: t('common.present'), value: totals.present + totals.late },
              { label: t('common.late'), value: totals.late },
              { label: t('common.absent'), value: totals.absent },
              { label: t('common.leave'), value: totals.leave },
            ]}
          />
          {(totals.half > 0 || totals.holiday > 0) && (
            <Subtle style={{ textAlign: 'center', marginTop: 4 }}>
              {[totals.half > 0 && `${t('common.half')}: ${totals.half}`, totals.holiday > 0 && `${t('common.holiday')}: ${totals.holiday}`].filter(Boolean).join('  ·  ')}
            </Subtle>
          )}
          <Text style={st.workedLine}>
            {totals.minutes ? (
              <>
                <Text style={st.workedBig}>{fmtMinutes(t, totals.minutes)}</Text>
                {` ${t('register.worked', { hours: '' }).trim()}`}
              </>
            ) : t('register.noHours')}
          </Text>
          <Divider style={{ marginVertical: 18 }} />
        </>
      )}

      {month && (sel ? <DayDetail t={t} day={sel} navigation={navigation} /> : <Subtle style={{ textAlign: 'center' }}>{t('register.tapDay')}</Subtle>)}

      {month && (
        <>
          <Divider style={{ marginTop: 20, marginBottom: 0 }} />
          <ListRow
            title={t(showList ? 'register.hideList' : 'register.viewAsList')}
            left={<Icon name="list" size={26} color={T.navyDeep} />}
            onPress={() => setShowList(!showList)}
            last
          />
          {showList && days.filter((d) => d.status !== 'before' && !(d.status === 'pending' && d.date > istToday())).map((d, i, arr) => {
            const [tone] = CHIP[d.status] || ['grey'];
            const color = { green: T.green, amber: T.amber, red: T.red, blue: T.blue, grey: T.textFaint }[tone];
            return (
              <TouchableOpacity key={d.date} onPress={() => onSelect(d.date)} activeOpacity={0.7}
                style={[st.listDay, i < arr.length - 1 && st.listLine, d.date === selected && { backgroundColor: T.yellowSoft }]}>
                <View style={[st.legendDot, { backgroundColor: color, marginRight: 12 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.listDate}>{fmtDay(t, d.date)}</Text>
                  <Text style={st.listStatus} numberOfLines={1}>{dayLabel(t, d)}</Text>
                </View>
                {d.checkIn ? <Text style={st.listTimes}>{d.checkIn} – {d.checkOut || '?'}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </View>
  );
}

function DayDetail({ t, day, navigation }) {
  const [tone, icon] = CHIP[day.status] || ['grey', 'circle'];
  const canFix = ['present', 'late', 'half', 'absent'].includes(day.status);
  const kind = day.checkIn && !day.checkOut ? 'missed_check_out' : day.checkIn ? 'wrong_time' : 'missed_check_in';
  return (
    <View>
      <SectionTitle>{fmtDayLong(t, day.date)}</SectionTitle>
      <Chip label={dayLabel(t, day)} tone={tone} icon={icon} style={{ marginTop: 8, alignSelf: 'stretch', paddingVertical: 12 }} />
      {day.checkIn ? (
        <>
          <View style={st.bigRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.bigLabel}>{t('register.in')}</Text>
              <Text style={st.bigValue}>{day.checkIn}</Text>
            </View>
            <View style={[{ flex: 1, paddingLeft: 20 }, st.bigSep]}>
              <Text style={st.bigLabel}>{t('register.out')}</Text>
              <Text style={[st.bigValue, !day.checkOut && { color: T.textFaint, fontSize: 22, marginTop: 10 }]}>{day.checkOut || t(day.date === istToday() ? 'register.stillIn' : 'register.noCheckOut')}</Text>
            </View>
          </View>
          {day.hours ? (
            <View style={{ marginTop: 14 }}>
              <Text style={st.bigLabel}>{t('register.workedLabel')}</Text>
              <Text style={[st.bigValue, { fontSize: 28 }]}>{fmtHours(t, day.hours)}</Text>
            </View>
          ) : null}
        </>
      ) : null}
      {day.edited ? <Subtle style={{ marginTop: 12 }}>{day.note ? t('register.editedByAdminNote', { note: day.note }) : t('register.editedByAdmin')}</Subtle> : null}
      {day.leaveType ? <Subtle style={{ marginTop: 8 }}>{t(day.leaveType === 'unpaid' ? 'register.unpaidLeave' : 'register.paidLeave')}</Subtle> : null}
      {canFix ? (
        <TouchableOpacity onPress={() => navigation.navigate('Corrections', { date: day.date, kind })} style={st.fixLink} activeOpacity={0.7}>
          <Icon name="edit-3" size={20} color={T.navyDeep} />
          <Text style={st.fixLinkText}>{t('register.askCorrection')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Team

function statusLine(t, p) {
  switch (p.status) {
    case 'present': return [{ text: t('register.checkedIn'), color: T.green, icon: 'check-circle' }];
    case 'late': return [{ text: t('register.checkedIn'), color: T.green, icon: 'check-circle' }, { text: t('common.late'), color: '#9A6B00' }];
    case 'half': return [{ text: t('register.checkedIn'), color: T.green, icon: 'check-circle' }, { text: t('common.half'), color: '#9A6B00' }];
    case 'pending': return [{ text: t('common.notYet'), color: T.textMuted, icon: 'user' }];
    case 'absent': return [{ text: t('common.absent'), color: T.red, icon: 'x-circle' }];
    case 'leave': return [{ text: t('common.onLeave'), color: '#2B7DA6', icon: 'sun' }];
    case 'holiday': return [{ text: t('common.holiday'), color: '#2B7DA6', icon: 'gift' }];
    case 'off': return [{ text: t('common.off'), color: T.textMuted, icon: 'moon' }];
    default: return [{ text: t(`common.${p.status}`), color: T.textMuted }];
  }
}

function flagsOf(t, p, office) {
  const away = office && p.checkInDistance != null && p.checkInDistance > office.radiusM;
  return [
    p.noCheckOut && t('register.noCheckOut'),
    p.leftEarlyBy > 0 && t('register.leftEarly', { n: p.leftEarlyBy }),
    away && t('register.fromOffice', { d: fmtDist(p.checkInDistance) }),
  ].filter(Boolean);
}

function TeamDay({ t, date, data, error, onRetry, reqCount, onRequests, onOpen }) {
  const today = istToday();
  const isToday = date === today;
  const s = data?.summary;
  const people = data ? [...data.staff].sort((a, b) => ((TEAM_ORDER[a.status] ?? 9) - (TEAM_ORDER[b.status] ?? 9)) || a.name.localeCompare(b.name)) : [];
  return (
    <View>
      <Text style={st.teamTitle}>{isToday ? t('register.teamToday') : fmtDay(t, date)}</Text>
      <Subtle style={{ fontSize: 18, marginTop: 2 }}>{fmtDayLong(t, date)}</Subtle>

      <TouchableOpacity disabled={!reqCount} onPress={onRequests} activeOpacity={0.7} style={st.reqRow}>
        <Text style={[st.reqText, !reqCount && { color: T.textMuted, fontWeight: '500' }]}>
          {reqCount === 1 ? t('register.requestsOne') : reqCount > 1 ? t('register.requestsMany', { n: reqCount }) : t('register.noRequests')}
        </Text>
        {reqCount ? <Icon name="chevron-right" size={24} color={T.navyDeep} /> : null}
      </TouchableOpacity>

      {!data && !error && <Loading />}
      {!data && !!error && (
        <View>
          <Empty>{error}</Empty>
          <Button title={t('common.tryAgain')} variant="outline" onPress={onRetry} />
        </View>
      )}

      {s && (
        <>
          <StatRow
            style={st.teamStats}
            items={[
              { label: t('register.checkedIn'), value: s.present + s.late, icon: 'check', color: T.green, tint: T.greenSoft },
              { label: t('register.lateArrival'), value: s.late, icon: 'clock', color: T.amber, tint: T.amberSoft },
              isToday || s.notYet
                ? { label: t('common.notYet'), value: s.notYet, icon: 'user', color: T.textMuted, tint: T.surface }
                : { label: t('common.absent'), value: s.absent, icon: 'user-x', color: T.red, tint: T.redSoft },
            ]}
          />
          {((isToday || s.notYet) && s.absent > 0) || s.leave > 0 ? (
            <Subtle style={{ textAlign: 'center', marginTop: 8 }}>{t('register.alsoCounts', { absent: s.absent, leave: s.leave })}</Subtle>
          ) : null}
        </>
      )}

      {!!data?.holiday && <Chip label={t('register.holidayName', { name: data.holiday })} tone="blue" icon="gift" style={{ marginTop: 14 }} />}
      {data && !people.length && <Empty>{s?.off ? t('register.weeklyOffAll') : t('register.noStaff')}</Empty>}

      {people.map((p, i) => {
        const line = statusLine(t, p);
        const flags = flagsOf(t, p, data.office);
        return (
          <ListRow
            key={p.id}
            title={p.name}
            subtitle={[p.designation || p.department, p.shift].filter(Boolean).join(' · ')}
            left={<Avatar name={p.name} />}
            right={has(p.checkIn) ? <Text style={st.personTime}>{p.checkIn}</Text> : null}
            onPress={() => onOpen(p)}
            last={i === people.length - 1}
            below={(
              <>
                <View style={st.statusLine}>
                  {line.map((part, j) => (
                    <View key={j} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {j > 0 ? <Text style={[st.statusText, { color: T.textMuted }]}> · </Text> : null}
                      {part.icon ? <Icon name={part.icon} size={18} color={part.color} style={{ marginRight: 6 }} /> : null}
                      <Text style={[st.statusText, { color: part.color }]}>{part.text}</Text>
                    </View>
                  ))}
                </View>
                {flags.length ? <Text style={st.flagText}>{flags.join(' · ')}</Text> : null}
              </>
            )}
          />
        );
      })}

      {people.length > 0 && <Subtle style={{ marginTop: 16 }}>{t('register.timesNote')}</Subtle>}
    </View>
  );
}

// One person's day for the admin: times, selfies, place, flags, and edit / add / remove.
function PersonSheet({ t, person: p, date, office, onClose, onPhoto, onEdit, onRemoved }) {
  const insets = useSafeAreaInsets();
  if (!p) return null;
  const line = statusLine(t, p);
  const flags = flagsOf(t, p, office);
  const canAdd = !p.attendanceId && ['absent', 'pending', 'off', 'leave', 'holiday'].includes(p.status);
  const canEdit = (canAdd || p.attendanceId) && date <= istToday();
  const faceText = (f) => f && ({ match: 'register.faceMatch', mismatch: 'register.faceMismatch', no_face: 'register.faceNoFace', enrolled: 'register.faceEnrolled', error: 'register.faceError' }[f.result]);
  const remove = () => Alert.alert(t('register.removeTitle', { name: p.name }), t('register.removeBody'), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('register.remove'), style: 'destructive', onPress: async () => {
      try { await attendanceAPI.remove(p.attendanceId); onRemoved(); } catch (e) { Alert.alert(t('register.couldNotRemove'), e.message); }
    } },
  ]);
  const selfie = (url, label, time) => (
    <TouchableOpacity style={{ flex: 1 }} onPress={() => onPhoto({ url, caption: `${p.name} · ${label} ${time}` })} activeOpacity={0.85}>
      <Image source={{ uri: url }} style={st.selfie} />
      <Text style={st.selfieLabel}>{label} · {time}</Text>
    </TouchableOpacity>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.sheetWrap}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <ScrollView contentContainerStyle={{ padding: T.pad }} bounces={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={p.name} size={52} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={st.sheetTitle} numberOfLines={1}>{p.name}</Text>
                <Subtle>{fmtDayLong(t, date)}</Subtle>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={t('common.close')}>
                <Icon name="x" size={26} color={T.navyDeep} />
              </TouchableOpacity>
            </View>

            <View style={[st.statusLine, { marginTop: 16 }]}>
              {line.map((part, j) => (
                <View key={j} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {j > 0 ? <Text style={[st.statusText, { color: T.textMuted }]}> · </Text> : null}
                  {part.icon ? <Icon name={part.icon} size={20} color={part.color} style={{ marginRight: 6 }} /> : null}
                  <Text style={[st.statusText, { color: part.color, fontSize: 18 }]}>{part.text}</Text>
                </View>
              ))}
            </View>
            {(p.designation || p.department || p.shift) ? <Subtle style={{ marginTop: 6 }}>{[p.designation || p.department, p.shift && `${t('register.shift')}: ${p.shift}`].filter(Boolean).join(' · ')}</Subtle> : null}

            {has(p.checkIn) && (
              <View style={st.bigRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.bigLabel}>{t('register.in')}</Text>
                  <Text style={st.bigValue}>{p.checkIn}</Text>
                </View>
                <View style={[{ flex: 1, paddingLeft: 16 }, st.bigSep]}>
                  <Text style={st.bigLabel}>{t('register.out')}</Text>
                  <Text style={[st.bigValue, !has(p.checkOut) && { fontSize: 20, color: T.textFaint, marginTop: 10 }]}>
                    {has(p.checkOut) ? p.checkOut : p.noCheckOut ? t('register.noCheckOut') : t('register.stillIn')}
                  </Text>
                </View>
                {has(p.hours) && (
                  <View style={[{ flex: 1, paddingLeft: 16 }, st.bigSep]}>
                    <Text style={st.bigLabel}>{t('register.workedLabel')}</Text>
                    <Text style={[st.bigValue, { fontSize: 22, marginTop: 8 }]}>{fmtHours(t, p.hours)}</Text>
                  </View>
                )}
              </View>
            )}

            {flags.length ? <Text style={[st.flagText, { fontSize: 16, marginTop: 12 }]}>{flags.join(' · ')}</Text> : null}
            {p.addedByAdmin ? <Subtle style={{ marginTop: 8 }}>{p.note ? t('register.addedByAdminNote', { note: p.note }) : t('register.addedByAdmin')}</Subtle> : null}

            {(p.checkInSelfie || p.checkOutSelfie) && (
              <View style={st.selfieRow}>
                {p.checkInSelfie ? selfie(p.checkInSelfie, t('register.in'), p.checkIn) : <View style={{ flex: 1 }} />}
                {p.checkOutSelfie ? selfie(p.checkOutSelfie, t('register.out'), p.checkOut) : <View style={{ flex: 1 }} />}
              </View>
            )}
            {(faceText(p.face) || faceText(p.faceOut)) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {faceText(p.face) ? <Chip label={`${t('register.in')}: ${t(faceText(p.face))}`} tone={p.face.result === 'match' || p.face.result === 'enrolled' ? 'green' : 'red'} /> : null}
                {faceText(p.faceOut) ? <Chip label={`${t('register.out')}: ${t(faceText(p.faceOut))}`} tone={p.faceOut.result === 'match' || p.faceOut.result === 'enrolled' ? 'green' : 'red'} /> : null}
              </View>
            )}

            {!!p.checkInAddress && (
              <View style={{ marginTop: 14 }}>
                <Text style={st.bigLabel}>{t('register.place')}</Text>
                <Text style={st.placeText}>{p.checkInAddress}</Text>
                {!!p.checkOutAddress && p.checkOutAddress !== p.checkInAddress && <Text style={[st.placeText, { marginTop: 4 }]}>{t('register.out')}: {p.checkOutAddress}</Text>}
              </View>
            )}

            {canEdit && (
              <Button
                title={t(p.attendanceId ? (p.noCheckOut ? 'register.setOutTime' : 'register.editDay') : 'register.addAttendance')}
                icon={p.attendanceId ? 'edit-3' : 'plus'}
                style={{ marginTop: 22 }}
                onPress={() => onEdit(p)}
              />
            )}
            {p.attendanceId && date <= istToday() ? (
              <Button title={t('register.removeDay')} variant="danger" icon="trash-2" style={{ marginTop: 12 }} onPress={remove} />
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TimeForm({ t, visible, person, date, record, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setCheckIn(has(record?.in) ? record.in : '');
    setCheckOut(has(record?.out) ? record.out : '');
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
      Alert.alert(t('common.couldNotSave'), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={st.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[st.sheet, { padding: T.pad, paddingBottom: insets.bottom + 20 }]}>
          <Text style={st.sheetTitle}>{t(record ? 'register.formEdit' : 'register.formAdd')}</Text>
          <Text style={st.formName}>{person?.name}</Text>
          <Subtle style={{ marginTop: 4, marginBottom: 16 }}>{date ? fmtDay(t, date) : ''} · {t('register.formMeta')}</Subtle>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Field style={{ flex: 1 }} label={t('register.checkInTime')} value={checkIn} onChangeText={setCheckIn} placeholder="09:30" keyboardType={TIME_KEYBOARD} maxLength={5} />
            <Field style={{ flex: 1 }} label={t('register.checkOutTime')} value={checkOut} onChangeText={setCheckOut} placeholder="18:00" keyboardType={TIME_KEYBOARD} maxLength={5} />
          </View>
          <Field label={t('register.note')} value={note} onChangeText={setNote} placeholder={t('register.notePlaceholder')} maxLength={200} />
          <Button title={t(record ? 'common.save' : 'common.add')} onPress={save} busy={busy} />
          <Button title={t('common.cancel')} variant="outline" onPress={onClose} style={{ marginTop: 10 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  navBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: T.onNavyGlass },
  navText: { color: T.onNavyMuted, fontSize: 16, fontWeight: '600' },
  todayPill: { paddingVertical: 6, paddingHorizontal: 18, borderRadius: 18, borderWidth: 1, borderColor: T.onNavyLine, backgroundColor: T.onNavyGlassStrong },
  todayPillText: { color: T.onNavy, fontSize: 16, fontWeight: '700' },

  todayDate: { fontSize: 22, fontWeight: '800', color: T.navyDeep, marginTop: 4 },
  todayStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  todayStatusText: { fontSize: 18, fontWeight: '600', color: T.navyDeep, marginLeft: 10, flex: 1 },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 14, borderRadius: T.radius, backgroundColor: T.bg },
  doneText: { fontSize: 19, fontWeight: '700', color: T.green, marginLeft: 8 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 8, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendOutline: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, borderColor: T.navyDeep },
  legendText: { fontSize: 15, color: T.textMuted, marginLeft: 6 },
  workedLine: { fontSize: 18, color: T.textMuted, marginTop: 12 },
  workedBig: { fontSize: 22, fontWeight: '800', color: T.navyDeep },

  bigRow: { flexDirection: 'row', marginTop: 18 },
  bigSep: { borderLeftWidth: 1, borderLeftColor: T.line },
  bigLabel: { fontSize: 16, color: T.textMuted },
  bigValue: { fontSize: 34, fontWeight: '800', color: T.navyDeep, marginTop: 2 },
  fixLink: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingVertical: 6 },
  fixLinkText: { fontSize: 17, fontWeight: '700', color: T.navyDeep, marginLeft: 10, textDecorationLine: 'underline', flex: 1 },

  listDay: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10 },
  listLine: { borderBottomWidth: 1, borderBottomColor: T.line },
  listDate: { fontSize: 17, fontWeight: '700', color: T.navyDeep },
  listStatus: { fontSize: 15, color: T.textMuted, marginTop: 2 },
  listTimes: { fontSize: 16, fontWeight: '600', color: T.navyDeep, marginLeft: 8 },

  teamTitle: { fontSize: 30, fontWeight: '800', color: T.navyDeep },
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: T.line, marginTop: 10 },
  reqText: { fontSize: 19, fontWeight: '700', color: T.navyDeep, flex: 1 },
  teamStats: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: T.line },
  personTime: { fontSize: 22, fontWeight: '800', color: T.navyDeep },
  statusLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  statusText: { fontSize: 16, fontWeight: '500' },
  flagText: { fontSize: 14, fontWeight: '600', color: T.red, marginTop: 4 },

  sheetWrap: { flex: 1, backgroundColor: 'rgba(14,26,51,0.45)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: T.sheetRadius, borderTopRightRadius: T.sheetRadius, maxHeight: '88%' },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: T.navyDeep },
  formName: { fontSize: 18, fontWeight: '600', color: T.navyDeep, marginTop: 4 },
  selfieRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  selfie: { width: '100%', aspectRatio: 1, borderRadius: T.radius, backgroundColor: T.surface },
  selfieLabel: { fontSize: 15, color: T.textMuted, marginTop: 6 },
  placeText: { fontSize: 16, color: T.navyDeep, marginTop: 2 },

  photoWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  photo: { width: '100%', height: '75%' },
  photoCaption: { color: '#fff', marginTop: 12, fontSize: 16 },
});
