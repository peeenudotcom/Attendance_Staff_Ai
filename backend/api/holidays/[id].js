import { db, must } from '../../lib/db.js';
import { route, HttpError } from '../../lib/http.js';
import { assertMonthsOpen } from '../../lib/month-close.js';

// DELETE /api/holidays/:id (Bearer, admin) -> removes a company holiday
export default route({
  async DELETE(req, { staff }) {
    const h = must(await db().from('holidays').select('id, date').eq('id', req.query.id).eq('org_id', staff.org_id).maybeSingle());
    if (!h) throw new HttpError(404, 'Holiday not found');
    await assertMonthsOpen(staff.org_id, [h.date]);
    const rows = must(await db().from('holidays').delete().eq('id', req.query.id).eq('org_id', staff.org_id).select('id'));
    if (!rows.length) throw new HttpError(404, 'Holiday not found');
    return { ok: true };
  },
}, { admin: true });
