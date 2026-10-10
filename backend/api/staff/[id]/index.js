import { db, must } from '../../../lib/db.js';
import { route, body, HttpError } from '../../../lib/http.js';
import { staffFields, adminView } from '../../../lib/staff-fields.js';

async function findInCompany(id, orgId) {
  const s = must(await db().from('staff').select('*').eq('id', id).eq('org_id', orgId).maybeSingle());
  if (!s) throw new HttpError(404, 'Staff member not found');
  return s;
}

export default route({
  // GET /api/staff/:id (Bearer, admin)
  async GET(req, { staff: admin }) {
    return adminView(await findInCompany(req.query.id, admin.org_id));
  },

  // PATCH /api/staff/:id { name?, phone?, email?, department?, designation?, salaryType?, salary?, role?, active? }
  // (Bearer, admin). Switching someone off (active: false) blocks their sign-in; nothing is deleted.
  async PATCH(req, { staff: admin }) {
    const target = await findInCompany(req.query.id, admin.org_id);
    const b = body(req);
    const patch = staffFields(b, { partial: true });
    if (b.active !== undefined) patch.active = !!b.active;
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update');

    const losingAdmin = target.role === 'admin' && (patch.role === 'staff' || patch.active === false);
    if (losingAdmin) {
      if (target.id === admin.id) throw new HttpError(400, "You can't remove your own admin access");
      const admins = must(await db().from('staff').select('id').eq('org_id', admin.org_id).eq('role', 'admin').eq('active', true));
      if (admins.length <= 1) throw new HttpError(400, 'A company needs at least one active admin');
    }

    const { data, error } = await db().from('staff').update(patch).eq('id', target.id).select('*').single();
    if (error?.code === '23505') throw new HttpError(409, 'This phone number is already registered');
    if (error) throw new Error(error.message);
    return { ok: true, staff: adminView(data) };
  },
}, { admin: true });
