// Haazri owner dashboard. Plain ES module, no build step. Talks to the same /api the app uses.
// Everything user-supplied is rendered with textContent (via h()), never as HTML.

const TOKEN_KEY = 'haazri_dashboard_token';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS_LABEL = { present: 'Present', late: 'Late', half: 'Half day', absent: 'Absent', pending: 'Not in yet', off: 'Weekly off', leave: 'On leave', holiday: 'Holiday', before: '', left: 'Left' };
const CELL = { present: 'P', late: 'L', half: 'H', absent: 'A', off: '·', leave: 'LV', holiday: 'HO', pending: '', before: '', left: '' };

const $ = (id) => document.getElementById(id);
const state = { user: null, company: null, view: 'today', phone: '', shifts: [] };

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
const durText = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);
const fmtDistance = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
const mapUrl = (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`;

// Coordinates from "30.2110, 74.9455" or a Google Maps link (the place pin !3d…!4d… wins over the
// map centre @lat,lng). Short maps.app.goo.gl links can't be read here.
function parseLocation(text) {
  const t = String(text || '').trim();
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(t);
  const any = pin || /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(t);
  if (!any) return null;
  const lat = Number(any[1]); const lng = Number(any[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: +lat.toFixed(6), lng: +lng.toFixed(6) } : null;
}

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
    state.shifts = (await api('/shifts').catch(() => ({ shifts: [] }))).shifts;
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
  refreshLeaveBadge();
}

function show(view) {
  state.view = view;
  history.replaceState(null, '', `#${view}`);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.view === view);
  VIEWS[view]($('view'));
}
$('tabs').addEventListener('click', (e) => { const v = e.target.closest('[data-view]')?.dataset.view; if (v) show(v); });

// ---------- Today ----------

async function viewToday(root, date = istToday()) {
  const picker = h('input', { type: 'date', value: date, max: istToday(), onchange: (e) => viewToday(root, e.target.value || istToday()) });
  const body = h('div');
  root.replaceChildren(
    h('div', { class: 'view-head' }, h('h2', {}, date === istToday() ? 'Today' : niceDate(date)), h('span', { class: 'holiday-tag hidden', id: 'day-holiday' }), h('div', { class: 'spacer' }), picker,
      h('button', { class: 'btn ghost small', onclick: () => viewToday(root, date) }, 'Refresh')),
    body,
  );
  loading(body);
  let data;
  try { data = await api(`/reports/day?date=${date}`); } catch (err) { return failed(body, err); }

  if (data.holiday) { const tag = root.querySelector('#day-holiday'); tag.textContent = `Holiday: ${data.holiday}`; tag.classList.remove('hidden'); }
  const s = data.summary;
  const chip = (n, label, cls = '') => h('div', { class: `chip ${cls}` }, h('b', {}, n), h('span', {}, label));
  const chips = h('div', { class: 'chips' },
    chip(s.present + s.late, 'In', 'ok'), chip(s.late, 'Late', 'late'), chip(s.absent, 'Absent', 'abs'),
    s.leave ? chip(s.leave, 'On leave', 'lv') : null,
    date === istToday() ? chip(s.notYet, 'Not in yet') : null, chip(s.checkedOut, 'Checked out'), chip(s.total, 'Staff'));

  const faceWarning = data.faceErrors
    ? h('div', { class: 'close-bar warn' }, h('div', {}, h('b', {}, 'Face match is not working'),
      h('span', {}, `${data.faceErrors === 1 ? '1 person was' : `${data.faceErrors} people were`} let through without a face check because Amazon's face service refused the request. Check the AWS account (plan and permissions), or ask support@tarahutaibuilds.com.`)))
    : null;
  if (!data.staff.length) {
    return body.replaceChildren(chips, h('div', { class: 'card empty' }, s.off ? 'Weekly off.' : 'No staff yet. Add people in the Staff tab.'));
  }
  const order = { late: 0, half: 1, present: 2, pending: 3, absent: 4, leave: 5, holiday: 6, off: 7 };
  const rows = [...data.staff].sort((a, b) => (order[a.status] - order[b.status]) || a.name.localeCompare(b.name)).map((p) => {
    const place = p.checkInAddress || '';
    const mapLink = p.checkInLocation ? h('a', { href: mapUrl(p.checkInLocation.lat, p.checkInLocation.lng), target: '_blank', rel: 'noopener' }, 'Map') : null;
    const away = data.office && p.checkInDistance != null && p.checkInDistance > data.office.radiusM;
    const dist = p.checkInDistance != null
      ? h('small', { class: away ? 'dist away' : 'dist' }, `${fmtDistance(p.checkInDistance)} from office${away && p.locationFree ? ' (can check in anywhere)' : ''}`)
      : null;
    return h('tr', {},
      h('td', { class: 'person' }, h('b', {}, p.name), h('small', {}, [p.designation || p.department, p.shift].filter(Boolean).join(' · '))),
      h('td', {}, h('span', { class: `pill ${p.status}` }, STATUS_LABEL[p.status]),
        p.addedByAdmin ? h('small', { class: 'dist', title: p.note || '' }, `Added by admin${p.note ? `: ${p.note}` : ''}`) : null,
        faceTag(p),
        h('button', { class: 'link-btn small-link', onclick: () => attendanceForm({ id: p.id, name: p.name }, date,
          p.attendanceId ? { id: p.attendanceId, in: p.checkIn, out: p.checkOut, note: p.note } : null, () => viewToday(root, date)) },
        p.attendanceId ? 'Edit day' : 'Add attendance')),
      h('td', { class: 'num' }, p.checkIn), h('td', { class: 'num' }, outCell(p, () => viewToday(root, date))), h('td', { class: 'num hide-sm' }, p.hours),
      h('td', { class: 'place hide-sm' }, place, place && mapLink ? ' · ' : '', mapLink, dist),
      h('td', {}, h('div', { class: 'selfies' },
        p.checkInSelfie ? h('img', { src: p.checkInSelfie, alt: 'Check-in selfie', title: 'Check-in selfie', onclick: () => showPhoto(p.checkInSelfie, `${p.name} · check-in ${p.checkIn}`) }) : null,
        p.checkOutSelfie ? h('img', { src: p.checkOutSelfie, alt: 'Check-out selfie', title: 'Check-out selfie', onclick: () => showPhoto(p.checkOutSelfie, `${p.name} · check-out ${p.checkOut}`) }) : null)),
    );
  });
  body.replaceChildren(...(faceWarning ? [faceWarning] : []), chips, h('div', { class: 'card scroll' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Status'), h('th', { class: 'num' }, 'In'), h('th', { class: 'num' }, 'Out'),
      h('th', { class: 'num hide-sm' }, 'Hours'), h('th', { class: 'hide-sm' }, 'Check-in place'), h('th', {}, 'Selfies'))),
    h('tbody', {}, rows))));
}

