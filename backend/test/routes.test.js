// Runs every backend route against an in-memory stand-in for Supabase.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const B = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const tables = { organizations: [], staff: [], otp_codes: [], attendance: [], call_logs: [], leave_requests: [], shifts: [], push_tokens: [], holidays: [], pay_adjustments: [], month_closes: [], month_close_log: [], correction_requests: [] };
const uploads = [];
const sentEmails = [];
const sentPushes = [];
const removed = [];

class Q {
  constructor(t) { this.t = t; this.filters = []; this.op = 'select'; this.one = null; this.ret = false; }
  select(cols = '*') { this.ret = true; this.cols = cols; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
  lt(k, v) { this.filters.push((r) => r[k] < v); return this; }
  in(k, vs) { this.filters.push((r) => vs.includes(r[k])); return this; }
  is(k, v) { this.filters.push((r) => (r[k] ?? null) === v); return this; }
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
      const r = { id: randomUUID(), active: true, approval: 'pending', ...(this.t === 'leave_requests' ? { status: 'pending' } : {}), created_at: new Date().toISOString(), ...this.row };
      if (this.t === 'staff' && rows.some((x) => x.phone === r.phone)) return { data: null, error: { code: '23505', message: 'dup' } };
      if (this.t === 'attendance' && rows.some((x) => x.staff_id === r.staff_id && x.date === r.date)) return { data: null, error: { code: '23505', message: 'dup' } };
      if (this.t === 'holidays' && rows.some((x) => x.org_id === r.org_id && x.date === r.date)) return { data: null, error: { code: '23505', message: 'dup' } };
      rows.push(r); out = [r];
    } else if (this.op === 'delete') {
      out = match(); tables[this.t] = rows.filter((r) => !out.includes(r));
    } else if (this.op === 'update') {
      out = match();
      if (this.t === 'staff' && this.patch.phone && rows.some((x) => x.phone === this.patch.phone && !out.includes(x))) {
        return { data: null, error: { code: '23505', message: 'dup' } };
      }
      out.forEach((r) => Object.assign(r, this.patch));
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
    // Embedded relations used by the routes: staff -> its company, company -> staff count.
    if (this.cols?.includes('org:organizations')) out = out.map((r) => ({ ...r, org: tables.organizations.find((o) => o.id === r.org_id) ?? null }));
    if (this.cols?.includes('staff(count)')) out = out.map((r) => ({ ...r, staff: [{ count: tables.staff.filter((x) => x.org_id === r.id).length }] }));
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
    remove: async (paths) => { removed.push(...paths); return { error: null }; },
    upload: async (path, buf) => { uploads.push({ path, size: buf.length }); stored.set(path, buf); return { error: null }; },
    download: async (path) => (stored.has(path) ? { data: new Blob([stored.get(path)]), error: null } : { data: null, error: { message: 'not found' } }),
    createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.example/${path}` } }),
    createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })) }),
  }) },
};
mock.module(import.meta.resolve('@supabase/supabase-js'), { namedExports: { createClient: () => fakeClient } });

process.env.SUPABASE_URL = 'x';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
process.env.AUTH_TOKEN_SECRET = 'a'.repeat(40);
process.env.RESEND_API_KEY = 're_test';
process.env.EMAIL_FROM = 'TARAhut <no-reply@example.com>';
process.env.EMAIL_REPLY_TO = 'support@example.com';
process.env.REVIEW_PHONE = '9000000001, 90000 00002';
process.env.REVIEW_CODE = '4826';

const sentWhatsApps = [];
const stored = new Map();
const rekognitionCalls = [];
let rekognitionReply = { FaceMatches: [{ Similarity: 98.6 }], UnmatchedFaces: [] };
let whatsAppDown = false;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('rekognition.')) {
    rekognitionCalls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    if (rekognitionReply.status) return { ok: false, status: rekognitionReply.status, text: async () => JSON.stringify(rekognitionReply.body) };
    return { ok: true, status: 200, text: async () => JSON.stringify(rekognitionReply) };
  }
  if (String(url).includes('graph.facebook.com')) {
    if (whatsAppDown) return { ok: false, status: 400, text: async () => 'bad number' };
    const m = JSON.parse(init.body);
    sentWhatsApps.push({ url: String(url), auth: init.headers.Authorization, ...m });
    return { ok: true, text: async () => JSON.stringify({ messaging_product: 'whatsapp', contacts: [{ input: m.to, wa_id: m.to }], messages: [{ id: 'wamid.test' }] }) };
  }
  if (String(url).includes('exp.host')) {
    const msgs = JSON.parse(init.body); sentPushes.push(...msgs);
    return { ok: true, json: async () => ({ data: msgs.map((m) => (m.to.includes('gone') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) }) };
  }
  sentEmails.push(JSON.parse(init.body)); return { ok: true, text: async () => '' };
};

tables.organizations.push({ id: 'org1', name: 'TARAhut', late_after_minutes: 555, weekly_off: 0, active: true });
tables.organizations.push({ id: 'demo', name: 'Demo Company', late_after_minutes: 555, active: true });
tables.staff.push({ id: 'admin1', created_at: '2026-01-01T00:00:00Z', org_id: 'org1', is_platform_admin: true, name: 'Parveen Sukhija', phone: '9915424411', email: 'owner@example.com', role: 'admin', active: true });
tables.staff.push({ id: 'rev1', created_at: '2026-01-01T00:00:00Z', org_id: 'demo', name: 'App Review', phone: '9000000001', email: null, role: 'staff', active: true });

async function call(path, { method = 'GET', body, token, query = {} } = {}) {
  const mod = await import(`${B}/api/${path}.js`);
  let status = 0, json;
  const res = { setHeader() {}, status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  await mod.default({ method, body, query, url: path, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  return { status, json };
}

const selfie = Buffer.from('fake jpeg bytes').toString('base64');

test('shift rules', async () => {
  const { isLateFor, leftEarlyBy } = await import(`${B}/lib/shifts.js`);
  const at = (t, d = '2026-10-12') => new Date(`${d}T${t}:00+05:30`);
  const day = { start_minutes: 540, end_minutes: 1080, late_after_minutes: 555 };
  const night = { start_minutes: 1320, end_minutes: 360, late_after_minutes: 1335 };
  const who = (shift) => ({ shift, org: { late_after_minutes: 600 } });
  assert.equal(isLateFor(at('08:50'), who(day)), false);
  assert.equal(isLateFor(at('09:15'), who(day)), false);
  assert.equal(isLateFor(at('09:16'), who(day)), true);
  assert.equal(isLateFor(at('21:55'), who(night)), false);
  assert.equal(isLateFor(at('22:20'), who(night)), true);
  assert.equal(isLateFor(at('00:30'), who(night)), true); // after midnight, still the night shift
  assert.equal(isLateFor(at('09:50'), who(null)), false); // company late time 10:00
  assert.equal(leftEarlyBy(day, at('09:00'), at('17:00')), 60);
  assert.equal(leftEarlyBy(day, at('09:00'), at('17:57')), 0); // 5 minutes' grace
  assert.equal(leftEarlyBy(night, at('22:00'), at('05:00', '2026-10-13')), 60);
  assert.equal(leftEarlyBy(null, at('09:00'), at('10:00')), 0);
});

test('pay rules', async () => {
  const { monthPay } = await import(`${B}/lib/payroll.js`);
  const totals = (o) => ({ present: 0, late: 0, absent: 0, off: 0, leave: 0, paidLeave: 0, unpaidLeave: 0, minutes: 0, ...o });
  // monthly, full 30-day month: 22 present + 4 late + 4 Sundays = full salary
  let p = monthPay({ salaryType: 'monthly', salary: 30000, daysInMonth: 30, totals: totals({ present: 22, late: 4, off: 4 }) });
  assert.equal(p.pay, 30000); assert.equal(p.payDays, 30);
  // 2 absent + 1 unpaid leave cut 3 days; 1 sick leave is paid
  p = monthPay({ salaryType: 'monthly', salary: 30000, daysInMonth: 30, totals: totals({ present: 20, late: 2, off: 4, absent: 2, paidLeave: 1, unpaidLeave: 1 }) });
  assert.equal(p.pay, 27000);
  // every 3 lates = half day: 7 lates -> 1 day cut
  p = monthPay({ salaryType: 'monthly', salary: 30000, daysInMonth: 30, lateCutEvery: 3, totals: totals({ present: 19, late: 7, off: 4 }) });
  assert.equal(p.lateCutDays, 1); assert.equal(p.pay, 29000);
  // daily: only days worked
  p = monthPay({ salaryType: 'daily', salary: 600, daysInMonth: 31, totals: totals({ present: 20, late: 5, off: 4, paidLeave: 2 }) });
  assert.equal(p.pay, 15000);
  // hourly: hours between check-in and check-out; late cut does not apply
  p = monthPay({ salaryType: 'hourly', salary: 100, daysInMonth: 31, lateCutEvery: 2, totals: totals({ present: 2, late: 4, minutes: 2880 }) });
  assert.equal(p.pay, 4800); assert.equal(p.hours, 48);
  // weekly rate: 7000 a week = 1000 a day
  p = monthPay({ salaryType: 'weekly', salary: 7000, daysInMonth: 28, totals: totals({ present: 24, off: 4 }) });
  assert.equal(p.pay, 28000);
  // a half day pays half
  p = monthPay({ salaryType: 'monthly', salary: 30000, daysInMonth: 30, totals: totals({ present: 25, half: 2, off: 4 }) });
  assert.equal(p.payDays, 30); assert.equal(p.pay, 30000);
  p = monthPay({ salaryType: 'daily', salary: 600, daysInMonth: 30, totals: totals({ present: 10, half: 1 }) });
  assert.equal(p.pay, 6300);
  // no salary set
  p = monthPay({ salaryType: null, salary: null, daysInMonth: 30, totals: totals({ present: 3 }) });
  assert.equal(p.missing, true); assert.equal(p.pay, null);
});

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
  assert.equal(sentEmails.at(-1).reply_to, 'support@example.com');
  const code = /(\d{4}) is your/.exec(sentEmails.at(-1).subject)[1];

  // wrong code, then right code
  r = await call('auth/verify-otp', { method: 'POST', body: { phone: '9915424411', otp: code === '1111' ? '2222' : '1111' } });
  assert.equal(r.status, 401);
  r = await call('auth/verify-otp', { method: 'POST', body: { phone: '9915424411', otp: code } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.user.role, 'admin');
  assert.equal(r.json.user.company.name, 'TARAhut');
  assert.equal(r.json.user.platformAdmin, true);
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
  assert.equal(r.json.staff.length, 1); // only the admin's own company
  assert.equal(r.json.staff.find((s) => s.id === 'admin1').today.checkIn !== '—', true);

  // add staff: validation, success, duplicate
  assert.equal((await call('staff/index', { method: 'POST', token, body: { name: 'A', phone: '9876543210' } })).status, 400);
  r = await call('staff/index', { method: 'POST', token, body: { name: 'Typo', phone: '9800000001', email: 'typo@gmail.con' } });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /did you mean typo@gmail\.com/);
  assert.equal((await call('staff/index', { method: 'POST', token, body: { name: 'Typo', phone: '9800000001', email: 'typo@gmial.com' } })).json.message, 'Check the email: did you mean typo@gmail.com?');
  r = await call('staff/index', { method: 'POST', token, body: { name: 'Asha Rani', phone: '98765 43210', email: 'Asha@Example.com', department: 'Sales', designation: 'Exec', salaryType: 'monthly', salary: 25000 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.staff.email, 'asha@example.com');
  assert.equal(r.json.invited, true);
  assert.match(sentEmails.at(-1).subject, /added to TARAhut on TARAhut Haazri/);
  assert.equal(sentEmails.at(-1).to, 'asha@example.com');
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

  // ---- companies ----
  // only the platform admin manages companies
  assert.equal((await call('companies/index', { token: revToken })).status, 403);
  assert.equal((await call('companies/index', { method: 'POST', token, body: { name: 'Majaf Fabrics' } })).status, 400);
  assert.equal((await call('companies/index', { method: 'POST', token, body: { name: 'X', adminName: 'Y', adminPhone: '9876543210', adminEmail: 'y@example.com' } })).status, 409);
  const orgsBefore = tables.organizations.length;
  r = await call('companies/index', { method: 'POST', token, body: { name: 'Majaf Fabrics', adminName: 'Majaf Owner', adminPhone: '9811111111', adminEmail: 'owner@majaf.example' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(tables.organizations.length, orgsBefore + 1);
  assert.equal(r.json.admin.company.name, 'Majaf Fabrics');
  r = await call('companies/index', { token });
  assert.equal(r.json.companies.find((c) => c.name === 'Majaf Fabrics').staffCount, 1);

  // the new company's admin signs in and sees only their own company
  await call('auth/login', { method: 'POST', body: { phone: '9811111111' } });
  const mCode = /(\d{4}) is your/.exec(sentEmails.at(-1).subject)[1];
  r = await call('auth/verify-otp', { method: 'POST', body: { phone: '9811111111', otp: mCode } });
  assert.equal(r.json.user.company.name, 'Majaf Fabrics');
  assert.equal(r.json.user.platformAdmin, undefined);
  const mToken = r.json.token;
  assert.equal((await call('companies/index', { token: mToken })).status, 403);
  r = await call('staff/index', { token: mToken });
  assert.deepEqual(r.json.staff.map((x) => x.name), ['Majaf Owner']);
  // cannot read or review another company's people or attendance
  assert.equal((await call('staff/[id]/index', { token: mToken, query: { id: 'admin1' } })).status, 404);
  assert.equal((await call('staff/[id]/attendance', { token: mToken, query: { id: 'admin1' } })).json.records.length, 0);
  assert.equal((await call('attendance/[id]/approve', { method: 'PUT', token: mToken, query: { id: attId } })).status, 404);
  // staff they add belong to their company
  r = await call('staff/index', { method: 'POST', token: mToken, body: { name: 'Majaf Staff', phone: '9822222222', email: 'staff@majaf.example' } });
  assert.equal(r.status, 200);
  assert.equal(tables.staff.find((x) => x.phone === '9822222222').org_id, tables.staff.find((x) => x.phone === '9811111111').org_id);

  // company settings: admin can set the late time; staff cannot
  r = await call('company', { method: 'PATCH', token: mToken, body: { lateAfterMinutes: 600 } });
  assert.equal(r.json.lateAfterMinutes, 600);
  assert.equal((await call('company', { method: 'PATCH', token: revToken, body: { lateAfterMinutes: 1 } })).status, 403);
  assert.equal((await call('company', { method: 'PATCH', token: mToken, body: { lateAfterMinutes: 2000 } })).status, 400);
  assert.equal((await call('company', { token: revToken })).json.name, 'Demo Company');

  // ---- dashboard: reports ----
  assert.equal((await call('reports/day', { token: revToken })).status, 403);
  r = await call('reports/day', { token });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const me = r.json.staff.find((x) => x.id === 'admin1');
  assert.ok(['present', 'late'].includes(me.status));
  assert.match(me.checkInSelfie, /^https:\/\/signed/);
  // added today, not in yet (or the weekly off, Sunday, when the tests run on a Sunday)
  const sundayToday = new Date(Date.now() + 330 * 60000).getUTCDay() === 0;
  assert.equal(r.json.staff.find((x) => x.name === 'Asha Rani').status, sundayToday ? 'off' : 'pending');
  assert.equal(r.json.summary.total, r.json.staff.length);
  assert.ok(!r.json.staff.some((x) => x.name === 'Majaf Owner')); // other company
  assert.equal((await call('reports/day', { token, query: { date: '10-10-2026' } })).status, 400);
  r = await call('reports/day', { token, query: { date: '2025-12-31' } });
  assert.equal(r.json.staff.length, 0); // nobody had joined yet

  r = await call('reports/month', { token });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const myRow = r.json.staff.find((x) => x.id === 'admin1');
  assert.ok(['present', 'late'].includes(myRow.days[today].status));
  assert.equal(r.json.days.length >= 28, true);
  assert.equal((await call('reports/month', { token, query: { month: '2026-13' } })).status, 400);
  r = await call('reports/month', { token, query: { month: '2026-02' } });
  const feb = r.json.staff.find((x) => x.id === 'admin1');
  assert.equal(feb.days['2026-02-01'].status, 'off'); // a Sunday, weekly off
  assert.equal(feb.days['2026-02-02'].status, 'absent');
  assert.equal(feb.totals.off, 4);
  assert.equal(feb.totals.absent, 24);

  // ---- dashboard: editing staff ----
  const asha = tables.staff.find((x) => x.phone === '9876543210');
  assert.equal((await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { email: 'a@gmail.con' } })).status, 400);
  r = await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { designation: 'Senior Exec', name: 'Asha R' } });
  assert.equal(r.status, 200); assert.equal(r.json.staff.designation, 'Senior Exec'); assert.equal(r.json.staff.name, 'Asha R');
  assert.equal((await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { phone: '9915424411' } })).status, 409);
  assert.equal((await call('staff/[id]/index', { method: 'PATCH', token, query: { id: 'admin1' }, body: { active: false } })).status, 400);
  assert.equal((await call('staff/[id]/index', { method: 'PATCH', token: mToken, query: { id: asha.id }, body: { name: 'x' } })).status, 404);
  assert.equal((await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { active: false } })).status, 200);
  assert.ok(!(await call('staff/index', { token })).json.staff.some((x) => x.id === asha.id));
  assert.ok((await call('staff/index', { token, query: { include: 'inactive' } })).json.staff.some((x) => x.id === asha.id && x.active === false));
  assert.equal((await call('staff/[id]/invite', { method: 'POST', token, query: { id: asha.id } })).status, 400);
  await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { active: true } });
  const before2 = sentEmails.length;
  assert.equal((await call('staff/[id]/invite', { method: 'POST', token, query: { id: asha.id } })).status, 200);
  assert.equal(sentEmails.length, before2 + 1);

  // ---- dashboard: company settings ----
  assert.equal((await call('company', { method: 'PATCH', token, body: { weeklyOff: 7 } })).status, 400);
  r = await call('company', { method: 'PATCH', token, body: { weeklyOff: 6 } });
  assert.equal(r.json.weeklyOff, 6);
  assert.equal((await call('company', { method: 'PATCH', token, body: { weeklyOff: null } })).json.weeklyOff, null);

  // ---- location lock ----
  assert.equal((await call('company', { method: 'PATCH', token, body: { office: { lat: 30.2110, lng: 74.9455, radiusM: 10 } } })).status, 400);
  assert.equal((await call('company', { method: 'PATCH', token, body: { office: { lat: 'x', lng: 74.9, radiusM: 200 } } })).status, 400);
  r = await call('company', { method: 'PATCH', token, body: { office: { lat: 30.2110, lng: 74.9455, radiusM: 200 } } });
  assert.deepEqual(r.json.office, { lat: 30.2110, lng: 74.9455, radiusM: 200 });
  await call('auth/login', { method: 'POST', body: { phone: asha.phone } });
  const aCode = /(\d{4}) is your/.exec(sentEmails.at(-1).subject)[1];
  const aToken = (await call('auth/verify-otp', { method: 'POST', body: { phone: asha.phone, otp: aCode } })).json.token;
  assert.equal((await call('company', { token: aToken })).json.lockApplies, true);
  // ~1.1 km away: refused, nothing saved
  const far = { selfie, latitude: 30.2210, longitude: 74.9455, accuracy: 20, address: 'Elsewhere' };
  r = await call('attendance/check-in', { method: 'POST', token: aToken, body: far });
  assert.equal(r.status, 403); assert.match(r.json.message, /1\.1 km from the office/);
  // no location at all: refused
  assert.equal((await call('attendance/check-in', { method: 'POST', token: aToken, body: { selfie } })).status, 400);
  assert.ok(!tables.attendance.some((x) => x.staff_id === asha.id));
  // 230 m away with 40 m GPS accuracy: allowed (accuracy gives up to 50 m of room)
  r = await call('attendance/check-in', { method: 'POST', token: aToken, body: { selfie, latitude: 30.21307, longitude: 74.9455, accuracy: 40 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const aRow = tables.attendance.find((x) => x.staff_id === asha.id);
  assert.ok(aRow.check_in_distance_m > 200 && aRow.check_in_distance_m < 250);
  // check-out is never blocked, distance recorded
  assert.equal((await call('attendance/check-out', { method: 'POST', token: aToken, body: far })).status, 200);
  assert.ok(tables.attendance.find((x) => x.staff_id === asha.id).check_out_distance_m > 1000);
  r = await call('reports/day', { token });
  const aDay = r.json.staff.find((x) => x.id === asha.id);
  assert.equal(aDay.checkInDistance, aRow.check_in_distance_m); assert.equal(r.json.office.radiusM, 200);
  // field staff may check in anywhere
  r = await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { locationFree: true } });
  assert.equal(r.json.staff.locationFree, true);
  assert.equal((await call('company', { token: aToken })).json.lockApplies, false);
  tables.attendance = tables.attendance.filter((x) => x.staff_id !== asha.id);
  assert.equal((await call('attendance/check-in', { method: 'POST', token: aToken, body: far })).status, 200);
  // turning the lock off
  r = await call('company', { method: 'PATCH', token, body: { office: null } });
  assert.equal(r.json.office, null);

  // ---- leave requests ----
  await call('company', { method: 'PATCH', token, body: { weeklyOff: 0 } }); // Sunday off again
  const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const plus = (n) => new Date(Date.now() + 330 * 60000 + n * 86400000).toISOString().slice(0, 10);
  assert.equal((await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(3), to: plus(1), type: 'casual' } })).status, 400);
  assert.equal((await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(1), to: plus(2), type: 'holiday' } })).status, 400);
  assert.equal((await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(-40), to: plus(-40), type: 'sick' } })).status, 400);
  assert.equal((await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(1), to: plus(70), type: 'paid' } })).status, 400);
  const mailsBefore = sentEmails.length;
  r = await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(1), to: plus(7), type: 'casual', reason: 'Family wedding' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.request.status, 'pending');
  assert.equal(r.json.request.days, 6); // 7 days minus one Sunday (weekly off)
  const leaveId = r.json.request.id;
  assert.equal(sentEmails.length, mailsBefore + 1); // the admin
  assert.match(sentEmails.at(-1).subject, /Asha R asked for leave/);
  // overlapping request refused
  assert.equal((await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(7), to: plus(9), type: 'sick' } })).status, 409);
  assert.equal((await call('leave/index', { token: aToken })).json.requests.length, 1);
  // admin view: staff can't, other company can't decide
  assert.equal((await call('leave/company', { token: aToken })).status, 403);
  r = await call('leave/company', { token });
  assert.equal(r.json.pending.length, 1); assert.equal(r.json.pending[0].staffName, 'Asha R');
  assert.equal((await call('leave/[id]/decide', { method: 'POST', token: mToken, query: { id: leaveId }, body: { approve: true } })).status, 404); // other company
  assert.equal((await call('leave/[id]/decide', { method: 'POST', token, query: { id: leaveId }, body: {} })).status, 400);
  r = await call('leave/[id]/decide', { method: 'POST', token, query: { id: leaveId }, body: { approve: true, note: 'Enjoy' } });
  assert.equal(r.status, 200); assert.equal(r.json.request.status, 'approved');
  assert.match(sentEmails.at(-1).subject, /was approved/); assert.equal(sentEmails.at(-1).to, asha.email);
  // reports show leave (unless it's the weekly off)
  const day1 = plus(1);
  r = await call('reports/day', { token, query: { date: day1 } });
  const expected = new Date(`${day1}T00:00:00Z`).getUTCDay() === 0 ? 'off' : 'leave';
  assert.equal(r.json.staff.find((x) => x.id === asha.id).status, expected);
  r = await call('reports/month', { token, query: { month: day1.slice(0, 7) } });
  assert.equal(r.json.staff.find((x) => x.id === asha.id).days[day1].status, expected);
  // cancel: approved future leave can be withdrawn by its owner only
  assert.equal((await call('leave/[id]/cancel', { method: 'POST', token, query: { id: leaveId } })).status, 404);
  r = await call('leave/[id]/cancel', { method: 'POST', token: aToken, query: { id: leaveId } });
  assert.equal(r.json.request.status, 'cancelled');
  assert.equal((await call('leave/[id]/decide', { method: 'POST', token, query: { id: leaveId }, body: { approve: true } })).status, 409);
  // after cancelling, the same days can be asked for again; leave that already started can't be cancelled
  r = await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(-2), to: plus(2), type: 'sick' } });
  assert.equal(r.status, 200);
  await call('leave/[id]/decide', { method: 'POST', token, query: { id: r.json.request.id }, body: { approve: true } });
  assert.equal((await call('leave/[id]/cancel', { method: 'POST', token: aToken, query: { id: r.json.request.id } })).status, 409);
  assert.ok(istToday());

  // ---- salary ----
  assert.equal((await call('reports/salary', { token: aToken })).status, 403);
  r = await call('staff/[id]/index', { method: 'PATCH', token, query: { id: 'admin1' }, body: { salaryType: 'monthly', salary: 28000 } });
  assert.equal(r.json.staff.salaryType, 'monthly');
  assert.equal((await call('company', { method: 'PATCH', token, body: { lateCutEvery: 1 } })).status, 400);
  assert.equal((await call('company', { method: 'PATCH', token, body: { lateCutEvery: 3 } })).json.lateCutEvery, 3);
  r = await call('reports/salary', { token, query: { month: '2026-02' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const owner = r.json.staff.find((x) => x.id === 'admin1');
  assert.equal(owner.payDays, 4); assert.equal(owner.pay, 4000); // Feb 2026: 4 Sundays paid, 24 days absent
  // a future month counts nothing yet
  const next = new Date(Date.now() + 330 * 60000 + 40 * 86400000).toISOString().slice(0, 7);
  r = await call('reports/salary', { token, query: { month: next } });
  assert.equal(r.json.staff.find((x) => x.id === 'admin1').pay, 0); // future Sundays are not paid yet
  assert.equal(r.json.inProgress, false); assert.equal(r.json.lateCutEvery, 3);
  const ashaPay = r.json.staff.find((x) => x.id === asha.id);
  assert.equal(ashaPay.pay, 0); assert.equal(ashaPay.payDays, 0); // joined after February
  await call('company', { method: 'PATCH', token, body: { lateCutEvery: null } });

  // ---- shifts, night shifts, half days, missed check-out ----
  assert.equal((await call('shifts/index', { token: aToken })).status, 403);
  assert.equal((await call('shifts/index', { method: 'POST', token, body: { name: 'Bad', start: '25:00', end: '06:00' } })).status, 400);
  r = await call('shifts/index', { method: 'POST', token, body: { name: 'Night', start: '22:00', end: '06:00' } });
  assert.equal(r.status, 200); assert.equal(r.json.shift.lateAfter, '22:15'); assert.equal(r.json.shift.overnight, true);
  const nightId = r.json.shift.id;
  assert.equal((await call('shifts/index', { method: 'POST', token, body: { name: 'night', start: '21:00', end: '05:00' } })).status, 409);
  r = await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { shiftId: 'not-ours' } });
  assert.equal(r.status, 400);
  r = await call('staff/[id]/index', { method: 'PATCH', token, query: { id: asha.id }, body: { shiftId: nightId } });
  assert.equal(r.json.staff.shiftId, nightId);
  assert.equal((await call('shifts/index', { token })).json.shifts[0].staffCount, 1);
  // a night shift that started yesterday evening is still "today" for the app, blocks a new check-in, and checks out
  tables.attendance = tables.attendance.filter((x) => x.staff_id !== asha.id);
  const istNow = new Date(Date.now() + 330 * 60000);
  const yesterday = new Date(istNow.getTime() - 86400000).toISOString().slice(0, 10);
  tables.attendance.push({ id: 'night1', org_id: 'org1', staff_id: asha.id, date: yesterday, status: 'present', approval: 'pending',
    check_in_at: new Date(Date.now() - 8 * 3600000).toISOString(), check_out_at: null, worked_minutes: null });
  r = await call('attendance/today', { token: aToken });
  assert.equal(r.json.id, 'night1'); assert.equal(r.json.checkedOut, false);
  assert.equal((await call('attendance/check-in', { method: 'POST', token: aToken, body: { selfie } })).status, 409);
  assert.equal((await call('attendance/check-out', { method: 'POST', token: aToken, body: { selfie } })).status, 200);
  const night1 = tables.attendance.find((x) => x.id === 'night1');
  assert.ok(night1.check_out_at); assert.ok(night1.worked_minutes >= 479 && night1.worked_minutes <= 481);
  // missed check-out: flagged, then an admin fills it in
  tables.attendance.push({ id: 'miss1', org_id: 'org1', staff_id: asha.id, date: '2026-10-05', status: 'present', approval: 'pending',
    check_in_at: '2026-10-05T03:30:00Z', check_out_at: null, worked_minutes: null }); // 09:00 IST
  r = await call('reports/day', { token, query: { date: '2026-10-05' } });
  assert.equal(r.json.staff.find((x) => x.id === asha.id).noCheckOut, true);
  assert.equal((await call('attendance/[id]/index', { method: 'PATCH', token: aToken, query: { id: 'miss1' }, body: { checkOut: '13:00' } })).status, 403);
  assert.equal((await call('attendance/[id]/index', { method: 'PATCH', token, query: { id: 'miss1' }, body: { checkOut: '1pm' } })).status, 400);
  r = await call('attendance/[id]/index', { method: 'PATCH', token, query: { id: 'miss1' }, body: { checkOut: '12:00' } });
  assert.equal(r.json.workedMinutes, 180);
  // half day: under 4 hours
  assert.equal((await call('company', { method: 'PATCH', token, body: { halfDayMinutes: 30 } })).status, 400);
  assert.equal((await call('company', { method: 'PATCH', token, body: { halfDayMinutes: 240 } })).json.halfDayMinutes, 240);
  r = await call('reports/day', { token, query: { date: '2026-10-05' } });
  const fixed = r.json.staff.find((x) => x.id === asha.id);
  assert.equal(fixed.status, 'half'); assert.equal(fixed.noCheckOut, false); assert.equal(fixed.checkOutSetByAdmin, true);
  assert.equal(fixed.shift, 'Night');
  r = await call('reports/month', { token, query: { month: '2026-10' } });
  assert.equal(r.json.staff.find((x) => x.id === asha.id).days['2026-10-05'].status, 'half');
  assert.equal(r.json.staff.find((x) => x.id === asha.id).totals.half, 1);
  // deleting a shift moves people back to the company's late time
  assert.equal((await call('shifts/[id]', { method: 'DELETE', token, query: { id: nightId } })).status, 200);
  assert.equal(tables.staff.find((x) => x.id === asha.id).shift_id, null);
  await call('company', { method: 'PATCH', token, body: { halfDayMinutes: null } });

  // ---- admins add / correct / remove a day ----
  assert.equal((await call('attendance/index', { method: 'POST', token: aToken, body: { staffId: asha.id, date: '2026-10-06', checkIn: '09:40' } })).status, 403);
  assert.equal((await call('attendance/index', { method: 'POST', token, body: { staffId: asha.id, date: '2099-01-01', checkIn: '09:40' } })).status, 400);
  assert.equal((await call('attendance/index', { method: 'POST', token, body: { staffId: 'm1x', date: '2026-10-06', checkIn: '09:40' } })).status, 404);
  assert.equal((await call('attendance/index', { method: 'POST', token, body: { staffId: asha.id, date: '2026-10-06', checkIn: '9.40am' } })).status, 400);
  r = await call('attendance/index', { method: 'POST', token, body: { staffId: asha.id, date: '2026-10-06', checkIn: '09:40', checkOut: '18:00', note: 'Phone battery dead' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.status, 'late'); assert.equal(r.json.workedMinutes, 500); // company late time 09:15
  const addedId = r.json.id;
  assert.equal((await call('attendance/index', { method: 'POST', token, body: { staffId: asha.id, date: '2026-10-06', checkIn: '09:00' } })).status, 409);
  r = await call('reports/day', { token, query: { date: '2026-10-06' } });
  let a6 = r.json.staff.find((x) => x.id === asha.id);
  assert.equal(a6.addedByAdmin, true); assert.equal(a6.note, 'Phone battery dead'); assert.equal(a6.checkIn, '09:40');
  r = await call('reports/month', { token, query: { month: '2026-10' } });
  assert.equal(r.json.staff.find((x) => x.id === asha.id).days['2026-10-06'].id, addedId);
  assert.equal(r.json.staff.find((x) => x.id === asha.id).days['2026-10-06'].edited, true);
  // correct the check-in: on time now, hours worked out again
  r = await call('attendance/[id]/index', { method: 'PATCH', token, query: { id: addedId }, body: { checkIn: '09:00' } });
  assert.equal(r.json.status, 'present'); assert.equal(r.json.workedMinutes, 540);
  // clear the check-out
  r = await call('attendance/[id]/index', { method: 'PATCH', token, query: { id: addedId }, body: { checkOut: '' } });
  assert.equal(tables.attendance.find((x) => x.id === addedId).check_out_at, null);
  assert.equal((await call('attendance/[id]/index', { method: 'PATCH', token, query: { id: addedId }, body: {} })).status, 400);
  // remove it
  assert.equal((await call('attendance/[id]/index', { method: 'DELETE', token: aToken, query: { id: addedId } })).status, 403);
  assert.equal((await call('attendance/[id]/index', { method: 'DELETE', token, query: { id: addedId } })).status, 200);
  r = await call('reports/day', { token, query: { date: '2026-10-06' } });
  assert.ok(!r.json.staff.some((x) => x.id === asha.id)); // gone again (she joined after that day)
  assert.ok(!tables.attendance.some((x) => x.id === addedId));

  // ---- the app: my month, push notifications ----
  r = await call('attendance/month', { token, query: { month: '2026-02' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.days.length, 28); assert.equal(r.json.days[0].status, 'off'); assert.equal(r.json.days[1].status, 'absent');
  assert.equal(r.json.totals.off, 4); assert.equal(r.json.totals.absent, 24);
  r = await call('attendance/month', { token: aToken });
  assert.ok(r.json.days.some((d) => d.status === 'pending' || d.status === 'off' || d.status === 'before'));
  assert.equal((await call('attendance/month', { token: aToken, query: { month: '2026-13' } })).status, 400);
  assert.equal((await call('push/register', { method: 'POST', token, body: { token: 'nope' } })).status, 400);
  assert.equal((await call('push/register', { method: 'POST', token, body: { token: 'ExponentPushToken[admin-phone]', platform: 'ios' } })).status, 200);
  assert.equal((await call('push/register', { method: 'POST', token, body: { token: 'ExponentPushToken[admin-gone]', platform: 'ios' } })).status, 200);
  assert.equal((await call('push/register', { method: 'POST', token: aToken, body: { token: 'ExponentPushToken[asha-phone]' } })).status, 200);
  // a phone moves to whoever signs in on it
  await call('push/register', { method: 'POST', token: aToken, body: { token: 'ExponentPushToken[shared]' } });
  await call('push/register', { method: 'POST', token, body: { token: 'ExponentPushToken[shared]' } });
  assert.equal(tables.push_tokens.find((t) => t.token === 'ExponentPushToken[shared]').staff_id, 'admin1');
  // leave request -> admin's phones; decision -> the person's phone; dead tokens are dropped
  const pushesBefore = sentPushes.length;
  r = await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(20), to: plus(20), type: 'paid' } });
  const toAdmin = sentPushes.slice(pushesBefore);
  assert.deepEqual(toAdmin.map((m) => m.to).sort(), ['ExponentPushToken[admin-gone]', 'ExponentPushToken[admin-phone]', 'ExponentPushToken[shared]']);
  assert.match(toAdmin[0].body, /Asha R asked for paid leave/);
  assert.ok(!tables.push_tokens.some((t) => t.token === 'ExponentPushToken[admin-gone]'));
  await call('leave/[id]/decide', { method: 'POST', token, query: { id: r.json.request.id }, body: { approve: false, note: 'Audit week' } });
  assert.equal(sentPushes.at(-1).to, 'ExponentPushToken[asha-phone]'); assert.match(sentPushes.at(-1).body, /not approved: Audit week/);
  assert.equal((await call('push/unregister', { method: 'POST', token: aToken, body: { token: 'ExponentPushToken[asha-phone]' } })).status, 200);
  assert.ok(!tables.push_tokens.some((t) => t.token === 'ExponentPushToken[asha-phone]'));
  assert.equal((await call('company', { token })).json.myShift, null);

  // ---- holidays ----
  assert.equal((await call('holidays/index', { method: 'POST', token: aToken, body: { date: '2026-02-16', name: 'X' } })).status, 403);
  assert.equal((await call('holidays/index', { method: 'POST', token, body: { date: 'soon', name: 'X' } })).status, 400);
  assert.equal((await call('holidays/index', { method: 'POST', token, body: { date: '2026-02-16' } })).status, 400);
  r = await call('holidays/index', { method: 'POST', token, body: { date: '2026-02-16', name: 'Test holiday' } });
  assert.equal(r.status, 200); const holId = r.json.holiday.id;
  assert.equal((await call('holidays/index', { method: 'POST', token, body: { date: '2026-02-16', name: 'Again' } })).status, 409);
  assert.equal((await call('holidays/index', { token: aToken, query: { year: '2026' } })).json.holidays.length, 1); // staff can see them
  r = await call('reports/day', { token, query: { date: '2026-02-16' } });
  assert.equal(r.json.holiday, 'Test holiday'); assert.equal(r.json.staff.find((x) => x.id === 'admin1').status, 'holiday');
  r = await call('reports/month', { token, query: { month: '2026-02' } });
  const febOwner = r.json.staff.find((x) => x.id === 'admin1');
  assert.equal(febOwner.days['2026-02-16'].status, 'holiday'); assert.equal(febOwner.days['2026-02-16'].holiday, 'Test holiday');
  assert.equal(febOwner.totals.holiday, 1); assert.equal(febOwner.totals.absent, 23);
  r = await call('reports/salary', { token, query: { month: '2026-02' } });
  assert.equal(r.json.staff.find((x) => x.id === 'admin1').pay, 5000); // 4 Sundays + 1 holiday paid at 28000/28
  r = await call('attendance/month', { token, query: { month: '2026-02' } });
  assert.equal(r.json.days[15].status, 'holiday'); assert.equal(r.json.days[15].holiday, 'Test holiday');
  // holidays don't use up leave days
  const hDate = plus(40);
  await call('holidays/index', { method: 'POST', token, body: { date: hDate, name: 'Festival' } });
  r = await call('leave/index', { method: 'POST', token: aToken, body: { from: plus(39), to: plus(41), type: 'casual' } });
  const span = [plus(39), plus(40), plus(41)];
  const expectedDays = span.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0 && d !== hDate).length;
  assert.equal(r.json.request.days, expectedDays);
  assert.equal((await call('holidays/[id]', { method: 'DELETE', token: aToken, query: { id: holId } })).status, 403);
  assert.equal((await call('holidays/[id]', { method: 'DELETE', token, query: { id: holId } })).status, 200);
  assert.equal((await call('reports/day', { token, query: { date: '2026-02-16' } })).json.staff.find((x) => x.id === 'admin1').status, 'absent');

  // pausing a company locks its users out
  const majafId = tables.organizations.find((o) => o.name === 'Majaf Fabrics').id;
  assert.equal((await call('companies/[id]', { method: 'PATCH', token, query: { id: majafId }, body: { active: false } })).status, 200);
  assert.equal((await call('attendance/today', { token: mToken })).status, 401);
});

test('account deletion', async () => {
  const { issueToken } = await import(`${B}/lib/auth.js`);
  tables.staff.push({ id: 'del1', created_at: '2026-01-01T00:00:00Z', org_id: 'org1', name: 'Gone Person', phone: '9888800001', email: 'gone@example.com', role: 'staff', active: true });
  tables.attendance.push({ id: 'att-del', staff_id: 'del1', date: '2026-03-02', check_in_at: '2026-03-02T04:00:00Z', check_in_selfie: 'del1/a.jpg', check_out_selfie: 'del1/b.jpg', check_in_lat: 30.1, check_in_lng: 75.2, check_in_address: 'Somewhere', worked_minutes: 480 });
  tables.push_tokens.push({ token: 'ExponentPushToken[del]', staff_id: 'del1' });
  tables.leave_requests.push({ id: 'lv-del', staff_id: 'del1', org_id: 'org1', reason: 'family', status: 'approved' });
  const token = issueToken('del1');
  sentEmails.length = 0;

  let r = await call('account/delete', { method: 'POST', token });
  assert.equal(r.status, 200); assert.match(r.json.eraseBy, /^\d{4}-\d{2}-\d{2}$/);
  const s = tables.staff.find((x) => x.id === 'del1');
  assert.equal(s.active, false); assert.ok(s.deletion_requested_at);
  assert.equal(tables.push_tokens.filter((t) => t.staff_id === 'del1').length, 0);
  assert.ok(sentEmails.some((e) => e.to.includes('support@tarahutaibuilds.com') && e.to.includes('owner@example.com')));
  assert.ok(sentEmails.some((e) => e.to === 'gone@example.com'));
  assert.equal((await call('attendance/today', { token })).status, 401); // signed out everywhere
  assert.equal((await call('auth/login', { method: 'POST', body: { phone: '9888800001' } })).status, 404);
  // an admin can't switch a deleted account back on
  const ownerToken = issueToken('admin1');
  assert.equal((await call('staff/[id]/index', { method: 'PATCH', token: ownerToken, query: { id: 'del1' }, body: { active: true } })).status, 409);

  // the demo account used by app reviewers stays on
  r = await call('account/delete', { method: 'POST', token: issueToken('rev1') });
  assert.equal(r.json.demo, true); assert.equal(tables.staff.find((x) => x.id === 'rev1').active, true);
  const { isReviewPhone } = await import(`${B}/lib/otp.js`);
  assert.equal(isReviewPhone('9000000002'), true); assert.equal(isReviewPhone('9000000003'), false);

  // the daily job: needs the cron secret, and erases only after 30 days
  assert.equal((await call('cron/erase-accounts')).status, 401);
  process.env.CRON_SECRET = 'c'.repeat(32);
  const cron = async () => {
    const mod = await import(`${B}/api/cron/erase-accounts.js`);
    let out; const res = { status(c) { out = { status: c }; return this; }, json(j) { out.json = j; return this; } };
    await mod.default({ method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, res);
    return out;
  };
  assert.equal((await cron()).json.erased, 0);
  s.deletion_requested_at = new Date(Date.now() - 31 * 86_400_000).toISOString();
  assert.equal((await cron()).json.erased, 1);
  assert.equal(s.name, 'Deleted user'); assert.equal(s.email, null); assert.notEqual(s.phone, '9888800001'); assert.ok(s.erased_at);
  const a = tables.attendance.find((x) => x.id === 'att-del');
  assert.equal(a.check_in_selfie, null); assert.equal(a.check_in_lat, null); assert.equal(a.check_in_address, null);
  assert.equal(a.worked_minutes, 480); // hours kept for payroll
  assert.deepEqual(removed.filter((p) => p.startsWith('del1/')).sort(), ['del1/a.jpg', 'del1/b.jpg']);
  assert.equal(tables.leave_requests.find((x) => x.id === 'lv-del').reason, null);
  assert.equal((await cron()).json.due, 0); // not erased twice
});

test('salary adjustments and closing a month', async () => {
  const { issueToken } = await import(`${B}/lib/auth.js`);
  tables.organizations.push({ id: 'mc', name: 'Month Close Co', late_after_minutes: 600, weekly_off: 0, active: true });
  tables.staff.push({ id: 'mcA', org_id: 'mc', name: 'Asha', phone: '9777700001', role: 'admin', active: true, created_at: '2026-08-01T00:00:00Z', salary_type: 'monthly', salary: 30000 });
  tables.staff.push({ id: 'mcB', org_id: 'mc', name: 'Bilal', phone: '9777700002', role: 'staff', active: true, created_at: '2026-08-01T00:00:00Z', salary_type: 'daily', salary: 700 });
  const token = issueToken('mcA');
  // September 2026: 30 days, Sundays 6, 13, 20, 27. Asha is in every working day except the 15th.
  for (let d = 1; d <= 30; d++) {
    const date = `2026-09-${String(d).padStart(2, '0')}`;
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
    if (d !== 15) tables.attendance.push({ id: `mcA-${d}`, org_id: 'mc', staff_id: 'mcA', date, status: 'present', check_in_at: `${date}T03:30:00Z`, check_out_at: `${date}T11:30:00Z`, worked_minutes: 480 });
    if (d <= 10) tables.attendance.push({ id: `mcB-${d}`, org_id: 'mc', staff_id: 'mcB', date, status: 'present', check_in_at: `${date}T03:30:00Z`, check_out_at: d === 10 ? null : `${date}T11:30:00Z`, worked_minutes: d === 10 ? null : 480 });
  }

  // Hand-checked: Asha 25 worked + 4 Sundays = 29 paid days × 30000/30 = ₹29,000; advance ₹5,000, bonus ₹1,000 -> ₹25,000.
  // Bilal: 9 days (1st-10th less Sunday the 6th) × ₹700 = ₹6,300.
  let r = await call('pay-adjustments/index', { method: 'POST', token, body: { staffId: 'mcA', month: '2026-09', kind: 'advance', amount: 5000, note: 'Diwali shopping' } });
  assert.equal(r.status, 200);
  await call('pay-adjustments/index', { method: 'POST', token, body: { staffId: 'mcA', month: '2026-09', kind: 'bonus', amount: 1000 } });
  const wrongId = (await call('pay-adjustments/index', { method: 'POST', token, body: { staffId: 'mcA', month: '2026-09', kind: 'deduction', amount: 50 } })).json.id;
  assert.equal((await call('pay-adjustments/[id]', { method: 'DELETE', token, query: { id: wrongId } })).status, 200);
  assert.equal((await call('pay-adjustments/index', { method: 'POST', token, body: { staffId: 'mcA', month: '2026-09', kind: 'tip', amount: 5 } })).status, 400);
  assert.equal((await call('pay-adjustments/index', { method: 'POST', token, body: { staffId: 'mcA', month: '2026-09', kind: 'bonus', amount: -5 } })).status, 400);
  assert.equal((await call('pay-adjustments/index', { method: 'POST', token, body: { staffId: 'admin1', month: '2026-09', kind: 'bonus', amount: 5 } })).status, 404); // other company

  r = await call('reports/salary', { token, query: { month: '2026-09' } });
  let asha = r.json.staff.find((p) => p.id === 'mcA'); const bilal = r.json.staff.find((p) => p.id === 'mcB');
  assert.equal(asha.pay, 29000); assert.equal(asha.adjustmentTotal, -4000); assert.equal(asha.payable, 25000);
  assert.deepEqual(asha.adjustments.map((a) => [a.kind, a.signed]).sort(), [['advance', -5000], ['bonus', 1000]]); // same-millisecond inserts may come back in either order
  assert.equal(bilal.pay, 6300); assert.equal(bilal.payable, 6300);
  assert.equal(r.json.payableTotal, 31300); assert.equal(r.json.closed, null);

  // before closing: Bilal's 10th has no check-out
  r = await call('month-close/index', { token, query: { month: '2026-09' } });
  assert.equal(r.json.ended, true); assert.equal(r.json.closed, false);
  assert.deepEqual(r.json.missingCheckOuts.map((x) => [x.name, x.date]), [['Bilal', '2026-09-10']]);
  assert.equal((await call('month-close/index', { method: 'POST', token, body: { month: '2026-10' } })).status, 400); // not over yet

  r = await call('month-close/index', { method: 'POST', token, body: { month: '2026-09' } });
  assert.equal(r.status, 200); assert.equal(r.json.payableTotal, 31300);
  assert.equal((await call('month-close/index', { method: 'POST', token, body: { month: '2026-09' } })).status, 409);

  // later changes don't touch the closed sheet...
  tables.staff.find((x) => x.id === 'mcA').salary = 60000;
  tables.organizations.find((o) => o.id === 'mc').weekly_off = 1;
  r = await call('reports/salary', { token, query: { month: '2026-09' } });
  asha = r.json.staff.find((p) => p.id === 'mcA');
  assert.equal(asha.pay, 29000); assert.equal(asha.salary, 30000); assert.equal(asha.payable, 25000);
  assert.equal(r.json.closed.by, 'Asha'); assert.equal(r.json.log.length, 1);
  // ...and the month can't be changed while closed
  const locked = [
    await call('attendance/index', { method: 'POST', token, body: { staffId: 'mcA', date: '2026-09-15', checkIn: '09:00' } }),
    await call('attendance/[id]/index', { method: 'PATCH', token, query: { id: 'mcB-10' }, body: { checkOut: '18:00' } }),
    await call('attendance/[id]/index', { method: 'DELETE', token, query: { id: 'mcA-1' } }),
    await call('pay-adjustments/index', { method: 'POST', token, body: { staffId: 'mcA', month: '2026-09', kind: 'bonus', amount: 1 } }),
    await call('holidays/index', { method: 'POST', token, body: { date: '2026-09-21', name: 'Late add' } }),
  ];
  for (const x of locked) { assert.equal(x.status, 409); assert.match(x.json.message, /September 2026 is closed/); }

  // reopening needs a reason, is logged, and goes back to live numbers
  assert.equal((await call('month-close/reopen', { method: 'POST', token, body: { month: '2026-09' } })).status, 400);
  assert.equal((await call('month-close/reopen', { method: 'POST', token, body: { month: '2026-09', reason: 'Missed check-out for Bilal' } })).status, 200);
  assert.equal((await call('attendance/[id]/index', { method: 'PATCH', token, query: { id: 'mcB-10' }, body: { checkOut: '18:00' } })).status, 200);
  r = await call('reports/salary', { token, query: { month: '2026-09' } });
  assert.equal(r.json.closed, null);
  assert.deepEqual(r.json.log.map((l) => [l.action, l.by, l.reason ?? null]), [['closed', 'Asha', null], ['reopened', 'Asha', 'Missed check-out for Bilal']]);
  assert.equal(r.json.staff.find((p) => p.id === 'mcA').salary, 60000); // live again
  assert.equal((await call('month-close/reopen', { method: 'POST', token, body: { month: '2026-09', reason: 'again' } })).status, 409);
  // staff can't see salaries or close months
  assert.equal((await call('reports/salary', { token: issueToken('mcB'), query: { month: '2026-09' } })).status, 403);
  assert.equal((await call('month-close/index', { method: 'POST', token: issueToken('mcB'), body: { month: '2026-09' } })).status, 403);
});

test('salary examples checked by hand', async () => {
  const { issueToken } = await import(`${B}/lib/auth.js`);
  // August 2026: 31 days, Sundays 2, 9, 16, 23, 30. Weekly off Sunday, half day under 4 hours.
  tables.organizations.push({ id: 'hc', name: 'Hand Check', late_after_minutes: 600, weekly_off: 0, half_day_minutes: 240, active: true });
  tables.shifts.push({ id: 'night', org_id: 'hc', name: 'Night', start_minutes: 1320, end_minutes: 360, late_after_minutes: 1335 });
  const person = (id, extra) => tables.staff.push({ id, org_id: 'hc', name: id, phone: `96666${String(tables.staff.length).padStart(5, '0')}`, role: 'staff', active: true, created_at: '2026-07-01T00:00:00Z', salary_type: 'monthly', salary: 31000, ...extra });
  tables.staff.push({ id: 'hcAdmin', org_id: 'hc', name: 'Owner', phone: '9666600000', role: 'admin', active: true, created_at: '2026-07-01T00:00:00Z' });
  person('Joiner', { created_at: '2026-08-17T04:00:00Z' });            // joined 17 Aug
  person('Leaver', { active: false, left_on: '2026-08-10' });          // switched off 10 Aug
  person('Halfday');
  person('Night', { salary_type: 'daily', salary: 800, shift_id: 'night' });
  const day = (id, date, inIst = '09:30', outIst = '18:00') => {
    const inAt = new Date(`${date}T${inIst}:00+05:30`); let outAt = new Date(`${date}T${outIst}:00+05:30`);
    if (outAt <= inAt) outAt = new Date(outAt.getTime() + 86_400_000);
    tables.attendance.push({ id: `${id}-${date}`, org_id: 'hc', staff_id: id, date, status: 'present', check_in_at: inAt.toISOString(), check_out_at: outAt.toISOString(), worked_minutes: Math.round((outAt - inAt) / 60000) });
  };
  for (let d = 1; d <= 31; d++) {
    const date = `2026-08-${String(d).padStart(2, '0')}`;
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
    if (d >= 17) day('Joiner', date);
    if (d <= 10) day('Leaver', date);
    day('Halfday', date, '09:30', d === 12 ? '12:50' : '18:00'); // 12 Aug: 3h 20m = half day
  }
  day('Night', '2026-08-03', '22:00', '06:00');
  day('Night', '2026-08-04', '22:00', '06:00');
  const token = issueToken('hcAdmin');
  // a night shift added by the admin, 15 minutes after the late time: late, 7h 30m
  let r = await call('attendance/index', { method: 'POST', token, body: { staffId: 'Night', date: '2026-08-05', checkIn: '22:30', checkOut: '06:00' } });
  assert.equal(r.status, 200); assert.equal(r.json.status, 'late'); assert.equal(r.json.workedMinutes, 450);

  r = await call('reports/salary', { token, query: { month: '2026-08' } });
  const p = Object.fromEntries(r.json.staff.map((x) => [x.id, x]));
  // Joiner: 17-31 Aug = 13 working days + 2 Sundays = 15 paid days × 31000/31 = 15,000; nothing before joining is absent
  assert.equal(p.Joiner.payDays, 15); assert.equal(p.Joiner.absent, 0); assert.equal(p.Joiner.pay, 15000);
  // Leaver: 1-10 Aug = 8 working days + 2 Sundays = 10 paid days = 10,000; days after leaving aren't absent
  assert.equal(p.Leaver.payDays, 10); assert.equal(p.Leaver.absent, 0); assert.equal(p.Leaver.pay, 10000); assert.equal(p.Leaver.leftOn, '2026-08-10');
  // Halfday: 25 full + 1 half = 25.5 worked + 5 Sundays = 30.5 paid days = 30,500
  assert.equal(p.Halfday.half, 1); assert.equal(p.Halfday.payDays, 30.5); assert.equal(p.Halfday.pay, 30500);
  // Night: 3 nights × ₹800 (one of them late, no late cut set) = 2,400
  assert.equal(p.Night.worked, 3); assert.equal(p.Night.late, 1); assert.equal(p.Night.pay, 2400);
  // the monthly sheet shows the leaver's days after leaving as "left", the joiner's before joining as "before"
  r = await call('reports/month', { token, query: { month: '2026-08' } });
  const sheet = Object.fromEntries(r.json.staff.map((x) => [x.id, x]));
  assert.equal(sheet.Leaver.days['2026-08-11'].status, 'left'); assert.equal(sheet.Joiner.days['2026-08-16'].status, 'before');

  // switching someone off records the day they left; switching back on clears it
  r = await call('staff/[id]/index', { method: 'PATCH', token, query: { id: 'Halfday' }, body: { active: false } });
  const istToday = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  assert.equal(tables.staff.find((x) => x.id === 'Halfday').left_on, istToday);
  await call('staff/[id]/index', { method: 'PATCH', token, query: { id: 'Halfday' }, body: { active: true } });
  assert.equal(tables.staff.find((x) => x.id === 'Halfday').left_on, null);
  // someone who left before the month isn't on it
  r = await call('reports/salary', { token, query: { month: '2026-09' } });
  assert.equal(r.json.staff.some((x) => x.id === 'Leaver'), false);
});

test('attendance correction requests', async () => {
  const { issueToken } = await import(`${B}/lib/auth.js`);
  const ist = (n) => new Date(Date.now() + 330 * 60000 + n * 86_400_000).toISOString().slice(0, 10);
  tables.organizations.push({ id: 'cr', name: 'Correct Co', late_after_minutes: 600, weekly_off: null, active: true });
  tables.staff.push({ id: 'crAdmin', org_id: 'cr', name: 'Boss', phone: '9555500000', email: 'boss@example.com', role: 'admin', active: true, created_at: '2026-01-01T00:00:00Z' });
  tables.staff.push({ id: 'crStaff', org_id: 'cr', name: 'Ravi', phone: '9555500001', email: 'ravi@example.com', role: 'staff', active: true, created_at: '2026-01-01T00:00:00Z' });
  const staff = issueToken('crStaff'); const admin = issueToken('crAdmin');
  tables.push_tokens.push({ token: 'ExponentPushToken[ravi]', staff_id: 'crStaff' });
  const y = ist(-1); const y2 = ist(-2); const y3 = ist(-3);
  // yesterday: checked in, forgot to check out
  tables.attendance.push({ id: 'cr-y', org_id: 'cr', staff_id: 'crStaff', date: y, status: 'late', check_in_at: new Date(`${y}T10:20:00+05:30`).toISOString(), check_out_at: null, worked_minutes: null });

  const ask = (b, t = staff) => call('corrections/index', { method: 'POST', token: t, body: b });
  assert.equal((await ask({ date: ist(1), kind: 'missed_check_in', checkIn: '09:00', reason: 'Forgot' })).status, 400); // future
  assert.equal((await ask({ date: y, kind: 'missed_check_out', reason: 'Forgot' })).status, 400); // no time
  assert.equal((await ask({ date: y, kind: 'missed_check_out', checkOut: '18:30', reason: 'x' })).status, 400); // no reason
  assert.equal((await ask({ date: ist(-60), kind: 'missed_check_in', checkIn: '09:00', reason: 'Long ago' })).status, 400);
  sentEmails.length = 0; sentPushes.length = 0;
  let r = await ask({ date: y, kind: 'missed_check_out', checkOut: '18:30', reason: 'Phone battery died' });
  assert.equal(r.status, 200); const outReq = r.json.request.id;
  assert.ok(sentEmails.some((e) => e.to === 'boss@example.com' && /correction/.test(e.subject)));
  assert.equal((await ask({ date: y, kind: 'wrong_time', checkIn: '10:00', reason: 'Again' })).status, 409); // one waiting per day
  r = await ask({ date: y2, kind: 'missed_check_in', checkIn: '09:10', checkOut: '18:00', reason: 'App would not open' });
  const inReq = r.json.request.id;
  const cancelReq = (await ask({ date: y3, kind: 'missed_check_in', checkIn: '09:00', reason: 'Testing' })).json.request.id;

  // the owner sees them; staff can't decide; other companies can't see them
  r = await call('corrections/company', { token: admin });
  assert.deepEqual(r.json.pending.map((x) => x.staffName), ['Ravi', 'Ravi', 'Ravi']);
  assert.equal((await call('corrections/[id]/decide', { method: 'POST', token: staff, query: { id: outReq }, body: { approve: true } })).status, 403);
  assert.equal((await call('corrections/[id]/decide', { method: 'POST', token: issueToken('mcA'), query: { id: outReq }, body: { approve: true } })).status, 404);
  // they show up in the month-close check
  r = await call('month-close/index', { token: admin, query: { month: y.slice(0, 7) } });
  assert.ok(r.json.pendingCorrections.some((x) => x.date === y));

  // approve the missed check-out: check-out added, check-in and late mark kept
  r = await call('corrections/[id]/decide', { method: 'POST', token: admin, query: { id: outReq }, body: { approve: true } });
  assert.equal(r.status, 200); assert.equal(r.json.request.status, 'approved');
  const yRow = tables.attendance.find((a) => a.id === 'cr-y');
  assert.equal(yRow.worked_minutes, 490); assert.equal(yRow.status, 'late'); assert.equal(yRow.check_out_edited_by, 'crAdmin');
  assert.match(yRow.admin_note, /Correction: Phone battery died/);
  assert.ok(sentPushes.some((m) => m.title === 'Correction approved'));
  // approve the missed day: a new record is added
  await call('corrections/[id]/decide', { method: 'POST', token: admin, query: { id: inReq }, body: { approve: true } });
  const y2Row = tables.attendance.find((a) => a.staff_id === 'crStaff' && a.date === y2);
  assert.equal(y2Row.worked_minutes, 530); assert.equal(y2Row.status, 'present'); assert.equal(y2Row.check_in_edited_by, 'crAdmin');
  // decisions are final; withdraw only while waiting
  assert.equal((await call('corrections/[id]/decide', { method: 'POST', token: admin, query: { id: inReq }, body: { approve: false } })).status, 409);
  assert.equal((await call('corrections/[id]/cancel', { method: 'POST', token: staff, query: { id: inReq } })).status, 409);
  assert.equal((await call('corrections/[id]/cancel', { method: 'POST', token: staff, query: { id: cancelReq } })).status, 200);
  // reject with a note
  const rej = (await ask({ date: y3, kind: 'missed_check_in', checkIn: '09:00', reason: 'Came in' })).json.request.id;
  r = await call('corrections/[id]/decide', { method: 'POST', token: admin, query: { id: rej }, body: { approve: false, note: 'You were on leave' } });
  assert.equal(r.json.request.status, 'rejected'); assert.equal(tables.attendance.some((a) => a.staff_id === 'crStaff' && a.date === y3), false);
  r = await call('corrections/index', { token: staff });
  assert.deepEqual(r.json.requests.map((x) => x.status).sort(), ['approved', 'approved', 'cancelled', 'rejected']);
});

test('self sign-up', async () => {
  const { issueToken } = await import(`${B}/lib/auth.js`);
  const su = (b) => call('signup', { method: 'POST', body: b });
  assert.equal((await call('signup')).status, 405);
  assert.equal((await su({ company: 'Kiran Traders', name: 'Kiran', phone: '98' })).status, 400);
  assert.equal((await su({ company: 'Kiran Traders', name: 'Kiran', phone: '9833333333', email: 'kiran@gmial.com' })).status, 400);
  // an existing phone points to sign-in instead
  let r = await su({ company: 'X', name: 'Y', phone: '9915424411', email: 'y@example.com' });
  assert.equal(r.status, 409); assert.match(r.json.message, /sign in/);
  // bots that fill the hidden field get a fake success and nothing is made
  const orgs = tables.organizations.length;
  r = await su({ company: 'Spam', name: 'Spam', phone: '9844444444', email: 's@example.com', website: 'http://spam' });
  assert.equal(r.status, 200); assert.equal(tables.organizations.length, orgs);

  const mails = sentEmails.length;
  r = await su({ company: ' Kiran Traders ', name: 'Kiran Kumar', phone: '+91 98333 33333', email: 'Kiran@Example.com' });
  assert.equal(r.status, 200); assert.equal(r.json.invited, true); assert.equal(r.json.company.name, 'Kiran Traders');
  const owner = tables.staff.find((s) => s.phone === '9833333333');
  assert.equal(owner.role, 'admin'); assert.equal(owner.email, 'kiran@example.com'); assert.ok(!owner.is_platform_admin);
  assert.equal(owner.org_id, r.json.company.id);
  assert.equal(sentEmails.length, mails + 2);
  assert.equal(sentEmails[mails].to, 'kiran@example.com'); assert.match(sentEmails[mails].text, /You are the admin of Kiran Traders/);
  assert.equal(sentEmails[mails + 1].to, 'support@example.com'); assert.match(sentEmails[mails + 1].subject, /New sign-up: Kiran Traders/);

  // the new admin can sign in and sees only their own company
  const token = issueToken(owner.id);
  r = await call('staff/index', { token });
  assert.equal(r.status, 200); assert.deepEqual(r.json.staff.map((s) => s.phone), ['9833333333']);
  assert.equal((await call('companies/index', { token })).status, 403);

  // too many sign-ups in an hour are refused
  const now = new Date().toISOString();
  for (let i = 0; i < 20; i++) tables.organizations.push({ id: `flood${i}`, name: 'F', created_at: now });
  assert.equal((await su({ company: 'Late', name: 'Late', phone: '9855555555', email: 'l@example.com' })).status, 429);
  tables.organizations = tables.organizations.filter((o) => !o.id.startsWith('flood'));
});

test('sign-in code on WhatsApp', async () => {
  process.env.WHATSAPP_TOKEN = 'wa-token'; process.env.WHATSAPP_PHONE_ID = '1234'; process.env.WHATSAPP_TEMPLATE = 'haazri_code';
  try {
    tables.staff.push({ id: 'wa1', org_id: 'org1', name: 'Wa Staff', phone: '9866666666', email: 'wa@example.com', role: 'staff', active: true });
    tables.staff.push({ id: 'wa2', org_id: 'org1', name: 'No Mail', phone: '9877777777', email: null, role: 'staff', active: true });
    const mails = sentEmails.length;
    // both channels: WhatsApp and email carry the same code
    let r = await call('auth/login', { method: 'POST', body: { phone: '9866666666' } });
    assert.equal(r.status, 200); assert.equal(r.json.channel, 'whatsapp+email');
    assert.equal(r.json.sentTo, 'WhatsApp +91 ******6666 and wa**@example.com');
    const msg = sentWhatsApps.at(-1);
    assert.equal(msg.url, 'https://graph.facebook.com/v23.0/1234/messages'); assert.equal(msg.auth, 'Bearer wa-token');
    assert.equal(msg.to, '919866666666'); assert.equal(msg.template.name, 'haazri_code');
    const code = msg.template.components[0].parameters[0].text;
    assert.equal(msg.template.components[1].parameters[0].text, code);
    assert.equal(sentEmails.length, mails + 1); assert.match(sentEmails.at(-1).subject, new RegExp(`^${code} is your`));
    assert.equal((await call('auth/verify-otp', { method: 'POST', body: { phone: '9866666666', otp: code } })).status, 200);
    // no email saved: WhatsApp alone is enough
    r = await call('auth/login', { method: 'POST', body: { phone: '9877777777' } });
    assert.equal(r.status, 200); assert.equal(r.json.channel, 'whatsapp'); assert.equal(r.json.sentTo, 'WhatsApp +91 ******7777');
    // WhatsApp refused: email still delivers; with no email either, the request fails
    whatsAppDown = true;
    r = await call('auth/login', { method: 'POST', body: { phone: '9866666666' } });
    assert.equal(r.status, 200); assert.equal(r.json.channel, 'email');
    assert.equal((await call('auth/login', { method: 'POST', body: { phone: '9877777777' } })).status, 502);
    // review accounts never get a message
    const waCount = sentWhatsApps.length;
    whatsAppDown = false;
    r = await call('auth/login', { method: 'POST', body: { phone: '9000000001' } });
    assert.equal(r.json.channel, 'review'); assert.equal(sentWhatsApps.length, waCount);
  } finally {
    whatsAppDown = false;
    delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_ID; delete process.env.WHATSAPP_TEMPLATE;
  }
});

test('WhatsApp webhook', async () => {
  const mod = await import(`${B}/api/whatsapp/webhook.js`);
  const hit = async (req) => {
    let status = 0, sent;
    const res = { setHeader() {}, status(s) { status = s; return this; }, send(b) { sent = b; return this; } };
    await mod.default({ headers: {}, query: {}, ...req }, res);
    return { status, sent };
  };
  process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me';
  try {
    const ok = await hit({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '42' } });
    assert.equal(ok.status, 200); assert.equal(ok.sent, '42');
    assert.equal((await hit({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '42' } })).status, 403);
    const body = { entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.x', status: 'failed', recipient_id: '919915424411', errors: [{ code: 131026, title: 'Message undeliverable' }] }] } }] }] };
    assert.equal((await hit({ method: 'POST', body })).status, 200);
  } finally {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
  }
});

test('overtime, leave balance, payslips and daily summary', async () => {
  const { issueToken } = await import(`${B}/lib/auth.js`);
  const { monthPay } = await import(`${B}/lib/payroll.js`);
  // hourly pay already covers every hour once: overtime adds only the extra (rate − 1)
  const t = { present: 1, late: 0, half: 0, absent: 0, off: 0, holiday: 0, paidLeave: 0, unpaidLeave: 0, minutes: 600, overtimeMinutes: 120 };
  assert.equal(monthPay({ salaryType: 'hourly', salary: 100, totals: t, daysInMonth: 30, overtimeRate: 2 }).overtimePay, 200);
  assert.equal(monthPay({ salaryType: 'daily', salary: 800, totals: t, daysInMonth: 30, overtimeRate: 1.5 }).overtimePay, 300);
  assert.equal(monthPay({ salaryType: 'daily', salary: 800, totals: t, daysInMonth: 30 }).overtimePay, 0);

  tables.organizations.push({ id: 'ft', name: 'Feature Co', late_after_minutes: 555, weekly_off: null, active: true });
  tables.shifts.push({ id: 'ftDay', org_id: 'ft', name: 'Day', start_minutes: 540, end_minutes: 1080, late_after_minutes: 555 });
  tables.staff.push(
    { id: 'ftAdmin', org_id: 'ft', name: 'Feature Admin', phone: '9811100001', email: 'fa@example.com', role: 'admin', active: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'ftWorker', org_id: 'ft', name: 'Worker One', phone: '9811100002', email: 'w1@example.com', role: 'staff', active: true, created_at: '2026-01-01T00:00:00Z', salary_type: 'monthly', salary: 30000 },
    { id: 'ftShift', org_id: 'ft', name: 'Shift Worker', phone: '9811100003', email: 'w2@example.com', role: 'staff', active: true, created_at: '2026-01-01T00:00:00Z', salary_type: 'daily', salary: 900, shift_id: 'ftDay' },
    { id: 'ftNew', org_id: 'ft', name: 'New Joiner', phone: '9811100004', email: 'w3@example.com', role: 'staff', active: true, created_at: '2026-07-15T00:00:00Z' },
  );
  const admin = issueToken('ftAdmin'); const worker = issueToken('ftWorker'); const newbie = issueToken('ftNew');
  const att = (id, staff, date, minutes) => tables.attendance.push({ id, org_id: 'ft', staff_id: staff, date, status: 'present', approval: 'approved',
    check_in_at: `${date}T03:30:00Z`, check_out_at: `${date}T13:00:00Z`, worked_minutes: minutes });
  att('ot1', 'ftWorker', '2026-09-01', 600); // 2 h over 8 h
  att('ot2', 'ftWorker', '2026-09-02', 490); // 10 min: under the 15-minute grace
  att('ot3', 'ftWorker', '2026-09-03', 540); // 1 h
  att('ot4', 'ftShift', '2026-09-01', 600); // 1 h over the 9-hour shift

  // ---- overtime settings and pay ----
  assert.equal((await call('company', { method: 'PATCH', token: admin, body: { overtimeRate: 5 } })).status, 400);
  assert.equal((await call('company', { method: 'PATCH', token: worker, body: { overtimeRate: 1.5 } })).status, 403);
  let r = await call('company', { method: 'PATCH', token: admin, body: { overtimeRate: 1.5, overtimeAfterMinutes: 480, paidLeavePerYear: 12, dailySummary: true } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.overtimeRate, 1.5); assert.equal(r.json.paidLeavePerYear, 12); assert.equal(r.json.dailySummary, true);
  r = await call('reports/salary', { token: admin, query: { month: '2026-09' } });
  const w = r.json.staff.find((p) => p.id === 'ftWorker');
  assert.equal(w.overtimeHours, 3);
  assert.equal(w.overtimePay, 563); // 30000 ÷ 30 days ÷ 8 h = 125/h × 1.5 × 3 h
  assert.equal(w.pay, Math.round(1000 * w.payDays) + 563);
  const sw = r.json.staff.find((p) => p.id === 'ftShift');
  assert.equal(sw.overtimeHours, 1); assert.equal(sw.overtimePay, 150); // 900 ÷ 9 h × 1.5
  assert.equal(r.json.overtimeRate, 1.5);

  // ---- paid leave balance ----
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const month = Number(today.slice(5, 7));
  const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  r = await call('leave/index', { token: worker });
  assert.equal(r.json.balance.limited, true); assert.equal(r.json.balance.earned, month); assert.equal(r.json.balance.available, month);
  r = await call('leave/index', { token: newbie });
  const joinedThisYear = today.slice(0, 4) === '2026';
  assert.equal(r.json.balance.earned, joinedThisYear ? Math.max(0, month - 6) : month);
  // more paid leave than earned is refused; unpaid leave is not limited
  r = await call('leave/index', { method: 'POST', token: worker, body: { from: addDays(today, 1), to: addDays(today, month + 1), type: 'casual' } });
  assert.equal(r.status, 400); assert.match(r.json.message, /paid leave days? left/);
  assert.equal((await call('leave/index', { method: 'POST', token: worker, body: { from: addDays(today, 1), to: addDays(today, month + 1), type: 'unpaid' } })).status, 200);
  r = await call('leave/index', { method: 'POST', token: worker, body: { from: addDays(today, month + 3), to: addDays(today, month + 3), type: 'sick' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('leave/index', { token: worker });
  const pendingThisYear = addDays(today, month + 3).slice(0, 4) === today.slice(0, 4) ? 1 : 0;
  assert.equal(r.json.balance.pending, pendingThisYear); assert.equal(r.json.balance.available, month - pendingThisYear);
  r = await call('leave/company', { token: admin });
  assert.ok(r.json.pending.every((p) => p.balance && p.balance.limited));

  // ---- payslips ----
  r = await call('payslips/index', { token: worker, query: { month: '2026-09' } });
  assert.equal(r.status, 404); // staff see slips only for closed months
  r = await call('payslips/index', { token: admin, query: { month: '2026-09', staffId: 'ftWorker' } });
  assert.equal(r.status, 200); assert.equal(r.json.slip.closed, false); assert.equal(r.json.slip.overtimePay, 563);
  assert.equal((await call('payslips/index', { token: admin, query: { month: '2026-09', staffId: 'admin1' } })).status, 404); // other company
  assert.equal((await call('month-close/index', { method: 'POST', token: admin, body: { month: '2026-09' } })).status, 200);
  r = await call('payslips/index', { token: worker });
  assert.deepEqual(r.json.payslips.map((p) => p.month), ['2026-09']); assert.equal(r.json.payslips[0].payable, w.payable);
  r = await call('payslips/index', { token: worker, query: { month: '2026-09', staffId: 'ftShift' } }); // staff can't open someone else's
  assert.equal(r.json.slip.staffId, 'ftWorker'); assert.equal(r.json.slip.closed, true);
  assert.equal(r.json.slip.earned + r.json.slip.overtimePay, w.pay);
  const link = r.json.link; assert.match(link, /^https:\/\/haazri\.tarahutaibuilds\.com\/payslip\?t=/);
  const token = new URL(link).searchParams.get('t');
  const view = await import(`${B}/api/payslips/view.js`);
  const open = async (t) => {
    let status = 0, html = '';
    await view.default({ query: { t } }, { setHeader() {}, status(s) { status = s; return this; }, send(b) { html = b; return this; } });
    return { status, html };
  };
  let v = await open(token);
  assert.equal(v.status, 200); assert.match(v.html, /Worker One/); assert.match(v.html, /Overtime/); assert.match(v.html, /Net payable/);
  assert.match(v.html, /\+91 \*\*\*\*\*\*0002/); assert.doesNotMatch(v.html, /9811100002/);
  assert.equal((await open(`${token.slice(0, -2)}xx`)).status, 404); // altered
  assert.equal((await open(worker)).status, 404); // a sign-in token is not a payslip link
  assert.equal((await call('auth/profile', { token })).status, 401); // and a payslip link is not a sign-in token

  // ---- daily WhatsApp summary ----
  const cron = await import(`${B}/api/cron/daily-summary.js`);
  const runCron = async (auth) => {
    let status = 0, json;
    await cron.default({ headers: auth ? { authorization: auth } : {} }, { status(s) { status = s; return this; }, json(j) { json = j; return this; } });
    return { status, json };
  };
  process.env.CRON_SECRET = 'c'.repeat(32);
  assert.equal((await runCron()).status, 401);
  assert.match((await runCron(`Bearer ${process.env.CRON_SECRET}`)).json.skipped, /template not set/);
  Object.assign(process.env, { WHATSAPP_TOKEN: 'wa-token', WHATSAPP_PHONE_ID: '1234', WHATSAPP_TEMPLATE: 'haazri_code', WHATSAPP_SUMMARY_TEMPLATE: 'haazri_daily_summary' });
  try {
    att('today1', 'ftWorker', today, 0);
    tables.attendance.find((a) => a.id === 'today1').check_out_at = null;
    const before = sentWhatsApps.length;
    r = await runCron(`Bearer ${process.env.CRON_SECRET}`);
    assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.sent, 1);
    const msgs = sentWhatsApps.slice(before);
    assert.equal(msgs.length, 1); assert.equal(msgs[0].to, '919811100001'); assert.equal(msgs[0].template.name, 'haazri_daily_summary');
    assert.deepEqual(msgs[0].template.components[0].parameters.map((p) => p.text).filter((_, i) => i !== 1), ['Feature Co', '1', '0', '3', '0']);
  } finally {
    for (const k of ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_TEMPLATE', 'WHATSAPP_SUMMARY_TEMPLATE']) delete process.env[k];
  }
});

test('face match on check-in', async () => {
  const { issueToken } = await import(`${B}/lib/auth.js`);
  tables.organizations.push({ id: 'fm', name: 'Face Co', late_after_minutes: 1439, weekly_off: null, active: true, face_match: true });
  tables.staff.push(
    { id: 'fmAdmin', org_id: 'fm', name: 'Face Admin', phone: '9822200001', email: 'fa@example.com', role: 'admin', active: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'fmStaff', org_id: 'fm', name: 'Face Staff', phone: '9822200002', email: 'fs@example.com', role: 'staff', active: true, created_at: '2026-01-01T00:00:00Z' },
  );
  const admin = issueToken('fmAdmin'); const staff = issueToken('fmStaff');
  const pic = (t) => Buffer.from(`jpeg ${t}`).toString('base64');
  const checkIn = (t) => call('attendance/check-in', { method: 'POST', token: staff, body: { selfie: pic(t), latitude: 30.7, longitude: 76.7, address: 'Test' } });
  const reset = () => { tables.attendance = tables.attendance.filter((a) => a.staff_id !== 'fmStaff'); };
  const row = () => tables.attendance.find((a) => a.staff_id === 'fmStaff');

  // keys not set: no check, nothing recorded
  let r = await checkIn('one');
  assert.equal(r.status, 200); assert.equal(row().check_in_face, undefined); assert.equal(rekognitionCalls.length, 0);
  reset();
  Object.assign(process.env, { REKOGNITION_ACCESS_KEY_ID: 'AKIATEST', REKOGNITION_SECRET_ACCESS_KEY: 'secret' });
  try {
    // first selfie becomes the saved photo
    r = await checkIn('first');
    assert.equal(r.status, 200); assert.equal(row().check_in_face, 'enrolled'); assert.equal(rekognitionCalls.length, 0);
    const me = tables.staff.find((s) => s.id === 'fmStaff');
    assert.equal(me.face_ref, 'fmStaff/face-reference.jpg'); assert.equal(stored.get(me.face_ref).toString(), 'jpeg first');
    // a match
    reset(); r = await checkIn('second');
    assert.equal(row().check_in_face, 'match'); assert.equal(row().check_in_face_score, 98.6);
    const c = rekognitionCalls.at(-1);
    assert.equal(c.url, 'https://rekognition.ap-south-1.amazonaws.com/'); assert.equal(c.headers['x-amz-target'], 'RekognitionService.CompareFaces');
    assert.match(c.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIATEST\/\d{8}\/ap-south-1\/rekognition\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/);
    assert.equal(Buffer.from(c.body.SourceImage.Bytes, 'base64').toString(), 'jpeg first');
    assert.equal(Buffer.from(c.body.TargetImage.Bytes, 'base64').toString(), 'jpeg second');
    // someone else: refused twice (no photo kept), the 3rd try in a row goes through flagged and admins are told
    rekognitionReply = { FaceMatches: [{ Similarity: 41.2 }], UnmatchedFaces: [{}] };
    tables.push_tokens.push({ id: 'fmTok', staff_id: 'fmAdmin', token: 'ExponentPushToken[fm-admin]' });
    reset(); const pushes = sentPushes.length; const files = stored.size;
    r = await checkIn('other');
    assert.equal(r.status, 422); assert.equal(r.json.code, 'face'); assert.equal(r.json.tries, 1); assert.match(r.json.message, /try 1 of 3/);
    assert.equal(row(), undefined); assert.equal(stored.size, files);
    r = await checkIn('other'); assert.equal(r.status, 422); assert.equal(r.json.tries, 2);
    assert.equal(sentPushes.length, pushes);
    r = await checkIn('other');
    assert.equal(r.status, 200); assert.equal(row().check_in_face, 'mismatch'); assert.equal(row().check_in_face_score, 41.2);
    assert.ok(sentPushes.slice(pushes).some((m) => m.title === 'Face did not match' && m.to === 'ExponentPushToken[fm-admin]' && /after 3 tries/.test(m.body)));
    assert.equal(tables.staff.find((s) => s.id === 'fmStaff').face_fails, 0);
    // a match in between starts the count again
    reset(); await checkIn('other'); rekognitionReply = { FaceMatches: [{ Similarity: 97 }], UnmatchedFaces: [] };
    r = await checkIn('me'); assert.equal(r.status, 200); assert.equal(tables.staff.find((s) => s.id === 'fmStaff').face_fails, 0);
    // a check-out never saves the reference photo: with none saved, it isn't checked
    tables.staff.find((s) => s.id === 'fmStaff').face_ref = null;
    const calls = rekognitionCalls.length;
    r = await call('attendance/check-out', { method: 'POST', token: staff, body: { selfie: pic('stranger'), latitude: 30.7, longitude: 76.7 } });
    assert.equal(r.status, 200); assert.equal(row().check_out_face, undefined); assert.equal(rekognitionCalls.length, calls);
    assert.equal(tables.staff.find((s) => s.id === 'fmStaff').face_ref, null);
    tables.staff.find((s) => s.id === 'fmStaff').face_ref = 'fmStaff/face-reference.jpg';
    row().check_out_at = undefined; row().check_out_selfie = undefined;
    // check-out is checked too
    rekognitionReply = { FaceMatches: [], UnmatchedFaces: [] };
    const checkOut = () => call('attendance/check-out', { method: 'POST', token: staff, body: { selfie: pic('out'), latitude: 30.7, longitude: 76.7 } });
    r = await checkOut(); assert.equal(r.status, 422); assert.match(r.json.message, /couldn't see your face/); assert.equal(row().check_out_at, undefined);
    rekognitionReply = { FaceMatches: [{ Similarity: 95 }], UnmatchedFaces: [] };
    r = await checkOut(); assert.equal(r.status, 200); assert.equal(row().check_out_face, 'match');
    // no face (or a saved photo Rekognition rejects) counts as a failed try; a Rekognition outage never blocks
    rekognitionReply = { status: 400, body: { __type: 'com.amazonaws#InvalidParameterException', message: 'no face in source' } };
    reset(); r = await checkIn('x'); assert.equal(r.status, 422);
    tables.staff.find((s) => s.id === 'fmStaff').face_fails = 0;
    rekognitionReply = { status: 500, body: { message: 'boom' } };
    reset(); r = await checkIn('y'); assert.equal(r.status, 200); assert.equal(row().check_in_face, 'error');
    rekognitionReply = { FaceMatches: [{ Similarity: 99 }], UnmatchedFaces: [] };
    // the admin sees the result on Today
    r = await call('reports/day', { token: admin });
    const p = r.json.staff.find((x) => x.id === 'fmStaff');
    assert.equal(p.face.result, 'error'); assert.match(p.face.savedPhoto, /face-reference\.jpg$/); assert.equal(p.faceOut, null);
    assert.equal(r.json.faceErrors, 1);
    assert.ok(r.json.staff.find((x) => x.id === 'fmAdmin').face === null);
    // admin resets the saved photo: the next selfie becomes the new one
    r = await call('staff/[id]/index', { method: 'PATCH', token: admin, query: { id: 'fmStaff' }, body: { faceReset: true } });
    assert.equal(r.status, 200); assert.equal(r.json.staff.faceSavedAt, null);
    assert.equal(tables.staff.find((s) => s.id === 'fmStaff').face_ref, null);
    reset(); await checkIn('new'); assert.equal(row().check_in_face, 'enrolled');
    // the store review account is flagged but never refused
    tables.organizations.find((o) => o.id === 'demo').face_match = true;
    tables.attendance = tables.attendance.filter((a) => a.staff_id !== 'rev1');
    rekognitionReply = { FaceMatches: [{ Similarity: 12 }], UnmatchedFaces: [{}] };
    tables.staff.find((s) => s.id === 'rev1').face_ref = null;
    r = await call('attendance/check-in', { method: 'POST', token: issueToken('rev1'), body: { selfie: pic('reviewer a'), latitude: 30.7, longitude: 76.7 } });
    assert.equal(r.status, 200); // first selfie saved
    tables.attendance = tables.attendance.filter((a) => a.staff_id !== 'rev1');
    r = await call('attendance/check-in', { method: 'POST', token: issueToken('rev1'), body: { selfie: pic('reviewer b'), latitude: 30.7, longitude: 76.7 } });
    assert.equal(r.status, 200); assert.equal(tables.attendance.find((a) => a.staff_id === 'rev1').check_in_face, 'mismatch');
    tables.organizations.find((o) => o.id === 'demo').face_match = false;
    // settings
    r = await call('company', { method: 'PATCH', token: admin, body: { faceMatch: false } });
    assert.equal(r.json.faceMatch, false);
  } finally {
    delete process.env.REKOGNITION_ACCESS_KEY_ID; delete process.env.REKOGNITION_SECRET_ACCESS_KEY;
  }
});
