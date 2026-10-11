import { db, must } from '../../lib/db.js';
import { route } from '../../lib/http.js';
import { isReviewPhone } from '../../lib/otp.js';
import { istDay } from '../../lib/attendance.js';
import { eraseBy } from '../../lib/account-deletion.js';
import { sendAccountDeletedEmail, sendAccountDeletionConfirmEmail } from '../../lib/email.js';

const SUPPORT_EMAIL = 'support@tarahutaibuilds.com';

// POST /api/account/delete (Bearer) -> deletes the signed-in person's own account.
// It is switched off at once (signs out everywhere, no more notifications); personal data is erased
// 30 days later by /api/cron/erase-accounts. The app-review demo account is left on for other reviewers.
export default route({
  async POST(req, { staff }) {
    if (isReviewPhone(staff.phone)) return { ok: true, demo: true };

    const requestedAt = new Date().toISOString();
    must(await db().from('staff').update({ active: false, deletion_requested_at: requestedAt, left_on: istDay(new Date()) }).eq('id', staff.id));
    must(await db().from('push_tokens').delete().eq('staff_id', staff.id));

    const by = eraseBy(requestedAt);
    const admins = must(await db().from('staff').select('id, email').eq('org_id', staff.org_id).eq('role', 'admin').eq('active', true));
    const to = [...new Set([SUPPORT_EMAIL, ...admins.map((a) => a.email).filter(Boolean)])];
    // The account is already deleted; a failed email must not undo or fail that.
    const emails = [sendAccountDeletedEmail({ to, staffName: staff.name, phone: staff.phone, company: staff.org.name, eraseBy: by })];
    if (staff.email) emails.push(sendAccountDeletionConfirmEmail({ to: staff.email, name: staff.name, eraseBy: by }));
    const results = await Promise.allSettled(emails);
    results.filter((r) => r.status === 'rejected').forEach((r) => console.error('[account/delete] email failed:', r.reason?.message));

    return { ok: true, eraseBy: by };
  },
});