// Face match results for the check-in and check-out selfies (nothing when face match is off).
function faceTag(p) {
  const one = (f, label, selfie, time) => {
    if (!f) return null;
    const compare = f.savedPhoto && selfie && f.result !== 'enrolled'
      ? h('button', { class: 'link-btn small-link', onclick: () => openModal([h('h3', {}, `${p.name} · face check (${label.toLowerCase()})`),
        h('div', { class: 'face-compare' },
          h('figure', {}, h('img', { src: f.savedPhoto, alt: 'Saved photo' }), h('figcaption', {}, 'Saved photo')),
          h('figure', {}, h('img', { src: selfie, alt: `${label} selfie` }), h('figcaption', {}, `${label} ${time}`))),
        h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: closeModal }, 'Close'))]) }, 'Compare')
      : null;
    const text = {
      match: ['Face matched', 'dist ok'],
      mismatch: [`Face doesn't match${f.score != null ? ` (${Math.round(f.score)}%)` : ''}`, 'dist away'],
      no_face: ['No clear face in selfie', 'dist away'],
      enrolled: ['Face photo saved', 'dist'],
      error: ['Face check not done', 'dist'],
    }[f.result];
    return text ? h('small', { class: text[1] }, `${label}: ${text[0]}`, compare ? ' · ' : '', compare) : null;
  };
  return [one(p.face, 'In', p.checkInSelfie, p.checkIn), one(p.faceOut, 'Out', p.checkOutSelfie, p.checkOut)];
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
    h('th', { class: 'num' }, 'P'), h('th', { class: 'num' }, 'L'), h('th', { class: 'num' }, 'H'), h('th', { class: 'num' }, 'A'), h('th', { class: 'num' }, 'LV'), h('th', { class: 'num' }, 'Hours'));
  const rows = data.staff.map((s) => h('tr', {},
    h('td', { class: 'person' }, h('b', {}, s.name), h('small', {}, s.designation || '')),
    data.days.map((d) => {
      const c = s.days[d];
      const tip = c.in ? `${STATUS_LABEL[c.status]} · in ${c.in}${c.out && c.out !== '—' ? `, out ${c.out}` : ''}` : c.holiday ? `Holiday: ${c.holiday}` : STATUS_LABEL[c.status];
      const editable = c.status !== 'before' && c.status !== 'left' && d <= istToday();
      return h('td', {
        title: `${niceDate(d)}${tip ? `: ${tip}` : ''}${c.note ? ` (${c.note})` : ''}${editable ? ' · click to add or change' : ''}`,
        class: editable ? 'clickable' : null,
        onclick: editable ? () => attendanceForm({ id: s.id, name: s.name }, d,
          c.id ? { id: c.id, in: c.in, out: c.out, note: c.note } : null, () => viewMonth(root, month)) : null,
      }, h('span', { class: `cell ${c.status}${c.edited ? ' edited' : ''}` }, CELL[c.status]));
    }),
    h('td', { class: 'num' }, s.totals.present), h('td', { class: 'num' }, s.totals.late), h('td', { class: 'num' }, s.totals.half), h('td', { class: 'num' }, s.totals.absent), h('td', { class: 'num' }, s.totals.leave),
    h('td', { class: 'num' }, fmtHours(s.totals.minutes))));

  body.replaceChildren(
    h('div', { class: 'card scroll' }, h('table', { class: 'grid' }, h('thead', {}, head), h('tbody', {}, rows))),
    h('div', { class: 'legend' },
      h('span', {}, h('span', { class: 'cell present' }, 'P'), 'Present'), h('span', {}, h('span', { class: 'cell late' }, 'L'), 'Late (still counts as present)'),
      h('span', {}, h('span', { class: 'cell half' }, 'H'), 'Half day'),
      h('span', {}, h('span', { class: 'cell absent' }, 'A'), 'Absent'), h('span', {}, h('span', { class: 'cell leave' }, 'LV'), 'Approved leave'),
      h('span', {}, h('span', { class: 'cell holiday' }, 'HO'), 'Holiday'), h('span', {}, h('span', { class: 'cell off' }, '·'), 'Weekly off'),
      h('span', {}, h('span', { class: 'cell present edited' }, 'P'), 'Added or changed by an admin'),
      h('span', {}, 'Hover a day for times; click a day to add or change attendance')),
  );
  dl.disabled = false;
  dl.onclick = () => downloadCsv(data);
}

function downloadCsv(data) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const word = { present: 'P', late: 'L', half: 'H', absent: 'A', off: 'Off', leave: 'Leave', holiday: 'Holiday', pending: '', before: '' };
  const lines = [['Name', 'Designation', ...data.days.map((d) => d.slice(8)), 'Present', 'Late', 'Half days', 'Absent', 'Leave', 'Holidays', 'Days worked', 'Hours'].map(esc).join(',')];
  for (const s of data.staff) {
    const t = s.totals;
    lines.push([s.name, s.designation || '', ...data.days.map((d) => word[s.days[d].status]), t.present, t.late, t.half, t.absent, t.leave, t.holiday,
      t.present + t.late + t.half / 2, (t.minutes / 60).toFixed(1)].map(esc).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `haazri-${state.company.name.replace(/[^\w]+/g, '-').toLowerCase()}-${data.month}.csv` });
  document.body.append(a); a.click(); a.remove();
}

// ---------- Leave ----------

const LEAVE_PILL = { pending: 'pending', approved: 'present', rejected: 'absent', cancelled: 'inactive' };
const LEAVE_WORD = { pending: 'Waiting', approved: 'Approved', rejected: 'Not approved', cancelled: 'Cancelled' };
const shortDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const leaveDates = (r) => (r.from === r.to ? shortDate(r.from) : `${shortDate(r.from)} – ${shortDate(r.to)}`);

async function refreshLeaveBadge(count) {
  try {
    const n = count ?? ((await api('/leave/company')).pending.length + (await api('/corrections/company')).pending.length);
    $('leave-badge').textContent = n;
    $('leave-badge').classList.toggle('hidden', !n);
  } catch { /* the badge is a convenience */ }
}

const CORRECTION_PILL = LEAVE_PILL;

