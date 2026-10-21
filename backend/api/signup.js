import { db, must } from '../lib/db.js';
import { route, body, cleanPhone, HttpError } from '../lib/http.js';
import { createCompany } from '../lib/companies.js';
import { sendSignupNoticeEmail } from '../lib/email.js';
import { emailProblem } from '../lib/email-check.js';

const text = (v, max = 120) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const MAX_SIGNUPS_PER_HOUR = 20; // across everyone; stops a script from filling the database

export default route({
  // POST /api/signup { company, name, phone, email } (public, from /start)
  // -> a new company with the person signing up as its admin. They then sign in with their phone.
  async POST(req) {
    const b = body(req);
    if (text(b.website)) return { ok: true, invited: true }; // hidden field only bots fill in
    const company = text(b.company);
    const name = text(b.name);
    const phone = cleanPhone(b.phone);
    const email = text(b.email, 200)?.toLowerCase() ?? null;
    if (!company) throw new HttpError(400, 'Enter your company name');
    if (!name) throw new HttpError(400, 'Enter your name');
    if (!phone) throw new HttpError(400, 'Enter your 10-digit mobile number');
    if (!email) throw new HttpError(400, 'Enter your email: sign-in codes are sent there');
    const badEmail = emailProblem(email);
    if (badEmail) throw new HttpError(400, badEmail);

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = must(await db().from('organizations').select('id').gte('created_at', since));
    if (recent.length >= MAX_SIGNUPS_PER_HOUR) throw new HttpError(429, 'Too many sign-ups right now. Please try again in an hour.');

    let created;
    try {
      created = await createCompany({ name: company, adminName: name, adminPhone: phone, adminEmail: email });
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        throw new HttpError(409, 'This mobile number already has a Haazri account. Open the app and sign in with it.');
      }
      throw err;
    }
    if (process.env.EMAIL_REPLY_TO) {
      try {
        await sendSignupNoticeEmail({ to: process.env.EMAIL_REPLY_TO, company, name, phone, email });
      } catch (err) {
        console.error('[signup] notice email failed:', err.message);
      }
    }
    return { ok: true, invited: created.invited, company: { id: created.org.id, name: created.org.name } };
  },
}, { public: true });
