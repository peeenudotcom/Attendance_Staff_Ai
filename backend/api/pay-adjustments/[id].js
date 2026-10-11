import { db, must } from '../../lib/db.js';
import { route, HttpError } from '../../lib/http.js';
import { assertMonthsOpen } from '../../lib/month-close.js';

// DELETE /api/pay-adjustments/:id (Bearer, admin) -> removes an adjustment entered by mistake (not in a closed month)
export default route({
  async DELETE(req, { staff: admin }) {
    const a = must(await db().from('pay_adjustments').select('id, month').eq('id', req.query.id).eq('org_id', admin.org_id).maybeSingle());
    if (!a) throw new HttpError(404, 'Adjustment not found');
    await assertMonthsOpen(admin.org_id, [a.month]);
    must(await db().from('pay_adjustments').delete().eq('id', a.id));
    return { ok: true };
  },
}, { admin: true });
