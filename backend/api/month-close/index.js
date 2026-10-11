import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { monthDays } from '../../lib/attendance.js';
import { closeChecks, closeRecord, monthName, salarySheet } from '../../lib/month-close.js';

export default route({
  // GET /api/month-close?month=YYYY-MM (Bearer, admin) -> what to sort out before closing: missing check-outs,
  // leave still waiting, people with no pay set; and whether the month has ended / is already closed.
  async GET(req, { staff: admin }) {
    const checks = await closeChecks(admin.org, req.query.month);
    const rec = await closeRecord(admin.org_id, checks.month);
    return { ...checks, closed: !!rec?.closed };
  },

  // POST /api/month-close { month } (Bearer, admin) -> closes the month: saves the salary sheet as it is now (earned,
  // adjustments, payable, and the rates and settings used) and locks the month's attendance, leave, holidays and
  // adjustments until it is reopened.
  async POST(req, { staff: admin }) {
    const { month } = monthDays(body(req).month);
    const checks = await closeChecks(admin.org, month);
    if (!checks.ended) throw new HttpError(400, `${monthName(month)} hasn't ended yet`);
    const rec = await closeRecord(admin.org_id, month);
    if (rec?.closed) throw new HttpError(409, `${monthName(month)} is already closed`);
    const snapshot = await salarySheet(admin.org, month);
    const at = new Date().toISOString();
    must(await db().from('month_closes').upsert(
      { org_id: admin.org_id, month, closed: true, snapshot, closed_by: admin.id, closed_at: at },
      { onConflict: 'org_id,month' },
    ));
    must(await db().from('month_close_log').insert({ org_id: admin.org_id, month, action: 'closed', by_staff: admin.id, by_name: admin.name, at }));
    return { ok: true, month, payableTotal: snapshot.payableTotal };
  },
}, { admin: true });
