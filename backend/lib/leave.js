import { HttpError } from './http.js';
import { istDay, weekday } from './attendance.js';

export const LEAVE_TYPES = { casual: 'Casual leave', sick: 'Sick leave', paid: 'Paid leave', unpaid: 'Unpaid leave' };
const ACTIVE = ['pending', 'approved'];
const DAY = 86_400_000;

const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Every date from `from` to `to`, inclusive ("YYYY-MM-DD"). */
export function datesBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Days of leave a request uses: its dates minus the company's weekly off. */
export const leaveDays = (r, weeklyOff) => datesBetween(r.from_date, r.to_date).filter((d) => weekday(d) !== weeklyOff).length;

/** Checks a new request's fields; returns the row to insert (without org/staff). */
export function leaveFields(b) {
  const from = String(b.from || '');
  const to = String(b.to || b.from || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw new HttpError(400, 'Choose the leave dates');
  }
  if (to < from) throw new HttpError(400, 'The last day must be on or after the first day');
  if (from < addDays(istDay(new Date()), -30)) throw new HttpError(400, 'Leave can only be asked for up to 30 days back');
  if (to > addDays(from, 59)) throw new HttpError(400, 'One request can cover at most 60 days');
  if (!LEAVE_TYPES[b.type]) throw new HttpError(400, 'Choose the type of leave');
  const reason = b.reason == null ? null : String(b.reason).trim().slice(0, 500) || null;
  return { from_date: from, to_date: to, type: b.type, reason };
}

/** Throws if the person already has a pending or approved request on any of these dates. */
export function assertNoOverlap(existing, { from_date, to_date }) {
  const clash = existing.find((r) => ACTIVE.includes(r.status) && r.from_date <= to_date && r.to_date >= from_date);
  if (clash) throw new HttpError(409, `You already have ${clash.status === 'approved' ? 'approved' : 'a pending request for'} leave on some of these days`);
}

/** A request as the app and dashboard show it. */
export function leaveView(r, { weeklyOff, staffName } = {}) {
  return {
    id: r.id,
    staffId: r.staff_id,
    ...(staffName !== undefined ? { staffName } : {}),
    from: r.from_date,
    to: r.to_date,
    days: leaveDays(r, weeklyOff),
    type: r.type,
    typeLabel: LEAVE_TYPES[r.type],
    reason: r.reason,
    status: r.status,
    note: r.decision_note,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
  };
}

/** staffId -> Set of dates on approved leave, from approved requests. */
export function leaveDateMap(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.status !== 'approved') continue;
    if (!map.has(r.staff_id)) map.set(r.staff_id, new Set());
    for (const d of datesBetween(r.from_date, r.to_date)) map.get(r.staff_id).add(d);
  }
  return map;
}

/** A company's approved leave touching the date range (for reports). */
export async function approvedLeave(db, orgId, first, last) {
  const { data, error } = await db.from('leave_requests').select('staff_id, from_date, to_date, status')
    .eq('org_id', orgId).eq('status', 'approved').lte('from_date', last).gte('to_date', first);
  if (error) throw new Error(error.message);
  return leaveDateMap(data);
}

export const fmtLeaveDates = (from, to) => {
  const f = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return from === to ? f(from) : `${f(from)} to ${f(to)}`;
};
