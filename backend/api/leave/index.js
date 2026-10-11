import { db, must } from '../../lib/db.js';
import { route, body } from '../../lib/http.js';
import { sendLeaveRequestEmail } from '../../lib/email.js';
import { notify } from '../../lib/push.js';
import { assertNoOverlap, fmtLeaveDates, leaveDays, leaveFields, leaveView, LEAVE_TYPES } from '../../lib/leave.js';

export default route({
  // GET /api/leave (Bearer) -> the signed-in person's own leave requests, newest first
  async GET(req, { staff }) {
    const rows = must(await db().from('leave_requests').select('*').eq('staff_id', staff.id).order('from_date', { ascending: false }));
    return { requests: rows.slice(0, 100).map((r) => leaveView(r, { weeklyOff: staff.org.weekly_off })) };
  },

  // POST /api/leave { from, to, type: casual|sick|paid|unpaid, reason? } (Bearer) -> asks for leave;
  // the company's admins are emailed.
  async POST(req, { staff }) {
    const fields = leaveFields(body(req));
    const mine = must(await db().from('leave_requests').select('*').eq('staff_id', staff.id).gte('to_date', fields.from_date));
    assertNoOverlap(mine, fields);
    const row = must(await db().from('leave_requests').insert({ ...fields, org_id: staff.org_id, staff_id: staff.id }).select('*').single());

    const weeklyOff = staff.org.weekly_off;
    const admins = must(await db().from('staff').select('id, name, email').eq('org_id', staff.org_id).eq('role', 'admin').eq('active', true));
    await Promise.all(admins.filter((a) => a.email && a.id !== staff.id).map((a) => sendLeaveRequestEmail({
      to: a.email, adminName: a.name, staffName: staff.name, dates: fmtLeaveDates(row.from_date, row.to_date),
      days: leaveDays(row, weeklyOff), typeLabel: LEAVE_TYPES[row.type], reason: row.reason,
    }).catch((err) => console.error('[leave] admin email failed:', err.message))));

    const dates = fmtLeaveDates(row.from_date, row.to_date);
    await notify(admins.filter((a) => a.id !== staff.id).map((a) => a.id), {
      title: 'Leave request', body: `${staff.name} asked for ${LEAVE_TYPES[row.type].toLowerCase()}: ${dates}`, data: { screen: 'Leave' },
    });
    return { ok: true, request: leaveView(row, { weeklyOff }) };
  },
});