async function viewLeave(root) {
  const body = h('div');
  root.replaceChildren(h('div', { class: 'view-head' }, h('h2', {}, 'Requests'), h('div', { class: 'spacer' }),
    h('span', { class: 'muted' }, 'Staff ask for leave and attendance corrections in the Haazri app')), body);
  loading(body);
  let data; let fixes;
  try { [data, fixes] = await Promise.all([api('/leave/company'), api('/corrections/company')]); } catch (err) { return failed(body, err); }
  refreshLeaveBadge(data.pending.length + fixes.pending.length);

  const decide = async (r, approve) => {
    let note = null;
    if (!approve) {
      note = prompt(`Not approving ${r.staffName}'s leave. Add a note for them (optional):`, '');
      if (note === null) return;
    }
    try {
      await api(`/leave/${r.id}/decide`, { method: 'POST', body: { approve, note } });
      toast(approve ? `Approved ${r.staffName}'s leave` : `${r.staffName}'s leave not approved`);
      viewLeave(root);
    } catch (err) { toast(err.message); }
  };
  const decideFix = async (r, approve) => {
    let note = null;
    if (!approve) {
      note = prompt(`Not approving ${r.staffName}'s correction. Add a note for them (optional):`, '');
      if (note === null) return;
    }
    try {
      await api(`/corrections/${r.id}/decide`, { method: 'POST', body: { approve, note } });
      toast(approve ? `Approved: ${r.staffName}'s attendance updated` : `${r.staffName}'s correction not approved`);
      viewLeave(root);
    } catch (err) { toast(err.message); }
  };
  const asked = (r) => `Asked ${new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  const row = (r, actions) => h('tr', {},
    h('td', { class: 'person' }, h('b', {}, r.staffName), h('small', {}, asked(r))),
    h('td', {}, h('b', {}, leaveDates(r)), h('small', { class: 'dist' }, `${r.days} day${r.days === 1 ? '' : 's'} · ${r.typeLabel}`),
      r.balance?.limited && r.type !== 'unpaid' ? h('small', { class: 'dist' }, `Paid leave: ${r.balance.earned - r.balance.used} left of ${r.balance.earned} earned this year · ${r.balance.pending} asked for, incl. this`) : null),
    h('td', { class: 'place hide-sm' }, r.reason || '—', r.note ? h('small', { class: 'dist' }, `Note: ${r.note}`) : null),
    h('td', {}, h('span', { class: `pill ${LEAVE_PILL[r.status]}` }, LEAVE_WORD[r.status])),
    h('td', {}, h('div', { class: 'actions' }, actions)));
  const fixTimes = (r) => [r.checkIn ? `In ${r.checkIn}` : null, r.checkOut ? `Out ${r.checkOut}` : null].filter(Boolean).join(' · ');
  const fixRow = (r, actions) => h('tr', {},
    h('td', { class: 'person' }, h('b', {}, r.staffName), h('small', {}, asked(r))),
    h('td', {}, h('b', {}, shortDate(r.date)), h('small', { class: 'dist' }, `${r.label} · ${fixTimes(r)}`)),
    h('td', { class: 'place hide-sm' }, r.reason, r.decisionNote ? h('small', { class: 'dist' }, `Note: ${r.decisionNote}`) : null),
    h('td', {}, h('span', { class: `pill ${CORRECTION_PILL[r.status]}` }, LEAVE_WORD[r.status])),
    h('td', {}, h('div', { class: 'actions' }, actions)));
  const table = (rows, empty) => (rows.length ? h('div', { class: 'card scroll' }, h('table', {}, h('tbody', {}, rows))) : h('div', { class: 'card empty' }, empty));

  const fixPending = table(fixes.pending.map((r) => fixRow(r, [
    h('button', { class: 'btn small', onclick: () => decideFix(r, true) }, 'Approve'),
    h('button', { class: 'btn ghost small', onclick: () => decideFix(r, false) }, 'Reject')])), 'No corrections waiting.');
  const pending = table(data.pending.map((r) => row(r, [
    h('button', { class: 'btn small', onclick: () => decide(r, true) }, 'Approve'),
    h('button', { class: 'btn ghost small', onclick: () => decide(r, false) }, 'Reject')])), 'No leave requests waiting.');
  const recent = table(data.recent.map((r) => row(r,
    r.status === 'approved' ? h('button', { class: 'btn ghost small', onclick: () => confirm(`Withdraw approval for ${r.staffName}'s leave (${leaveDates(r)})?`) && decide(r, false) }, 'Withdraw')
      : r.status === 'rejected' ? h('button', { class: 'btn ghost small', onclick: () => decide(r, true) }, 'Approve') : null)), 'Nothing yet.');
  const fixRecent = table(fixes.recent.map((r) => fixRow(r, null)), 'Nothing yet.');

  body.replaceChildren(
    h('h3', { class: 'sub' }, `Attendance corrections waiting (${fixes.pending.length})`), fixPending,
    h('h3', { class: 'sub' }, `Leave waiting (${data.pending.length})`), pending,
    h('h3', { class: 'sub' }, 'Earlier corrections'), fixRecent,
    h('h3', { class: 'sub' }, 'Earlier leave'), recent);
}

// ---------- Salary ----------

const PAY_TYPES = { monthly: 'Monthly', daily: 'Daily', hourly: 'Hourly', weekly: 'Weekly' };
const PER = { monthly: '/month', daily: '/day', hourly: '/hour', weekly: '/week' };
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// 0.5 -> "½ day", 1 -> "1 day", 1.5 -> "1½ days"
const halfDays = (n) => `${Math.floor(n) || ''}${n % 1 ? '½' : ''} day${n > 1 ? 's' : ''}`;

const niceShort = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const signedRupees = (n) => (n > 0 ? `+${rupees(n)}` : n < 0 ? `−${rupees(-n)}` : '—');
const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const whenText = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const ADJ_KINDS = { advance: 'Advance paid', bonus: 'Bonus', deduction: 'Deduction', addition: 'Other addition' };

