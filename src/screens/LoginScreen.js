import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Screen, AppHeader, Button, Card, Subtle, Icon, T } from '../ui';
import { useLang, LANGS } from '../i18n';
import '../i18n/strings/login';

const START_URL = 'https://haazri.tarahutaibuilds.com/start';
const RESEND_WAIT = 30; // seconds before "Resend code" can be tapped again

// fetch fails with a TypeError when there is no connection; a captive Wi-Fi page returns HTML, not our JSON.
const isNetwork = (e) => e instanceof TypeError || /network|non-JSON|timed? ?out|failed to fetch/i.test(e?.message || '');

/** English | ਪੰਜਾਬੀ | हिंदी on the navy header; the chosen one is yellow. */
function LanguagePills() {
  const { lang, setLang, t } = useLang();
  return (
    <View style={s.langRow} accessibilityRole="radiogroup" accessibilityLabel={t('common.language')}>
      {LANGS.map((l) => {
        const on = l.code === lang;
        return (
          <TouchableOpacity key={l.code} onPress={() => setLang(l.code)} activeOpacity={0.8}
            accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[s.langPill, on && s.langPillOn]}>
            <Text style={[s.langText, on && { color: T.onYellow }]} numberOfLines={1}>{l.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useLang();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const otpInput = useRef(null);
  const [step, setStep] = useState('phone');
  const [sentTo, setSentTo] = useState(''); // masked destination reported by the backend
  const [reviewLogin, setReviewLogin] = useState(false); // store-review demo account: fixed code, no email
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null); // { title, message }
  const [notice, setNotice] = useState('');
  const [wait, setWait] = useState(0); // resend cooldown, seconds left

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const onPhone = (text) => {
    let d = text.replace(/\D/g, '');
    if (d.length > 10 && d.startsWith('91')) d = d.slice(-10); // pasted "+91 98765 43210"
    setPhone(d.slice(0, 10));
    setError(null);
  };

  const sendCode = async ({ resend } = {}) => {
    if (phone.length < 10) { setError({ title: t('login.invalidPhone') }); return; }
    resend ? setResending(true) : setLoading(true);
    setError(null);
    setNotice('');
    try {
      const res = await authAPI.login({ phone });
      setSentTo(res?.sentTo || '');
      setReviewLogin(res?.channel === 'review');
      setStep('otp');
      setWait(RESEND_WAIT);
      if (resend) setNotice(t('login.resent'));
    } catch (e) {
      setError({ title: t('login.sendFailed'), message: isNetwork(e) ? t('common.noInternet') : (e.message || t('login.unexpected')) });
    } finally {
      resend ? setResending(false) : setLoading(false);
    }
  };

  const verify = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    setError(null);
    setNotice('');
    try {
      const res = await authAPI.verifyOTP({ phone, otp });
      if (!res?.user || !res?.token) throw new Error(t('login.unexpected'));
      await login(res.user, res.token);
    } catch (e) {
      setOtp('');
      setError({ title: t('login.signInFailed'), message: isNetwork(e) ? t('common.noInternet') : (e.message || t('login.wrongCode')) });
      setLoading(false);
    }
  };

  const changeNumber = () => { setStep('phone'); setOtp(''); setError(null); setNotice(''); };

  const header = (
    <AppHeader title={t('login.welcome')} subtitle={t('login.subtitle')}>
      <LanguagePills />
    </AppHeader>
  );

  return (
    <Screen header={header} keyboard>
      {step === 'phone' ? (
        <>
          <Text style={s.h}>{t('login.phoneTitle')}</Text>
          <Subtle style={s.lead}>{t('login.phoneHint')}</Subtle>
          <View style={s.phoneBox}>
            <View style={s.prefix}><Text style={s.prefixText}>+91</Text></View>
            <TextInput
              style={s.phoneInput}
              placeholder={t('login.phonePlaceholder')}
              placeholderTextColor={T.textFaint}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              value={phone}
              onChangeText={onPhone}
              onSubmitEditing={() => sendCode()}
              returnKeyType="next"
              accessibilityLabel={t('login.phoneTitle')}
            />
          </View>
          {error && <ErrorBox error={error} />}
          <Button title={t('login.continue')} icon="arrow-right" onPress={() => sendCode()} busy={loading} disabled={phone.length < 10} style={{ marginTop: 8 }} />

          <View style={s.help}>
            <Icon name="info" size={20} color={T.textMuted} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.helpText}>{t('login.helpAdmin')}</Text>
              <Text style={[s.helpText, { marginTop: 6 }]}>
                {t('login.helpNewBusiness')}{' '}
                <Text style={s.link} onPress={() => Linking.openURL(START_URL).catch(() => {})} accessibilityRole="link">
                  haazri.tarahutaibuilds.com/start
                </Text>
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={s.h}>{t('login.codeTitle')}</Text>
          <Text style={s.sentTo}>
            {reviewLogin ? t('login.codeReview') : t('login.codeSentTo', { to: sentTo || `+91 ${phone}` })}
          </Text>

          {/* The four boxes only show the code; one real input lies over them. It has to have a size: Android
              won't focus or open the keyboard for a zero-height input, and tapping the boxes refocuses it. */}
          <Pressable style={s.otpRow} onPress={() => otpInput.current?.focus()}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[s.otpBox, otp.length > i && s.otpBoxFilled, otp.length === i && s.otpBoxNext]}>
                <Text style={s.otpChar}>{otp[i] || ''}</Text>
              </View>
            ))}
            <TextInput
              ref={otpInput}
              style={s.hiddenInput}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={4}
              value={otp}
              onChangeText={(x) => { setOtp(x.replace(/\D/g, '').slice(0, 4)); setError(null); }}
              caretHidden
              autoFocus
              accessibilityLabel={t('login.codeTitle')}
            />
          </Pressable>
          <Subtle style={s.tapHint}>{t('login.codeTapHint')}</Subtle>

          {error && <ErrorBox error={error} />}
          {!!notice && !error && (
            <View style={s.notice}><Icon name="check-circle" size={18} color={T.green} /><Text style={s.noticeText}>{notice}</Text></View>
          )}

          <Button title={t('login.verify')} icon="check" onPress={verify} busy={loading} disabled={otp.length < 4} />

          <View style={s.links}>
            <TouchableOpacity onPress={changeNumber} disabled={loading} hitSlop={10} style={s.linkBtn}>
              <Icon name="edit-2" size={18} color={T.navyDeep} />
              <Text style={s.linkText}>{t('login.changeNumber')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setOtp(''); sendCode({ resend: true }); }} disabled={loading || resending || wait > 0} hitSlop={10} style={s.linkBtn}>
              <Icon name="refresh-cw" size={18} color={wait > 0 ? T.textFaint : T.navyDeep} />
              <Text style={[s.linkText, wait > 0 && { color: T.textFaint }]}>
                {wait > 0 ? t('login.resendIn', { s: wait }) : t('login.resend')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      <Text style={s.byline}>{t('login.byline')}</Text>
    </Screen>
  );
}

