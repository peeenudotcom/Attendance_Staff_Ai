import { db, must } from '../../lib/db.js';
import { readLink } from '../../lib/auth.js';
import { payslip } from '../../lib/payslip.js';

// GET /payslip?t=<signed link> (public; rewritten to /api/payslips/view) -> the salary slip as a printable page.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const PAY = { monthly: 'Monthly', weekly: 'Weekly', daily: 'Daily', hourly: 'Hourly' };
const PER = { monthly: ' a month', weekly: ' a week', daily: ' a day', hourly: ' an hour' };
const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex"><link rel="icon" type="image/png" href="/favicon.png">
<style>
:root{--bg:#F7F3EC;--card:#fff;--text:#2A1418;--muted:#6B5A57;--line:#E5DCCF;--accent:#802534;--ok:#2F7D74;--neg:#B42318}
@media (prefers-color-scheme:dark){:root{--bg:#150C0F;--card:#1F1317;--text:#F4EFE7;--muted:#BBAFA8;--line:#3A262B;--accent:#E39AA6;--ok:#45A79F;--neg:#F97066}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px 48px}
.slip{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:18px 0 6px;color:var(--accent)}
.muted{color:var(--muted)}.top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px}
table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid var(--line);vertical-align:top}td.n{text-align:right;white-space:nowrap}
tr:last-child td{border-bottom:0}.neg{color:var(--neg)}.total td{font-weight:700;font-size:17px;border-top:2px solid var(--text)}
.note{background:#FFF4E5;color:#7A4B00;border-radius:10px;padding:10px 12px;margin:0 0 14px}
@media (prefers-color-scheme:dark){.note{background:#3A2A10;color:#F5C26B}}
.bar{display:flex;gap:10px;margin-top:16px}.btn{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer}
@media print{body{background:#fff;color:#000}.bar{display:none}.slip{border:0;padding:0}main{padding:0}}
</style></head><body><main>${inner}</main></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  const link = readLink(req.query?.t);
  if (!link || link.k !== 'payslip') {
    return res.status(404).send(page('Link expired', '<div class="slip"><h1>This link has expired</h1><p class="muted">Ask your admin to share the salary slip again, or open it in the Haazri app.</p></div>'));
  }
  try {
    const org = must(await db().from('organizations').select('*').eq('id', link.o).maybeSingle());
    if (!org) return res.status(404).send(page('Not found', '<div class="slip"><h1>Salary slip not found</h1></div>'));
    const s = await payslip(org, link.m, link.s);
    const row = (label, value, cls = '') => `<tr><td>${label}</td><td class="n ${cls}">${value}</td></tr>`;
    const attendance = [
      row('Days in month', s.daysInMonth),
      row('Days worked', s.worked),
      row('Weekly off and holidays', s.off + s.holiday),
      row('Paid leave', s.paidLeave),
      s.unpaidLeave ? row('Unpaid leave', s.unpaidLeave) : '',
      s.absent ? row('Absent', s.absent) : '',
      s.half ? row('Half days', s.half) : '',
      s.late ? row('Late marks', s.late) : '',
      s.salaryType === 'hourly' ? row('Hours worked', s.hours) : (s.payDays != null ? row('Paid days', s.payDays) : ''),
      s.overtimeHours ? row('Overtime hours', s.overtimeHours) : '',
    ].join('');
    const plus = s.adjustments.filter((a) => a.signed > 0);
    const minus = s.adjustments.filter((a) => a.signed < 0);
    const earnings = [
      row(`Salary for ${s.salaryType === 'hourly' ? 'hours worked' : 'paid days'}${s.lateCutDays ? ` (after ${days(s.lateCutDays)} cut for late marks)` : ''}`, s.earned == null ? '—' : rupees(s.earned)),
      s.overtimePay ? row('Overtime', rupees(s.overtimePay)) : '',
      ...plus.map((a) => row(`${esc(a.label)}${a.note ? ` <span class="muted">· ${esc(a.note)}</span>` : ''}`, rupees(a.amount))),
    ].join('');
    const deductions = minus.map((a) => row(`${esc(a.label)}${a.note ? ` <span class="muted">· ${esc(a.note)}</span>` : ''}`, `−${rupees(a.amount)}`, 'neg')).join('');
    const inner = `
<div class="slip">
  ${s.closed ? '' : `<p class="note">${s.inProgress ? 'This month is not over yet: figures are up to today and will change.' : 'This month is not closed yet: figures may still change.'}</p>`}
  <div class="top">
    <div><h1>${esc(s.company)}</h1><div class="muted">Salary slip · ${esc(s.monthLabel)}</div></div>
    <div style="text-align:right"><b>${esc(s.name)}</b><div class="muted">${esc([s.designation, s.department].filter(Boolean).join(' · '))}</div>
    ${s.phone ? `<div class="muted">+91 ******${esc(String(s.phone).slice(-4))}</div>` : ''}</div>
  </div>
  <h2>Pay</h2>
  <table>${s.missing ? row('Pay', 'Not set') : row('Pay type', `${PAY[s.salaryType] ?? ''} · ${rupees(s.salary)}${PER[s.salaryType] ?? ''}`)}</table>
  <h2>Attendance</h2><table>${attendance}</table>
  <h2>Earnings</h2><table>${earnings}</table>
  ${deductions ? `<h2>Deductions</h2><table>${deductions}</table>` : ''}
  <table style="margin-top:14px"><tr class="total"><td>Net payable</td><td class="n">${s.payable == null ? '—' : rupees(s.payable)}</td></tr></table>
  <p class="muted" style="margin:16px 0 0;font-size:13px">Worked out from attendance in TARAhut Haazri. Computer-generated slip; no signature needed.</p>
</div>
<div class="bar"><button class="btn" onclick="window.print()">Print or save as PDF</button></div>`;
    return res.status(200).send(page(`Salary slip ${s.monthLabel} · ${s.name}`, inner));
  } catch (err) {
    if (err.status === 404) return res.status(404).send(page('Not found', '<div class="slip"><h1>Salary slip not found</h1><p class="muted">This person may no longer be in that month\'s salary sheet.</p></div>'));
    console.error('[payslip view]', err);
    return res.status(500).send(page('Error', '<div class="slip"><h1>Something went wrong</h1><p class="muted">Please try again.</p></div>'));
  }
}
