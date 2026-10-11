import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { sendCorrectionRequestEmail } from '../../lib/email.js';
import { notify } from '../../lib/push.js';
import { fmtLeaveDates } from '../../lib/leave.js';
import { assertMonthsOpen } from '../../lib/month-close.js';
import { CORRECTION_KINDS, correctionFields, correctionView, correctionWhat } from '../../lib/corrections.js';

export default route({
  // GET /api/corrections (Bearer) -> the signed-in person's correction requests, newest first
  async GET(req, { staff }) {
    const rows = must(await db().from('correction_requests').select('*').eq('staff_id', staff.id).order('created_at', { ascending: false }));
    return { requests: rows.slice(0, 50).map((r) => correctionView(r)) };
  },

  // POST /api/corrections { date, kind: missed_check_in|missed_check_out|wrong_time, checkIn?, checkOut?, reason } (Bearer)
  // -> asks an admin to fix a day; the company's admins are emailed and notified.
  async POST(req, { staff }) {
    const fields = correctionFields(body(req));
    await assertMonthsOpen(staff.org_id, [fields.date]);
    const pending = must(await db().from('correction_requests').select('id').eq('staff_id', staff.id).eq('date', fields.date).eq('status', 'pending'));
    if (pending.length) throw new HttpError(409, 'You already have a request waiting for this day');
    const row = must(await db().from('correction_requests').insert({ ...fields, org_id: staff.org_id, staff_id: staff.id, status: 'pending' }).select('*').single());

    const admins = must(await db().from('staff').select('id, name, email').eq('org_id', staff.org_id).eq('role', 'admin').eq('active', true));
    const others = admins.filter((a) => a.id !== staff.id);
    const date = fmtLeaveDates(row.date, row.date);
    await Promise.all(others.filter((a) => a.email).map((a) => sendCorrectionRequestEmail({
      to: a.email, adminName: a.name, staffName: staff.name, date, label: CORRECTION_KINDS[row.kind], what: correctionWhat(row), reason: row.reason,
    }).catch((err) => console.error('[corrections] request email failed:', err.message))));
    await notify(others.map((a) => a.id), {
      title: 'Attendance correction', body: `${staff.name}: ${CORRECTION_KINDS[row.kind].toLowerCase()} on ${date}`, data: { screen: 'Corrections' },
    });
    return { ok: true, request: correctionView(row) };
  },
});
