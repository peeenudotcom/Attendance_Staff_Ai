import { route } from '../../lib/http.js';
import { istDay } from '../../lib/attendance.js';
import { buildMonth } from '../../lib/report.js';
import { monthPay } from '../../lib/payroll.js';

// GET /api/reports/salary?month=YYYY-MM (Bearer, admin) -> each active person's pay for the month from attendance
// (see lib/payroll.js for the rules); for the current month, pay so far.
export default route({
  async GET(req, { staff: admin }) {
    const m = await buildMonth(admin.org, req.query.month);
    const lateCutEvery = admin.org.late_cut_every ?? null;
    const today = istDay(new Date());
    const people = m.staff.map(({ staff: s, id, name, designation, totals }) => ({
      id,
      name,
      designation,
      salaryType: s.salary_type,
      salary: s.salary,
      ...monthPay({ salaryType: s.salary_type, salary: s.salary, totals, daysInMonth: m.days.length, lateCutEvery }),
    }));
    return {
      month: m.month,
      daysInMonth: m.days.length,
      inProgress: m.days[m.days.length - 1] >= today && m.days[0] <= today,
      lateCutEvery,
      total: people.reduce((sum, p) => sum + (p.pay ?? 0), 0),
      missing: people.filter((p) => p.missing).length,
      staff: people,
    };
  },
}, { admin: true });
