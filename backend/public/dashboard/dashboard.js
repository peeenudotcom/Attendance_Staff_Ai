// Haazri owner dashboard. Plain ES module, no build step. Talks to the same /api the app uses.
// Everything user-supplied is rendered with textContent (via h()), never as HTML.

const TOKEN_KEY = 'haazri_dashboard_token';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS_LABEL = { present: 'Present', late: 'Late', absent: 'Absent', pending: 'Not in yet', off: 'Weekly off', before: '' };
const CELL = { present: 'P', late: 'L', absent: 'A', off: '·', pending: '', before: '' };

const $ = (id) => document.getElementById(id);
const state = { user: null, company: null, view: 'today', phone: '' };

// ---------- helpers ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const istMonth = () => istToday().slice(0, 7);
const minutesToHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const hhmmToMinutes = (s) => { const [a, b] = String(s).split(':').map(Number); return a * 60 + b; };
const fmtHours = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : '—');
const niceDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    signOut('Your session has ended. Please sign in again.');
    throw new Error('Signed out');
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

function loading(container) {
  container.replaceChildren(h('div', { class: 'empty' }, 'Loading…'));
}

function failed(container, err) {
  container.replaceChildren(h('div', { class: 'empty' }, err.message));
}

// ---------- modal ----------

function openModal(content, { photo = false } = {}) {
  const m = $('modal');
  const box = h('div', { class: photo ? 'modal-box photo-box' : 'modal-box' }, content);
  m.replaceChildren(box);
  m.classList.remove('hidden');
  m.onclick = (e) => { if (e.target === m) closeModal(); };
}
function closeModal() { $('modal').classList.add('hidden'); $('modal').replaceChildren(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function showPhoto(url, caption) {
  openModal([h('img', { src: url, alt: caption }), h('p', {}, caption)], { photo: true });
}

// ---------- auth ----------

function showAuth(message = '') {
  $('app').classList.add('hidden');
  $('auth').classList.remove('hidden');
  $('phone-form').classList.remove('hidden');
  $('code-form').classList.add('hidden');
  $('auth-hint').textContent = 'Sign in with your phone number';
  $('auth-msg').className = 'msg';
  $('auth-msg').textContent = message;
}

function signOut(message) {
  localStorage.removeItem(TOKEN_KEY);
  state.user = null;
  showAuth(message);
}

$('phone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  $('auth-msg').textContent = '';
  try {
    state.phone = $('phone').value.trim();
    const res = await api('/auth/login', { method: 'POST', body: { phone: state.phone } });
    $('phone-form').classList.add('hidden');
    $('code-form').classList.remove('hidden');
    $('auth-hint').textContent = `We sent a code to ${res.sentTo}`;
    $('code').value = '';
    $('code').focus();
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally { btn.disabled = false; }
});

$('code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  $('auth-msg').textContent = '';
  try {
    const res = await api('/auth/verify-otp', { method: 'POST', body: { phone: state.phone, otp: $('code').value.trim() } });
    if (res.user.role !== 'admin') {
      $('auth-msg').textContent = 'The dashboard is for company admins. Staff use the Haazri app.';
      return;
    }
    localStorage.setItem(TOKEN_KEY, res.token);
    await start();
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally { btn.disabled = false; }
});

$('change-phone').addEventListener('click', () => showAuth());
$('sign-out').addEventListener('click', () => signOut());

// ---------- shell ----------

async function start() {
  try {
    const user = await api('/auth/profile');
    if (user.role !== 'admin') return signOut('The dashboard is for company admins.');
    state.user = user;
    state.company = await api('/company');
  } catch (err) {
    if (err.message !== 'Signed out') signOut('Could not load your account. Please sign in again.');
    return;
  }
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('company-name').textContent = state.company.name;
  $('user-name').textContent = state.user.name;
  $('clients-tab').classList.toggle('hidden', !state.user.platformAdmin);
  const fromHash = location.hash.slice(1);
  show(VIEWS[fromHash] && (fromHash !== 'clients' || state.user.platformAdmin) ? fromHash : 'today');
}

function show(view) {
  state.view = view;
  history.replaceState(null, '', `#${view}`);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.view === view);
  VIEWS[view]($('view'));
}
$('tabs').addEventListener('click', (e) => { const v = e.target.dataset?.view; if (v) show(v); });

// ---------- Today ----------

async function viewToday(root, date = istToday()) {
  const picker = h('input', { type: 'date', value: date, max: istToday(), onchange: (e) => viewToday(root, e.target.value || istToday()) });
  const body = h('div');
  root.replaceChildren(
    h('div', { class: 'view-head' }, h('h2', {}, date === istToday() ? 'Today' : niceDate(date)), h('div', { class: 'spacer' }), picker,
      h('button', { class: 'btn ghost small', onclick: () => viewToday(root, date) }, 'Refresh')),
    body,
  );
  loading(body);
  let data;
  try { data = await api(`/reports/day?date=${date}`); } catch (err) { return failed(body, err); }

  const s = data.summary;
  const chip = (n, label, cls = '') => h('div', { class: `chip ${cls}` }, h('b', {}, n), h('span', {}, label));
  const chips = h('div', { class: 'chips' },
    chip(s.present + s.late, 'In', 'ok'), chip(s.late, 'Late', 'late'), chip(s.absent, 'Absent', 'abs'),
    date === istToday() ? chip(s.notYet, 'Not in yet') : null, chip(s.checkedOut, 'Checked out'), chip(s.total, 'Staff'));

  if (!data.staff.length) {
    return body.replaceChildren(chips, h('div', { class: 'card empty' }, s.off ? 'Weekly off.' : 'No staff yet. Add people in the Staff tab.'));
  }
  const order = { late: 0, present: 1, pending: 2, absent: 3, off: 4 };
  const rows = [...data.staff].sort((a, b) => (order[a.status] - order[b.status]) || a.name.localeCompare(b.name)).map((p) => {
    const place = p.checkInAddress || '';
    const mapLink = p.checkInLocation ? h('a', { href: `https://maps.google.com/?q=${p.checkInLocation.lat},${p.checkInLocation.lng}`, target: '_blank', rel: 'noopener' }, 'Map') : null;
    return h('tr', {},
      h('td', { class: 'person' }, h('b', {}, p.name), h('small', {}, p.designation || p.department || '')),
      h('td', {}, h('span', { class: `pill ${p.status}` }, STATUS_LABEL[p.status])),
      h('td', { class: 'num' }, p.checkIn), h('td', { class: 'num' }, p.checkOut), h('td', { class: 'num hide-sm' }, p.hours),
      h('td', { class: 'place hide-sm' }, place, place && mapLink ? ' · ' : '', mapLink),
      h('td', {}, h('div', { class: 'selfies' },
        p.checkInSelfie ? h('img', { src: p.checkInSelfie, alt: 'Check-in selfie', title: 'Check-in selfie', onclick: () => showPhoto(p.checkInSelfie, `${p.name} · check-in ${p.checkIn}`) }) : null,
        p.checkOutSelfie ? h('img', { src: p.checkOutSelfie, alt: 'Check-out selfie', title: 'Check-out selfie', onclick: () => showPhoto(p.checkOutSelfie, `${p.name} · check-out ${p.checkOut}`) }) : null)),
    );
  });
  body.replaceChildren(chips, h('div', { class: 'card scroll' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Status'), h('th', { class: 'num' }, 'In'), h('th', { class: 'num' }, 'Out'),
      h('th', { class: 'num hide-sm' }, 'Hours'), h('th', { class: 'hide-sm' }, 'Check-in place'), h('th', {}, 'Selfies'))),
    h('tbody', {}, rows))));
}

