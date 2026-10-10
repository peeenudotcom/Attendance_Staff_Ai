import { db, must } from '../../../lib/db.js';
import { route, HttpError } from '../../../lib/http.js';
import { sendWelcomeEmail } from '../../../lib/email.js';

// POST /api/staff/:id/invite (Bearer, admin) -> sends the welcome email (install link + sign-in steps) again
export default route({
  async POST(req, { staff: admin }) {
    const s = must(await db().from('staff').select('*').eq('id', req.query.id).eq('org_id', admin.org_id).maybeSingle());
    if (!s) throw new HttpError(404, 'Staff member not found');
    if (!s.active) throw new HttpError(400, 'Switch this person back on before inviting them');
    if (!s.email) throw new HttpError(400, 'Add an email for this person first');
    try {
      await sendWelcomeEmail({ to: s.email, name: s.name, phone: s.phone, company: admin.org.name, addedBy: admin.name });
    } catch (err) {
      console.error('[staff] invite email failed:', err.message);
      throw new HttpError(502, 'Could not send the email. Please try again.');
    }
    return { ok: true };
  },
}, { admin: true });
