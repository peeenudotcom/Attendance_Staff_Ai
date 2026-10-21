import { db, must } from './db.js';
import { HttpError } from './http.js';
import { istDay, monthDays } from './attendance.js';
import { buildMonth, inMonth } from './report.js';
import { monthPay } from './payroll.js';

/** Salary adjustments an admin can record against a person's month, and whether each adds to or takes from pay. */
export const ADJUSTMENT_KINDS = {
  advance: { label: 'Advance paid', sign: -1 },
  bonus: { label: 'Bonus', sign: 1 },
  deduction: { label: 'Deduction', sign: -1 },
  addition: { label: 'Other addition', sign: 1 },
};

export const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const round2 = (n) => Math.round(n * 100) / 100;

/** Every "YYYY-MM" from the month of `from` to the month of `to` (dates or months). */
export function monthsBetween(from, to = from) {
  const out = [];
  let [y, m] = String(from).slice(0, 7).split('-').map(Number);
  const end = String(to).slice(0, 7);
  for (let i = 0; i < 36; i++) {
    const cur = `${y}-${String(m).padStart(2, '0')}`;
    out.push(cur);
    if (cur >= end) break;
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** Throws 409 if any of the given dates or months is in a closed month of this company. */
export async function assertMonthsOpen(orgId, datesOrMonths) {
  const months = [...new Set(datesOrMonths.filter(Boolean).map((d) => String(d).slice(0, 7)))];
  if (!months.length) return;
  const closed = must(await db().from('month_closes').select('month').eq('org_id', orgId).eq('closed', true).in('month', months));
  if (closed.length) {
    const first = closed.map((c) => c.month).sort()[0];
    throw new HttpError(409, `${monthName(first)} is closed. Reopen it on the Salary page to make changes.`);
  }
}

export async function closeRecord(orgId, month) {
  return must(await db().from('month_closes').select('*').eq('org_id', orgId).eq('month', month).maybeSingle());
}

export async function closeLog(orgId, month) {
  const rows = must(await db().from('month_close_log').select('action, reason, by_name, at').eq('org_id', orgId).eq('month', month).order('at'));
  return rows.map((r) => ({ action: r.action, reason: r.reason, by: r.by_name, at: r.at }));
}

const adjustmentView = (a) => ({
  id: a.id, kind: a.kind, label: ADJUSTMENT_KINDS[a.kind]?.label ?? a.kind,
  amount: Number(a.amount), signed: Number(a.amount) * (ADJUSTMENT_KINDS[a.kind]?.sign ?? 1), note: a.note, createdAt: a.created_at,
});

/**
 * The live salary sheet for a month: for each active person, pay earned from attendance (lib/payroll.js), the month's
 * adjustments (advances, bonuses, deductions, additions) and the balance payable = earned + additions − deductions.
 */
export async function salarySheet(org, monthParam) {
  const m = await buildMonth(org, monthParam);
  const lateCutEvery = org.late_cut_every ?? null;
  const today = istDay(new Date());
  const adj = must(await db().from('pay_adjustments').select('id, staff_id, kind, amount, note, created_at')
    .eq('org_id', org.id).eq('month', m.month).order('created_at'));
  const overtimeRate = org.overtime_rate == null ? null : Number(org.overtime_rate);
  const people = m.staff.map(({ staff: s, normalDayMinutes, id, name, designation, leftOn, totals }) => {
    const pay = monthPay({ salaryType: s.salary_type, salary: s.salary == null ? null : Number(s.salary), totals, daysInMonth: m.days.length, lateCutEvery, overtimeRate, normalDayMinutes });
    const adjustments = adj.filter((a) => a.staff_id === id).map(adjustmentView);
    const adjustmentTotal = round2(adjustments.reduce((sum, a) => sum + a.signed, 0));
    return {
      id, name, designation, ...(leftOn ? { leftOn } : {}), salaryType: s.salary_type, salary: s.salary == null ? null : Number(s.salary), ...pay,
      adjustments, adjustmentTotal, payable: pay.pay == null ? null : round2(pay.pay + adjustmentTotal),
    };
  });
  return {
    month: m.month,
    daysInMonth: m.days.length,
    inProgress: m.days[m.days.length - 1] >= today && m.days[0] <= today,
    lateCutEvery,
    overtimeRate,
    overtimeAfterMinutes: org.overtime_after_minutes ?? 480,
    weeklyOff: org.weekly_off ?? null,
    halfDayMinutes: org.half_day_minutes ?? null,
    total: people.reduce((sum, p) => sum + (p.pay ?? 0), 0),
    adjustmentTotal: round2(people.reduce((sum, p) => sum + p.adjustmentTotal, 0)),
    payableTotal: round2(people.reduce((sum, p) => sum + (p.payable ?? 0), 0)),
    missing: people.filter((p) => p.missing).length,
    staff: people,
  };
}

/**
 * What to sort out before closing a month: check-ins with no check-out, leave and correction requests still waiting,
 * and people with no pay set. A month can be closed only after it has ended.
 */
export async function closeChecks(org, monthParam) {
  const { month, days } = monthDays(monthParam);
  const first = days[0]; const last = days[days.length - 1];
  const ended = last < istDay(new Date());
  const staff = must(await db().from('staff').select('id, name, salary_type, salary, active, left_on, created_at').eq('org_id', org.id))
    .filter((s) => inMonth(s, first, last));
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const open = must(await db().from('attendance').select('staff_id, date, check_in_at, check_out_at')
    .eq('org_id', org.id).gte('date', first).lte('date', last));
  const corrections = must(await db().from('correction_requests').select('staff_id, date, kind')
    .eq('org_id', org.id).eq('status', 'pending').gte('date', first).lte('date', last));
  const pending = must(await db().from('leave_requests').select('staff_id, from_date, to_date, status')
    .eq('org_id', org.id).eq('status', 'pending').lte('from_date', last).gte('to_date', first));
  return {
    month,
    ended,
    missingCheckOuts: open.filter((r) => r.check_in_at && !r.check_out_at && nameOf.has(r.staff_id))
      .map((r) => ({ staffId: r.staff_id, name: nameOf.get(r.staff_id), date: r.date }))
      .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date < b.date ? -1 : 1)),
    pendingLeave: pending.filter((r) => nameOf.has(r.staff_id))
      .map((r) => ({ staffId: r.staff_id, name: nameOf.get(r.staff_id), from: r.from_date, to: r.to_date })),
    pendingCorrections: corrections.filter((r) => nameOf.has(r.staff_id))
      .map((r) => ({ staffId: r.staff_id, name: nameOf.get(r.staff_id), date: r.date, kind: r.kind })),
    payNotSet: staff.filter((s) => !s.salary_type || s.salary == null).map((s) => s.name).sort(),
  };
}