// ---------- Monthly sheet ----------

async function viewMonth(root, month = istMonth()) {
  const picker = h('input', { type: 'month', value: month, max: istMonth(), onchange: (e) => viewMonth(root, e.target.value || istMonth()) });
  const dl = h('button', { class: 'btn small', disabled: true }, 'Download for Excel');
  const body = h('div');
  root.replaceChildren(h('div', { class: 'view-head' }, h('h2', {}, 'Monthly sheet'), h('div', { class: 'spacer' }), picker, dl), body);
  loading(body);
  let data;
  try { data = await api(`/reports/month?month=${month}`); } catch (err) { return failed(body, err); }
  if (!data.staff.length) return body.replaceChildren(h('div', { class: 'card empty' }, 'No staff yet.'));

  const dayNum = (d) => Number(d.slice(8));
  const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
  const head = h('tr', {}, h('th', {}, 'Name'),
    data.days.map((d) => h('th', { class: `dow ${dow(d) === data.weeklyOff ? 'weekend' : ''}`, title: niceDate(d) }, dayNum(d), h('br'), DAYS[dow(d)][0])),
    h('th', { class: 'num' }, 'P'), h('th', { class: 'num' }, 'L'), h('th', { class: 'num' }, 'A'), h('th', { class: 'num' }, 'Hours'));
  const rows = data.staff.map((s) => h('tr', {},
    h('td', { class: 'person' }, h('b', {}, s.name), h('small', {}, s.designation || '')),
    data.days.map((d) => {
      const c = s.days[d];
      const tip = c.in ? `${STATUS_LABEL[c.status]} · in ${c.in}${c.out && c.out !== '—' ? `, out ${c.out}` : ''}` : STATUS_LABEL[c.status];
      return h('td', { title: tip ? `${niceDate(d)}: ${tip}` : null }, h('span', { class: `cell ${c.status}` }, CELL[c.status]));
    }),
    h('td', { class: 'num' }, s.totals.present), h('td', { class: 'num' }, s.totals.late), h('td', { class: 'num' }, s.totals.absent),
    h('td', { class: 'num' }, fmtHours(s.totals.minutes))));

  body.replaceChildren(
    h('div', { class: 'card scroll' }, h('table', { class: 'grid' }, h('thead', {}, head), h('tbody', {}, rows))),
    h('div', { class: 'legend' },
      h('span', {}, h('span', { class: 'cell present' }, 'P'), 'Present'), h('span', {}, h('span', { class: 'cell late' }, 'L'), 'Late (still counts as present)'),
      h('span', {}, h('span', { class: 'cell absent' }, 'A'), 'Absent'), h('span', {}, h('span', { class: 'cell off' }, '·'), 'Weekly off'),
      h('span', {}, 'Hover a day to see check-in and check-out times')),
  );
  dl.disabled = false;
  dl.onclick = () => downloadCsv(data);
}

