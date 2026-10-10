import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { RADIUS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';

export default function GlassCard({ children, style, intensity = 40, borderRadius = RADIUS.xl }) {
  const { colors: C, isDark } = useTheme();
  const tint = isDark ? 'dark' : 'light';

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.wrapper, { borderRadius, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }, style]}>
        <BlurView intensity={intensity} tint={tint} style={[styles.blur, { borderRadius }]}>
          <View style={[styles.inner, { borderRadius, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)' }]}>
            {children}
          </View>
        </BlurView>
        <View style={[styles.highlight, { borderRadius, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)' }]} pointerEvents="none" />
      </View>
    );
  }

  return (
    <View style={[{ borderRadius, backgroundColor: isDark ? 'rgba(31,19,23,0.88)' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: 'hidden', borderWidth: 1 },
  blur: { overflow: 'hidden' },
  inner: {},
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
