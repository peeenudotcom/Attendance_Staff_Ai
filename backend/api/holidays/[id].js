import { db, must } from '../../lib/db.js';
import { route, HttpError } from '../../lib/http.js';

// DELETE /api/holidays/:id (Bearer, admin) -> removes a company holiday
export default route({
  async DELETE(req, { staff }) {
    const rows = must(await db().from('holidays').delete().eq('id', req.query.id).eq('org_id', staff.org_id).select('id'));
    if (!rows.length) throw new HttpError(404, 'Holiday not found');
    return { ok: true };
  },
}, { admin: true });
