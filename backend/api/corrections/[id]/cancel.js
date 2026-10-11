import { db, must } from '../../../lib/db.js';
import { route, HttpError } from '../../../lib/http.js';
import { correctionView } from '../../../lib/corrections.js';

// POST /api/corrections/:id/cancel (Bearer) -> withdraws your own request while it is still waiting
export default route({
  async POST(req, { staff }) {
    const r = must(await db().from('correction_requests').select('*').eq('id', req.query.id).eq('staff_id', staff.id).maybeSingle());
    if (!r) throw new HttpError(404, 'Correction request not found');
    if (r.status !== 'pending') throw new HttpError(409, 'Only a request that is still waiting can be withdrawn');
    const row = must(await db().from('correction_requests').update({ status: 'cancelled' }).eq('id', r.id).select('*').single());
    return { ok: true, request: correctionView(row) };
  },
});
