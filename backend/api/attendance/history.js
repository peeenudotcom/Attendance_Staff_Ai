import { db, must } from '../../lib/db.js';
import { route, HttpError } from '../../lib/http.js';
import { fmtHours, fmtTime, istDay } from '../../lib/attendance.js';

// GET /api/attendance/history?month=YYYY-MM (Bearer) -> the signed-in staff member's month
export default route({
  async GET(req, { staff }) {
    const month = String(req.query.month || istDay(new Date()).slice(0, 7));
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match || +match[2] < 1 || +match[2] > 12) throw new HttpError(400, 'Invalid month, use YYYY-MM');
    const next = +match[2] === 12 ? `${+match[1] + 1}-01` : `${match[1]}-${String(+match[2] + 1).padStart(2, '0')}`;

    const rows = must(await db().from('attendance').select('*')
      .eq('staff_id', staff.id).gte('date', `${month}-01`).lt('date', `${next}-01`).order('date', { ascending: false }));

    return {
      month,
      records: rows.map((r) => ({
        id: r.id,
        date: r.date,
        checkIn: fmtTime(r.check_in_at),
        checkOut: fmtTime(r.check_out_at),
        status: r.status,
        approval: r.approval,
        hours: fmtHours(r.worked_minutes),
        location: r.check_in_address ?? '—',
      })),
    };
  },
});
