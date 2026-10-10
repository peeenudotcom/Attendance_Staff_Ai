import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { db, must } from './db.js';
import { HttpError } from './http.js';

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;               // wrong guesses per code
const MAX_SENDS = 5;                  // codes per phone per window
const SEND_WINDOW_MS = 15 * 60 * 1000;

function hash(phone, code) {
  return createHash('sha256').update(`${phone}:${code}:${process.env.AUTH_TOKEN_SECRET}`).digest('hex');
}

function sameString(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * App Review access: one phone number that accepts one fixed code, set by
 * REVIEW_PHONE and REVIEW_CODE. No email is sent for it. Unset both to turn it off.
 */
export function isReviewPhone(phone) {
  const reviewPhone = String(process.env.REVIEW_PHONE || '').replace(/\D/g, '').slice(-10);
  return !!reviewPhone && !!process.env.REVIEW_CODE && phone === reviewPhone;
}

/** Creates and stores a new 4-digit code for `phone`, enforcing the send limit. */
export async function createCode(phone) {
  const now = Date.now();
  const existing = must(await db().from('otp_codes').select('sends, window_started_at').eq('phone', phone).maybeSingle());
  const windowOpen = existing && now - new Date(existing.window_started_at).getTime() < SEND_WINDOW_MS;
  const sends = windowOpen ? existing.sends : 0;
  if (sends >= MAX_SENDS) throw new HttpError(429, 'Too many codes requested. Please wait 15 minutes and try again.');

  const code = String(randomInt(1000, 10000));
  must(await db().from('otp_codes').upsert({
    phone,
    code_hash: hash(phone, code),
    expires_at: new Date(now + CODE_TTL_MS).toISOString(),
    attempts: 0,
    sends: sends + 1,
    window_started_at: windowOpen ? existing.window_started_at : new Date(now).toISOString(),
  }));
  return code;
}

/** Throws unless `code` is the current, unexpired code for `phone`; a correct code is used up. */
export async function checkCode(phone, code) {
  if (isReviewPhone(phone)) {
    if (sameString(code, process.env.REVIEW_CODE)) return;
    throw new HttpError(401, 'Invalid or expired code');
  }
  const row = must(await db().from('otp_codes').select('*').eq('phone', phone).maybeSingle());
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw new HttpError(401, 'Invalid or expired code');
  if (row.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong attempts. Request a new code.');
  if (!sameString(hash(phone, code), row.code_hash)) {
    must(await db().from('otp_codes').update({ attempts: row.attempts + 1 }).eq('phone', phone));
    throw new HttpError(401, 'Invalid or expired code');
  }
  // Used up: expire it but keep the send counter.
  must(await db().from('otp_codes').update({ expires_at: new Date(0).toISOString() }).eq('phone', phone));
}

export function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return 'your email';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(2, local.length - head.length))}@${domain}`;
}
