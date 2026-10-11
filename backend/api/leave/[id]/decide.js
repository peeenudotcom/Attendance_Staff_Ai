import { db, must } from '../../../lib/db.js';
import { holidayMap } from '../../../lib/holidays.js';
import { route, body, HttpError } from '../../../lib/http.js';
import { sendLeaveDecisionEmail } from '../../../lib/email.js';
import { notify } from '../../../lib/push.js';
import { fmtLeaveDates, leaveView, LEAVE_TYPES } from '../../../lib/leave.js';

// POST /api/leave/:id/decide { approve: boolean, note? } (Bearer, admin) -> approves or rejects a request
// in the admin's company (an earlier decision can be changed; a cancelled request can't). The person is emailed.
export default route({
  async POST(req, { staff: admin }) {
    const holidays = await holidayMap(admin.org_id);
    const b = body(req);
    if (typeof b.approve !== 'boolean') throw new HttpError(400, 'Say whether to approve or reject');
    const r = must(await db().from('leave_requests').select('*').eq('id', req.query.id).eq('org_id', admin.org_id).maybeSingle());
    if (!r) throw new HttpError(404, 'Leave request not found');
    if (r.status === 'cancelled') throw new HttpError(409, 'This request was cancelled');

    const status = b.approve ? 'approved' : 'rejected';
    const note = b.note == null ? null : String(b.note).trim().slice(0, 300) || null;
    const row = must(await db().from('leave_requests')
      .update({ status, decision_note: note, decided_by: admin.id, decided_at: new Date().toISOString() })
      .eq('id', r.id).select('*').single());

    const person = must(await db().from('staff').select('name, email').eq('id', r.staff_id).maybeSingle());
    if (person?.email && r.staff_id !== admin.id) {
      await sendLeaveDecisionEmail({
        to: person.email, name: person.name, approved: b.approve, dates: fmtLeaveDates(r.from_date, r.to_date),
        typeLabel: LEAVE_TYPES[r.type], note, by: admin.name,
      }).catch((err) => console.error('[leave] decision email failed:', err.message));
    }
    if (r.staff_id !== admin.id) {
      await notify([r.staff_id], {
        title: b.approve ? 'Leave approved' : 'Leave not approved',
        body: `Your leave for ${fmtLeaveDates(r.from_date, r.to_date)} was ${b.approve ? 'approved' : 'not approved'}${note ? `: ${note}` : ''}`,
        data: { screen: 'Leave' },
      });
    }
    return { ok: true, request: leaveView(row, { weeklyOff: admin.org.weekly_off, holidays, staffName: person?.name }) };
  },
}, { admin: true });
