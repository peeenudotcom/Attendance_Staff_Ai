import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Dimensions, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS, GLASS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSendOTP = async () => {
    if (phone.length < 10) return Alert.alert('Invalid', 'Enter a valid 10-digit number');
    setLoading(true);
    try {
      await authAPI.login({ phone });
      setStep('otp');
    } catch (e) {
      Alert.alert('Could not send OTP', e.message || 'Please check your connection and try again.');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) return Alert.alert('Invalid', 'Enter the OTP');
    setLoading(true);
    try {
      const res = await authAPI.verifyOTP({ phone, otp });
      if (!res?.user || !res?.token) throw new Error('Unexpected response from server');
      await login(res.user, res.token);
    } catch (e) {
      setOtp('');
      Alert.alert('Sign-in failed', e.message || 'The OTP is incorrect or has expired. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Ambient orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoSymbol}>T</Text>
            </View>
            <Text style={styles.brandName}>TARAhut</Text>
            <Text style={styles.brandSub}>AI-Powered Workforce Suite</Text>
          </View>

          {/* Card */}
          <GlassCard style={styles.cardWrap} intensity={50} borderRadius={RADIUS.xxl}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{step === 'phone' ? 'Sign In' : 'Verification'}</Text>
            <Text style={styles.cardSub}>
              {step === 'phone' ? 'Enter your mobile number to continue' : `Code sent to +91 ${phone}`}
            </Text>

            {step === 'phone' ? (
              <>
                <View style={styles.inputGroup}>
                  <View style={styles.prefix}>
                    <Text style={styles.prefixText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Phone number"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                <TouchableOpacity
                  style={[phone.length < 10 && styles.ctaBtnDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading || phone.length < 10}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[COLORS.accentStart, COLORS.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBtn}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Continue →</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.otpRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.otpBox, otp.length > i && styles.otpBoxFill]}>
                      <Text style={styles.otpChar}>{otp[i] || '·'}</Text>
                    </View>
                  ))}
                </View>
                <TextInput
                  style={styles.hiddenInput}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={otp}
                  onChangeText={setOtp}
                  autoFocus
                />

                <TouchableOpacity
                  style={[otp.length < 4 && styles.ctaBtnDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading || otp.length < 4}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[COLORS.accentStart, COLORS.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBtn}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Verify →</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.otpLinks}>
                  <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}>
                    <Text style={styles.link}>Change Number</Text>
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Text style={styles.link}>Resend</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          </GlassCard>

          <Text style={styles.footer}>TARAhut AI Labs · 25+ Years of Trust</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  orb1: { position: 'absolute', top: '15%', left: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124, 58, 237, 0.12)' },
  orb2: { position: 'absolute', top: '40%', right: -60, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(59, 130, 246, 0.08)' },
  orb3: { position: 'absolute', bottom: '10%', left: '30%', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(124, 58, 237, 0.06)' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xxl },

  brand: { alignItems: 'center', marginBottom: 36 },
  logoMark: { width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 16, ...SHADOWS.accent },
  logoSymbol: { fontSize: 26, fontWeight: '900', color: '#fff' },
  brandName: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 2 },
  brandSub: { ...FONTS.small, color: COLORS.textMuted, marginTop: 6, letterSpacing: 1.5, fontSize: 10 },

  cardWrap: {},
  card: { padding: SPACING.xxl },
  cardTitle: { ...FONTS.h2, textAlign: 'center' },
  cardSub: { ...FONTS.caption, textAlign: 'center', marginTop: 4, marginBottom: 24 },

  inputGroup: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, overflow: 'hidden', marginBottom: 20 },
  prefix: { paddingHorizontal: 16, paddingVertical: 15, borderRightWidth: 1, borderRightColor: COLORS.border },
  prefixText: { ...FONTS.bodyMedium, color: COLORS.textSecondary },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17, fontWeight: '500', color: COLORS.textPrimary, letterSpacing: 2 },

  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 24 },
  otpBox: { width: 52, height: 56, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center' },
  otpBoxFill: { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentSoft },
  otpChar: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0 },

  ctaBtn: { borderRadius: RADIUS.sm, paddingVertical: 16, alignItems: 'center', ...SHADOWS.accent },
  ctaBtnDisabled: { opacity: 0.3 },
  ctaBtnText: { ...FONTS.button, color: '#fff' },

  otpLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  link: { ...FONTS.captionMedium, color: COLORS.textAccent },

  footer: { ...FONTS.small, textAlign: 'center', color: COLORS.textMuted, marginTop: 28, letterSpacing: 1 },
});
