import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useModalHeaderInset } from '../utils/safeArea';
import { attendanceAPI } from '../services/api';
import FaceDetectionOverlay from '../components/FaceDetectionOverlay';
import FaceMatchConfirmation from '../components/FaceMatchConfirmation';

const { width } = Dimensions.get('window');

export default function MarkAttendanceScreen({ route, navigation }) {
  const { colors: C } = useTheme();
  const headerTop = useModalHeaderInset(12);
  const { type } = route.params;
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [selfie, setSelfie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => { getLocation(); }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed to mark attendance');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
      const [addr] = await Location.reverseGeocodeAsync(loc.coords);
      if (addr) {
        setAddress(`${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not get location');
    } finally {
      setLocationLoading(false);
    }
  };

  const takeSelfie = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      setSelfie(photo);
    } catch (e) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const submitAttendance = async () => {
    if (!selfie) return Alert.alert('Required', 'Please take a selfie');
    if (!location) return Alert.alert('Required', 'Location is required');
    setLoading(true);
    const data = {
      type, selfie: selfie.base64,
      latitude: location.latitude, longitude: location.longitude,
      address, timestamp: new Date().toISOString(),
    };
    try {
      type === 'check-in' ? await attendanceAPI.checkIn(data) : await attendanceAPI.checkOut(data);
      Alert.alert('Success!', `${type === 'check-in' ? 'Checked In' : 'Checked Out'} successfully`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(`${type === 'check-in' ? 'Check In' : 'Check Out'} failed`, e.message || 'Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View style={[styles.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color={C.accent} /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={[styles.permCard, { backgroundColor: C.bgCard, borderColor: C.border }]}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={[styles.permTitle, { color: C.textPrimary }]}>Camera Access Required</Text>
          <Text style={[styles.permDesc, { color: C.textSecondary }]}>We need camera access to verify your identity for attendance</Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.permButtonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.bgCard, borderColor: C.border }]}>
          <Text style={[styles.backIcon, { color: C.textPrimary }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
          {type === 'check-in' ? 'Check In' : 'Check Out'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Steps Indicator */}
      <View style={styles.steps}>
        <View style={[styles.step, styles.stepDone]}>
          <Text style={styles.stepNum}>1</Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: C.border }, selfie && styles.stepLineDone]} />
        <View style={[styles.step, { backgroundColor: C.bgElevated, borderColor: C.border }, selfie && styles.stepDone]}>
          <Text style={styles.stepNum}>2</Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: C.border }, location && selfie && styles.stepLineDone]} />
        <View style={[styles.step, { backgroundColor: C.bgElevated, borderColor: C.border }, location && selfie && styles.stepDone]}>
          <Text style={styles.stepNum}>3</Text>
        </View>
      </View>
      <Text style={[styles.stepLabel, { color: C.textAccent }]}>
        {!selfie ? (faceDetected ? 'Face Detected — Capture' : 'Detecting Face...') : verifying ? 'Verifying Identity...' : verified ? 'Verified — Confirm' : 'Verify Identity'}
      </Text>

      {/* Camera / Face Verification */}
      <View style={styles.cameraWrapper}>
        {verifying || verified ? (
          <View style={[styles.cameraView, { backgroundColor: C.bg, justifyContent: 'center' }]}>
            <FaceMatchConfirmation
              selfieUri={selfie?.uri}
              onVerified={() => setVerified(true)}
            />
          </View>
        ) : selfie ? (
          <Image source={{ uri: selfie.uri }} style={styles.cameraView} />
        ) : (
          <View style={styles.cameraView}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
            <View style={styles.faceOverlay}>
              <FaceDetectionOverlay onFaceDetected={() => setFaceDetected(true)} />
            </View>
          </View>
        )}
        {selfie && !verifying && !verified && (
          <TouchableOpacity style={styles.retakeBtn} onPress={() => { setSelfie(null); setFaceDetected(false); }}>
            <Text style={styles.retakeText}>🔄 Retake</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info Cards */}
      <View style={styles.infoRow}>
        <View style={[styles.infoCard, { backgroundColor: C.bgCard, borderColor: C.border }, location && styles.infoCardDone]}>
          <Text style={styles.infoIcon}>{locationLoading ? '⏳' : location ? '📍' : '⚠️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: C.textMuted }]}>Location</Text>
            <Text style={[styles.infoValue, { color: C.textPrimary }]} numberOfLines={1}>
              {locationLoading ? 'Detecting...' : address || 'Captured'}
            </Text>
          </View>
        </View>
        <View style={[styles.infoCard, { backgroundColor: C.bgCard, borderColor: C.border }, styles.infoCardDone]}>
          <Text style={styles.infoIcon}>🕐</Text>
          <View>
            <Text style={[styles.infoLabel, { color: C.textMuted }]}>Time</Text>
            <Text style={[styles.infoValue, { color: C.textPrimary }]}>
              {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Action */}
      <View style={styles.bottom}>
        {verified ? (
          <TouchableOpacity
            style={[styles.submitBtn, type === 'check-out' && { backgroundColor: COLORS.danger }]}
            onPress={submitAttendance}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {type === 'check-in' ? '✅  Confirm Check In' : '🏠  Confirm Check Out'}
              </Text>
            )}
          </TouchableOpacity>
        ) : selfie && !verifying ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: C.accentStart || COLORS.accent }]}
            onPress={() => setVerifying(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>🔍  Verify Identity</Text>
          </TouchableOpacity>
        ) : !selfie ? (
          <TouchableOpacity
            style={[styles.captureBtn, !faceDetected && { opacity: 0.3 }]}
            onPress={faceDetected ? takeSelfie : null}
            activeOpacity={0.7}
            disabled={!faceDetected}
          >
            <View style={styles.captureOuter}>
              <View style={[styles.captureInner, faceDetected && { backgroundColor: C.success || COLORS.accent }]} />
            </View>
            {!faceDetected && <Text style={[styles.waitText, { color: C.textMuted }]}>Detecting face...</Text>}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: 40 },

  permCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xxl, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  permTitle: { ...FONTS.h3, textAlign: 'center' },
  permDesc: { ...FONTS.caption, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  permButton: { backgroundColor: COLORS.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: RADIUS.md, ...SHADOWS.accent },
  permButtonText: { ...FONTS.button, color: '#fff' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  backIcon: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { ...FONTS.h3 },

  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 60, marginTop: 8 },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  stepDone: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.border, marginHorizontal: 8 },
  stepLineDone: { backgroundColor: COLORS.accent },
  stepLabel: { ...FONTS.captionMedium, textAlign: 'center', marginTop: 8, color: COLORS.textAccent },

  cameraWrapper: { margin: SPACING.xl, borderRadius: RADIUS.xl, overflow: 'hidden', height: width - 40, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border },
  cameraView: { flex: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
  faceOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  faceGuide: { width: 160, height: 200, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderStyle: 'dashed' },
  faceText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginTop: 12 },
  retakeBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  retakeText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  infoRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: 10 },
  infoCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  infoCardDone: { borderColor: COLORS.success + '30' },
  infoIcon: { fontSize: 20 },
  infoLabel: { fontSize: 11, color: COLORS.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginTop: 1 },

  bottom: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl },
  captureBtn: { alignItems: 'center' },
  captureOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: COLORS.accentBorder, justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.accent },
  submitBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 18, alignItems: 'center', width: '100%', ...SHADOWS.accent },
  submitText: { ...FONTS.button, color: '#fff', fontSize: 17 },
  waitText: { fontSize: 12, fontWeight: '600', marginTop: 10, letterSpacing: 0.5 },
});