async function viewSalary(root, month = istMonth()) {
  const reload = () => viewSalary(root, month);
  const picker = h('input', { type: 'month', value: month, max: istMonth(), onchange: (e) => viewSalary(root, e.target.value || istMonth()) });
  const dl = h('button', { class: 'btn small', disabled: true }, 'Download for Excel');
  const status = h('span');
  const body = h('div');
  root.replaceChildren(h('div', { class: 'view-head' }, h('h2', {}, 'Salary'), status, h('div', { class: 'spacer' }), picker, dl), body);
  loading(body);
  let data;
  try { data = await api(`/reports/salary?month=${month}`); } catch (err) { return failed(body, err); }
  const closed = !!data.closed;
  status.replaceWith(closed ? h('span', { class: 'pill closed' }, 'Closed') : data.inProgress ? h('span', { class: 'pill pending' }, 'In progress') : h('span', { class: 'pill open' }, 'Open'));
  if (!data.staff.length) return body.replaceChildren(h('div', { class: 'card empty' }, 'No staff yet.'));

  // Close / reopen bar
  const bar = closed
    ? h('div', { class: 'close-bar closed' },
      h('div', {}, h('b', {}, `${monthLabel(data.month)} is closed`),
        h('span', {}, `Closed${data.closed.by ? ` by ${data.closed.by}` : ''} on ${whenText(data.closed.at)}. These figures are saved and won't change, even if pay, shifts or settings change later.`)),
      h('button', { class: 'btn ghost small', onclick: () => reopenForm(data.month, reload) }, 'Reopen month'))
    : data.inProgress
      ? h('div', { class: 'close-bar' }, h('div', {}, h('b', {}, 'This month is not over'), h('span', {}, 'Amounts are up to today. You can close the month once it has ended.')))
      : h('div', { class: 'close-bar' },
        h('div', {}, h('b', {}, `Ready to close ${monthLabel(data.month)}?`),
          h('span', {}, 'Closing saves this salary sheet and locks the month’s attendance, leave, holidays and adjustments.')),
        h('button', { class: 'btn small', onclick: () => closeMonthForm(data.month, reload) }, `Close ${monthLabel(data.month)}`));

  const chip = (n, label, cls = '') => h('div', { class: `chip ${cls}` }, h('b', {}, n), h('span', {}, label));
  const chips = h('div', { class: 'chips' },
    chip(rupees(data.total), data.inProgress ? 'Earned so far' : 'Earned from attendance'),
    chip(signedRupees(data.adjustmentTotal ?? 0), 'Advances & adjustments', (data.adjustmentTotal ?? 0) < 0 ? 'abs' : ''),
    chip(rupees(data.payableTotal ?? data.total), 'Balance payable', 'ok'),
    data.missing ? chip(data.missing, 'Pay not set', 'abs') : null);

  const rows = data.staff.map((p) => {
    const setPay = closed ? null : h('button', { class: 'btn ghost small', onclick: async () => {
      const full = await api(`/staff/${p.id}`).catch(() => null);
      if (full) staffForm(full, reload);
    } }, p.missing ? 'Set pay' : 'Edit pay');
    const adjust = h('button', { class: 'btn ghost small', onclick: () => adjustmentsForm(p, data, reload) }, closed ? 'Details' : 'Adjust');
    const slip = p.missing ? null : h('button', { class: 'btn ghost small', onclick: () => payslipForm(p, data) }, 'Payslip');
    const cut = [p.half ? `${plural(p.half, 'half day')}` : null, p.absent ? `${plural(p.absent, 'absent day')}` : null, p.unpaidLeave ? `${p.unpaidLeave} unpaid leave` : null,
      p.lateCutDays ? `${halfDays(p.lateCutDays)} for ${p.late} late marks` : null].filter(Boolean).join(', ');
    const adjTotal = p.adjustmentTotal ?? 0;
    return h('tr', {},
      h('td', { class: 'person' }, h('b', {}, p.name), h('small', {}, p.leftOn ? `Left ${niceShort(p.leftOn)}` : (p.designation || ''))),
      h('td', {}, p.missing ? h('span', { class: 'muted' }, 'Not set') : [h('b', {}, `${rupees(p.salary)}${PER[p.salaryType]}`), h('small', { class: 'dist' }, PAY_TYPES[p.salaryType])]),
      h('td', { class: 'num hide-sm' }, p.worked), h('td', { class: 'num hide-sm', title: p.holiday ? `${p.off} weekly off + ${p.holiday} holiday` : null }, p.off + (p.holiday || 0)), h('td', { class: 'num hide-sm' }, p.paidLeave),
      h('td', { class: 'num hide-sm' }, p.salaryType === 'hourly' ? `${p.hours} h` : (p.payDays ?? '—')),
      h('td', { class: 'num hide-sm', title: p.overtimePay ? `${rupees(p.overtimePay)} overtime pay (included in Earned)` : null },
        p.overtimeHours ? `${p.overtimeHours} h` : '—', p.overtimePay ? h('small', { class: 'dist' }, rupees(p.overtimePay)) : null),
      h('td', { class: 'place hide-sm' }, cut || '—'),
      h('td', { class: 'num hide-sm' }, p.pay == null ? '—' : rupees(p.pay)),
      h('td', { class: `num ${adjTotal < 0 ? 'neg' : ''}`, title: (p.adjustments || []).map((a) => `${a.label} ${rupees(a.amount)}${a.note ? ` (${a.note})` : ''}`).join('\n') || null }, signedRupees(adjTotal)),
      h('td', { class: 'num' }, p.payable == null ? '—' : h('b', {}, rupees(p.payable))),
      h('td', {}, h('div', { class: 'actions' }, slip, adjust, setPay)));
  });

  const rules = h('div', { class: 'legend rules' },
    h('span', {}, h('b', {}, 'Monthly:'), ` salary ÷ ${data.daysInMonth} days × paid days (worked, weekly off, holidays and paid leave).`),
    h('span', {}, h('b', {}, 'Weekly:'), ' the same at salary ÷ 7 a day.'),
    h('span', {}, h('b', {}, 'Daily:'), ' rate × days worked.'),
    h('span', {}, h('b', {}, 'Hourly:'), ' rate × hours between check-in and check-out.'),
    h('span', {}, 'Half days pay half. Absent days and unpaid leave are not paid. ',
      data.lateCutEvery ? `Every ${data.lateCutEvery} late marks cut half a day (Settings).` : 'Late marks do not cut pay (change in Settings).'),
    h('span', {}, h('b', {}, 'Overtime:'), data.overtimeRate
      ? ` time worked beyond a person's shift (or ${durText(data.overtimeAfterMinutes ?? 480)} without a shift), 15 minutes or more a day, paid at ${data.overtimeRate}× their hourly rate and included in Earned.`
      : ' shown in hours but not paid (turn on in Settings).'),
    h('span', {}, h('b', {}, 'Balance payable:'), ' earned + bonuses and additions − advances and deductions.'));

  const history = (data.log || []).length
    ? h('div', { class: 'history' }, h('h3', { class: 'sub' }, 'History'), h('ul', {}, data.log.map((l) => h('li', {},
      h('b', {}, l.action === 'closed' ? 'Closed' : 'Reopened'), ` by ${l.by || 'an admin'} · ${whenText(l.at)}`, l.reason ? h('span', { class: 'muted' }, ` · ${l.reason}`) : null))))
    : null;

  body.replaceChildren(bar, chips, h('div', { class: 'card scroll' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Pay'), h('th', { class: 'num hide-sm' }, 'Worked'), h('th', { class: 'num hide-sm' }, 'Off'),
      h('th', { class: 'num hide-sm' }, 'Paid leave'), h('th', { class: 'num hide-sm' }, 'Pay days'), h('th', { class: 'num hide-sm' }, 'Overtime'), h('th', { class: 'hide-sm' }, 'Cut for'),
      h('th', { class: 'num hide-sm' }, 'Earned'), h('th', { class: 'num' }, 'Adjustments'), h('th', { class: 'num' }, 'Payable'), h('th', {}))),
    h('tbody', {}, rows))), rules, ...(history ? [history] : []));
  dl.disabled = false;
  dl.onclick = () => downloadSalaryCsv(data);
}

// Advances, bonuses and other adjustments for one person's month.
function adjustmentsForm(p, data, onDone) {
  const closed = !!data.closed;
  const msg = h('p', { class: 'msg' });
  const list = (p.adjustments || []).length
    ? h('table', { class: 'mini' }, h('tbody', {}, p.adjustments.map((a) => h('tr', {},
      h('td', {}, h('b', {}, a.label), a.note ? h('small', { class: 'dist' }, a.note) : null),
      h('td', { class: `num ${a.signed < 0 ? 'neg' : ''}` }, signedRupees(a.signed)),
      h('td', {}, closed ? null : h('button', { class: 'btn ghost small danger', onclick: () => remove(a) }, 'Remove'))))))
    : h('p', { class: 'muted', style: 'margin:0 0 12px' }, 'No advances or adjustments this month.');
  const summary = h('div', { class: 'adj-sum' },
    h('span', {}, 'Earned', h('b', {}, p.pay == null ? '—' : rupees(p.pay))),
    h('span', {}, 'Adjustments', h('b', {}, signedRupees(p.adjustmentTotal ?? 0))),
    h('span', {}, 'Payable', h('b', {}, p.payable == null ? '—' : rupees(p.payable))));
  const form = closed ? h('p', { class: 'muted' }, 'This month is closed. Reopen it to change adjustments.') : h('form', {},
    h('div', { class: 'row2' },
      h('label', { class: 'field' }, h('span', {}, 'Type'), h('select', { name: 'kind' }, Object.entries(ADJ_KINDS).map(([k, v]) => h('option', { value: k }, v)))),
      h('label', { class: 'field' }, h('span', {}, 'Amount (₹)'), h('input', { name: 'amount', type: 'number', min: 1, step: 'any', inputmode: 'decimal', required: true, placeholder: 'e.g. 2000' }))),
    h('label', { class: 'field' }, h('span', {}, 'Note (optional)'), h('input', { name: 'note', maxlength: 200, placeholder: 'e.g. Advance given on 12 Sept' })),
    msg,
    h('div', { class: 'foot' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Close'), h('button', { class: 'btn', type: 'submit' }, 'Add')));
  async function remove(a) {
    if (!confirm(`Remove ${a.label.toLowerCase()} of ${rupees(a.amount)} for ${p.name}?`)) return;
    try { await api(`/pay-adjustments/${a.id}`, { method: 'DELETE' }); closeModal(); toast('Removed'); onDone(); } catch (err) { msg.textContent = err.message; }
  }
  if (!closed) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true; msg.textContent = '';
      const v = Object.fromEntries(new FormData(form));
      try {
        await api('/pay-adjustments', { method: 'POST', body: { staffId: p.id, month: data.month, kind: v.kind, amount: Number(v.amount), note: v.note } });
        closeModal(); toast(`${ADJ_KINDS[v.kind]} added for ${p.name}`); onDone();
      } catch (err) { msg.textContent = err.message; btn.disabled = false; }
    });
  }
  openModal([h('h3', {}, `${p.name} · ${monthLabel(data.month)}`), summary, list, form,
    closed ? h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: closeModal }, 'Close')) : null]);
}

