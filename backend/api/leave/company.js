import { db, must } from '../../lib/db.js';
import { holidayMap } from '../../lib/holidays.js';
import { route } from '../../lib/http.js';
import { leaveView } from '../../lib/leave.js';

// GET /api/leave/company (Bearer, admin) -> { pending: every pending request (oldest first),
//   recent: the last 100 decided or cancelled ones } for the admin's company
export default route({
  async GET(req, { staff: admin }) {
    const holidays = await holidayMap(admin.org_id);
    const rows = must(await db().from('leave_requests').select('*').eq('org_id', admin.org_id).order('created_at', { ascending: false }));
    const people = must(await db().from('staff').select('id, name').eq('org_id', admin.org_id));
    const names = new Map(people.map((p) => [p.id, p.name]));
    const view = (r) => leaveView(r, { weeklyOff: admin.org.weekly_off, holidays, staffName: names.get(r.staff_id) ?? 'Unknown' });
    return {
      pending: rows.filter((r) => r.status === 'pending').reverse().map(view),
      recent: rows.filter((r) => r.status !== 'pending').slice(0, 100).map(view),
    };
  },
}, { admin: true });
