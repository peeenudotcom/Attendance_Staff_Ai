import { db, must } from './db.js';
import { HttpError } from './http.js';
import { istDay } from './attendance.js';
import { isLateFor, parseHhmm } from './shifts.js';

/** "HH:MM" on an IST date -> Date. */
export const atOn = (date, minutes) => new Date(Date.parse(`${date}T00:00:00+05:30`) + minutes * 60_000);

/** A company member with their shift and company, for working out late marks. */
export async function memberWithShift(staffId, org) {
  const s = must(await db().from('staff').select('*').eq('id', staffId).eq('org_id', org.id).maybeSingle());
  if (!s) throw new HttpError(404, 'Staff member not found');
  s.org = org;
  s.shift = s.shift_id ? must(await db().from('shifts').select('*').eq('id', s.shift_id).maybeSingle()) : null;
  return s;
}

/**
 * Check-in/out times for a day from "HH:MM" strings. The check-out is on the same day, or the next day if it's
 * not after the check-in (a night shift). Returns the columns to save (status, times, worked minutes).
 */
export function dayTimes(person, date, checkIn, checkOut) {
  const inAt = atOn(date, parseHhmm(checkIn, 'check-in time'));
  if (inAt > new Date()) throw new HttpError(400, 'The check-in time is in the future');
  const cols = { check_in_at: inAt.toISOString(), status: isLateFor(inAt, person) ? 'late' : 'present', check_out_at: null, worked_minutes: null };
  if (checkOut) {
    let outAt = atOn(date, parseHhmm(checkOut, 'check-out time'));
    if (outAt <= inAt) outAt = new Date(outAt.getTime() + 86_400_000);
    if (outAt - inAt > 20 * 3_600_000) throw new HttpError(400, 'The check-out is more than 20 hours after the check-in');
    if (outAt > new Date()) throw new HttpError(400, 'The check-out time is in the future');
    cols.check_out_at = outAt.toISOString();
    cols.worked_minutes = Math.round((outAt - inAt) / 60_000);
  }
  return cols;
}

export function checkDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || Number.isNaN(Date.parse(date))) throw new HttpError(400, 'Choose a date');
  if (date > istDay(new Date())) throw new HttpError(400, "You can't add attendance for a future day");
  return date;
}

export const noteText = (v) => (v == null ? null : String(v).trim().slice(0, 200) || null);
