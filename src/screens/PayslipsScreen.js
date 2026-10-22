import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking, Share } from 'react-native';
import { useLang, fmtMonth } from '../i18n';
import '../i18n/strings/payslips';
import { payslipsAPI } from '../services/api';
import { Screen, AppHeader, Button, Empty, Loading, T } from '../ui';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Salary slips for every month the company has closed. Each opens as a page the person can save as PDF or share.
export default function PayslipsScreen({ navigation }) {
  const { t } = useLang();
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setSlips((await payslipsAPI.mine()).payslips || []);
    } catch (e) {
      Alert.alert(t('payslips.couldNotLoad'), e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const monthLabel = (s) => (/^\d{4}-\d{2}/.test(s.month || '') ? fmtMonth(t, s.month) : s.label);

  const open = async (s, share) => {
    setBusy(`${s.month}:${share ? 's' : 'o'}`);
    try {
      const { link } = await payslipsAPI.get(s.month);
      if (share) await Share.share({ message: t('payslips.shareMsg', { month: monthLabel(s), link }) });
      else await Linking.openURL(link);
    } catch (e) {
      Alert.alert(t('payslips.couldNotOpen'), e.message);
    } finally {
      setBusy(null);
    }
  };

  const header = <AppHeader title={t('payslips.title')} subtitle={t('payslips.subtitle')} onBack={() => navigation.goBack()} />;

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {loading ? <Loading /> : slips.length === 0 ? (
        <Empty>{t('payslips.empty')}</Empty>
      ) : slips.map((s, i) => (
        <View key={s.month} style={[st.item, i < slips.length - 1 && st.line]}>
          <View style={st.top}>
            <View style={{ flex: 1 }}>
              <Text style={st.month}>{monthLabel(s)}</Text>
              <Text style={st.sub}>{t('payslips.netPay')}</Text>
            </View>
            <Text style={st.amount}>{s.payable == null ? '—' : rupees(s.payable)}</Text>
          </View>
          <View style={st.actions}>
            <Button title={t('payslips.open')} icon="file-text" small onPress={() => open(s, false)}
              busy={busy === `${s.month}:o`} disabled={!!busy} style={{ flex: 1 }} />
            <Button title={t('payslips.share')} icon="share-2" variant="outline" small onPress={() => open(s, true)}
              busy={busy === `${s.month}:s`} disabled={!!busy} style={{ flex: 1 }} />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const st = StyleSheet.create({
  item: { paddingVertical: 18 },
  line: { borderBottomWidth: 1, borderBottomColor: T.line },
  top: { flexDirection: 'row', alignItems: 'center' },
  month: { fontSize: 20, fontWeight: '700', color: T.navyDeep },
  sub: { fontSize: 15, color: T.textMuted, marginTop: 3 },
  amount: { fontSize: 22, fontWeight: '800', color: T.green },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
});