function ErrorBox({ error }) {
  return (
    <Card tone="red" style={{ marginBottom: 14, padding: 14 }}>
      <Text style={s.errTitle}>{error.title}</Text>
      {!!error.message && <Text style={s.errText}>{error.message}</Text>}
    </Card>
  );
}

const s = StyleSheet.create({
  langRow: { flexDirection: 'row', gap: 10 },
  langPill: { flex: 1, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderRadius: 24, borderWidth: 1, borderColor: T.onNavyLine, backgroundColor: T.onNavyGlass },
  langPillOn: { backgroundColor: T.yellow, borderColor: T.yellow },
  langText: { color: T.onNavy, fontSize: 17, fontWeight: '700' },

  h: { fontSize: 24, fontWeight: '800', color: T.navyDeep },
  lead: { fontSize: 16, marginTop: 6, marginBottom: 18, lineHeight: 22 },
  phoneBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: T.line, borderRadius: T.radius, backgroundColor: T.surface, overflow: 'hidden', marginBottom: 14 },
  prefix: { paddingHorizontal: 16, paddingVertical: 16, borderRightWidth: 1, borderRightColor: T.line },
  prefixText: { fontSize: 20, fontWeight: '700', color: T.navyDeep },
  phoneInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, fontSize: 22, fontWeight: '600', color: T.text, letterSpacing: 1.5 },

  help: { flexDirection: 'row', marginTop: 26, padding: 16, borderRadius: T.radius, backgroundColor: T.surface },
  helpText: { fontSize: 15, color: T.textMuted, lineHeight: 21 },
  link: { color: T.navyDeep, fontWeight: '700', textDecorationLine: 'underline' },

  sentTo: { fontSize: 17, color: T.textMuted, marginTop: 8, marginBottom: 22, lineHeight: 24 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 10 },
  otpBox: { width: 64, height: 72, borderRadius: T.radius, borderWidth: 1.5, borderColor: T.line, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },
  otpBoxFilled: { borderColor: T.yellow, backgroundColor: T.yellowSoft },
  otpBoxNext: { borderColor: T.navy },
  otpChar: { fontSize: 32, fontWeight: '800', color: T.navyDeep },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
  tapHint: { textAlign: 'center', fontSize: 14, marginBottom: 20 },

  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  noticeText: { fontSize: 15, color: T.green, fontWeight: '600' },
  errTitle: { fontSize: 17, fontWeight: '700', color: T.red },
  errText: { fontSize: 15, color: T.text, marginTop: 4, lineHeight: 21 },

  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  linkText: { fontSize: 17, fontWeight: '700', color: T.navyDeep },

  byline: { textAlign: 'center', fontSize: 13, color: T.textFaint, marginTop: 34 },
});
