// Runs every backend route against an in-memory stand-in for Supabase.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const B = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const tables = { organizations: [], staff: [], otp_codes: [], attendance: [], call_logs: [], leave_requests: [], shifts: [], push_tokens: [], holidays: [] };
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
    upload: async (path, buf) => { uploads.push({ path, size: buf.length }); return { error: null }; },
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

globalThis.fetch = async (url, init) => {
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
