import { db, must } from '../../../lib/db.js';
import { route, HttpError } from '../../../lib/http.js';
import { fmtHours, fmtTime, istDay, selfieUrl } from '../../../lib/attendance.js';

// GET /api/staff/:id/attendance?month=YYYY-MM (Bearer, admin) -> a staff member's month, with selfie links
export default route({
  async GET(req) {
    const month = String(req.query.month || istDay(new Date()).slice(0, 7));
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match || +match[2] < 1 || +match[2] > 12) throw new HttpError(400, 'Invalid month, use YYYY-MM');
    const next = +match[2] === 12 ? `${+match[1] + 1}-01` : `${match[1]}-${String(+match[2] + 1).padStart(2, '0')}`;

    const rows = must(await db().from('attendance').select('*')
      .eq('staff_id', req.query.id).gte('date', `${month}-01`).lt('date', `${next}-01`).order('date', { ascending: false }));

    return {
      month,
      records: await Promise.all(rows.map(async (r) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        approval: r.approval,
        checkIn: fmtTime(r.check_in_at),
        checkOut: fmtTime(r.check_out_at),
        hours: fmtHours(r.worked_minutes),
        checkInLocation: r.check_in_address,
        checkOutLocation: r.check_out_address,
        checkInSelfie: await selfieUrl(r.check_in_selfie),
        checkOutSelfie: await selfieUrl(r.check_out_selfie),
      }))),
    };
  },
}, { admin: true });