async function closeMonthForm(month, onDone) {
  openModal([h('h3', {}, `Close ${monthLabel(month)}`), h('div', { class: 'empty' }, 'Checking the month…')]);
  let c;
  try { c = await api(`/month-close?month=${month}`); } catch (err) { return openModal([h('h3', {}, `Close ${monthLabel(month)}`), h('p', { class: 'msg' }, err.message)]); }
  const msg = h('p', { class: 'msg' });
  const section = (title, items, render, fix) => h('div', { class: 'check-block' },
    h('b', {}, `${title} (${items.length})`), h('ul', {}, items.slice(0, 12).map(render)), items.length > 12 ? h('small', { class: 'muted' }, `and ${items.length - 12} more`) : null,
    fix ? h('small', { class: 'muted' }, fix) : null);
  const issues = [
    c.missingCheckOuts.length ? section('No check-out', c.missingCheckOuts, (x) => h('li', {}, `${x.name} · ${niceDate(x.date)}`), 'Fill these in on the Monthly sheet (click the day), or close anyway to pay them as recorded.') : null,
    c.pendingLeave.length ? section('Leave still waiting', c.pendingLeave, (x) => h('li', {}, `${x.name} · ${x.from === x.to ? niceDate(x.from) : `${niceDate(x.from)} – ${niceDate(x.to)}`}`), 'Approve or reject these on the Requests page first; waiting leave counts as absent.') : null,
    (c.pendingCorrections || []).length ? section('Correction requests waiting', c.pendingCorrections, (x) => h('li', {}, `${x.name} · ${niceDate(x.date)}`), 'Approve or reject these on the Requests page so the attendance is right.') : null,
    c.payNotSet.length ? section('Pay not set', c.payNotSet, (n) => h('li', {}, n), 'They will show no salary for this month.') : null,
  ].filter(Boolean);
  const go = h('button', { class: 'btn', onclick: async () => {
    go.disabled = true; msg.textContent = '';
    try { const r = await api('/month-close', { method: 'POST', body: { month } }); closeModal(); toast(`${monthLabel(month)} closed · ${rupees(r.payableTotal)} payable`); onDone(); } catch (err) { msg.textContent = err.message; go.disabled = false; }
  } }, issues.length ? 'Close anyway' : `Close ${monthLabel(month)}`);
  openModal([h('h3', {}, `Close ${monthLabel(month)}`),
    issues.length ? h('p', { class: 'muted', style: 'margin:-6px 0 12px' }, 'Check these before closing:') : h('p', { class: 'ok-line' }, 'Everything looks complete: no missing check-outs, no leave waiting, pay set for everyone.'),
    ...issues,
    h('p', { class: 'muted' }, 'Closing saves this salary sheet as it is now. Attendance, leave, holidays and adjustments for the month are locked until someone reopens it with a reason.'),
    msg, h('div', { class: 'foot' }, h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'), go)]);
}

function reopenForm(month, onDone) {
  const msg = h('p', { class: 'msg' });
  const form = h('form', {},
    h('label', { class: 'field' }, h('span', {}, 'Why are you reopening it?'), h('input', { name: 'reason', required: true, minlength: 3, maxlength: 300, placeholder: 'e.g. Missed check-out for Bilal on 10 Sept' })),
    h('p', { class: 'muted' }, 'The reason and your name are kept in the month’s history. The salary sheet goes back to live figures until you close the month again.'),
    msg, h('div', { class: 'foot' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn', type: 'submit' }, 'Reopen month')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.textContent = '';
    try { await api('/month-close/reopen', { method: 'POST', body: { month, reason: new FormData(form).get('reason') } }); closeModal(); toast(`${monthLabel(month)} reopened`); onDone(); } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  });
  openModal([h('h3', {}, `Reopen ${monthLabel(month)}`), form]);
}

// One person's salary slip: open it (print / save as PDF) or send the link on WhatsApp.
async function payslipForm(p, data) {
  openModal([h('h3', {}, `Payslip · ${p.name}`), h('div', { class: 'empty' }, 'Preparing the slip…')]);
  let r;
  try { r = await api(`/payslips?month=${data.month}&staffId=${p.id}`); } catch (err) { return openModal([h('h3', {}, `Payslip · ${p.name}`), h('p', { class: 'msg' }, err.message)]); }
  const text = `Hi ${p.name.split(' ')[0]}, your salary slip for ${monthLabel(data.month)} from ${state.company.name}: ${r.link}`;
  const wa = r.slip.phone ? `https://wa.me/91${r.slip.phone}?text=${encodeURIComponent(text)}` : null;
  openModal([h('h3', {}, `Payslip · ${p.name} · ${monthLabel(data.month)}`),
    h('div', { class: 'adj-sum' },
      h('span', {}, 'Earned', h('b', {}, r.slip.earned == null ? '—' : rupees(r.slip.earned))),
      h('span', {}, 'Overtime', h('b', {}, rupees(r.slip.overtimePay || 0))),
      h('span', {}, 'Net payable', h('b', {}, r.slip.payable == null ? '—' : rupees(r.slip.payable)))),
    r.slip.closed ? h('p', { class: 'muted' }, 'The month is closed, so these figures are final.')
      : h('p', { class: 'msg' }, 'This month is not closed yet: the slip shows live figures and says so. Close the month first to send a final slip.'),
    h('p', { class: 'muted' }, 'The link works for 90 days without signing in. Staff also see their slips in the app once a month is closed.'),
    h('div', { class: 'foot' },
      h('button', { class: 'btn ghost', onclick: closeModal }, 'Close'),
      h('a', { class: 'btn ghost', href: r.link, target: '_blank', rel: 'noopener' }, 'Open slip'),
      wa ? h('a', { class: 'btn', href: wa, target: '_blank', rel: 'noopener' }, 'Send on WhatsApp') : null)]);
}

function downloadSalaryCsv(data) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [['Name', 'Designation', 'Pay type', 'Rate', 'Days worked', 'Weekly off', 'Paid leave', 'Unpaid leave', 'Absent',
    'Late marks', 'Late cut (days)', 'Hours', 'Pay days', 'Overtime hours', 'Overtime pay', 'Earned', 'Adjustments', 'Balance payable', 'Adjustment details'].map(esc).join(',')];
  for (const p of data.staff) {
    const details = (p.adjustments || []).map((a) => `${a.label} ${a.signed < 0 ? '-' : '+'}${a.amount}${a.note ? ` (${a.note})` : ''}`).join('; ');
    lines.push([p.name, p.designation || '', PAY_TYPES[p.salaryType] || 'Not set', p.salary ?? '', p.worked, p.off, p.paidLeave, p.unpaidLeave,
      p.absent, p.late, p.lateCutDays, p.hours, p.payDays ?? '', p.overtimeHours ?? 0, p.overtimePay ?? 0, p.pay ?? '', p.adjustmentTotal ?? 0, p.payable ?? '', details].map(esc).join(','));
  }
  lines.push(['Total', '', '', '', '', '', '', '', '', '', '', '', '', '', '', data.total, data.adjustmentTotal ?? 0, data.payableTotal ?? data.total, ''].map(esc).join(','));
  if (data.closed) lines.push(esc(`Closed${data.closed.by ? ` by ${data.closed.by}` : ''} on ${whenText(data.closed.at)}`));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `haazri-salary-${state.company.name.replace(/[^\w]+/g, '-').toLowerCase()}-${data.month}.csv` });
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
    h('td', {}, !s.active ? h('span', { class: 'pill inactive' }, 'Switched off') : s.role === 'admin' ? h('span', { class: 'pill admin' }, 'Admin') : h('span', { class: 'pill present' }, 'Staff'),
      s.locationFree && state.company.office ? h('small', { class: 'tag', title: 'Can check in away from the office' }, 'Anywhere') : null,
      s.shiftId ? h('small', { class: 'tag' }, state.shifts.find((x) => x.id === s.shiftId)?.name || 'Shift') : null),
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
    h('div', { class: 'row2' },
      h('label', { class: 'field' }, h('span', {}, 'Pay type'),
        h('select', { name: 'salaryType' }, h('option', { value: '', selected: !s?.salaryType }, 'Not set'),
          Object.entries(PAY_TYPES).map(([k, v]) => h('option', { value: k, selected: s?.salaryType === k }, v)))),
      f('Salary (₹)', 'salary', s?.salary ?? '', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'Amount' })),
    h('label', { class: 'field' }, h('span', {}, 'Role'),
      h('select', { name: 'role' }, h('option', { value: 'staff', selected: s?.role !== 'admin' }, 'Staff (uses the app)'),
        h('option', { value: 'admin', selected: s?.role === 'admin' }, 'Admin (app + this dashboard)'))),
    h('label', { class: 'field' }, h('span', {}, 'Shift'),
      h('select', { name: 'shiftId' }, h('option', { value: '', selected: !s?.shiftId }, `Company default (late after ${minutesToHHMM(state.company.lateAfterMinutes)})`),
        state.shifts.map((sh) => h('option', { value: sh.id, selected: s?.shiftId === sh.id }, `${sh.name} · ${sh.start}–${sh.end}`)))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'locationFree', checked: !!s?.locationFree }),
      h('span', {}, h('b', {}, 'Can check in from anywhere'), h('small', {}, 'For field or sales staff. Others must be at the office when location lock is on.'))),
    !isNew && state.company.faceMatch ? h('div', { class: 'field' }, h('span', {}, 'Face photo'),
      s.faceSavedAt
        ? h('div', {}, `Saved ${new Date(s.faceSavedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} from a check-in selfie. `,
          h('button', { class: 'link-btn', type: 'button', onclick: async () => {
            if (!confirm(`Forget ${s.name}'s saved face photo? Their next check-in selfie becomes the new one.`)) return;
            try { await api(`/staff/${s.id}`, { method: 'PATCH', body: { faceReset: true } }); closeModal(); toast('Face photo reset'); onDone(); } catch (err) { msg.textContent = err.message; }
          } }, 'Reset'))
        : h('div', { class: 'muted' }, 'Not saved yet: their next check-in selfie becomes it.')) : null,
    msg,
    h('div', { class: 'foot' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Cancel'),
      h('button', { class: 'btn', type: 'submit' }, isNew ? 'Add and send invite' : 'Save')),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.textContent = '';
    const body = { ...Object.fromEntries(new FormData(form)), locationFree: form.elements.locationFree.checked };
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
    h('label', { class: 'field' }, h('span', {}, 'Half day'),
      h('select', { name: 'halfDay' }, h('option', { value: '', selected: c.halfDayMinutes == null }, 'No half days'),
        [[180, '3 hours'], [240, '4 hours'], [270, '4½ hours'], [300, '5 hours'], [360, '6 hours']].map(([m, w]) =>
          h('option', { value: m, selected: c.halfDayMinutes === m }, `Less than ${w} worked = half day`)))),
    h('label', { class: 'field' }, h('span', {}, 'Late marks and salary'),
      h('select', { name: 'lateCut' }, h('option', { value: '', selected: c.lateCutEvery == null }, 'No salary cut for late marks'),
        [2, 3, 4, 5].map((n) => h('option', { value: n, selected: c.lateCutEvery === n }, `Every ${n} late marks = half-day cut`)))),
    h('div', { class: 'row2' },
      h('label', { class: 'field' }, h('span', {}, 'Overtime pay'),
        h('select', { name: 'otRate' }, h('option', { value: '', selected: c.overtimeRate == null }, 'No overtime pay'),
          [[1, '1× hourly rate'], [1.5, '1.5× hourly rate'], [2, '2× hourly rate']].map(([n, w]) => h('option', { value: n, selected: c.overtimeRate === n }, w))),
        h('small', {}, 'Paid for time beyond the shift, 15 minutes or more a day.')),
      h('label', { class: 'field' }, h('span', {}, 'Normal day (staff without a shift)'),
        h('select', { name: 'otAfter' }, [[480, '8 hours'], [540, '9 hours'], [600, '10 hours'], [720, '12 hours']].map(([m, w]) =>
          h('option', { value: m, selected: (c.overtimeAfterMinutes ?? 480) === m }, w))))),
    h('label', { class: 'field' }, h('span', {}, 'Paid leave per year'),
      h('select', { name: 'paidLeave' }, h('option', { value: '', selected: c.paidLeavePerYear == null }, 'No limit'),
        [6, 8, 10, 12, 15, 18, 21, 24, 30].map((n) => h('option', { value: n, selected: c.paidLeavePerYear === n }, `${n} days a year (${Math.floor((n / 12) * 2) / 2} a month)`))),
      h('small', {}, 'Earned each month from January (or joining), reset every January. Casual, sick and paid leave use it; unpaid leave doesn’t.')),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'faceMatch', checked: !!c.faceMatch }),
      h('span', {}, h('b', {}, 'Face match'), h('small', {}, 'Each check-in selfie is compared with the person’s saved photo (their first selfie after this is on). Today shows the result and you get a notification if it doesn’t match. Check-in is never blocked. Tell your staff before turning it on.'))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'summary', checked: !!c.dailySummary }),
      h('span', {}, 'Send admins a WhatsApp summary every morning (around 11 am): who has checked in, who is late, who is not in yet')),
    msg,
    h('button', { class: 'btn', type: 'submit' }, 'Save settings'),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.className = 'msg'; msg.textContent = '';
    const v = Object.fromEntries(new FormData(form));
    try {
      state.company = await api('/company', { method: 'PATCH', body: {
        name: v.name, lateAfterMinutes: hhmmToMinutes(v.late), weeklyOff: v.off === '' ? null : Number(v.off), lateCutEvery: v.lateCut === '' ? null : Number(v.lateCut),
        halfDayMinutes: v.halfDay === '' ? null : Number(v.halfDay), overtimeRate: v.otRate === '' ? null : Number(v.otRate),
        overtimeAfterMinutes: Number(v.otAfter), paidLeavePerYear: v.paidLeave === '' ? null : Number(v.paidLeave), dailySummary: v.summary === 'on', faceMatch: v.faceMatch === 'on' } });
      $('company-name').textContent = state.company.name;
      msg.className = 'msg ok'; msg.textContent = 'Saved.';
    } catch (err) { msg.textContent = err.message; } finally { btn.disabled = false; }
  });
  root.replaceChildren(h('div', { class: 'view-head' }, h('h2', {}, 'Settings')), h('div', { class: 'settings' }, form, holidaysCard(), officeCard(), shiftsCard()));
}

