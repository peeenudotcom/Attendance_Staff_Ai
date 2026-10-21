import { db, must } from './db.js';
import { fmtTime, istDay, monthDays, weekday } from './attendance.js';
import { approvedLeave } from './leave.js';
import { holidayMap } from './holidays.js';

/**
 * What a day was for one person, given their attendance row (or none):
 * 'present' | 'late' (checked in), 'half' (checked out with fewer than `halfDayMinutes` worked),
 * 'off' (weekly off), 'holiday' (company holiday), 'before' (not yet joined), 'leave' (approved leave),
 * 'left' (after the day they were switched off), 'pending' (today or later, not checked in yet) or 'absent'.
 * Checking in wins over leave.
 */
export function dayStatus({ row, date, joinedOn, leftOn = null, weeklyOff, onLeave = false, halfDayMinutes = null, holiday = false }) {
  if (row?.check_in_at) {
    if (halfDayMinutes && row.check_out_at && (row.worked_minutes ?? 0) < halfDayMinutes) return 'half';
    return row.status;
  }
  if (date < joinedOn) return 'before';
  if (leftOn && date > leftOn) return 'left';
  if (weeklyOff != null && weekday(date) === weeklyOff) return 'off';
  if (holiday) return 'holiday';
  if (onLeave) return 'leave';
  if (date >= istDay(new Date())) return 'pending';
  return 'absent';
}

export const joinedOn = (s) => istDay(new Date(s.created_at));

const OVERTIME_GRACE = 15; // fewer extra minutes than this in a day are not overtime
/** A person's normal working day in minutes: their shift's length, else the company's setting, else 8 hours. */
export function normalDayMinutes(shift, org) {
  if (shift) return ((shift.end_minutes - shift.start_minutes + 1440) % 1440) || 1440;
  return org.overtime_after_minutes ?? 480;
}
/** Overtime minutes in one day's attendance row for someone whose normal day is `normal` minutes. */
export function overtimeMinutes(row, normal) {
  const extra = (row?.check_out_at ? row.worked_minutes ?? 0 : 0) - normal;
  return extra >= OVERTIME_GRACE ? extra : 0;
}

/** Was this person with the company at some point in [first, last]? Switched-off people count up to the day they left. */
export const inMonth = (s, first, last) => (s.active || (s.left_on && s.left_on >= first)) && joinedOn(s) <= last;

/**
 * A company's month (or, with `staffId`, one person's): every staff member who was with the company that month (active,
 * or switched off during or after it), their status for each day, with totals.
 * Cells: { status, in?, out?, minutes?, leaveType? }. Totals count present, late, half, absent, off, holiday and leave days up to today
 * (paidLeave/unpaidLeave split the leave), worked minutes and overtime minutes (beyond the person's normal day).
 */
export async function buildMonth(org, monthParam, { staffId = null } = {}) {
  const { month, days } = monthDays(monthParam);
  const weeklyOff = org.weekly_off;
  let staffQ = db().from('staff').select('*').eq('org_id', org.id);
  if (staffId) staffQ = staffQ.eq('id', staffId);
  const staff = must(await staffQ.order('name')).filter((s) => inMonth(s, days[0], days[days.length - 1]));
  let rowsQ = db().from('attendance').select('id, staff_id, date, status, check_in_at, check_out_at, worked_minutes, check_in_edited_by, check_out_edited_by, admin_note')
    .eq('org_id', org.id).gte('date', days[0]).lte('date', days[days.length - 1]);
  if (staffId) rowsQ = rowsQ.eq('staff_id', staffId);
  const rows = must(await rowsQ);
  const leave = await approvedLeave(db(), org.id, days[0], days[days.length - 1]);
  const holidays = await holidayMap(org.id, days[0], days[days.length - 1]);
  const shifts = new Map(must(await db().from('shifts').select('*').eq('org_id', org.id)).map((x) => [x.id, x]));
  const key = (sid, date) => `${sid}|${date}`;
  const byKey = new Map(rows.map((r) => [key(r.staff_id, r.date), r]));
  const today = istDay(new Date());

  return {
    month,
    days,
    weeklyOff,
    holidays: Object.fromEntries(holidays),
    staff: staff.map((s) => {
      const totals = { present: 0, late: 0, half: 0, absent: 0, off: 0, holiday: 0, leave: 0, paidLeave: 0, unpaidLeave: 0, minutes: 0, overtimeMinutes: 0 };
      const normal = normalDayMinutes(shifts.get(s.shift_id), org);
      const cells = {};
      for (const date of days) {
        const r = byKey.get(key(s.id, date));
        const leaveType = leave.get(s.id)?.get(date);
        const status = dayStatus({ row: r, date, joinedOn: joinedOn(s), leftOn: s.left_on ?? null, weeklyOff, onLeave: !!leaveType, halfDayMinutes: org.half_day_minutes, holiday: holidays.has(date) });
        // Totals only count days up to today, so a month in progress isn't paid for Sundays or leave still to come.
        if (date <= today && status in totals) totals[status] += 1;
        if (date <= today && status === 'leave') totals[leaveType === 'unpaid' ? 'unpaidLeave' : 'paidLeave'] += 1;
        if (r?.worked_minutes) totals.minutes += r.worked_minutes;
        totals.overtimeMinutes += overtimeMinutes(r, normal);
        cells[date] = r?.check_in_at
          ? { status, id: r.id, in: fmtTime(r.check_in_at), out: fmtTime(r.check_out_at), minutes: r.worked_minutes,
            ...(r.check_in_edited_by || r.check_out_edited_by ? { edited: true } : {}), ...(r.admin_note ? { note: r.admin_note } : {}) }
          : status === 'leave' ? { status, leaveType } : status === 'holiday' ? { status, holiday: holidays.get(date) } : { status };
      }
      return { staff: s, normalDayMinutes: normal, id: s.id, name: s.name, designation: s.designation, department: s.department, ...(s.active ? {} : { leftOn: s.left_on }), days: cells, totals };
    }),
  };
}
