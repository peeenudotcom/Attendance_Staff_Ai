import { db, must } from './db.js';
import { HttpError } from './http.js';
import { signLink } from './auth.js';
import { closeRecord, monthName, salarySheet } from './month-close.js';

const SITE = 'https://haazri.tarahutaibuilds.com';
const LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * One person's salary slip for a month: the closed month's saved sheet, or live figures while it is open.
 * Earned from attendance excludes overtime, which is shown on its own line.
 */
export async function payslip(org, month, staffId) {
  const rec = await closeRecord(org.id, month);
  const closed = !!(rec?.closed && rec.snapshot);
  const sheet = closed ? rec.snapshot : await salarySheet(org, month);
  const p = sheet.staff.find((x) => x.id === staffId);
  if (!p) throw new HttpError(404, 'No salary for this person in that month');
  const s = must(await db().from('staff').select('phone, department, designation').eq('id', staffId).maybeSingle());
  return {
    company: org.name,
    month: sheet.month,
    monthLabel: monthName(sheet.month),
    closed,
    inProgress: !closed && !!sheet.inProgress,
    staffId,
    name: p.name,
    designation: p.designation ?? s?.designation ?? null,
    department: s?.department ?? null,
    phone: s?.phone ?? null,
    salaryType: p.salaryType,
    salary: p.salary,
    missing: !!p.missing,
    daysInMonth: sheet.daysInMonth,
    worked: p.worked,
    off: p.off,
    holiday: p.holiday ?? 0,
    paidLeave: p.paidLeave,
    unpaidLeave: p.unpaidLeave,
    absent: p.absent,
    half: p.half ?? 0,
    late: p.late,
    lateCutDays: p.lateCutDays ?? 0,
    hours: p.hours,
    payDays: p.payDays,
    overtimeHours: p.overtimeHours ?? 0,
    overtimePay: p.overtimePay ?? 0,
    earned: p.pay == null ? null : p.pay - (p.overtimePay ?? 0),
    adjustments: p.adjustments ?? [],
    payable: p.payable,
  };
}

/** A link that opens the slip without signing in (for sharing on WhatsApp), valid for 90 days. */
export const payslipLink = (orgId, month, staffId) =>
  `${SITE}/payslip?t=${signLink({ k: 'payslip', o: orgId, m: month, s: staffId }, LINK_TTL_MS)}`;

/** Months this person has a slip for: closed months whose saved sheet includes them, newest first. */
export async function closedPayslips(orgId, staffId) {
  const rows = must(await db().from('month_closes').select('month, closed, snapshot').eq('org_id', orgId).eq('closed', true));
  return rows
    .map((r) => ({ month: r.month, p: r.snapshot?.staff?.find((x) => x.id === staffId) }))
    .filter((r) => r.p)
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .map((r) => ({ month: r.month, label: monthName(r.month), payable: r.p.payable }));
}
