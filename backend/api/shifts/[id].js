import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { assertUniqueName, shiftFields, shiftView } from '../../lib/shifts.js';

async function findShift(id, orgId) {
  const s = must(await db().from('shifts').select('*').eq('id', id).eq('org_id', orgId).maybeSingle());
  if (!s) throw new HttpError(404, 'Shift not found');
  return s;
}

export default route({
  // PATCH /api/shifts/:id { name, start, end, lateAfter? } (Bearer, admin)
  async PATCH(req, { staff: admin }) {
    const s = await findShift(req.query.id, admin.org_id);
    const fields = shiftFields(body(req));
    await assertUniqueName(db(), admin.org_id, fields.name, s.id);
    const row = must(await db().from('shifts').update(fields).eq('id', s.id).select('*').single());
    return { ok: true, shift: shiftView(row) };
  },

  // DELETE /api/shifts/:id (Bearer, admin) -> people on it go back to the company's late time
  async DELETE(req, { staff: admin }) {
    const s = await findShift(req.query.id, admin.org_id);
    must(await db().from('staff').update({ shift_id: null }).eq('shift_id', s.id).eq('org_id', admin.org_id));
    must(await db().from('shifts').delete().eq('id', s.id));
    return { ok: true };
  },
}, { admin: true });
