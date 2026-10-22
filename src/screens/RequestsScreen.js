import React, { useCallback, useRef, useState } from 'react';
import { View, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { leaveAPI, correctionsAPI, staffAPI } from '../services/api';
import { useRequestsCount } from '../navigation/AppNavigator';
import { useLang, fmtDay } from '../i18n';
import '../i18n/strings/requests';
import '../i18n/strings/corrections';
import { Screen, AppHeader, Segmented, ListRow, Avatar, Chip, SectionTitle, Empty, Loading } from '../ui';
import { MyLeave, LeavePicker, useLeaveForm, leaveDates, daysText, STATUS_TONE } from './LeaveScreen';

// Requests (admin tab): leave and attendance corrections waiting for a decision, the ones decided lately, and the
// admin's own leave ("My leave"). Tapping a request opens ReviewRequest.

const EARLIER_LIMIT = 20;

/** "Wed, 14 Oct – Thu, 15 Oct · 2 days" or "Wed, 14 Oct · Forgot to check out" */
export function requestLine(t, kind, r) {
  return kind === 'leave'
    ? `${leaveDates(t, r)} · ${daysText(t, r.days)}`
    : `${fmtDay(t, r.date)} · ${t(`corrections.kind_${r.kind}`)}`;
}

export default function RequestsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useLang();
  const tRef = useRef(t);
  tRef.current = t;
  const { count, refresh: refreshCount } = useRequestsCount();
  const leaveForm = useLeaveForm();

  const [tab, setTab] = useState('review');
  const [pending, setPending] = useState([]);
  const [earlier, setEarlier] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [leave, corr, people] = await Promise.all([
        leaveAPI.company(), correctionsAPI.company(), staffAPI.list(true).catch(() => null),
      ]);
      // Job titles for the review screen (best effort: the request lists don't carry them).
      const byId = new Map(); const byName = new Map();
      for (const p of people?.staff || []) { byId.set(p.id, p.designation); byName.set(p.name, p.designation); }
      const withJob = (r) => ({ ...r, designation: (r.staffId && byId.get(r.staffId)) || byName.get(r.staffName) || null });
      const items = (list, kind) => (list || []).map((r) => ({ kind, request: withJob(r) }));
      setPending([...items(leave.pending, 'leave'), ...items(corr.pending, 'correction')]
        .sort((a, b) => String(a.request.createdAt).localeCompare(String(b.request.createdAt))));
      setEarlier([...items(leave.recent, 'leave'), ...items(corr.recent, 'correction')]
        .sort((a, b) => String(b.request.decidedAt || b.request.createdAt).localeCompare(String(a.request.decidedAt || a.request.createdAt)))
        .slice(0, EARLIER_LIMIT));
    } catch (e) {
      Alert.alert(tRef.current('requests.couldNotLoad'), e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); refreshCount(); }, [load, refreshCount]));

  const onRefresh = () => {
    if (tab === 'mine') { leaveForm.refresh(); return; }
    setRefreshing(true); load(); refreshCount();
  };
  const open = (it) => navigation.navigate('ReviewRequest', { kind: it.kind, request: it.request });
  const asPage = route?.name === 'Leave'; // opened from a notification (stack screen, no tab bar)
  const toReviewCount = loading ? count : pending.length;

  const typeChip = (it) => (it.kind === 'leave'
    ? <Chip label={t(`leave.${it.request.type}`)} tone="yellow" />
    : <Chip label={t('requests.correction')} tone="blue" />);
  const statusLabel = (it) => (it.kind === 'correction' && it.request.status === 'cancelled'
    ? t('corrections.withdrawn') : t(`common.${it.request.status}`));

  return (
    <Screen keyboard refreshing={tab === 'mine' ? leaveForm.refreshing : refreshing} onRefresh={onRefresh}
      header={(
        <AppHeader title={t('requests.title')} subtitle={t('requests.subtitle')}
          avatarName={user?.name || ''} onAvatarPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          onBack={asPage ? () => navigation.goBack() : undefined}>
          <Segmented value={tab} onChange={setTab} options={[
            { value: 'review', label: t('requests.toReview'), badge: toReviewCount || null },
            { value: 'mine', label: t('requests.myLeave') },
          ]} />
          {tab === 'mine' ? <View style={{ marginTop: 16 }}><LeavePicker form={leaveForm} showToggle /></View> : null}
        </AppHeader>
      )}>
      {tab === 'mine' ? <MyLeave navigation={navigation} form={leaveForm} /> : (
        <View>
          <SectionTitle>{t('requests.toReview')}</SectionTitle>
          {loading ? <Loading /> : null}
          {!loading && pending.length === 0 ? <Empty>{t('requests.nothingToReview')}</Empty> : null}
          {pending.map((it, i) => (
            <ListRow key={`${it.kind}-${it.request.id}`} last={i === pending.length - 1}
              left={<Avatar name={it.request.staffName || ''} />}
              title={it.request.staffName} subtitle={requestLine(t, it.kind, it.request)}
              below={<View style={{ marginTop: 8 }}>{typeChip(it)}</View>}
              onPress={() => open(it)} />
          ))}

          {!loading && (
            <>
              <SectionTitle style={{ marginTop: 28 }}>{t('requests.earlier')}</SectionTitle>
              {earlier.length === 0 ? <Empty>{t('requests.noEarlier')}</Empty> : null}
              {earlier.map((it, i) => (
                <ListRow key={`${it.kind}-${it.request.id}`} last={i === earlier.length - 1}
                  left={<Avatar name={it.request.staffName || ''} size={40} />}
                  title={it.request.staffName}
                  subtitle={`${requestLine(t, it.kind, it.request)}${it.kind === 'leave' ? ` · ${t(`leave.${it.request.type}`)}` : ''}`}
                  below={<View style={{ marginTop: 8 }}><Chip label={statusLabel(it)} tone={STATUS_TONE[it.request.status]} /></View>}
                  onPress={() => open(it)} />
              ))}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
