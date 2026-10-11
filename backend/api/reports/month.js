import { db, must } from '../../lib/db.js';
import { route } from '../../lib/http.js';
import { fmtTime, monthDays } from '../../lib/attendance.js';
import { dayStatus, joinedOn } from '../../lib/report.js';

// GET /api/reports/month?month=YYYY-MM (Bearer, admin) -> staff × days grid with totals (default: this month, IST)
export default route({
  async GET(req, { staff: admin }) {
    const { month, days } = monthDays(req.query.month);
    const weeklyOff = admin.org.weekly_off;

    const staff = must(await db().from('staff').select('*').eq('org_id', admin.org_id).eq('active', true).order('name'));
    const rows = must(await db().from('attendance').select('staff_id, date, status, check_in_at, check_out_at, worked_minutes')
      .eq('org_id', admin.org_id).gte('date', days[0]).lte('date', days[days.length - 1]));
    const key = (staffId, date) => `${staffId}|${date}`;
    const byKey = new Map(rows.map((r) => [key(r.staff_id, r.date), r]));

    return {
      month,
      days,
      weeklyOff,
      staff: staff.map((s) => {
        const totals = { present: 0, late: 0, absent: 0, off: 0, minutes: 0 };
        const cells = {};
        for (const date of days) {
          const r = byKey.get(key(s.id, date));
          const status = dayStatus({ row: r, date, joinedOn: joinedOn(s), weeklyOff });
          if (status in totals) totals[status] += 1;
          if (r?.worked_minutes) totals.minutes += r.worked_minutes;
          cells[date] = r?.check_in_at
            ? { status, in: fmtTime(r.check_in_at), out: fmtTime(r.check_out_at), minutes: r.worked_minutes }
            : { status };
        }
        return { id: s.id, name: s.name, designation: s.designation, department: s.department, days: cells, totals };
      }),
    };
  },
}, { admin: true });
