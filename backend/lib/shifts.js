import { HttpError } from './http.js';

const IST_OFFSET_MIN = 330;
const minuteOfDay = (d) => { const t = new Date(d.getTime() + IST_OFFSET_MIN * 60_000); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
export const hhmm = (m) => (m == null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
export function parseHhmm(v, what) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? ''));
  const n = m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new HttpError(400, `Enter the ${what} as HH:MM`);
  return n;
}

/** Overnight when the shift ends at or before it starts (e.g. 22:00–06:00). */
export const overnight = (s) => s.end_minutes <= s.start_minutes;

export function shiftView(s, staffCount) {
  return {
    id: s.id,
    name: s.name,
    start: hhmm(s.start_minutes),
    end: hhmm(s.end_minutes),
    lateAfter: hhmm(s.late_after_minutes),
    overnight: overnight(s),
    ...(staffCount !== undefined ? { staffCount } : {}),
  };
}

/** Checks a shift form; returns columns. */
export function shiftFields(b) {
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) throw new HttpError(400, 'Give the shift a name');
  const start = parseHhmm(b.start, 'start time');
  const end = parseHhmm(b.end, 'end time');
  const lateAfter = b.lateAfter ? parseHhmm(b.lateAfter, 'late time') : (start + 15) % 1440;
  if (start === end) throw new HttpError(400, 'Start and end time must differ');
  return { name, start_minutes: start, end_minutes: end, late_after_minutes: lateAfter };
}

/**
 * Late for this person's check-in? Uses their shift's late time, or the company's.
 * Measured from the shift start, so it also works across midnight (a 22:00 shift is late at 00:30);
 * arriving up to 6 hours early is on time.
 */
export function isLateFor(at, staff) {
  const m = minuteOfDay(at);
  const s = staff.shift;
  if (!s) return m > (staff.org.late_after_minutes ?? 555);
  const sinceStart = (m - s.start_minutes + 1440) % 1440;
  if (sinceStart > 1440 - 360) return false; // early
  return sinceStart > (s.late_after_minutes - s.start_minutes + 1440) % 1440;
}

/**
 * Minutes someone left before their shift's end (0 if on time or no shift).
 * The end is on the check-in day, or the next day for an overnight shift. Five minutes' grace.
 */
export function leftEarlyBy(shift, checkInAt, checkOutAt) {
  if (!shift || !checkInAt || !checkOutAt) return 0;
  const inAt = new Date(checkInAt);
  const dayStart = inAt.getTime() - minuteOfDay(inAt) * 60_000 - (inAt.getUTCSeconds() * 1000 + inAt.getUTCMilliseconds());
  let end = dayStart + shift.end_minutes * 60_000;
  if (overnight(shift) && minuteOfDay(inAt) >= shift.end_minutes) end += 86_400_000;
  const early = Math.round((end - new Date(checkOutAt).getTime()) / 60_000);
  return early > 5 ? early : 0;
}

/** Throws unless the shift (if any) belongs to the company. */
export async function assertShiftInOrg(db, shiftId, orgId) {
  if (!shiftId) return;
  const { data } = await db.from('shifts').select('id').eq('id', shiftId).eq('org_id', orgId).maybeSingle();
  if (!data) throw new HttpError(400, 'Choose one of your shifts');
}

/** Throws if the company already has another shift with this name. */
export async function assertUniqueName(db, orgId, name, exceptId = null) {
  const { data } = await db.from('shifts').select('id, name').eq('org_id', orgId);
  if ((data || []).some((x) => x.id !== exceptId && x.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, `There is already a shift called ${name}`);
  }
}
