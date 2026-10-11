import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './http.js';

// Attendance is keyed by the IST calendar day, so a 9pm check-in stays on "today"
// even though the server runs in UTC.
const IST_OFFSET_MIN = 330;
const BUCKET = 'selfies';
const MAX_SELFIE_BYTES = 3 * 1024 * 1024;

const toIst = (d) => new Date(d.getTime() + IST_OFFSET_MIN * 60_000);

/** "YYYY-MM-DD" of the IST day containing `d`. */
export const istDay = (d) => toIst(d).toISOString().slice(0, 10);

/** Late if after the company's cut-off (minutes past midnight IST, default 09:15). */
export const isLate = (d, lateAfterMinutes = 555) => {
  const ist = toIst(d);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes() > lateAfterMinutes;
};

/** "HH:MM" in IST, or "—". */
export const fmtTime = (ts) => {
  if (!ts) return '—';
  const ist = toIst(new Date(ts));
  return `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`;
};

export const fmtHours = (minutes) =>
  minutes == null ? '—' : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;

/**
 * The server's clock decides the time; a client timestamp is accepted only if it is
 * within 10 minutes of it (covers slow uploads, blocks back-dating).
 */
export function eventTime(clientTimestamp) {
  const now = new Date();
  const client = clientTimestamp ? new Date(clientTimestamp) : null;
  if (client && !Number.isNaN(client.getTime()) && Math.abs(client - now) <= 10 * 60_000) return client;
  return now;
}

/** Stores a base64 JPEG selfie in the private bucket and returns its path. */
export async function uploadSelfie(base64, staffId, kind) {
  if (!base64) throw new HttpError(400, 'A selfie is required');
  const buffer = Buffer.from(String(base64).replace(/^data:image\/\w+;base64,/, ''), 'base64');
  if (!buffer.length) throw new HttpError(400, 'The selfie could not be read');
  if (buffer.length > MAX_SELFIE_BYTES) throw new HttpError(413, 'The selfie is too large');
  const path = `${staffId}/${istDay(new Date())}-${kind}-${randomUUID()}.jpg`;
  const { error } = await db().storage.from(BUCKET).upload(path, buffer, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Selfie upload failed: ${error.message}`);
  return path;
}

/** Short-lived link to a stored selfie, or null. */
export async function selfieUrl(path, expiresIn = 60 * 60) {
  if (!path) return null;
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Short-lived links for many selfie paths at once: { path: url }. */
export async function selfieUrls(paths, expiresIn = 60 * 60) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await db().storage.from(BUCKET).createSignedUrls(list, expiresIn);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

/** Validates "YYYY-MM" (default: current IST month) and returns its days as "YYYY-MM-DD". */
export function monthDays(month) {
  const m = String(month || istDay(new Date()).slice(0, 7));
  const match = /^(\d{4})-(\d{2})$/.exec(m);
  if (!match || +match[2] < 1 || +match[2] > 12) throw new HttpError(400, 'Invalid month, use YYYY-MM');
  const count = new Date(Date.UTC(+match[1], +match[2], 0)).getUTCDate();
  return { month: m, days: Array.from({ length: count }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`) };
}

/** Day of the week (0 = Sunday) for a "YYYY-MM-DD" date. */
export const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

export function coord(value, limit) {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}
