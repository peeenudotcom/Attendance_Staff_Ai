import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import GlowDot from './GlowDot';
import { simulateFaceMatch } from '../utils/aiEngine';

export default function FaceMatchConfirmation({ selfieUri, onVerified }) {
  const { colors: C } = useTheme();
  const [phase, setPhase] = useState('verifying'); // verifying → verified
  const [matchResult, setMatchResult] = useState(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Progress animation
    const result = simulateFaceMatch();
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: result.processingTime,
      useNativeDriver: false,
    }).start();

    // Simulate verification
    const timer = setTimeout(() => {
      setPhase('verified');
      setMatchResult(result);
      onVerified?.(result);

      // Bounce animation on verified
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }).start();
    }, result.processingTime);

    return () => clearTimeout(timer);
  }, []);

  const isVerified = phase === 'verified';

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      {/* Selfie with overlay */}
      <View style={styles.selfieWrap}>
        {selfieUri && (
          <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
        )}
        {!selfieUri && (
          <View style={[styles.selfieImage, { backgroundColor: C.bgElevated, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
        )}

        {/* Scanning overlay */}
        {!isVerified && (
          <View style={styles.scanOverlay}>
            <View style={[styles.scanLineH, { backgroundColor: C.accentStart || '#7C3AED' }]} />
          </View>
        )}

        {/* Verified badge */}
        {isVerified && (
          <Animated.View style={[styles.verifiedBadge, { transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient
              colors={[C.success, '#059669']}
              style={styles.verifiedGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.verifiedCheck}>✓</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </View>

      {/* Status */}
      <View style={styles.statusWrap}>
        {!isVerified ? (
          <>
            <View style={styles.statusRow}>
              <GlowDot color={C.accentStart || '#7C3AED'} size={8} pulse />
              <Text style={[styles.statusText, { color: C.textPrimary }]}>Verifying identity...</Text>
            </View>
            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: C.bgCard }]}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={[C.accentStart || '#7C3AED', C.accentEnd || '#3B82F6']}
                  style={styles.progressGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.matchRow}>
              <Text style={[styles.matchLabel, { color: C.success }]}>Face Match</Text>
              {/* Confidence ring */}
              <View style={styles.confRing}>
                <LinearGradient
                  colors={[C.success, '#059669']}
                  style={styles.confGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={[styles.confInner, { backgroundColor: C.bg }]}>
                    <Text style={[styles.confNum, { color: C.success }]}>{matchResult?.confidence}%</Text>
                  </View>
                </LinearGradient>
              </View>
            </View>
            <View style={[styles.verifiedTag, { backgroundColor: C.successSoft || 'rgba(16,185,129,0.12)' }]}>
              <GlowDot color={C.success} size={6} pulse />
              <Text style={[styles.verifiedText, { color: C.success }]}>Identity Verified</Text>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: SPACING.xl },
  selfieWrap: { width: 160, height: 200, borderRadius: 80, overflow: 'hidden', position: 'relative' },
  selfieImage: { width: '100%', height: '100%', borderRadius: 80 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanLineH: { width: '100%', height: 2, opacity: 0.6 },
  verifiedBadge: { position: 'absolute', bottom: -5, right: -5 },
  verifiedGradient: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  verifiedCheck: { color: '#fff', fontSize: 22, fontWeight: '900' },

  statusWrap: { marginTop: SPACING.xl, alignItems: 'center', width: '100%', paddingHorizontal: SPACING.xxl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  statusText: { ...FONTS.bodyMedium },
  progressTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },
  progressGradient: { flex: 1 },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: SPACING.md },
  matchLabel: { fontSize: 20, fontWeight: '800' },
  confRing: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  confGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 2 },
  confInner: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  confNum: { fontSize: 14, fontWeight: '900' },

  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
  verifiedText: { fontSize: 13, fontWeight: '700' },
});
