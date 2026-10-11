import { db, must } from '../lib/db.js';
import { route, body, HttpError } from '../lib/http.js';

const view = (o) => ({ id: o.id, name: o.name, logoUrl: o.logo_url, lateAfterMinutes: o.late_after_minutes, weeklyOff: o.weekly_off });

export default route({
  // GET /api/company (Bearer) -> the signed-in user's company
  GET: (req, { staff }) => view(staff.org),

  // PATCH /api/company { name?, lateAfterMinutes?, weeklyOff? (0 = Sunday … 6, or null) } (company admin) -> their own company's settings
  async PATCH(req, { staff }) {
    if (staff.role !== 'admin') throw new HttpError(403, 'Only admins can do this');
    const b = body(req);
    const patch = {};
    if (b.name !== undefined) {
      const name = String(b.name || '').trim().slice(0, 120);
      if (!name) throw new HttpError(400, 'Company name is required');
      patch.name = name;
    }
    if (b.lateAfterMinutes !== undefined) {
      const m = Number(b.lateAfterMinutes);
      if (!Number.isInteger(m) || m < 0 || m > 1439) throw new HttpError(400, 'Late time must be between 00:00 and 23:59');
      patch.late_after_minutes = m;
    }
    if (b.weeklyOff !== undefined) {
      const d = b.weeklyOff === null || b.weeklyOff === '' ? null : Number(b.weeklyOff);
      if (d !== null && (!Number.isInteger(d) || d < 0 || d > 6)) throw new HttpError(400, 'Weekly off must be a day of the week');
      patch.weekly_off = d;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update');
    const org = must(await db().from('organizations').update(patch).eq('id', staff.org_id).select('*').single());
    return view(org);
  },
});
