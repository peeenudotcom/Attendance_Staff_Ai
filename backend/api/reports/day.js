import { db, must } from '../../lib/db.js';
import { route, HttpError } from '../../lib/http.js';
import { fmtHours, fmtTime, istDay, selfieUrls } from '../../lib/attendance.js';
import { dayStatus, joinedOn } from '../../lib/report.js';

// GET /api/reports/day?date=YYYY-MM-DD (Bearer, admin) -> everyone's attendance for one day (default: today, IST)
export default route({
  async GET(req, { staff: admin }) {
    const date = String(req.query.date || istDay(new Date()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Invalid date, use YYYY-MM-DD');

    const staff = must(await db().from('staff').select('*').eq('org_id', admin.org_id).eq('active', true).order('name'));
    const rows = must(await db().from('attendance').select('*').eq('org_id', admin.org_id).eq('date', date));
    const byStaff = new Map(rows.map((r) => [r.staff_id, r]));
    const urls = await selfieUrls(rows.flatMap((r) => [r.check_in_selfie, r.check_out_selfie]));

    const people = staff.map((s) => {
      const r = byStaff.get(s.id);
      return {
        id: s.id,
        name: s.name,
        designation: s.designation,
        department: s.department,
        status: dayStatus({ row: r, date, joinedOn: joinedOn(s), weeklyOff: admin.org.weekly_off }),
        attendanceId: r?.id ?? null,
        approval: r?.approval ?? null,
        checkIn: fmtTime(r?.check_in_at),
        checkOut: fmtTime(r?.check_out_at),
        hours: fmtHours(r?.worked_minutes),
        checkInAddress: r?.check_in_address ?? null,
        checkOutAddress: r?.check_out_address ?? null,
        checkInLocation: r?.check_in_lat != null ? { lat: r.check_in_lat, lng: r.check_in_lng } : null,
        checkInSelfie: urls[r?.check_in_selfie] ?? null,
        checkOutSelfie: urls[r?.check_out_selfie] ?? null,
      };
    }).filter((p) => p.status !== 'before');

    const count = (st) => people.filter((p) => p.status === st).length;
    return {
      date,
      summary: {
        total: people.length,
        present: count('present'),
        late: count('late'),
        absent: count('absent'),
        notYet: count('pending'),
        off: count('off'),
        checkedOut: people.filter((p) => p.checkOut !== '—').length,
      },
      staff: people,
    };
  },
}, { admin: true });
