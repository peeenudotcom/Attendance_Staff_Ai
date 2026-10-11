import { db } from './db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends a push notification to every phone the given people are signed in on. Never throws: a failed
 * notification must not fail the request that caused it. Tokens Expo reports as gone are removed.
 */
export async function notify(staffIds, { title, body, data = {} }) {
  try {
    const ids = [...new Set(staffIds.filter(Boolean))];
    if (!ids.length) return;
    const lists = await Promise.all(ids.map((id) => db().from('push_tokens').select('token').eq('staff_id', id)));
    const tokens = lists.flatMap((r) => (r.data || []).map((t) => t.token));
    if (!tokens.length) return;
    const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default' }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    const gone = (json.data || []).map((r, i) => (r.details?.error === 'DeviceNotRegistered' ? tokens[i] : null)).filter(Boolean);
    await Promise.all(gone.map((t) => db().from('push_tokens').delete().eq('token', t)));
  } catch (err) {
    console.error('[push] failed:', err.message);
  }
}
