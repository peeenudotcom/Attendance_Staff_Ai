// Runs every backend route against an in-memory stand-in for Supabase.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const B = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const tables = { organizations: [], staff: [], otp_codes: [], attendance: [], call_logs: [] };
const uploads = [];
const sentEmails = [];

class Q {
  constructor(t) { this.t = t; this.filters = []; this.op = 'select'; this.one = null; this.ret = false; }
  select(cols = '*') { this.ret = true; this.cols = cols; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  gte(k, v) { this.filters.push((r) => r[k] >= v); return this; }
  lte(k, v) { this.filters.push((r) => r[k] <= v); return this; }
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
      const r = { id: randomUUID(), active: true, approval: 'pending', created_at: new Date().toISOString(), ...this.row };
      if (this.t === 'staff' && rows.some((x) => x.phone === r.phone)) return { data: null, error: { code: '23505', message: 'dup' } };
      if (this.t === 'attendance' && rows.some((x) => x.staff_id === r.staff_id && x.date === r.date)) return { data: null, error: { code: '23505', message: 'dup' } };
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
process.env.REVIEW_PHONE = '9000000001';
process.env.REVIEW_CODE = '4826';

globalThis.fetch = async (url, init) => { sentEmails.push(JSON.parse(init.body)); return { ok: true, text: async () => '' }; };

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
  assert.equal(r.json.staff.find((x) => x.name === 'Asha Rani').status, 'pending'); // added today, not in yet
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

  // pausing a company locks its users out
  const majafId = tables.organizations.find((o) => o.name === 'Majaf Fabrics').id;
  assert.equal((await call('companies/[id]', { method: 'PATCH', token, query: { id: majafId }, body: { active: false } })).status, 200);
  assert.equal((await call('attendance/today', { token: mToken })).status, 401);
});
