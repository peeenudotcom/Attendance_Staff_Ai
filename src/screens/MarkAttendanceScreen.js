import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, Dimensions, Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { COLORS, SHADOWS, RADIUS, SPACING, FONTS } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { useModalHeaderInset } from '../utils/safeArea';
import { attendanceAPI, companyAPI } from '../services/api';
import { distanceM, fmtDistance, outsideOffice } from '../utils/geo';
import SelfieGuide from '../components/SelfieGuide';

const { width } = Dimensions.get('window');

// "Railway Road, Kotkapura": the geocoder often repeats the street as the place name.
function formatAddress(a) {
  const parts = [a.name, a.street, a.district, a.city].map((p) => (p || '').trim()).filter(Boolean);
  const unique = parts.filter((p, i) => !parts.slice(0, i).some((q) => q.toLowerCase() === p.toLowerCase()));
  return unique.join(', ');
}

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
  const [company, setCompany] = useState(null);
  // Why there is no location: 'denied' (permission), 'off' (location services off) or 'unavailable' (no GPS fix).
  const [locError, setLocError] = useState(null);
  // After submitting: { ok: true, time } or { ok: false, network, message }. Staff must always know whether it was recorded.
  const [result, setResult] = useState(null);

  useEffect(() => {
    getLocation();
    // Only to warn early; if this fails the server still checks the location on submit.
    companyAPI.get().then(setCompany).catch(() => {});
  }, []);

  const office = company?.office;
  const distance = office && location ? distanceM(office, { lat: location.latitude, lng: location.longitude }) : null;
  const blocked = type === 'check-in' && company?.lockApplies && distance != null
    && outsideOffice(distance, location.accuracy, office.radiusM);

  const getLocation = async () => {
    setLocationLoading(true);
    setLocError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocError('denied'); return; }
      if (!(await Location.hasServicesEnabledAsync())) { setLocError('off'); return; }
      // A weak GPS signal indoors can take a long time; give up after 20 seconds so staff aren't left waiting.
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000)),
      ]);
      setLocation(loc.coords);
      // The street address needs the internet; without it attendance still works with the coordinates.
      try {
        const [addr] = await Location.reverseGeocodeAsync(loc.coords);
        if (addr) setAddress(formatAddress(addr));
      } catch { /* address is optional */ }
    } catch (e) {
      setLocError('unavailable');
    } finally {
      setLocationLoading(false);
    }
  };

  const takeSelfie = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      // Full-resolution photos are several MB; 1000 px wide is plenty for a selfie and uploads
      // quickly on mobile data (and stays well under the server's upload limit).
      const small = await manipulateAsync(photo.uri, [{ resize: { width: 1000 } }], {
        compress: 0.6, format: SaveFormat.JPEG, base64: true,
      });
      setSelfie(small);
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
      latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy,
      address, timestamp: new Date().toISOString(),
    };
    try {
      type === 'check-in' ? await attendanceAPI.checkIn(data) : await attendanceAPI.checkOut(data);
      setResult({ ok: true, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
    } catch (e) {
      // fetch fails with a TypeError when there is no connection; a captive Wi-Fi page returns HTML, not our JSON.
      const network = e instanceof TypeError || /network|non-JSON|timed? ?out|failed to fetch/i.test(e.message || '');
      setResult({ ok: false, network, message: network ? 'No internet connection, so nothing was saved.' : (e.message || 'Something went wrong.') });
    } finally {
      setLoading(false);
    }
  };

  const askCorrection = () => navigation.replace('Corrections', {
    date: new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10),
    kind: type === 'check-in' ? 'missed_check_in' : 'missed_check_out',
  });

  if (!permission) return <View style={[styles.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color={C.accent} /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={[styles.permCard, { backgroundColor: C.bgCard, borderColor: C.border }]}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={[styles.permTitle, { color: C.textPrimary }]}>Camera Access Required</Text>
          <Text style={[styles.permDesc, { color: C.textSecondary }]}>We need camera access to take your check-in selfie</Text>
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
        {!selfie ? 'Take a selfie' : 'Confirm your attendance'}
      </Text>

      {/* Camera / Selfie */}
      {/* Smaller preview while a message is showing, so its buttons fit on small phones. */}
      <View style={[styles.cameraWrapper, (result || (locError && !locationLoading)) && { height: width * 0.5 }]}>
        {selfie ? (
          <Image source={{ uri: selfie.uri }} style={styles.cameraView} />
        ) : (
          <View style={styles.cameraView}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
            <View style={styles.faceOverlay}>
              <SelfieGuide />
            </View>
          </View>
        )}
        {selfie && (
          <TouchableOpacity style={styles.retakeBtn} onPress={() => setSelfie(null)}>
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
              {locationLoading ? 'Detecting...' : locError ? 'Not found' : address || 'Captured'}
            </Text>
            {distance != null && !locationLoading && (
              <Text style={[styles.infoSub, { color: blocked ? COLORS.danger : C.textMuted }]} numberOfLines={1}>
                {fmtDistance(distance)} from office
              </Text>
            )}
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
        {result ? (
          result.ok ? (
            <View style={[styles.resultCard, { backgroundColor: C.bgCard, borderColor: C.success }]}>
              <Text style={[styles.resultTitle, { color: C.success }]}>✓ Attendance recorded</Text>
              <Text style={[styles.blockedText, { color: C.textSecondary }]}>
                {type === 'check-in' ? 'Checked in' : 'Checked out'} at {result.time}. Your admin can see it now.
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={styles.refreshText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.resultCard, { backgroundColor: C.bgCard, borderColor: COLORS.danger }]}>
              <Text style={[styles.resultTitle, { color: COLORS.danger }]}>Attendance NOT recorded</Text>
              <Text style={[styles.blockedText, { color: C.textSecondary }]}>{result.message}</Text>
              {result.network && (
                <Text style={[styles.blockedText, { color: C.textMuted }]}>
                  Check your mobile data or Wi-Fi and try again. Not sure if it went through? Home shows whether you are checked in.
                </Text>
              )}
              <View style={styles.resultActions}>
                <TouchableOpacity style={[styles.refreshBtn, { flex: 1 }]} onPress={() => setResult(null)} activeOpacity={0.8}>
                  <Text style={styles.refreshText}>Try again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ghostBtn, { borderColor: C.border, flex: 1 }]} onPress={askCorrection} activeOpacity={0.8}>
                  <Text style={[styles.ghostText, { color: C.textAccent }]}>Ask for a correction</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        ) : locError && !locationLoading ? (
          <View style={[styles.blockedCard, { backgroundColor: C.bgCard, borderColor: COLORS.danger + '55' }]}>
            <Text style={[styles.blockedTitle, { color: C.textPrimary }]}>Location not found: not recorded yet</Text>
            <Text style={[styles.blockedText, { color: C.textSecondary }]}>
              {locError === 'denied' ? 'Haazri needs your location to mark attendance. Allow location for Haazri in your phone settings ("While using the app").'
                : locError === 'off' ? 'Location is switched off on this phone. Turn it on in settings, then try again.'
                  : 'Your phone could not find its location. Move near a window or outside, then try again.'}
            </Text>
            <View style={styles.resultActions}>
              <TouchableOpacity style={[styles.refreshBtn, { flex: 1 }]} onPress={getLocation} activeOpacity={0.8}>
                <Text style={styles.refreshText}>Try again</Text>
              </TouchableOpacity>
              {locError !== 'unavailable' && (
                <TouchableOpacity style={[styles.ghostBtn, { borderColor: C.border, flex: 1 }]} onPress={() => Linking.openSettings()} activeOpacity={0.8}>
                  <Text style={[styles.ghostText, { color: C.textAccent }]}>Open settings</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={askCorrection} style={{ marginTop: 10 }}>
              <Text style={[styles.ghostText, { color: C.textAccent }]}>Still not working? Ask for a correction</Text>
            </TouchableOpacity>
          </View>
        ) : blocked && !locationLoading ? (
          <View style={[styles.blockedCard, { backgroundColor: C.bgCard, borderColor: COLORS.danger + '55' }]}>
            <Text style={[styles.blockedTitle, { color: C.textPrimary }]}>You're not at the office</Text>
            <Text style={[styles.blockedText, { color: C.textSecondary }]}>
              You are {fmtDistance(distance)} away. You can check in when you are within {fmtDistance(office.radiusM)} of the office.
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={getLocation} activeOpacity={0.8}>
              <Text style={styles.refreshText}>Check my location again</Text>
            </TouchableOpacity>
          </View>
        ) : selfie ? (
          <TouchableOpacity
            style={[styles.submitBtn, type === 'check-out' && { backgroundColor: COLORS.danger }]}
            onPress={submitAttendance}
            disabled={loading || !location}
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
        ) : (
          <TouchableOpacity style={styles.captureBtn} onPress={takeSelfie} activeOpacity={0.7}>
            <View style={styles.captureOuter}>
              <View style={styles.captureInner} />
            </View>
            <Text style={[styles.waitText, { color: C.textMuted }]}>Tap to take your selfie</Text>
          </TouchableOpacity>
        )}
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
  infoSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  blockedCard: { width: '100%', borderRadius: RADIUS.md, borderWidth: 1, padding: 16, alignItems: 'center' },
  blockedTitle: { fontSize: 16, fontWeight: '700' },
  blockedText: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  refreshBtn: { marginTop: 12, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 20 },
  refreshText: { ...FONTS.button, color: '#fff', textAlign: 'center' },
  resultCard: { width: '100%', borderRadius: RADIUS.md, borderWidth: 1.5, padding: 16, alignItems: 'center' },
  resultTitle: { fontSize: 18, fontWeight: '800' },
  resultActions: { flexDirection: 'row', gap: 10, width: '100%' },
  ghostBtn: { marginTop: 12, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },

  bottom: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl },
  captureBtn: { alignItems: 'center' },
  captureOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: COLORS.accentBorder, justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.accent },
  submitBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 18, alignItems: 'center', width: '100%', ...SHADOWS.accent },
  submitText: { ...FONTS.button, color: '#fff', fontSize: 17 },
  waitText: { fontSize: 12, fontWeight: '600', marginTop: 10, letterSpacing: 0.5 },
});
