import { db, must } from './db.js';
import { HttpError } from './http.js';
import { fmtTime, istDay } from './attendance.js';
import { checkDate, dayTimes, memberWithShift } from './admin-attendance.js';
import { parseHhmm } from './shifts.js';

export const CORRECTION_KINDS = {
  missed_check_in: 'Forgot to check in',
  missed_check_out: 'Forgot to check out',
  wrong_time: 'Wrong time recorded',
};
const MAX_DAYS_BACK = 45;

const hhmm = (v, what) => {
  if (v == null || v === '') return null;
  const m = parseHhmm(v, what);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Validated columns for a new request from { date, kind, checkIn?, checkOut?, reason }. */
export function correctionFields(b) {
  const date = checkDate(b.date);
  const oldest = istDay(new Date(Date.now() - MAX_DAYS_BACK * 86_400_000));
  if (date < oldest) throw new HttpError(400, `Corrections can be asked for the last ${MAX_DAYS_BACK} days only`);
  if (!CORRECTION_KINDS[b.kind]) throw new HttpError(400, 'Choose what needs correcting');
  const checkIn = hhmm(b.checkIn, 'check-in time');
  const checkOut = hhmm(b.checkOut, 'check-out time');
  if (b.kind === 'missed_check_in' && !checkIn) throw new HttpError(400, 'Enter the time you came in');
  if (b.kind === 'missed_check_out' && !checkOut) throw new HttpError(400, 'Enter the time you left');
  if (b.kind === 'wrong_time' && !checkIn && !checkOut) throw new HttpError(400, 'Enter the right check-in or check-out time');
  const reason = String(b.reason ?? '').trim().slice(0, 300);
  if (reason.length < 3) throw new HttpError(400, 'Say what happened');
  return { date, kind: b.kind, check_in: checkIn, check_out: checkOut, reason };
}

/** "check-in 09:05, check-out 18:30" */
export const correctionWhat = (r) => [r.check_in ? `check-in ${r.check_in}` : null, r.check_out ? `check-out ${r.check_out}` : null].filter(Boolean).join(', ');

export const correctionView = (r, staffName) => ({
  id: r.id, date: r.date, kind: r.kind, label: CORRECTION_KINDS[r.kind], checkIn: r.check_in, checkOut: r.check_out,
  reason: r.reason, status: r.status, decisionNote: r.decision_note, decidedAt: r.decided_at, createdAt: r.created_at,
  ...(staffName !== undefined ? { staffName } : {}),
});

/**
 * Applies an approved request to the person's attendance: fills in or replaces the times given, keeps the others,
 * and works out hours and late/on time again from their shift. Marked as edited by the approving admin, with the
 * reason as the note.
 */
export async function applyCorrection(admin, r) {
  const person = await memberWithShift(r.staff_id, admin.org);
  const existing = must(await db().from('attendance').select('*').eq('staff_id', r.staff_id).eq('date', r.date).maybeSingle());
  const checkIn = r.check_in ?? (existing?.check_in_at ? fmtTime(existing.check_in_at) : null);
  const checkOut = r.check_out ?? (existing?.check_out_at ? fmtTime(existing.check_out_at) : null);
  if (!checkIn) throw new HttpError(400, 'There is no check-in on this day. The request needs a check-in time.');
  const cols = dayTimes(person, r.date, checkIn, checkOut);
  const note = `Correction: ${r.reason}`.slice(0, 200);
  if (existing) {
    if (!r.check_in) { delete cols.check_in_at; delete cols.status; } // keep the recorded check-in and its late mark
    const patch = { ...cols, admin_note: note };
    if (r.check_in) patch.check_in_edited_by = admin.id;
    if (r.check_out) patch.check_out_edited_by = admin.id;
    must(await db().from('attendance').update(patch).eq('id', existing.id));
    return existing.id;
  }
  const row = must(await db().from('attendance').insert({
    ...cols, staff_id: r.staff_id, org_id: r.org_id, date: r.date,
    check_in_edited_by: admin.id, check_out_edited_by: cols.check_out_at ? admin.id : null, admin_note: note,
  }).select('id').single());
  return row.id;
}
