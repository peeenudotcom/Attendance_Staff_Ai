import { route, HttpError } from '../../lib/http.js';
import { fmtHours, fmtTime, istDay, selfieUrls } from '../../lib/attendance.js';
import { officeOf } from '../../lib/geo.js';
import { leftEarlyBy } from '../../lib/shifts.js';
import { dayPeople, daySummary } from '../../lib/day.js';

// GET /api/reports/day?date=YYYY-MM-DD (Bearer, admin) -> everyone's attendance for one day (default: today, IST)
export default route({
  async GET(req, { staff: admin }) {
    const date = String(req.query.date || istDay(new Date()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Invalid date, use YYYY-MM-DD');

    const { people: day, holiday, shifts } = await dayPeople(admin.org, date);
    const today = istDay(new Date());
    const urls = await selfieUrls(day.flatMap(({ row: r }) => (r ? [r.check_in_selfie, r.check_out_selfie] : [])));

    const people = day.map(({ s, row: r, status }) => {
      return {
        id: s.id,
        name: s.name,
        designation: s.designation,
        department: s.department,
        status,
        shift: shifts.get(s.shift_id)?.name ?? null,
        leftEarlyBy: leftEarlyBy(shifts.get(s.shift_id), r?.check_in_at, r?.check_out_at),
        noCheckOut: !!(r?.check_in_at && !r.check_out_at && date < today),
        checkOutSetByAdmin: !!r?.check_out_edited_by,
        addedByAdmin: !!r?.check_in_edited_by,
        note: r?.admin_note ?? null,
        attendanceId: r?.id ?? null,
        approval: r?.approval ?? null,
        checkIn: fmtTime(r?.check_in_at),
        checkOut: fmtTime(r?.check_out_at),
        hours: fmtHours(r?.worked_minutes),
        checkInAddress: r?.check_in_address ?? null,
        checkOutAddress: r?.check_out_address ?? null,
        checkInDistance: r?.check_in_distance_m ?? null,
        checkOutDistance: r?.check_out_distance_m ?? null,
        locationFree: !!s.location_free,
        checkInLocation: r?.check_in_lat != null ? { lat: r.check_in_lat, lng: r.check_in_lng } : null,
        checkInSelfie: urls[r?.check_in_selfie] ?? null,
        checkOutSelfie: urls[r?.check_out_selfie] ?? null,
      };
    });

    return {
      date,
      holiday,
      office: officeOf(admin.org),
      summary: { ...daySummary(day), checkedOut: people.filter((p) => p.checkOut !== '—').length },
      staff: people,
    };
  },
}, { admin: true });
