import { db, must } from '../../../lib/db.js';
import { route, body, HttpError } from '../../../lib/http.js';
import { sendCorrectionDecisionEmail } from '../../../lib/email.js';
import { notify } from '../../../lib/push.js';
import { fmtLeaveDates } from '../../../lib/leave.js';
import { assertMonthsOpen } from '../../../lib/month-close.js';
import { applyCorrection, correctionView, correctionWhat } from '../../../lib/corrections.js';

// POST /api/corrections/:id/decide { approve: boolean, note? } (Bearer, admin) -> approving fixes the attendance
// (added or updated, marked as edited by this admin); the person is emailed and notified either way.
export default route({
  async POST(req, { staff: admin }) {
    const b = body(req);
    if (typeof b.approve !== 'boolean') throw new HttpError(400, 'Say whether to approve or reject');
    const r = must(await db().from('correction_requests').select('*').eq('id', req.query.id).eq('org_id', admin.org_id).maybeSingle());
    if (!r) throw new HttpError(404, 'Correction request not found');
    if (r.status !== 'pending') throw new HttpError(409, `This request was already ${r.status}`);
    await assertMonthsOpen(admin.org_id, [r.date]);
    if (b.approve) await applyCorrection(admin, r);

    const note = b.note == null ? null : String(b.note).trim().slice(0, 300) || null;
    const row = must(await db().from('correction_requests')
      .update({ status: b.approve ? 'approved' : 'rejected', decision_note: note, decided_by: admin.id, decided_at: new Date().toISOString() })
      .eq('id', r.id).select('*').single());

    const person = must(await db().from('staff').select('name, email').eq('id', r.staff_id).maybeSingle());
    const date = fmtLeaveDates(r.date, r.date);
    if (r.staff_id !== admin.id) {
      if (person?.email) {
        await sendCorrectionDecisionEmail({ to: person.email, name: person.name, approved: b.approve, date, what: correctionWhat(r), note, by: admin.name })
          .catch((err) => console.error('[corrections] decision email failed:', err.message));
      }
      await notify([r.staff_id], {
        title: b.approve ? 'Correction approved' : 'Correction not approved',
        body: `Your correction for ${date} was ${b.approve ? 'approved' : 'not approved'}${note ? `: ${note}` : ''}`,
        data: { screen: 'Corrections' },
      });
    }
    return { ok: true, request: correctionView(row, person?.name) };
  },
}, { admin: true });
