import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
  Animated, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useHeaderInset } from '../utils/safeArea';
import GlassCard from '../components/GlassCard';
import GradientButton from '../components/GradientButton';
import GlowDot from '../components/GlowDot';
import DailyBriefingCard from '../components/DailyBriefingCard';
import PredictiveCard from '../components/PredictiveCard';
import FloatingAssistantButton from '../components/FloatingAssistantButton';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: C, isDark, toggleTheme } = useTheme();
  const headerTop = useHeaderInset(16);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkedIn, setCheckedIn] = useState(false);
  const glowAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.5, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.2, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formatDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const getGreeting = () => {
    const h = currentTime.getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  };

  const isAdmin = user?.role === 'admin';
  const score = 82;

  const stats = [
    { label: 'Present', value: '22', color: C.success },
    { label: 'Absent', value: '3', color: C.danger },
    { label: 'Late', value: '2', color: C.warning },
    { label: 'Leave', value: '1', color: C.info },
  ];

  const adminActions = [
    { icon: '➕', label: 'Add Staff', value: '12 members', screen: 'AddStaff' },
    { icon: '📈', label: 'Analytics', value: '96% rate', screen: 'Reports' },
    { icon: '💳', label: 'Payroll', value: '₹2.4L due', screen: 'Payroll' },
    { icon: '📡', label: 'Live Track', value: '5 active', screen: 'LiveTrack' },
  ];

  const team = [
    { name: 'Rahul Sharma', role: 'Sales Lead', status: 'present', time: '09:02', score: 91 },
    { name: 'Priya Verma', role: 'Marketing', status: 'present', time: '09:15', score: 87 },
    { name: 'Amit Kumar', role: 'Developer', status: 'late', time: '10:30', score: 72 },
    { name: 'Sunita Devi', role: 'Support', status: 'absent', time: '—', score: 0 },
  ];

  const statusMap = {
    present: { color: C.success, label: 'Active' },
    late: { color: C.warning, label: 'Late' },
    absent: { color: C.danger, label: 'Absent' },
  };

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <View>
            <Text style={[styles.greeting, { color: C.textMuted }]}>{getGreeting()}</Text>
            <Text style={[styles.userName, { color: C.textPrimary }]}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Notifications */}
            <TouchableOpacity style={[styles.themeToggle, { backgroundColor: C.bgCard, borderColor: C.border }]} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
              <Text style={styles.themeIcon}>🔔</Text>
              <View style={styles.notifDot} />
            </TouchableOpacity>
            {/* Theme Toggle */}
            <TouchableOpacity style={[styles.themeToggle, { backgroundColor: C.bgCard, borderColor: C.border }]} onPress={toggleTheme} activeOpacity={0.7}>
              <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.avatar, { backgroundColor: C.bgElevated, borderColor: C.border }]} onPress={() => navigation.navigate('Profile')}>
              <Text style={[styles.avatarText, { color: C.textPrimary }]}>{(user?.name || 'U')[0]}</Text>
              <GlowDot color={C.success} size={5} pulse style={styles.avatarDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Glass Status Card */}
        <View style={styles.statusSection}>
          <GlassCard style={styles.statusGlass} intensity={50} borderRadius={RADIUS.xxl}>
            <View style={styles.statusContent}>
              {/* Ambient gradient orbs */}
              <View style={styles.orbPurple} />
              <View style={styles.orbBlue} />

              <View style={styles.statusRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusLabel, { color: C.textAccent }]}>
                    {checkedIn ? '● CHECKED IN' : '○ NOT CHECKED IN'}
                  </Text>
                  <Text style={[styles.statusTime, { color: C.textPrimary }]}>{formatTime(currentTime)}</Text>
                  <Text style={[styles.statusDate, { color: C.textMuted }]}>{formatDate(currentTime)}</Text>
                </View>

                {/* Score Ring */}
                <View style={styles.scoreRing}>
                  <LinearGradient
                    colors={[C.accentStart, C.accentEnd]}
                    style={styles.scoreGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={[styles.scoreInner, { backgroundColor: C.bg }]}>
                      <Text style={[styles.scoreNum, { color: C.textAccent }]}>{score}</Text>
                      <Text style={[styles.scoreLbl, { color: C.textMuted }]}>Score</Text>
                    </View>
                  </LinearGradient>
                </View>
              </View>

              {checkedIn && (
                <View style={[styles.checkedRow, { borderTopColor: C.border }]}>
                  <GlowDot color={C.success} size={4} pulse />
                  <Text style={[styles.checkedText, { color: C.textSecondary }]}>Since 09:02 AM · Main Office</Text>
                </View>
              )}
            </View>
          </GlassCard>
        </View>

        {/* AI Briefing - Admin Only */}
        {isAdmin && (
          <View style={{ marginHorizontal: SPACING.xl, marginTop: 20 }}>
            <DailyBriefingCard />
          </View>
        )}

        {/* CTA - Gradient Button */}
        <View style={styles.ctaWrap}>
          <Animated.View style={[styles.ctaGlowOrb, { opacity: glowAnim }]} />
          <GradientButton
            title={checkedIn ? 'Check Out' : 'Check In'}
            icon={checkedIn ? '⏹' : '▶'}
            variant={checkedIn ? 'danger' : 'primary'}
            onPress={() => navigation.navigate('MarkAttendance', { type: checkedIn ? 'check-out' : 'check-in' })}
          />
        </View>

        {/* Today Insights */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>TODAY'S INSIGHTS</Text>
          <View style={styles.insightsRow}>
            {stats.map((s) => (
              <View key={s.label} style={[styles.insightCard, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                <GlowDot color={s.color} size={6} />
                <Text style={[styles.insightValue, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.insightLabel, { color: C.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>QUICK ACCESS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {[
              { icon: '◷', label: 'History', screen: 'History' },
              ...(Platform.OS === 'android' ? [{ icon: '◉', label: 'Calls', screen: 'CallLogs' }] : []),
              { icon: '◫', label: 'Gallery', screen: 'Gallery' },
              { icon: '◈', label: 'Reports', screen: 'Reports' },
              { icon: '◇', label: 'Leave', screen: 'Leave' },
              { icon: '◆', label: 'Salary', screen: 'Salary' },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={[styles.quickChip, { backgroundColor: C.bgCard, borderColor: C.border }]} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.7}>
                <Text style={[styles.quickIcon, { color: C.textMuted }]}>{a.icon}</Text>
                <Text style={[styles.quickLabel, { color: C.textPrimary }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Command Center */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: C.textMuted }]}>COMMAND CENTER</Text>
            <View style={styles.adminGrid}>
              {adminActions.map((a) => (
                <TouchableOpacity key={a.label} style={[styles.adminCard, { backgroundColor: C.bgCard, borderColor: C.border }]} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.7}>
                  <Text style={styles.adminIcon}>{a.icon}</Text>
                  <Text style={[styles.adminLabel, { color: C.textPrimary }]}>{a.label}</Text>
                  <Text style={[styles.adminValue, { color: C.textMuted }]}>{a.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* AI Predictions - Admin Only */}
        {isAdmin && (
          <View style={styles.section}>
            <PredictiveCard />
          </View>
        )}

        {/* Team Activity */}
        {isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: C.textMuted }]}>TEAM ACTIVITY</Text>
              <TouchableOpacity><Text style={[styles.viewAll, { color: C.textAccent }]}>View All →</Text></TouchableOpacity>
            </View>
            {team.map((m, i) => {
              const st = statusMap[m.status];
              return (
                <View key={i} style={[styles.memberRow, { backgroundColor: C.bgCard, borderColor: C.border }]}>
                  <View style={styles.memberAvatarWrap}>
                    <View style={[styles.memberAvatar, { backgroundColor: C.bgElevated }]}>
                      <Text style={[styles.memberInitial, { color: C.textPrimary }]}>{m.name[0]}</Text>
                    </View>
                    <View style={styles.memberDotWrap}>
                      <GlowDot color={st.color} size={5} pulse={m.status === 'present'} />
                    </View>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: C.textPrimary }]}>{m.name}</Text>
                    <Text style={[styles.memberRole, { color: C.textSecondary }]}>{m.role}</Text>
                  </View>
                  <View style={styles.memberRight}>
                    <Text style={[styles.memberStatus, { color: st.color }]}>{st.label}</Text>
                    {m.time !== '—' && <Text style={[styles.memberTime, { color: C.textMuted }]}>{m.time}</Text>}
                    {m.score > 0 && (
                      <View style={[styles.memberScoreBadge, { backgroundColor: C.accentSoft }]}>
                        <Text style={[styles.memberScore, { color: C.textAccent }]}>{m.score}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* AI Assistant FAB */}
      <FloatingAssistantButton onPress={() => navigation.navigate('Chat')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greeting: { fontSize: 13 },
  userName: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  themeToggle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  themeIcon: { fontSize: 16 },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  avatarDot: { position: 'absolute', bottom: -2, right: -2 },
  notifDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },

  // Glass status card
  statusSection: { marginHorizontal: SPACING.xl, marginTop: 20 },
  statusGlass: {},
  statusContent: { padding: SPACING.xl, overflow: 'hidden' },
  orbPurple: { position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(124, 58, 237, 0.12)' },
  orbBlue: { position: 'absolute', bottom: -30, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(59, 130, 246, 0.08)' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textAccent, letterSpacing: 2 },
  statusTime: { fontSize: 40, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -1, marginTop: 4 },
  statusDate: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  checkedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  checkedText: { fontSize: 13, color: COLORS.textSecondary },

  // Score
  scoreRing: { width: 68, height: 68, borderRadius: 34, overflow: 'hidden' },
  scoreGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 3 },
  scoreInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  scoreNum: { fontSize: 22, fontWeight: '800', color: COLORS.textAccent },
  scoreLbl: { fontSize: 8, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 1 },

  // CTA
  ctaWrap: { alignItems: 'center', marginTop: 28, position: 'relative' },
  ctaGlowOrb: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124, 58, 237, 0.15)' },

  // Sections
  section: { marginTop: 32, paddingHorizontal: SPACING.xl },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 2, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  viewAll: { fontSize: 12, fontWeight: '500', color: COLORS.textAccent },

  // Insights
  insightsRow: { flexDirection: 'row', gap: 10 },
  insightCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  insightValue: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  insightLabel: { fontSize: 10, fontWeight: '500', color: COLORS.textMuted, marginTop: 4, letterSpacing: 0.5 },

  // Quick
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bgCard, paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  quickIcon: { fontSize: 15, color: COLORS.textMuted },
  quickLabel: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },

  // Admin
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  adminCard: { width: (width - 50) / 2, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  adminIcon: { fontSize: 24, marginBottom: 10 },
  adminLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  adminValue: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Team
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  memberAvatarWrap: { position: 'relative', width: 44, height: 44 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center' },
  memberInitial: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  memberDotWrap: { position: 'absolute', bottom: -2, right: -4 },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  memberRole: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  memberRight: { alignItems: 'flex-end', gap: 3 },
  memberStatus: { fontSize: 11, fontWeight: '600' },
  memberTime: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  memberScoreBadge: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs },
  memberScore: { fontSize: 10, fontWeight: '700', color: COLORS.textAccent },
});
