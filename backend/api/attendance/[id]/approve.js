import { db, must } from '../../../lib/db.js';
import { route, HttpError } from '../../../lib/http.js';

// PUT /api/attendance/:id/approve (Bearer, admin)
export default route({
  async PUT(req, { staff }) {
    const rows = must(await db().from('attendance')
      .update({ approval: 'approved', reject_reason: null, reviewed_by: staff.id })
      .eq('id', req.query.id).eq('org_id', staff.org_id).select('id'));
    if (!rows.length) throw new HttpError(404, 'Attendance record not found');
    return { ok: true };
  },
}, { admin: true });