function officeCard(note = '') {
  const o = state.company.office;
  const msg = h('p', { class: note ? 'msg ok' : 'msg' }, note);
  const where = h('input', { name: 'where', placeholder: 'e.g. 30.2110, 74.9455 or a Google Maps link', value: o ? `${o.lat}, ${o.lng}` : '' });
  const radius = h('select', { name: 'radius' },
    [100, 200, 300, 500, 1000, 2000].map((m) => h('option', { value: m, selected: (o?.radiusM ?? 200) === m }, `Within ${fmtDistance(m)}`)));
  const status = h('p', { class: 'hint' });
  const showStatus = () => {
    const c = state.company.office;
    status.replaceChildren(c
      ? h('span', {}, h('span', { class: 'pill present' }, 'On'), ` Staff must be within ${fmtDistance(c.radiusM)} of `,
        h('a', { href: mapUrl(c.lat, c.lng), target: '_blank', rel: 'noopener' }, 'this spot'), ' to check in.')
      : h('span', {}, h('span', { class: 'pill inactive' }, 'Off'), ' Staff can check in from anywhere.'));
  };
  showStatus();
  const setWhere = (lat, lng, note) => { where.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`; msg.className = 'msg ok'; msg.textContent = note; };

  const useMyCheckIn = async () => {
    msg.className = 'msg'; msg.textContent = '';
    try {
      const day = await api('/reports/day');
      const me = day.staff.find((p) => p.id === state.user.id);
      if (!me?.checkInLocation) { msg.textContent = 'You have not checked in from the app today. Check in at the office first, then try again.'; return; }
      setWhere(me.checkInLocation.lat, me.checkInLocation.lng, `Using where you checked in at ${me.checkIn}. Click "Turn on" to save.`);
    } catch (err) { msg.textContent = err.message; }
  };
  const useThisDevice = () => {
    msg.className = 'msg'; msg.textContent = '';
    if (!navigator.geolocation) { msg.textContent = 'This browser cannot share its location.'; return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setWhere(p.coords.latitude, p.coords.longitude,
        `Location found (accurate to about ${Math.round(p.coords.accuracy)} m). Check it on the map, then click "Turn on".`),
      () => { msg.textContent = 'Could not get this device\'s location. Allow location for this site, or paste the location instead.'; },
      { enableHighAccuracy: true, timeout: 15000 });
  };

  const save = async (office) => {
    msg.className = 'msg'; msg.textContent = '';
    try {
      state.company = await api('/company', { method: 'PATCH', body: { office } });
      card.replaceWith(officeCard(office ? 'Location lock is on.' : 'Location lock is off.'));
    } catch (err) { msg.textContent = err.message; }
  };
  const turnOn = (e) => {
    e.preventDefault();
    const pos = parseLocation(where.value);
    if (!pos) {
      msg.className = 'msg';
      msg.textContent = /goo\.gl|maps\.app/.test(where.value)
        ? 'Short Google Maps links can\'t be read. Open the link, then copy the numbers shown when you tap the red pin (like 30.2110, 74.9455).'
        : 'Enter the location as two numbers, like 30.2110, 74.9455, or paste a full Google Maps link.';
      return;
    }
    save({ ...pos, radiusM: Number(radius.value) });
  };

  const card = h('form', { class: 'card form-card', onsubmit: turnOn },
    h('h3', {}, 'Location lock'),
    h('p', { class: 'hint' }, 'Only allow check-in at your office. Check-out is never blocked, and the distance is shown on the Today page.'),
    status,
    h('label', { class: 'field' }, h('span', {}, 'Office location'), where),
    h('div', { class: 'loc-actions' },
      h('button', { class: 'btn ghost small', type: 'button', onclick: useMyCheckIn }, 'Use where I checked in today'),
      h('button', { class: 'btn ghost small', type: 'button', onclick: useThisDevice }, "Use this device's location")),
    h('label', { class: 'field' }, h('span', {}, 'Allowed distance'), radius),
    msg,
    h('div', { class: 'loc-actions' },
      h('button', { class: 'btn', type: 'submit' }, state.company.office ? 'Save' : 'Turn on'),
      state.company.office ? h('button', { class: 'btn ghost', type: 'button', onclick: () => confirm('Turn off location lock? Staff will be able to check in from anywhere.') && save(null) }, 'Turn off') : null),
  );
  return card;
}

// ---------- Add / edit a day (admin) ----------

function attendanceForm(person, date, record, onDone) {
  const msg = h('p', { class: 'msg' });
  const t = (label, name, value, req) => h('label', { class: 'field' }, h('span', {}, label),
    h('input', { name, type: 'time', value: value && value !== '—' ? value : '', required: req }));
  const form = h('form', {},
    h('p', { class: 'hint legend', style: 'margin:0 0 12px' }, record
      ? 'Change the times or remove the day. Late or on time follows their shift.'
      : 'For someone who couldn’t check in. There is no selfie or location, so the day is marked as added by an admin. Late or on time follows their shift.'),
    h('div', { class: 'row2' }, t('Check-in', 'checkIn', record?.in, true), t('Check-out (optional)', 'checkOut', record?.out, false)),
    h('label', { class: 'field' }, h('span', {}, 'Note (optional)'), h('input', { name: 'note', value: record?.note || '', maxlength: 200, placeholder: 'e.g. Phone battery dead' })),
    msg,
    h('div', { class: 'foot' },
      record ? h('button', { class: 'btn ghost danger', type: 'button', onclick: remove, style: 'margin-right:auto' }, 'Remove day') : null,
      h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Cancel'),
      h('button', { class: 'btn', type: 'submit' }, record ? 'Save' : 'Add')));
  async function remove() {
    if (!confirm(`Remove ${person.name}'s attendance on ${niceDate(date)}? It will show as absent.`)) return;
    try { await api(`/attendance/${record.id}`, { method: 'DELETE' }); closeModal(); toast('Day removed'); onDone(); } catch (err) { msg.textContent = err.message; }
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.textContent = '';
    const v = Object.fromEntries(new FormData(form));
    try {
      if (record) await api(`/attendance/${record.id}`, { method: 'PATCH', body: { checkIn: v.checkIn, checkOut: v.checkOut || '', note: v.note } });
      else await api('/attendance', { method: 'POST', body: { staffId: person.id, date, checkIn: v.checkIn, checkOut: v.checkOut || null, note: v.note } });
      closeModal(); toast(record ? 'Saved' : `Attendance added for ${person.name}`); onDone();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  });
  openModal([h('h3', {}, `${record ? 'Edit' : 'Add'} attendance · ${person.name}`), h('p', { class: 'muted', style: 'margin:-6px 0 14px' }, niceDate(date)), form]);
}

