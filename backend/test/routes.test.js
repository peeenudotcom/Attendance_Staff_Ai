// Runs every backend route against an in-memory stand-in for Supabase.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const B = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const tables = { staff: [], otp_codes: [], attendance: [], call_logs: [] };
const uploads = [];
const sentEmails = [];

class Q {
  constructor(t) { this.t = t; this.filters = []; this.op = 'select'; this.one = null; this.ret = false; }
  select() { this.ret = true; return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lt(k, v) { this.filters.push((r) => r[k] < v); return this; }
  order(k, o = {}) { this.sort = [k, o.ascending !== false]; return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  update(p) { this.op = 'update'; this.patch = p; return this; }
  upsert(rows, o = {}) { this.op = 'upsert'; this.row = rows; this.opts = o; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  single() { this.one = 'single'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  run() {
    const rows = tables[this.t];
    const match = () => rows.filter((r) => this.filters.every((f) => f(r)));
    let out;
    if (this.op === 'insert') {
      const r = { id: randomUUID(), active: true, approval: 'pending', ...this.row };
      if (this.t === 'staff' && rows.some((x) => x.phone === r.phone)) return { data: null, error: { code: '23505', message: 'dup' } };
      if (this.t === 'attendance' && rows.some((x) => x.staff_id === r.staff_id && x.date === r.date)) return { data: null, error: { code: '23505', message: 'dup' } };
      rows.push(r); out = [r];
    } else if (this.op === 'update') {
      out = match(); out.forEach((r) => Object.assign(r, this.patch));
    } else if (this.op === 'upsert') {
      out = [];
      for (const r of [].concat(this.row)) {
        const keys = this.t === 'otp_codes' ? ['phone'] : this.opts.onConflict.split(',');
        const ex = rows.find((x) => keys.every((k) => x[k] === r[k]));
        if (ex) { if (!this.opts.ignoreDuplicates) Object.assign(ex, r); } else { rows.push({ id: randomUUID(), ...r }); }
        out.push(r);
      }
    } else {
      out = match();
      if (this.sort) { const [k, asc] = this.sort; out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : -1) * (asc ? 1 : -1)); }
    }
    out = out.map((r) => ({ ...r }));
    if (this.one) {
      if (this.one === 'single' && out.length !== 1) return { data: null, error: { message: 'not single' } };
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, error: null };
  }
}

const fakeClient = {
  from: (t) => new Q(t),
  storage: { from: () => ({
    upload: async (path, buf) => { uploads.push({ path, size: buf.length }); return { error: null }; },
    createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.example/${path}` } }),
  }) },
};
mock.module(import.meta.resolve('@supabase/supabase-js'), { namedExports: { createClient: () => fakeClient } });

process.env.SUPABASE_URL = 'x';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
process.env.AUTH_TOKEN_SECRET = 'a'.repeat(40);
process.env.RESEND_API_KEY = 're_test';
process.env.EMAIL_FROM = 'TARAhut <no-reply@example.com>';
process.env.REVIEW_PHONE = '9000000001';
process.env.REVIEW_CODE = '4826';

globalThis.fetch = async (url, init) => { sentEmails.push(JSON.parse(init.body)); return { ok: true, text: async () => '' }; };

tables.staff.push({ id: 'admin1', name: 'Parveen Sukhija', phone: '9915424411', email: 'owner@example.com', role: 'admin', active: true });
tables.staff.push({ id: 'rev1', name: 'App Review', phone: '9000000001', email: null, role: 'staff', active: true });

async function call(path, { method = 'GET', body, token, query = {} } = {}) {
  const mod = await import(`${B}/api/${path}.js`);
  let status = 0, json;
  const res = { setHeader() {}, status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  await mod.default({ method, body, query, url: path, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  return { status, json };
}

const selfie = Buffer.from('fake jpeg bytes').toString('base64');

test('full flow', async () => {
  // health
  assert.equal((await call('health')).status, 200);

  // unknown number
  let r = await call('auth/login', { method: 'POST', body: { phone: '9999999999' } });
  assert.equal(r.status, 404);

  // owner login -> email sent, masked
  r = await call('auth/login', { method: 'POST', body: { phone: '+91 99154 24411' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.sentTo, 'ow***@example.com');
  const code = /(\d{4}) is your/.exec(sentEmails.at(-1).subject)[1];

  // wrong code, then right code
  r = await call('auth/verify-otp', { method: 'POST', body: { phone: '9915424411', otp: code === '1111' ? '2222' : '1111' } });
  assert.equal(r.status, 401);
  r = await call('auth/verify-otp', { method: 'POST', body: { phone: '9915424411', otp: code } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.user.role, 'admin');
  const token = r.json.token;
  // code is single-use
  assert.equal((await call('auth/verify-otp', { method: 'POST', body: { phone: '9915424411', otp: code } })).status, 401);

  // reviewer: no email, fixed code
  const before = sentEmails.length;
  r = await call('auth/login', { method: 'POST', body: { phone: '9000000001' } });
  assert.equal(r.status, 200); assert.equal(sentEmails.length, before);
  assert.equal((await call('auth/verify-otp', { method: 'POST', body: { phone: '9000000001', otp: '0000' } })).status, 401);
  r = await call('auth/verify-otp', { method: 'POST', body: { phone: '9000000001', otp: '4826' } });
  assert.equal(r.status, 200); const revToken = r.json.token;

  // auth required, bad token rejected
  assert.equal((await call('attendance/today')).status, 401);
  assert.equal((await call('attendance/today', { token: token + 'x' })).status, 401);

  // profile + today empty
  assert.equal((await call('auth/profile', { token })).json.name, 'Parveen Sukhija');
  assert.deepEqual((await call('attendance/today', { token })).json, {});

  // check-out before check-in
  assert.equal((await call('attendance/check-out', { method: 'POST', token, body: { selfie } })).status, 400);
  // check-in needs selfie
  assert.equal((await call('attendance/check-in', { method: 'POST', token, body: {} })).status, 400);
  r = await call('attendance/check-in', { method: 'POST', token, body: { selfie, latitude: 30.7, longitude: 76.7, address: 'Mohali', timestamp: new Date().toISOString() } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await call('attendance/check-in', { method: 'POST', token, body: { selfie } })).status, 409);

  r = await call('attendance/today', { token });
  assert.equal(r.json.checkedIn, true); assert.equal(r.json.checkedOut, false);
  assert.equal(r.json.location, 'Mohali'); assert.match(r.json.checkInSelfie, /^https:\/\/signed/);

  r = await call('attendance/check-out', { method: 'POST', token, body: { selfie, latitude: 30.7, longitude: 76.7, address: 'Mohali' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await call('attendance/check-out', { method: 'POST', token, body: { selfie } })).status, 409);
  r = await call('attendance/today', { token });
  assert.equal(r.json.checkedOut, true); assert.match(r.json.hours, /^\dh \d\dm$/);
  assert.equal(uploads.length, 2);

  // history
  r = await call('attendance/history', { token });
  assert.equal(r.json.records.length, 1);
  assert.equal((await call('attendance/history', { token, query: { month: '2026-13' } })).status, 400);

  // staff: admin-only
  assert.equal((await call('staff/index', { token: revToken })).status, 403);
  r = await call('staff/index', { token });
  assert.equal(r.json.staff.length, 2);
  assert.equal(r.json.staff.find((s) => s.id === 'admin1').today.checkIn !== '—', true);

  // add staff: validation, success, duplicate
  assert.equal((await call('staff/index', { method: 'POST', token, body: { name: 'A', phone: '9876543210' } })).status, 400);
  r = await call('staff/index', { method: 'POST', token, body: { name: 'Asha Rani', phone: '98765 43210', email: 'Asha@Example.com', department: 'Sales', designation: 'Exec', salaryType: 'monthly', salary: 25000 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.staff.email, 'asha@example.com');
  assert.equal((await call('staff/index', { method: 'POST', token, body: { name: 'Dup', phone: '9876543210', email: 'd@example.com' } })).status, 409);
  // new staff can sign in
  r = await call('auth/login', { method: 'POST', body: { phone: '9876543210' } });
  assert.equal(r.status, 200); assert.equal(sentEmails.at(-1).to, 'asha@example.com');

  // staff detail + month report
  const ashaId = tables.staff.find((s) => s.phone === '9876543210').id;
  assert.equal((await call('staff/[id]/index', { token, query: { id: ashaId } })).json.salary, 25000);
  r = await call('staff/[id]/attendance', { token, query: { id: 'admin1' } });
  assert.equal(r.json.records.length, 1); assert.match(r.json.records[0].checkOutSelfie, /signed/);

  // approve / reject
  const attId = tables.attendance[0].id;
  assert.equal((await call('attendance/[id]/approve', { method: 'PUT', token: revToken, query: { id: attId } })).status, 403);
  assert.equal((await call('attendance/[id]/approve', { method: 'PUT', token, query: { id: attId } })).status, 200);
  assert.equal(tables.attendance[0].approval, 'approved');
  assert.equal((await call('attendance/[id]/reject', { method: 'PUT', token, query: { id: attId }, body: { reason: 'wrong site' } })).status, 200);
  assert.equal(tables.attendance[0].reject_reason, 'wrong site');
  assert.equal((await call('attendance/[id]/approve', { method: 'PUT', token, query: { id: 'nope' } })).status, 404);

  // call logs (dedup on resync)
  const logs = [{ number: '+919876543210', name: 'X', type: 'outgoing', seconds: 63, timestamp: Date.now() }, { number: '', timestamp: 1 }];
  r = await call('call-logs/sync', { method: 'POST', token, body: { logs } });
  assert.equal(r.json.synced, 1);
  await call('call-logs/sync', { method: 'POST', token, body: { logs } });
  assert.equal(tables.call_logs.length, 1);

  // wrong method
  assert.equal((await call('attendance/today', { method: 'POST', token })).status, 405);

  // OTP brute force: 5 wrong guesses lock the code
  await call('auth/login', { method: 'POST', body: { phone: '9915424411' } });
  const c2 = /(\d{4}) is your/.exec(sentEmails.at(-1).subject)[1];
  const wrong = c2 === '1234' ? '4321' : '1234';
  for (let i = 0; i < 5; i++) await call('auth/verify-otp', { method: 'POST', body: { phone: '9915424411', otp: wrong } });
  assert.equal((await call('auth/verify-otp', { method: 'POST', body: { phone: '9915424411', otp: c2 } })).status, 429);

  // send limit: 5 per 15 minutes (owner has used 2)
  for (let i = 0; i < 3; i++) assert.equal((await call('auth/login', { method: 'POST', body: { phone: '9915424411' } })).status, 200);
  assert.equal((await call('auth/login', { method: 'POST', body: { phone: '9915424411' } })).status, 429);
});
