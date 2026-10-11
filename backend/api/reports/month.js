import { route } from '../../lib/http.js';
import { buildMonth } from '../../lib/report.js';

// GET /api/reports/month?month=YYYY-MM (Bearer, admin) -> staff × days grid with totals (default: this month, IST)
export default route({
  async GET(req, { staff: admin }) {
    const m = await buildMonth(admin.org, req.query.month);
    return { ...m, staff: m.staff.map(({ staff, ...row }) => row) };
  },
}, { admin: true });
