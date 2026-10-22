import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, Dimensions, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { attendanceAPI, companyAPI } from '../services/api';
import { distanceM, fmtDistance, outsideOffice } from '../utils/geo';
import { Screen, AppHeader, Button, Card, Icon, Loading, Subtle, T, istToday } from '../ui';
import { useLang, fmtDayLong } from '../i18n';
import '../i18n/strings/mark';

const { width } = Dimensions.get('window');
const FRAME_H = Math.min(width - T.pad * 2, 420) * 1.15;

// "Railway Road, Kotkapura": the geocoder often repeats the street as the place name.
function formatAddress(a) {
  const parts = [a.name, a.street, a.district, a.city].map((p) => (p || '').trim()).filter(Boolean);
  const unique = parts.filter((p, i) => !parts.slice(0, i).some((q) => q.toLowerCase() === p.toLowerCase()));
  return unique.join(', ');
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// The server's face refusal is English ("…didn't match your saved photo… (try 1 of 3)."); show it in the app's language.
function faceMessage(t, message = '') {
  const base = /couldn'?t see/i.test(message) ? t('mark.faceNoFace') : t('mark.faceMismatch');
  const m = message.match(/try (\d+) of (\d+)/i);
  return m ? `${base} ${t('mark.faceTry', { n: m[1], max: m[2] })}` : base;
}

/** Oval + corner marks over the camera, with a short hint. Only a framing guide; it checks nothing. */
function FaceGuide({ hint }) {
  const c = 'rgba(255,255,255,0.85)';
  return (
    <View style={s.guideWrap} pointerEvents="none">
      <View style={[s.oval, { borderColor: c }]} />
      <View style={s.guideBadge}><Text style={s.guideText}>{hint}</Text></View>
    </View>
  );
}

export default function MarkAttendanceScreen({ route, navigation }) {
  const { t } = useLang();
  const { type } = route.params;
  const isIn = type === 'check-in';
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [selfie, setSelfie] = useState(null);
  const [shooting, setShooting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [company, setCompany] = useState(null);
  // Why there is no location: 'denied' (permission), 'off' (location services off) or 'unavailable' (no GPS fix).
  const [locError, setLocError] = useState(null);
  // After submitting: { ok: true, time } or { ok: false, network, face, message }. Staff must always know whether it was recorded.
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    getLocation();
    // Only to warn early; if this fails the server still checks the location on submit.
    companyAPI.get().then(setCompany).catch(() => {});
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const office = company?.office;
  const distance = office && location ? distanceM(office, { lat: location.latitude, lng: location.longitude }) : null;
  const blocked = isIn && company?.lockApplies && distance != null
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
    if (!cameraRef.current || shooting) return;
    setShooting(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      // Full-resolution photos are several MB; 1000 px wide is plenty for a selfie and uploads
      // quickly on mobile data (and stays well under the server's upload limit).
      const small = await manipulateAsync(photo.uri, [{ resize: { width: 1000 } }], {
        compress: 0.6, format: SaveFormat.JPEG, base64: true,
      });
      setSelfie(small);
    } catch (e) {
      Alert.alert(t('mark.photoFailTitle'), t('mark.photoFail'));
    } finally {
      setShooting(false);
    }
  };

  const submitAttendance = async () => {
    if (!selfie || !location) return;
    setLoading(true);
    const data = {
      type, selfie: selfie.base64,
      latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy,
      address, timestamp: new Date().toISOString(),
    };
    try {
      isIn ? await attendanceAPI.checkIn(data) : await attendanceAPI.checkOut(data);
      setResult({ ok: true, time: hhmm(new Date()) });
    } catch (e) {
      // fetch fails with a TypeError when there is no connection; a captive Wi-Fi page returns HTML, not our JSON.
      const network = e instanceof TypeError || /network|non-JSON|timed? ?out|failed to fetch/i.test(e.message || '');
      const face = e.code === 'face';
      setResult({
        ok: false, network, face,
        message: network ? t('mark.noInternetSaved') : face ? faceMessage(t, e.message) : (e.message || t('mark.somethingWrong')),
      });
    } finally {
      setLoading(false);
    }
  };

  const askCorrection = () => navigation.replace('Corrections', {
    date: istToday(),
    kind: isIn ? 'missed_check_in' : 'missed_check_out',
  });

  const header = (
    <AppHeader
      title={isIn ? t('mark.checkIn') : t('mark.checkOut')}
      subtitle={`${hhmm(now)}  ·  ${fmtDayLong(t, istToday())}`}
      onBack={() => navigation.goBack()}
      compact
    />
  );

  if (!permission) return <Screen header={header}><Loading /></Screen>;

  if (!permission.granted) {
    return (
      <Screen header={header}>
        <View style={s.permWrap}>
          <View style={s.permIcon}><Icon name="camera" size={32} color={T.navyDeep} /></View>
          <Text style={s.permTitle}>{t('mark.camTitle')}</Text>
          <Subtle style={s.permDesc}>{t('mark.camDesc')}</Subtle>
          <Button title={t('mark.camAllow')} icon="camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
          {permission.canAskAgain === false && (
            <Button title={t('mark.openSettings')} variant="outline" icon="settings" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch', marginTop: 12 }} />
          )}
        </View>
      </Screen>
    );
  }

  // Smaller picture while a message is showing, so its buttons fit without scrolling on small phones.
  const frameH = result || (locError && !locationLoading) || (blocked && !locationLoading) ? FRAME_H * 0.55 : FRAME_H;
  const accuracy = location?.accuracy != null ? Math.round(location.accuracy) : null;

  return (
    <Screen header={header}>
      {/* Selfie */}
      <View style={[s.frame, { height: frameH }]}>
        {selfie ? (
          <Image source={{ uri: selfie.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            {!result && <FaceGuide hint={t('mark.guide')} />}
          </>
        )}
        {selfie && !loading && !result?.ok && (
          <TouchableOpacity style={s.retake} onPress={() => { setSelfie(null); setResult(null); }} activeOpacity={0.8}>
            <Icon name="refresh-cw" size={16} color="#fff" />
            <Text style={s.retakeText}>{t('mark.retake')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!selfie && !result && (
        <View style={s.shutterWrap}>
          <TouchableOpacity onPress={takeSelfie} disabled={shooting} activeOpacity={0.75} style={s.shutterOuter}
            accessibilityRole="button" accessibilityLabel={t('mark.takeSelfie')}>
            <View style={[s.shutterInner, shooting && { opacity: 0.5 }]}>
              <Icon name="camera" size={24} color={T.onYellow} />
            </View>
          </TouchableOpacity>
          <Text style={s.shutterLabel}>{t('mark.takeSelfie')}</Text>
        </View>
      )}

      {/* Location */}
      <View style={s.locRow}>
        <View style={[s.locIcon, { backgroundColor: location ? T.greenSoft : locError && !locationLoading ? T.redSoft : T.surface }]}>
          <Icon name="map-pin" size={19} color={location ? T.green : locError && !locationLoading ? T.red : T.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.locLabel}>{t('mark.locTitle')}</Text>
          <Text style={s.locValue} numberOfLines={2}>
            {locationLoading ? t('mark.locFinding') : locError ? t('mark.locNotFound') : address || t('mark.locFound')}
          </Text>
          {!locationLoading && location && (
            <Text style={[s.locSub, blocked && { color: T.red, fontWeight: '700' }]} numberOfLines={1}>
              {[accuracy != null && t('mark.accuracy', { m: accuracy }), distance != null && t('mark.fromOffice', { d: fmtDistance(distance) })].filter(Boolean).join('  ·  ')}
            </Text>
          )}
        </View>
      </View>

      {/* Action */}
      <View style={{ marginTop: 18 }}>
        {result ? (
          result.ok ? (
            <Card tone="green">
              <Text style={[s.cardTitle, { color: T.green }]}>{t('mark.okTitle')}</Text>
              <Text style={s.bigTime}>{result.time}</Text>
              <Text style={s.cardText}>{t(isIn ? 'mark.okIn' : 'mark.okOut', { time: result.time })}</Text>
              <Button title={t('common.done')} variant="success" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
            </Card>
          ) : (
            <Card tone="red">
              <Text style={[s.cardTitle, { color: T.red }]}>{t('mark.failTitle')}</Text>
              <Text style={s.cardText}>{result.message}</Text>
              {result.network && <Text style={[s.cardText, { color: T.textMuted }]}>{t('mark.networkHint')}</Text>}
              <Button
                title={result.face ? t('mark.retakeSelfie') : t('common.tryAgain')}
                icon={result.face ? 'camera' : 'refresh-cw'}
                onPress={() => { if (result.face) setSelfie(null); setResult(null); }}
                style={{ marginTop: 16 }}
              />
              <Button title={t('mark.askCorrection')} variant="outline" icon="edit-3" onPress={askCorrection} style={{ marginTop: 10 }} />
            </Card>
          )
        ) : locError && !locationLoading ? (
          <Card tone="red">
            <Text style={[s.cardTitle, { color: T.red }]}>{t('mark.locErrTitle')}</Text>
            <Text style={s.cardText}>
              {locError === 'denied' ? t('mark.locDenied') : locError === 'off' ? t('mark.locOff') : t('mark.locUnavailable')}
            </Text>
            <Button title={t('common.tryAgain')} icon="refresh-cw" onPress={getLocation} style={{ marginTop: 16 }} />
            {locError !== 'unavailable' && (
              <Button title={t('mark.openSettings')} variant="outline" icon="settings" onPress={() => Linking.openSettings()} style={{ marginTop: 10 }} />
            )}
            <TouchableOpacity onPress={askCorrection} style={{ marginTop: 14 }} hitSlop={8}>
              <Text style={s.linkText}>{t('mark.stillNotWorking')}</Text>
            </TouchableOpacity>
          </Card>
        ) : blocked && !locationLoading ? (
          <Card tone="yellow">
            <Text style={s.cardTitle}>{t('mark.notAtOffice')}</Text>
            <Text style={s.cardText}>{t('mark.notAtOfficeText', { d: fmtDistance(distance), r: fmtDistance(office.radiusM) })}</Text>
            <Button title={t('mark.checkLocation')} icon="map-pin" onPress={getLocation} style={{ marginTop: 16 }} />
          </Card>
        ) : selfie ? (
          <Button
            title={!location ? t('mark.waitingLocation') : isIn ? t('mark.submitIn') : t('mark.submitOut')}
            variant={isIn ? 'success' : 'primary'}
            icon={isIn ? 'log-in' : 'log-out'}
            onPress={submitAttendance}
            busy={loading}
            disabled={!location}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  permWrap: { alignItems: 'center', paddingTop: 20 },
  permIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: T.yellowSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  permTitle: { fontSize: 20, fontWeight: '800', color: T.navyDeep, textAlign: 'center' },
  permDesc: { fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 21 },

  frame: { borderRadius: T.radiusLg, overflow: 'hidden', backgroundColor: T.navyDeep },
  guideWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  oval: { width: '58%', aspectRatio: 0.78, borderRadius: 999, borderWidth: 3, borderStyle: 'dashed' },
  guideBadge: { position: 'absolute', bottom: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(14,26,51,0.7)', maxWidth: '90%' },
  guideText: { fontSize: 13, fontWeight: '600', color: '#fff', textAlign: 'center' },
  retake: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(14,26,51,0.75)', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22 },
  retakeText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  shutterWrap: { alignItems: 'center', marginTop: 18 },
  shutterOuter: { width: 86, height: 86, borderRadius: 43, borderWidth: 4, borderColor: T.navy, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: T.yellow, alignItems: 'center', justifyContent: 'center' },
  shutterLabel: { fontSize: 15, fontWeight: '700', color: T.navyDeep, marginTop: 10 },

  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: T.line, borderRadius: T.radius },
  locIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  locLabel: { fontSize: 13, color: T.textMuted },
  locValue: { fontSize: 15, fontWeight: '700', color: T.navyDeep, marginTop: 2 },
  locSub: { fontSize: 13, color: T.textMuted, marginTop: 3 },

  cardTitle: { fontSize: 17, fontWeight: '800', color: T.navyDeep },
  bigTime: { fontSize: 34, fontWeight: '800', color: T.navyDeep, marginTop: 6 },
  cardText: { fontSize: 14, color: T.text, marginTop: 8, lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '700', color: T.navyDeep, textDecorationLine: 'underline', textAlign: 'center' },
});
