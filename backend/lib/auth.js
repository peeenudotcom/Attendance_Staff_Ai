import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  const s = process.env.AUTH_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_TOKEN_SECRET must be set (32+ characters)');
  return s;
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest();
}

export function issueToken(staffId) {
  const payload = Buffer.from(JSON.stringify({ sub: staffId, iat: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload).toString('base64url')}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const provided = Buffer.from(signature, 'base64url');
  const expected = sign(payload);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const { sub, iat } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!sub || !Number.isFinite(iat) || iat > Date.now() + 60_000 || Date.now() - iat > TOKEN_TTL_MS) return null;
    return sub;
  } catch {
    return null;
  }
}

/** The active staff member behind the request's Bearer token, or null. */
export async function currentStaff(req) {
  const header = req.headers.authorization || '';
  const staffId = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!staffId) return null;
  const { data } = await db().from('staff').select('*, org:organizations(*)').eq('id', staffId).maybeSingle();
  return data && data.active && data.org?.active ? data : null;
}

/** The user object the app stores after sign-in (`s.org` included when loaded). */
export function publicUser(s) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
    department: s.department,
    designation: s.designation,
    ...(s.org ? { company: { id: s.org.id, name: s.org.name, logoUrl: s.org.logo_url } } : {}),
    ...(s.is_platform_admin ? { platformAdmin: true } : {}),
  };
}
