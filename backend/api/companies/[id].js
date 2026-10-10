import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';

// PATCH /api/companies/:id { name?, logoUrl?, lateAfterMinutes?, active? } (platform admin)
// `active: false` pauses a company: none of its staff can sign in or use the app.
export default route({
  async PATCH(req) {
    const b = body(req);
    const patch = {};
    if (b.name !== undefined) {
      const name = String(b.name || '').trim().slice(0, 120);
      if (!name) throw new HttpError(400, 'Company name is required');
      patch.name = name;
    }
    if (b.logoUrl !== undefined) patch.logo_url = b.logoUrl ? String(b.logoUrl).slice(0, 500) : null;
    if (b.lateAfterMinutes !== undefined) {
      const m = Number(b.lateAfterMinutes);
      if (!Number.isInteger(m) || m < 0 || m > 1439) throw new HttpError(400, 'lateAfterMinutes must be 0-1439');
      patch.late_after_minutes = m;
    }
    if (b.active !== undefined) patch.active = !!b.active;
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update');

    const rows = must(await db().from('organizations').update(patch).eq('id', req.query.id).select('id'));
    if (!rows.length) throw new HttpError(404, 'Company not found');
    return { ok: true };
  },
}, { platform: true });
