import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { pushAPI } from './api';

// Notifications: push messages from the server (leave requested / decided) and reminders the phone schedules
// itself from the person's shift (check in, check out). Nothing here may break the app if notifications
// are refused or unavailable, so every call is wrapped.

const IST_MS = 330 * 60_000;
const DAY = 86_400_000;
const PREF_KEY = 'haazri_reminders';
let pushToken = null;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

// Reminders on/off, kept on the phone (default on).
const store = Platform.OS === 'web'
  ? { get: async (k) => localStorage.getItem(k), set: async (k, v) => localStorage.setItem(k, v) }
  : { get: (k) => require('expo-secure-store').getItemAsync(k), set: (k, v) => require('expo-secure-store').setItemAsync(k, v) };
export async function remindersOn() {
  try { return (await store.get(PREF_KEY)) !== 'off'; } catch { return true; }
}
export async function setRemindersOn(on) {
  try { await store.set(PREF_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  if (!on) await cancelReminders();
}

async function allowed() {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Asks for permission (once) and links this phone to the signed-in person for push messages. */
export async function registerForPush() {
  try {
    if (!(await allowed())) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Haazri', importance: Notifications.AndroidImportance.HIGH });
    }
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    pushToken = data;
    await pushAPI.register(data, Platform.OS);
  } catch (e) {
    console.log('[push] not registered:', e?.message);
  }
}

/** On sign-out: stop push messages to this phone and clear reminders. */
export async function unregisterPush() {
  try { if (pushToken) await pushAPI.unregister(pushToken); } catch { /* signed out anyway */ }
  pushToken = null;
  await cancelReminders();
}

async function cancelReminders() {
  try { if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}

const istDate = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const atIst = (date, minutes) => new Date(Date.parse(`${date}T00:00:00+05:30`) + minutes * 60_000);
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

/**
 * Plans the next two weeks of reminders (iOS keeps at most 64):
 * - check in: at the shift's late time (or the company's), on working days that aren't approved leave,
 *   skipping today once checked in;
 * - check out: today only, when checked in and not out, 15 minutes after the shift ends (20:00 without a shift).
 */
export async function scheduleReminders({ company, today, leaveDates = [] }) {
  try {
    if (Platform.OS === 'web' || !company || !(await remindersOn())) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await cancelReminders();

    const shift = company.myShift;
    const lateAt = shift ? toMin(shift.lateAfter) : company.lateAfterMinutes ?? 555;
    const leave = new Set(leaveDates);
    const now = Date.now();
    const todayDate = istDate(now);
    const jobs = [];

    for (let i = 0; i < 14; i++) {
      const date = istDate(now + i * DAY);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (company.weeklyOff === weekday || leave.has(date)) continue;
      if (date === todayDate && today?.checkedIn) continue;
      const when = atIst(date, lateAt);
      if (when.getTime() <= now) continue;
      jobs.push({ when, title: 'Not checked in yet', body: 'Tap to check in with Haazri.', data: { screen: 'MarkAttendance', type: 'check-in' } });
    }

    if (today?.checkedIn && !today?.checkedOut) {
      let when;
      if (shift) {
        const endDate = toMin(shift.end) <= toMin(shift.start) ? istDate(now + DAY) : todayDate; // overnight shift ends tomorrow
        when = new Date(atIst(endDate, toMin(shift.end)).getTime() + 15 * 60_000);
      } else {
        when = atIst(todayDate, 20 * 60);
      }
      if (when.getTime() > now) jobs.push({ when, title: "Don't forget to check out", body: 'Tap to check out with Haazri.', data: { screen: 'MarkAttendance', type: 'check-out' } });
    }

    for (const j of jobs) {
      await Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body, data: j.data, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.when },
      });
    }
  } catch (e) {
    console.log('[reminders] not scheduled:', e?.message);
  }
}

/** Opens the screen a tapped notification points at. Returns an unsubscribe function. */
export function onNotificationTap(navigate) {
  if (Platform.OS === 'web') return () => {};
  const go = (response) => {
    const d = response?.notification?.request?.content?.data || {};
    if (d.screen === 'MarkAttendance') navigate('MarkAttendance', { type: d.type || 'check-in' });
    else if (d.screen) navigate(d.screen);
  };
  Notifications.getLastNotificationResponseAsync().then((r) => r && go(r)).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(go);
  return () => sub.remove();
}