// ---------- Holidays ----------

// Fixed-date national holidays offered as one-click adds. Festivals that move each year (Diwali, Gurpurab,
// Holi, Eid...) are added by hand, so a wrong date is never guessed for the admin.
const FIXED_HOLIDAYS = [['01-26', 'Republic Day'], ['08-15', 'Independence Day'], ['10-02', 'Gandhi Jayanti'], ['12-25', 'Christmas']];

function holidaysCard() {
  const list = h('div');
  const msg = h('p', { class: 'msg' });
  const date = h('input', { type: 'date', name: 'date', required: true, min: `${istToday().slice(0, 4)}-01-01` });
  const name = h('input', { name: 'name', placeholder: 'e.g. Diwali', maxlength: 60, required: true });
  const suggest = h('div', { class: 'loc-actions' });
  let holidays = [];

  const draw = () => {
    const today = istToday();
    const upcoming = holidays.filter((x) => x.date >= today);
    const past = holidays.filter((x) => x.date < today && x.date.slice(0, 4) === today.slice(0, 4));
    const row = (x) => h('tr', { class: x.date < today ? 'past' : null },
      h('td', {}, h('b', {}, x.name), h('small', { class: 'dist' }, niceDate(x.date))),
      h('td', {}, h('div', { class: 'actions' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => remove(x) }, 'Remove'))));
    list.replaceChildren(holidays.length
      ? h('table', { class: 'mini' }, h('tbody', {}, upcoming.map(row), past.map(row)))
      : h('p', { class: 'muted' }, 'No holidays yet.'));
    // Next occurrence of each fixed holiday that isn't added yet
    const have = new Set(holidays.map((x) => x.date));
    const year = Number(today.slice(0, 4));
    const next = FIXED_HOLIDAYS.map(([md, n]) => [`${`${year}-${md}` >= today ? year : year + 1}-${md}`, n]).filter(([d]) => !have.has(d));
    suggest.replaceChildren(...(next.length ? [h('span', { class: 'muted' }, 'Quick add:'),
      ...next.map(([d, n]) => h('button', { class: 'btn ghost small', type: 'button', onclick: () => add(d, n) }, `${n} (${d.slice(8)}/${d.slice(5, 7)})`))] : []));
  };
  const load = async () => {
    try { holidays = (await api('/holidays')).holidays; draw(); } catch (err) { list.replaceChildren(h('p', { class: 'msg' }, err.message)); }
  };
  const add = async (d, n) => {
    msg.className = 'msg'; msg.textContent = '';
    try {
      await api('/holidays', { method: 'POST', body: { date: d, name: n } });
      toast(`${n} added`); date.value = ''; name.value = ''; load();
    } catch (err) { msg.textContent = err.message; }
  };
  const remove = async (x) => {
    if (!confirm(`Remove ${x.name} (${niceDate(x.date)})? That day will count as a normal working day again.`)) return;
    try { await api(`/holidays/${x.id}`, { method: 'DELETE' }); toast(`${x.name} removed`); load(); } catch (err) { toast(err.message); }
  };
  load();
  return h('form', { class: 'card form-card', onsubmit: (e) => { e.preventDefault(); add(date.value, name.value.trim()); } },
    h('h3', {}, 'Holidays'),
    h('p', { class: 'hint' }, 'Paid days off for everyone: not marked absent, paid for monthly and weekly salaries, not counted as leave, and no check-in reminder.'),
    list,
    h('div', { class: 'row2', style: 'margin-top:14px' }, h('label', { class: 'field' }, h('span', {}, 'Date'), date), h('label', { class: 'field' }, h('span', {}, 'Name'), name)),
    msg,
    h('div', { class: 'loc-actions' }, h('button', { class: 'btn small', type: 'submit' }, 'Add holiday')),
    suggest);
}

