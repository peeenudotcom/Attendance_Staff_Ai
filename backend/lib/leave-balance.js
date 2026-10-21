import { db, must } from './db.js';
import { istDay, weekday } from './attendance.js';
import { holidayMap } from './holidays.js';
import { datesBetween } from './leave.js';
import { joinedOn } from './report.js';

/** Leave types that use the paid leave balance (unpaid leave never does). */
export const usesBalance = (type) => type !== 'unpaid';

/**
 * A person's paid leave for the current calendar year (IST). With `paid_leave_per_year` set, they earn 1/12 of it
 * each month from January (or the month they joined), rounded down to half days, and it resets every January.
 * Casual, sick and paid leave on working days (not the weekly off or holidays) use it; `pending` is leave still
 * waiting for a decision. Without a limit, only `used` and `pending` are reported.
 */
export async function leaveBalance(org, staff, { today = istDay(new Date()) } = {}) {
  const year = today.slice(0, 4);
  const first = `${year}-01-01`; const last = `${year}-12-31`;
  const rows = must(await db().from('leave_requests').select('from_date, to_date, type, status')
    .eq('staff_id', staff.id).lte('from_date', last).gte('to_date', first))
    .filter((r) => usesBalance(r.type) && (r.status === 'approved' || r.status === 'pending'));
  const holidays = await holidayMap(org.id, first, last);
  const count = (r) => datesBetween(r.from_date < first ? first : r.from_date, r.to_date > last ? last : r.to_date)
    .filter((d) => weekday(d) !== org.weekly_off && !holidays.has(d)).length;
  const used = rows.filter((r) => r.status === 'approved').reduce((n, r) => n + count(r), 0);
  const pending = rows.filter((r) => r.status === 'pending').reduce((n, r) => n + count(r), 0);
  const perYear = org.paid_leave_per_year ?? null;
  if (perYear == null) return { limited: false, year: Number(year), used, pending };

  const joined = joinedOn(staff);
  const startMonth = joined > first ? Number(joined.slice(5, 7)) : 1;
  const months = Math.max(0, Number(today.slice(5, 7)) - startMonth + 1);
  const earned = Math.floor((perYear * months / 12) * 2) / 2;
  return { limited: true, year: Number(year), perYear, earned, used, pending, available: Math.max(0, earned - used - pending) };
}
