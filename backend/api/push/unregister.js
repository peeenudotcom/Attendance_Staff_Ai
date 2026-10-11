import { db, must } from '../../lib/db.js';
import { route, body } from '../../lib/http.js';

// POST /api/push/unregister { token } (Bearer) -> stop notifications to this phone (on sign-out)
export default route({
  async POST(req, { staff }) {
    const { token } = body(req);
    if (token) must(await db().from('push_tokens').delete().eq('token', String(token)).eq('staff_id', staff.id));
    return { ok: true };
  },
});
