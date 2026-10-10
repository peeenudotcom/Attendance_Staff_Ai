import { db, must } from '../../../lib/db.js';
import { route, body, HttpError } from '../../../lib/http.js';

// PUT /api/attendance/:id/reject { reason } (Bearer, admin)
export default route({
  async PUT(req, { staff }) {
    const reason = String(body(req).reason || '').trim().slice(0, 500) || null;
    const rows = must(await db().from('attendance')
      .update({ approval: 'rejected', reject_reason: reason, reviewed_by: staff.id })
      .eq('id', req.query.id).select('id'));
    if (!rows.length) throw new HttpError(404, 'Attendance record not found');
    return { ok: true };
  },
}, { admin: true });
