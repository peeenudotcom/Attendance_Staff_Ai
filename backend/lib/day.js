import { db, must } from './db.js';
import { dayStatus, joinedOn } from './report.js';
import { approvedLeave } from './leave.js';
import { holidayMap } from './holidays.js';

/**
 * Everyone active in a company on one day, with their attendance row (if any) and day status
 * (people who had not joined yet are left out), plus the day's holiday name and the company's shifts.
 */
export async function dayPeople(org, date) {
  const staff = must(await db().from('staff').select('*').eq('org_id', org.id).eq('active', true).order('name'));
  const rows = must(await db().from('attendance').select('*').eq('org_id', org.id).eq('date', date));
  const byStaff = new Map(rows.map((r) => [r.staff_id, r]));
  const leave = await approvedLeave(db(), org.id, date, date);
  const holiday = (await holidayMap(org.id, date, date)).get(date) ?? null;
  const shifts = new Map(must(await db().from('shifts').select('*').eq('org_id', org.id)).map((x) => [x.id, x]));
  const people = staff.map((s) => {
    const row = byStaff.get(s.id) ?? null;
    const status = dayStatus({ row, date, joinedOn: joinedOn(s), weeklyOff: org.weekly_off, onLeave: !!leave.get(s.id)?.has(date), halfDayMinutes: org.half_day_minutes, holiday: !!holiday });
    return { s, row, status };
  }).filter((p) => p.status !== 'before');
  return { people, holiday, shifts };
}

/** Counts for a day's people: present (incl. half days), late, absent, not checked in yet, off, leave, holiday. */
export function daySummary(people) {
  const count = (st) => people.filter((p) => p.status === st).length;
  return {
    total: people.length,
    present: count('present') + count('half'),
    late: count('late'),
    absent: count('absent'),
    notYet: count('pending'),
    off: count('off'),
    leave: count('leave'),
    half: count('half'),
    holiday: count('holiday'),
  };
}
