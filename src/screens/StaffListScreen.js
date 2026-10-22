import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n';
import '../i18n/strings/staff';
import { staffAPI } from '../services/api';
import { Screen, AppHeader, Avatar, Chip, Button, ListRow, Empty, Loading, Icon, T } from '../ui';

// Admins: the company's staff. Tap someone to see or change their details; "+ Add" for a new person.
export default function StaffListScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [showOff, setShowOff] = useState(false);
  const [list, setList] = useState(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setList((await staffAPI.list(showOff)).staff || []);
    } catch (e) {
      Alert.alert(t('staff.couldNotLoadStaff'), e.message);
      setList((l) => l || []);
    } finally {
      setRefreshing(false);
    }
  }, [showOff, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!list || !q) return list;
    const digits = q.replace(/\D/g, '');
    return list.filter((s) => (s.name || '').toLowerCase().includes(q)
      || (s.designation || '').toLowerCase().includes(q)
      || (s.department || '').toLowerCase().includes(q)
      || (digits.length > 0 && (s.phone || '').replace(/\D/g, '').includes(digits)));
  }, [list, query]);

  const header = (
    <AppHeader
      title={t('staff.title')}
      subtitle={t('staff.subtitle')}
      avatarName={user?.name || ''}
      onAvatarPress={() => navigation.navigate('Profile')}
      onBack={route?.name === 'StaffList' ? () => navigation.goBack() : undefined}
      right={<Button title={t('common.add')} icon="plus" variant="accent" small onPress={() => navigation.navigate('AddStaff')} />}
    >
      <View style={st.search}>
        <Icon name="search" size={22} color={T.onNavyMuted} />
        <TextInput
          style={st.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('staff.searchPlaceholder')}
          placeholderTextColor={T.onNavyMuted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t('common.close')}>
            <Icon name="x" size={20} color={T.onNavyMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </AppHeader>
  );

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {!shown ? <Loading /> : shown.length === 0 ? (
        <Empty>{query.trim() ? t('staff.noMatch', { q: query.trim() }) : t('staff.noStaff')}</Empty>
      ) : shown.map((s) => (
        <View key={s.id} style={{ opacity: s.active ? 1 : 0.6 }}>
          <ListRow
            left={<Avatar name={s.name || ''} size={50} />}
            title={s.name}
            subtitle={[s.designation, s.department].filter(Boolean).join(' · ') || s.phone}
            right={!s.active
              ? <Chip label={t('staff.off')} tone="red" />
              : <Chip label={s.role === 'admin' ? t('common.admin') : t('common.staff')} tone={s.role === 'admin' ? 'yellow' : 'grey'} />}
            onPress={() => navigation.navigate('AddStaff', { staff: s })}
          />
        </View>
      ))}
      <View style={st.offRow}>
        <Text style={st.offText}>{t('staff.showOff')}</Text>
        <Switch value={showOff} onValueChange={setShowOff} trackColor={{ true: T.navy, false: T.line }} thumbColor="#fff" ios_backgroundColor={T.line} />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 30, borderWidth: 1, borderColor: T.onNavyLine,
    backgroundColor: T.onNavyGlass, paddingHorizontal: 18, height: 56,
  },
  searchInput: { flex: 1, color: T.onNavy, fontSize: 18, marginLeft: 12, paddingVertical: 0, height: '100%' },
  offRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, marginTop: 4 },
  offText: { flex: 1, fontSize: 18, fontWeight: '700', color: T.navyDeep },
});
