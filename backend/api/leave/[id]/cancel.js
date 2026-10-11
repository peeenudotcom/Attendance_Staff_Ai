import { db, must } from '../../../lib/db.js';
import { holidayMap } from '../../../lib/holidays.js';
import { route, HttpError } from '../../../lib/http.js';
import { istDay } from '../../../lib/attendance.js';
import { leaveView } from '../../../lib/leave.js';

// POST /api/leave/:id/cancel (Bearer) -> withdraws your own request: a pending one, or approved leave
// that hasn't started yet.
export default route({
  async POST(req, { staff }) {
    const holidays = await holidayMap(staff.org_id);
    const r = must(await db().from('leave_requests').select('*').eq('id', req.query.id).eq('staff_id', staff.id).maybeSingle());
    if (!r) throw new HttpError(404, 'Leave request not found');
    const cancellable = r.status === 'pending' || (r.status === 'approved' && r.from_date > istDay(new Date()));
    if (!cancellable) throw new HttpError(409, r.status === 'approved' ? 'This leave has already started' : `This request is already ${r.status}`);
    const row = must(await db().from('leave_requests').update({ status: 'cancelled' }).eq('id', r.id).select('*').single());
    return { ok: true, request: leaveView(row, { weeklyOff: staff.org.weekly_off, holidays }) };
  },
});