function downloadCsv(data) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const word = { present: 'P', late: 'L', absent: 'A', off: 'Off', pending: '', before: '' };
  const lines = [['Name', 'Designation', ...data.days.map((d) => d.slice(8)), 'Present', 'Late', 'Absent', 'Days worked', 'Hours'].map(esc).join(',')];
  for (const s of data.staff) {
    const t = s.totals;
    lines.push([s.name, s.designation || '', ...data.days.map((d) => word[s.days[d].status]), t.present, t.late, t.absent,
      t.present + t.late, (t.minutes / 60).toFixed(1)].map(esc).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `haazri-${state.company.name.replace(/[^\w]+/g, '-').toLowerCase()}-${data.month}.csv` });
  document.body.append(a); a.click(); a.remove();
}

// ---------- Staff ----------

async function viewStaff(root, showOff = false) {
  const toggle = h('label', { class: 'legend', style: 'margin:0' }, h('input', { type: 'checkbox', checked: showOff, onchange: (e) => viewStaff(root, e.target.checked) }), ' Show switched-off staff');
  const body = h('div');
  root.replaceChildren(h('div', { class: 'view-head' }, h('h2', {}, 'Staff'), h('div', { class: 'spacer' }), toggle,
    h('button', { class: 'btn small', onclick: () => staffForm(null, () => viewStaff(root, showOff)) }, '+ Add staff')), body);
  loading(body);
  let data;
  try { data = await api(`/staff${showOff ? '?include=inactive' : ''}`); } catch (err) { return failed(body, err); }
  if (!data.staff.length) return body.replaceChildren(h('div', { class: 'card empty' }, 'No staff yet. Click "+ Add staff" to add your first person.'));

  const rows = data.staff.map((s) => h('tr', {},
    h('td', { class: 'person' }, h('b', {}, s.name), h('small', {}, [s.designation, s.department].filter(Boolean).join(' · '))),
    h('td', { class: 'num' }, s.phone),
    h('td', { class: 'hide-sm' }, s.email || '—'),
    h('td', {}, !s.active ? h('span', { class: 'pill inactive' }, 'Switched off') : s.role === 'admin' ? h('span', { class: 'pill admin' }, 'Admin') : h('span', { class: 'pill present' }, 'Staff')),
    h('td', { class: 'hide-sm' }, s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'),
    h('td', {}, h('div', { class: 'actions' },
      h('button', { class: 'btn ghost small', onclick: () => staffForm(s, () => viewStaff(root, showOff)) }, 'Edit'),
      s.active && s.id !== state.user.id ? h('button', { class: 'btn ghost small', onclick: () => resendInvite(s) }, 'Send invite') : null,
      s.id !== state.user.id ? h('button', { class: 'btn ghost small', onclick: () => setActive(s, !s.active, () => viewStaff(root, showOff)) }, s.active ? 'Switch off' : 'Switch on') : null)),
  ));
  body.replaceChildren(h('div', { class: 'card scroll' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', { class: 'num' }, 'Phone'), h('th', { class: 'hide-sm' }, 'Email'), h('th', {}, 'Role'), h('th', { class: 'hide-sm' }, 'Last sign-in'), h('th', {}))),
    h('tbody', {}, rows))));
}

function staffForm(s, onDone) {
  const isNew = !s;
  const f = (label, name, value = '', attrs = {}) => h('label', { class: 'field' }, h('span', {}, label), h('input', { name, value: value ?? '', ...attrs }));
  const msg = h('p', { class: 'msg' });
  const form = h('form', {},
    f('Full name *', 'name', s?.name, { required: true }),
    h('div', { class: 'row2' },
      f('Phone *', 'phone', s?.phone, { required: true, inputmode: 'numeric', maxlength: 14 }),
      f('Email * (sign-in codes go here)', 'email', s?.email, { required: true, type: 'email' })),
    h('div', { class: 'row2' }, f('Designation', 'designation', s?.designation), f('Department', 'department', s?.department)),
    h('label', { class: 'field' }, h('span', {}, 'Role'),
      h('select', { name: 'role' }, h('option', { value: 'staff', selected: s?.role !== 'admin' }, 'Staff (uses the app)'),
        h('option', { value: 'admin', selected: s?.role === 'admin' }, 'Admin (app + this dashboard)'))),
    msg,
    h('div', { class: 'foot' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Cancel'),
      h('button', { class: 'btn', type: 'submit' }, isNew ? 'Add and send invite' : 'Save')),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.textContent = '';
    const body = Object.fromEntries(new FormData(form));
    try {
      const res = isNew ? await api('/staff', { method: 'POST', body }) : await api(`/staff/${s.id}`, { method: 'PATCH', body });
      closeModal();
      toast(isNew ? (res.invited ? `${res.staff.name} added. Welcome email sent.` : `${res.staff.name} added, but the welcome email failed. Use "Send invite".`) : 'Saved');
      onDone();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  });
  openModal([h('h3', {}, isNew ? 'Add staff' : `Edit ${s.name}`), form]);
}

async function resendInvite(s) {
  try { await api(`/staff/${s.id}/invite`, { method: 'POST' }); toast(`Invite sent to ${s.email}`); } catch (err) { toast(err.message); }
}

async function setActive(s, active, onDone) {
  if (!active && !confirm(`Switch off ${s.name}? They won't be able to sign in. Their attendance history is kept.`)) return;
  try { await api(`/staff/${s.id}`, { method: 'PATCH', body: { active } }); toast(active ? `${s.name} switched on` : `${s.name} switched off`); onDone(); } catch (err) { toast(err.message); }
}

// ---------- Settings ----------

function viewSettings(root) {
  const c = state.company;
  const msg = h('p', { class: 'msg' });
  const form = h('form', { class: 'card form-card' },
    h('h3', {}, 'Company settings'),
    h('p', { class: 'hint' }, 'These apply to everyone in your company.'),
    h('label', { class: 'field' }, h('span', {}, 'Company name'), h('input', { name: 'name', value: c.name, required: true })),
    h('div', { class: 'row2' },
      h('label', { class: 'field' }, h('span', {}, 'Late after'), h('input', { name: 'late', type: 'time', value: minutesToHHMM(c.lateAfterMinutes), required: true })),
      h('label', { class: 'field' }, h('span', {}, 'Weekly off'),
        h('select', { name: 'off' }, h('option', { value: '', selected: c.weeklyOff == null }, 'None (open every day)'),
          DAYS.map((d, i) => h('option', { value: i, selected: c.weeklyOff === i }, d))),
        h('small', {}, 'The monthly sheet marks this day as off, for past months too.'))),
    msg,
    h('button', { class: 'btn', type: 'submit' }, 'Save settings'),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.className = 'msg'; msg.textContent = '';
    const v = Object.fromEntries(new FormData(form));
    try {
      state.company = await api('/company', { method: 'PATCH', body: { name: v.name, lateAfterMinutes: hhmmToMinutes(v.late), weeklyOff: v.off === '' ? null : Number(v.off) } });
      $('company-name').textContent = state.company.name;
      msg.className = 'msg ok'; msg.textContent = 'Saved.';
    } catch (err) { msg.textContent = err.message; } finally { btn.disabled = false; }
  });
  root.replaceChildren(h('div', { class: 'view-head' }, h('h2', {}, 'Settings')), form);
}

// ---------- Clients (platform admin) ----------

async function viewClients(root) {
  const body = h('div');
  root.replaceChildren(h('div', { class: 'view-head' }, h('h2', {}, 'Client companies'), h('div', { class: 'spacer' }),
    h('button', { class: 'btn small', onclick: () => companyForm(() => viewClients(root)) }, '+ Add company')), body);
  loading(body);
  let data;
  try { data = await api('/companies'); } catch (err) { return failed(body, err); }
  const rows = data.companies.map((c) => h('tr', {},
    h('td', { class: 'person' }, h('b', {}, c.name), h('small', {}, `Since ${new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`)),
    h('td', { class: 'num' }, c.staffCount),
    h('td', {}, h('span', { class: `pill ${c.active ? 'present' : 'inactive'}` }, c.active ? 'Active' : 'Paused')),
    h('td', {}, h('div', { class: 'actions' }, c.id === state.company.id ? h('span', { class: 'muted' }, 'Your company') :
      h('button', { class: 'btn ghost small', onclick: () => pauseCompany(c, () => viewClients(root)) }, c.active ? 'Pause' : 'Resume'))),
  ));
  body.replaceChildren(h('div', { class: 'card scroll' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Company'), h('th', { class: 'num' }, 'Staff'), h('th', {}, 'Status'), h('th', {}))),
    h('tbody', {}, rows))));
}

function companyForm(onDone) {
  const f = (label, name, attrs = {}) => h('label', { class: 'field' }, h('span', {}, label), h('input', { name, required: true, ...attrs }));
  const msg = h('p', { class: 'msg' });
  const form = h('form', {},
    f('Company name', 'name'),
    h('p', { class: 'hint legend', style: 'margin:0 0 12px' }, "The company's first admin (usually the owner). They get a welcome email and can then add their own staff."),
    f("Admin's name", 'adminName'),
    h('div', { class: 'row2' }, f("Admin's phone", 'adminPhone', { inputmode: 'numeric', maxlength: 14 }), f("Admin's email", 'adminEmail', { type: 'email' })),
    msg,
    h('div', { class: 'foot' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn', type: 'submit' }, 'Create company')),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.textContent = '';
    try {
      const res = await api('/companies', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      closeModal();
      toast(res.invited ? `${res.company.name} created. Welcome email sent to the admin.` : `${res.company.name} created, but the welcome email failed.`);
      onDone();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  });
  openModal([h('h3', {}, 'Add a client company'), form]);
}

async function pauseCompany(c, onDone) {
  if (c.active && !confirm(`Pause ${c.name}? None of their staff will be able to sign in until you resume it.`)) return;
  try { await api(`/companies/${c.id}`, { method: 'PATCH', body: { active: !c.active } }); toast(c.active ? `${c.name} paused` : `${c.name} resumed`); onDone(); } catch (err) { toast(err.message); }
}

const VIEWS = { today: viewToday, month: viewMonth, staff: viewStaff, settings: viewSettings, clients: viewClients };

// ---------- boot ----------
if (localStorage.getItem(TOKEN_KEY)) start(); else showAuth();
