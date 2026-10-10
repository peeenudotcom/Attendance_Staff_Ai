import { db, must } from '../../lib/db.js';
import { route, body, cleanPhone, HttpError } from '../../lib/http.js';
import { checkCode } from '../../lib/otp.js';
import { issueToken, publicUser } from '../../lib/auth.js';

// POST /api/auth/verify-otp { phone, otp } -> { user, token }
export default route({
  async POST(req) {
    const { phone: rawPhone, otp } = body(req);
    const phone = cleanPhone(rawPhone);
    if (!phone || !otp) throw new HttpError(400, 'Phone and code are required');

    await checkCode(phone, String(otp).trim());

    const staff = must(await db().from('staff').select('*').eq('phone', phone).maybeSingle());
    if (!staff || !staff.active) throw new HttpError(401, 'No active account for this number');
    await db().from('staff').update({ last_login_at: new Date().toISOString() }).eq('id', staff.id);

    return { user: publicUser(staff), token: issueToken(staff.id) };
  },
}, { public: true });
