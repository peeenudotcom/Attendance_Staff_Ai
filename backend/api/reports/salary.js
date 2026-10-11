import { route } from '../../lib/http.js';
import { monthDays } from '../../lib/attendance.js';
import { closeLog, closeRecord, salarySheet } from '../../lib/month-close.js';

// GET /api/reports/salary?month=YYYY-MM (Bearer, admin) -> each active person's pay for the month: earned from
// attendance (lib/payroll.js), adjustments (advances, bonuses…) and the balance payable. A closed month returns the
// sheet exactly as it was saved when the month was closed; `log` lists every close and reopen.
export default route({
  async GET(req, { staff: admin }) {
    const { month } = monthDays(req.query.month);
    const [rec, log] = await Promise.all([closeRecord(admin.org_id, month), closeLog(admin.org_id, month)]);
    if (rec?.closed && rec.snapshot) {
      const lastClose = [...log].reverse().find((l) => l.action === 'closed');
      return { ...rec.snapshot, inProgress: false, closed: { at: rec.closed_at, by: lastClose?.by ?? null }, log };
    }
    return { ...(await salarySheet(admin.org, month)), closed: null, log };
  },
}, { admin: true });
