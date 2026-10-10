import { db, must } from '../../lib/db.js';
import { route, body, cleanPhone, HttpError } from '../../lib/http.js';
import { createCode, isReviewPhone, maskEmail } from '../../lib/otp.js';
import { sendOtpEmail } from '../../lib/email.js';

// POST /api/auth/login { phone } -> sends a sign-in code to the staff member's email
export default route({
  async POST(req) {
    const phone = cleanPhone(body(req).phone);
    if (!phone) throw new HttpError(400, 'Enter a valid 10-digit phone number');

    const staff = must(await db().from('staff').select('name, email, active').eq('phone', phone).maybeSingle());
    if (!staff || !staff.active) throw new HttpError(404, 'No active account for this number. Ask your admin to add you.');

    if (isReviewPhone(phone)) return { otpSent: true, channel: 'review', sentTo: 'the code in the App Review notes' };
    if (!staff.email) throw new HttpError(400, 'No email is saved for this account. Ask your admin to add one.');

    const code = await createCode(phone);
    try {
      await sendOtpEmail({ to: staff.email, name: staff.name, code });
    } catch (err) {
      console.error('[login] code email failed:', err.message);
      throw new HttpError(502, 'Could not send the sign-in code. Please try again.');
    }
    return { otpSent: true, channel: 'email', sentTo: maskEmail(staff.email) };
  },
}, { public: true });
