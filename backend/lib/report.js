import { istDay, weekday } from './attendance.js';

/**
 * What a day was for one person, given their attendance row (or none):
 * 'present' | 'late' (checked in), 'off' (weekly off), 'before' (not yet joined), 'leave' (approved leave),
 * 'pending' (today or later, not checked in yet) or 'absent'. Checking in wins over leave.
 */
export function dayStatus({ row, date, joinedOn, weeklyOff, onLeave = false }) {
  if (row?.check_in_at) return row.status;
  if (date < joinedOn) return 'before';
  if (weeklyOff != null && weekday(date) === weeklyOff) return 'off';
  if (onLeave) return 'leave';
  if (date >= istDay(new Date())) return 'pending';
  return 'absent';
}

export const joinedOn = (s) => istDay(new Date(s.created_at));
