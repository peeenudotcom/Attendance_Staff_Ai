import { db, must } from '../../../lib/db.js';
import { route, HttpError } from '../../../lib/http.js';
import { publicUser } from '../../../lib/auth.js';

// GET /api/staff/:id (Bearer, admin)
export default route({
  async GET(req, { staff: admin }) {
    const s = must(await db().from('staff').select('*').eq('id', req.query.id).eq('org_id', admin.org_id).maybeSingle());
    if (!s) throw new HttpError(404, 'Staff member not found');
    return { ...publicUser(s), active: s.active, salaryType: s.salary_type, salary: s.salary };
  },
}, { admin: true });
