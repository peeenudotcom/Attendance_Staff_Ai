import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RADIUS } from '../utils/theme';

// A static framing guide for the check-in selfie. It does not detect or
// verify anything; the selfie is stored with the attendance record.
export default function SelfieGuide() {
  const borderColor = 'rgba(255,255,255,0.75)';
  return (
    <View style={styles.container}>
      <View style={[styles.oval, { borderColor }]}>
        <View style={[styles.corner, styles.topLeft, { borderColor }]} />
        <View style={[styles.corner, styles.topRight, { borderColor }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor }]} />
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>Position your face in the frame</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  oval: { width: 200, height: 260, borderRadius: 100, borderWidth: 3, borderStyle: 'dashed', overflow: 'hidden' },
  corner: { position: 'absolute', width: 20, height: 20, borderWidth: 3 },
  topLeft: { top: 20, left: 20, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  topRight: { top: 20, right: 20, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 20, left: 20, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 20, right: 20, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  statusBadge: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: 'rgba(0,0,0,0.6)' },
  statusText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
});
