import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';

// POST /api/push/register { token, platform? } (Bearer) -> this phone gets the signed-in person's notifications
// (a phone belongs to whoever signed in on it last).
export default route({
  async POST(req, { staff }) {
    const { token, platform } = body(req);
    if (!/^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(String(token || ''))) throw new HttpError(400, 'Invalid push token');
    must(await db().from('push_tokens').upsert(
      { token, staff_id: staff.id, platform: platform ? String(platform).slice(0, 20) : null, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    ));
    return { ok: true };
  },
});
