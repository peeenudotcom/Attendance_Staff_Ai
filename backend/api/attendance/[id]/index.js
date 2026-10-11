import { db, must } from '../../../lib/db.js';
import { route, body, HttpError } from '../../../lib/http.js';
import { fmtTime } from '../../../lib/attendance.js';
import { dayTimes, memberWithShift, noteText } from '../../../lib/admin-attendance.js';
import { assertMonthsOpen } from '../../../lib/month-close.js';

async function findRecord(id, orgId) {
  const r = must(await db().from('attendance').select('*').eq('id', id).eq('org_id', orgId).maybeSingle());
  if (!r) throw new HttpError(404, 'Attendance record not found');
  await assertMonthsOpen(orgId, [r.date]);
  return r;
}

export default route({
  // PATCH /api/attendance/:id { checkIn?: "HH:MM", checkOut?: "HH:MM" | "" (clear), note? } (Bearer, admin)
  // -> fills in a missed check-out or corrects the times; hours and late/on-time are worked out again.
  async PATCH(req, { staff: admin }) {
    const r = await findRecord(req.query.id, admin.org_id);
    const b = body(req);
    if (b.checkIn === undefined && b.checkOut === undefined && b.note === undefined) throw new HttpError(400, 'Nothing to update');
    const patch = {};
    if (b.checkIn !== undefined || b.checkOut !== undefined) {
      if (!r.check_in_at && b.checkIn === undefined) throw new HttpError(400, 'There is no check-in on this day');
      const person = await memberWithShift(r.staff_id, admin.org);
      const checkIn = b.checkIn !== undefined ? b.checkIn : fmtTime(r.check_in_at);
      const checkOut = b.checkOut !== undefined ? b.checkOut : (r.check_out_at ? fmtTime(r.check_out_at) : null);
      const cols = dayTimes(person, r.date, checkIn, checkOut);
      // Keep the recorded check-in (and its late mark) unless the admin changed it.
      if (b.checkIn === undefined) { delete cols.check_in_at; delete cols.status; }
      Object.assign(patch, cols);
      if (b.checkIn !== undefined) patch.check_in_edited_by = admin.id;
      if (b.checkOut !== undefined) patch.check_out_edited_by = b.checkOut ? admin.id : null;
    }
    if (b.note !== undefined) patch.admin_note = noteText(b.note);
    must(await db().from('attendance').update(patch).eq('id', r.id));
    return { ok: true, checkOutAt: patch.check_out_at ?? r.check_out_at, workedMinutes: patch.worked_minutes ?? r.worked_minutes, status: patch.status ?? r.status };
  },

  // DELETE /api/attendance/:id (Bearer, admin) -> removes a day recorded by mistake (it shows as absent again)
  async DELETE(req, { staff: admin }) {
    const r = await findRecord(req.query.id, admin.org_id);
    must(await db().from('attendance').delete().eq('id', r.id));
    return { ok: true };
  },
}, { admin: true });
