import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { RADIUS, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

export default function FaceDetectionOverlay({ onFaceDetected }) {
  const { colors: C } = useTheme();
  const [phase, setPhase] = useState('scanning'); // scanning → detected
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Scanning line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Simulate face detection after 1.5-2.5 seconds
    const delay = 1500 + Math.random() * 1000;
    const timer = setTimeout(() => {
      setPhase('detected');
      onFaceDetected?.();
      // Pulse animation on detection
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  const isDetected = phase === 'detected';
  const borderColor = isDetected ? (C.success || '#10B981') : (C.warning || '#F59E0B');
  const statusText = isDetected ? 'Face Detected — Tap to capture' : 'Position your face in the oval';
  const statusColor = isDetected ? C.success : C.textMuted;

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      {/* Oval guide */}
      <View style={[styles.oval, { borderColor }]}>
        {/* Scanning line */}
        {!isDetected && (
          <Animated.View
            style={[styles.scanLine, { backgroundColor: borderColor, transform: [{ translateY: scanTranslateY }] }]}
          />
        )}

        {/* Corner markers */}
        <View style={[styles.corner, styles.topLeft, { borderColor }]} />
        <View style={[styles.corner, styles.topRight, { borderColor }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor }]} />

        {/* Detected checkmark */}
        {isDetected && (
          <View style={[styles.checkBadge, { backgroundColor: C.success }]}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </View>

      {/* Status text */}
      <View style={[styles.statusBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        {!isDetected && <View style={[styles.scanDot, { backgroundColor: borderColor }]} />}
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  oval: {
    width: 200,
    height: 260,
    borderRadius: 100,
    borderWidth: 3,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    width: '90%',
    height: 2,
    opacity: 0.7,
  },
  corner: { position: 'absolute', width: 20, height: 20, borderWidth: 3 },
  topLeft: { top: 20, left: 20, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  topRight: { top: 20, right: 20, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 20, left: 20, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 20, right: 20, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  checkBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  checkText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  scanDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '600' },
});
