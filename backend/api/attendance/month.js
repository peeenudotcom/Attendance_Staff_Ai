import { route } from '../../lib/http.js';
import { fmtHours } from '../../lib/attendance.js';
import { buildMonth } from '../../lib/report.js';

// GET /api/attendance/month?month=YYYY-MM (Bearer) -> the signed-in person's own month for the app's calendar:
// every day's status (present, late, half, absent, leave, off, pending, before) with times, and the month's totals.
export default route({
  async GET(req, { staff }) {
    const m = await buildMonth(staff.org, req.query.month, { staffId: staff.id });
    const me = m.staff[0];
    return {
      month: m.month,
      weeklyOff: m.weeklyOff,
      days: m.days.map((date) => {
        const c = me?.days[date] ?? { status: 'before' };
        return {
          date,
          status: c.status,
          checkIn: c.in ?? null,
          checkOut: c.out && c.out !== '—' ? c.out : null,
          hours: c.minutes ? fmtHours(c.minutes) : null,
          ...(c.leaveType ? { leaveType: c.leaveType } : {}),
          ...(c.edited ? { edited: true } : {}),
          ...(c.note ? { note: c.note } : {}),
        };
      }),
      totals: me ? { ...me.totals, hours: fmtHours(me.totals.minutes) } : null,
    };
  },
});
