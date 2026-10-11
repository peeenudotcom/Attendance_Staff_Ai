import { db, must } from '../../../lib/db.js';
import { route, body, HttpError } from '../../../lib/http.js';
import { parseHhmm } from '../../../lib/shifts.js';

// PATCH /api/attendance/:id { checkOut: "HH:MM" } (Bearer, admin) -> fills in (or corrects) a check-out time
// for someone who forgot. The time is on the attendance day, or the next day if it's before the check-in
// (a night shift). Hours are worked out again and the record is marked as set by an admin.
export default route({
  async PATCH(req, { staff: admin }) {
    const r = must(await db().from('attendance').select('*').eq('id', req.query.id).eq('org_id', admin.org_id).maybeSingle());
    if (!r) throw new HttpError(404, 'Attendance record not found');
    if (!r.check_in_at) throw new HttpError(400, 'There is no check-in on this day');
    const m = parseHhmm(body(req).checkOut, 'check-out time');
    let out = new Date(Date.parse(`${r.date}T00:00:00+05:30`) + m * 60_000);
    const inAt = new Date(r.check_in_at);
    if (out <= inAt) out = new Date(out.getTime() + 86_400_000);
    if (out - inAt > 20 * 3_600_000) throw new HttpError(400, 'That is more than 20 hours after the check-in');
    const worked = Math.round((out - inAt) / 60_000);
    must(await db().from('attendance').update({ check_out_at: out.toISOString(), worked_minutes: worked, check_out_edited_by: admin.id }).eq('id', r.id));
    return { ok: true, checkOutAt: out.toISOString(), workedMinutes: worked };
  },
}, { admin: true });
