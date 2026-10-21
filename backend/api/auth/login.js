import { db, must } from '../../lib/db.js';
import { route, body, cleanPhone, HttpError } from '../../lib/http.js';
import { createCode, isReviewPhone, maskEmail } from '../../lib/otp.js';
import { sendOtpEmail } from '../../lib/email.js';
import { whatsappEnabled, sendOtpWhatsApp, maskPhone } from '../../lib/whatsapp.js';

// POST /api/auth/login { phone } -> sends a sign-in code on WhatsApp (when set up) and to the staff member's email.
// Both go out when possible: Meta accepting a message doesn't prove the number is on WhatsApp.
export default route({
  async POST(req) {
    const phone = cleanPhone(body(req).phone);
    if (!phone) throw new HttpError(400, 'Enter a valid 10-digit phone number');

    const staff = must(await db().from('staff').select('name, email, active').eq('phone', phone).maybeSingle());
    if (!staff || !staff.active) throw new HttpError(404, 'No active account for this number. Ask your admin to add you.');

    if (isReviewPhone(phone)) return { otpSent: true, channel: 'review', sentTo: 'the code in the App Review notes' };
    const useWhatsApp = whatsappEnabled();
    if (!staff.email && !useWhatsApp) throw new HttpError(400, 'No email is saved for this account. Ask your admin to add one.');

    const code = await createCode(phone);
    const [wa, mail] = await Promise.all([
      useWhatsApp ? sendOtpWhatsApp({ phone, code }).then(() => true, (err) => { console.error('[login] WhatsApp code failed:', err.message); return false; }) : false,
      staff.email ? sendOtpEmail({ to: staff.email, name: staff.name, code }).then(() => true, (err) => { console.error('[login] code email failed:', err.message); return false; }) : false,
    ]);
    if (!wa && !mail) throw new HttpError(502, 'Could not send the sign-in code. Please try again.');

    const sentTo = [wa && `WhatsApp ${maskPhone(phone)}`, mail && maskEmail(staff.email)].filter(Boolean).join(' and ');
    return { otpSent: true, channel: wa && mail ? 'whatsapp+email' : wa ? 'whatsapp' : 'email', sentTo };
  },
}, { public: true });
