import { db, must } from '../../lib/db.js';
import { route, HttpError } from '../../lib/http.js';
import { monthDays } from '../../lib/attendance.js';
import { closedPayslips, payslip, payslipLink } from '../../lib/payslip.js';

// GET /api/payslips (Bearer) -> the signed-in person's slips: every closed month they were paid in.
// GET /api/payslips?month=YYYY-MM[&staffId=] (Bearer) -> one slip and a shareable link. Staff get their own slip for
// closed months; admins any of their company's staff for any month (live figures until the month is closed).
export default route({
  async GET(req, { staff: me }) {
    if (!req.query.month) return { payslips: await closedPayslips(me.org_id, me.id) };
    const { month } = monthDays(req.query.month);
    const isAdmin = me.role === 'admin';
    const staffId = isAdmin && req.query.staffId ? String(req.query.staffId) : me.id;
    if (staffId !== me.id) {
      const other = must(await db().from('staff').select('id').eq('id', staffId).eq('org_id', me.org_id).maybeSingle());
      if (!other) throw new HttpError(404, 'Staff member not found');
    }
    const slip = await payslip(me.org, month, staffId);
    if (!isAdmin && !slip.closed) throw new HttpError(404, 'Your slip for this month is not ready yet');
    return { slip, link: payslipLink(me.org_id, month, staffId) };
  },
});
