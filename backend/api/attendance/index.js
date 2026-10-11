import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { checkDate, dayTimes, memberWithShift, noteText } from '../../lib/admin-attendance.js';
import { assertMonthsOpen } from '../../lib/month-close.js';

// POST /api/attendance { staffId, date, checkIn: "HH:MM", checkOut?: "HH:MM", note? } (Bearer, admin)
// -> adds a day for someone who couldn't check in (no selfie or location; marked as added by an admin).
// Late or on time follows the person's shift.
export default route({
  async POST(req, { staff: admin }) {
    const b = body(req);
    const date = checkDate(b.date);
    await assertMonthsOpen(admin.org_id, [date]);
    const person = await memberWithShift(b.staffId, admin.org);
    if (!person.active) throw new HttpError(400, `${person.name} is switched off`);
    const cols = dayTimes(person, date, b.checkIn, b.checkOut);
    const { data, error } = await db().from('attendance').insert({
      ...cols, staff_id: person.id, org_id: admin.org_id, date,
      check_in_edited_by: admin.id, check_out_edited_by: cols.check_out_at ? admin.id : null, admin_note: noteText(b.note),
    }).select('id').single();
    if (error?.code === '23505') throw new HttpError(409, `${person.name} already has attendance on this day. Edit it instead.`);
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id, status: cols.status, workedMinutes: cols.worked_minutes };
  },
}, { admin: true });
