import { db, must } from './db.js';
import { fmtTime, istDay, monthDays, weekday } from './attendance.js';
import { approvedLeave } from './leave.js';

/**
 * What a day was for one person, given their attendance row (or none):
 * 'present' | 'late' (checked in), 'half' (checked out with fewer than `halfDayMinutes` worked),
 * 'off' (weekly off), 'before' (not yet joined), 'leave' (approved leave),
 * 'pending' (today or later, not checked in yet) or 'absent'. Checking in wins over leave.
 */
export function dayStatus({ row, date, joinedOn, weeklyOff, onLeave = false, halfDayMinutes = null }) {
  if (row?.check_in_at) {
    if (halfDayMinutes && row.check_out_at && (row.worked_minutes ?? 0) < halfDayMinutes) return 'half';
    return row.status;
  }
  if (date < joinedOn) return 'before';
  if (weeklyOff != null && weekday(date) === weeklyOff) return 'off';
  if (onLeave) return 'leave';
  if (date >= istDay(new Date())) return 'pending';
  return 'absent';
}

export const joinedOn = (s) => istDay(new Date(s.created_at));

/**
 * A company's month: every active staff member's status for each day, with totals.
 * Cells: { status, in?, out?, minutes?, leaveType? }. Totals count present, late, half, absent, off and leave days up to today
 * (paidLeave/unpaidLeave split the leave) and worked minutes.
 */
export async function buildMonth(org, monthParam) {
  const { month, days } = monthDays(monthParam);
  const weeklyOff = org.weekly_off;
  const staff = must(await db().from('staff').select('*').eq('org_id', org.id).eq('active', true).order('name'));
  const rows = must(await db().from('attendance').select('id, staff_id, date, status, check_in_at, check_out_at, worked_minutes, check_in_edited_by, check_out_edited_by, admin_note')
    .eq('org_id', org.id).gte('date', days[0]).lte('date', days[days.length - 1]));
  const leave = await approvedLeave(db(), org.id, days[0], days[days.length - 1]);
  const key = (staffId, date) => `${staffId}|${date}`;
  const byKey = new Map(rows.map((r) => [key(r.staff_id, r.date), r]));
  const today = istDay(new Date());

  return {
    month,
    days,
    weeklyOff,
    staff: staff.map((s) => {
      const totals = { present: 0, late: 0, half: 0, absent: 0, off: 0, leave: 0, paidLeave: 0, unpaidLeave: 0, minutes: 0 };
      const cells = {};
      for (const date of days) {
        const r = byKey.get(key(s.id, date));
        const leaveType = leave.get(s.id)?.get(date);
        const status = dayStatus({ row: r, date, joinedOn: joinedOn(s), weeklyOff, onLeave: !!leaveType, halfDayMinutes: org.half_day_minutes });
        // Totals only count days up to today, so a month in progress isn't paid for Sundays or leave still to come.
        if (date <= today && status in totals) totals[status] += 1;
        if (date <= today && status === 'leave') totals[leaveType === 'unpaid' ? 'unpaidLeave' : 'paidLeave'] += 1;
        if (r?.worked_minutes) totals.minutes += r.worked_minutes;
        cells[date] = r?.check_in_at
          ? { status, id: r.id, in: fmtTime(r.check_in_at), out: fmtTime(r.check_out_at), minutes: r.worked_minutes,
            ...(r.check_in_edited_by || r.check_out_edited_by ? { edited: true } : {}), ...(r.admin_note ? { note: r.admin_note } : {}) }
          : status === 'leave' ? { status, leaveType } : { status };
      }
      return { staff: s, id: s.id, name: s.name, designation: s.designation, department: s.department, days: cells, totals };
    }),
  };
}