// ---------- Shifts ----------

function shiftsCard() {
  const list = h('div');
  const draw = () => list.replaceChildren(state.shifts.length
    ? h('table', { class: 'mini' }, h('tbody', {}, state.shifts.map((sh) => h('tr', {},
      h('td', {}, h('b', {}, sh.name), h('small', { class: 'dist' }, `${sh.start}–${sh.end}${sh.overnight ? ' (overnight)' : ''} · late after ${sh.lateAfter}`)),
      h('td', { class: 'num' }, plural(sh.staffCount ?? 0, 'person').replace('persons', 'people')),
      h('td', {}, h('div', { class: 'actions' },
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => shiftForm(sh, reload) }, 'Edit'),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => removeShift(sh) }, 'Delete')))))))
    : h('p', { class: 'muted' }, 'No shifts yet. Everyone uses the company late time above.'));
  const reload = async () => { state.shifts = (await api('/shifts')).shifts; draw(); };
  const removeShift = async (sh) => {
    if (!confirm(`Delete the ${sh.name} shift? People on it will use the company late time.`)) return;
    try { await api(`/shifts/${sh.id}`, { method: 'DELETE' }); toast(`${sh.name} deleted`); reload(); } catch (err) { toast(err.message); }
  };
  draw();
  return h('div', { class: 'card form-card' },
    h('h3', {}, 'Shifts'),
    h('p', { class: 'hint' }, 'Set working hours for different groups, then choose each person’s shift in Staff. Late marks follow their shift; Today shows who left before it ended.'),
    list,
    h('div', { class: 'loc-actions', style: 'margin-top:14px' }, h('button', { class: 'btn small', type: 'button', onclick: () => shiftForm(null, reload) }, '+ Add shift')));
}

function shiftForm(sh, onDone) {
  const msg = h('p', { class: 'msg' });
  const t = (label, name, value) => h('label', { class: 'field' }, h('span', {}, label), h('input', { name, type: 'time', value: value || '', required: name !== 'lateAfter' }));
  const form = h('form', {},
    h('label', { class: 'field' }, h('span', {}, 'Name'), h('input', { name: 'name', value: sh?.name || '', placeholder: 'e.g. Morning, Night, Store', required: true })),
    h('div', { class: 'row2' }, t('Starts', 'start', sh?.start), t('Ends', 'end', sh?.end)),
    t('Late after (blank = 15 minutes after the start)', 'lateAfter', sh?.lateAfter),
    h('p', { class: 'hint legend', style: 'margin:0 0 8px' }, 'For a night shift, put an end time earlier than the start (e.g. 22:00 to 06:00).'),
    msg,
    h('div', { class: 'foot' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn', type: 'submit' }, sh ? 'Save' : 'Add shift')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; msg.textContent = '';
    const v = Object.fromEntries(new FormData(form));
    try {
      await api(sh ? `/shifts/${sh.id}` : '/shifts', { method: sh ? 'PATCH' : 'POST', body: { name: v.name, start: v.start, end: v.end, lateAfter: v.lateAfter || null } });
      closeModal(); toast(sh ? 'Shift saved' : 'Shift added'); onDone();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  });
  openModal([h('h3', {}, sh ? `Edit ${sh.name}` : 'Add a shift'), form]);
}

// Out time on Today, with "left early", "set by admin" and a way to fill in a missed check-out.
function outCell(p, refresh) {
  const notes = [];
  if (p.leftEarlyBy) notes.push(h('small', { class: 'dist away' }, `Left ${durText(p.leftEarlyBy)} early`));
  if (p.checkOutSetByAdmin) notes.push(h('small', { class: 'dist' }, 'Set by admin'));
  if (p.noCheckOut) {
    return [h('span', { class: 'pill absent' }, 'No check-out'), h('br'),
      h('button', { class: 'link-btn small-link', onclick: () => setOutTime(p, refresh) }, 'Set out time')];
  }
  return [p.checkOut, ...notes];
}

async function setOutTime(p, refresh) {
  const v = prompt(`${p.name} checked in at ${p.checkIn} and didn't check out. What time did they leave? (HH:MM, 24-hour)`, '18:00');
  if (v === null) return;
  try { await api(`/attendance/${p.attendanceId}`, { method: 'PATCH', body: { checkOut: v.trim() } }); toast('Out time saved'); refresh(); } catch (err) { toast(err.message); }
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

const VIEWS = { today: viewToday, month: viewMonth, leave: viewLeave, salary: viewSalary, staff: viewStaff, settings: viewSettings, clients: viewClients };

// ---------- boot ----------
if (localStorage.getItem(TOKEN_KEY)) start(); else showAuth();
