import { db, must } from '../lib/db.js';
import { route, body, HttpError } from '../lib/http.js';
import { coord } from '../lib/attendance.js';
import { officeOf } from '../lib/geo.js';
import { shiftView } from '../lib/shifts.js';

const view = (o) => ({
  id: o.id, name: o.name, logoUrl: o.logo_url, lateAfterMinutes: o.late_after_minutes, weeklyOff: o.weekly_off, office: officeOf(o),
  lateCutEvery: o.late_cut_every ?? null,
  halfDayMinutes: o.half_day_minutes ?? null,
  overtimeRate: o.overtime_rate == null ? null : Number(o.overtime_rate),
  overtimeAfterMinutes: o.overtime_after_minutes ?? null,
  paidLeavePerYear: o.paid_leave_per_year ?? null,
  dailySummary: !!o.daily_summary,
  faceMatch: !!o.face_match,
});

export default route({
  // GET /api/company (Bearer) -> the signed-in user's company; `lockApplies` says whether their check-in
  // must be at the office (so the app can warn before the selfie), and `myShift` their shift (null = company late time).
  GET: (req, { staff }) => ({
    ...view(staff.org),
    lockApplies: !!officeOf(staff.org) && !staff.location_free,
    myShift: staff.shift ? shiftView(staff.shift) : null, // for the app's check-in / check-out reminders
  }),

  // PATCH /api/company { name?, lateAfterMinutes?, weeklyOff? (0 = Sunday … 6, or null),
  //   office? ({ lat, lng, radiusM } to turn location lock on, null to turn it off),
  //   lateCutEvery? (every N late marks cut half a day's pay, 2-10, or null for no cut),
  //   halfDayMinutes? (fewer worked minutes = half day, 60-720, or null for no half days),
  //   overtimeRate? (1-3 × the hourly rate, or null for no overtime pay), overtimeAfterMinutes? (normal day for people
  //   without a shift, 240-960, or null for 8 hours), paidLeavePerYear? (0-60, or null for no limit),
  //   dailySummary? (WhatsApp summary to admins each morning), faceMatch? (compare check-in selfies with a saved photo) } (company admin) -> their own company's settings
  async PATCH(req, { staff }) {
    if (staff.role !== 'admin') throw new HttpError(403, 'Only admins can do this');
    const b = body(req);
    const patch = {};
    if (b.name !== undefined) {
      const name = String(b.name || '').trim().slice(0, 120);
      if (!name) throw new HttpError(400, 'Company name is required');
      patch.name = name;
    }
    if (b.lateAfterMinutes !== undefined) {
      const m = Number(b.lateAfterMinutes);
      if (!Number.isInteger(m) || m < 0 || m > 1439) throw new HttpError(400, 'Late time must be between 00:00 and 23:59');
      patch.late_after_minutes = m;
    }
    if (b.weeklyOff !== undefined) {
      const d = b.weeklyOff === null || b.weeklyOff === '' ? null : Number(b.weeklyOff);
      if (d !== null && (!Number.isInteger(d) || d < 0 || d > 6)) throw new HttpError(400, 'Weekly off must be a day of the week');
      patch.weekly_off = d;
    }
    if (b.lateCutEvery !== undefined) {
      const n = b.lateCutEvery === null || b.lateCutEvery === '' ? null : Number(b.lateCutEvery);
      if (n !== null && (!Number.isInteger(n) || n < 2 || n > 10)) throw new HttpError(400, 'Late cut must be every 2 to 10 late marks');
      patch.late_cut_every = n;
    }
    if (b.halfDayMinutes !== undefined) {
      const n = b.halfDayMinutes === null || b.halfDayMinutes === '' ? null : Number(b.halfDayMinutes);
      if (n !== null && (!Number.isInteger(n) || n < 60 || n > 720)) throw new HttpError(400, 'Half day must be between 1 and 12 hours');
      patch.half_day_minutes = n;
    }
    if (b.overtimeRate !== undefined) {
      const n = b.overtimeRate === null || b.overtimeRate === '' ? null : Number(b.overtimeRate);
      if (n !== null && (!Number.isFinite(n) || n < 1 || n > 3)) throw new HttpError(400, 'Overtime rate must be between 1× and 3×');
      patch.overtime_rate = n;
    }
    if (b.overtimeAfterMinutes !== undefined) {
      const n = b.overtimeAfterMinutes === null || b.overtimeAfterMinutes === '' ? null : Number(b.overtimeAfterMinutes);
      if (n !== null && (!Number.isInteger(n) || n < 240 || n > 960)) throw new HttpError(400, 'A normal day must be between 4 and 16 hours');
      patch.overtime_after_minutes = n;
    }
    if (b.paidLeavePerYear !== undefined) {
      const n = b.paidLeavePerYear === null || b.paidLeavePerYear === '' ? null : Number(b.paidLeavePerYear);
      if (n !== null && (!Number.isInteger(n) || n < 0 || n > 60)) throw new HttpError(400, 'Paid leave must be between 0 and 60 days a year');
      patch.paid_leave_per_year = n;
    }
    if (b.dailySummary !== undefined) patch.daily_summary = !!b.dailySummary;
    if (b.faceMatch !== undefined) patch.face_match = !!b.faceMatch;
    if (b.office !== undefined) {
      if (b.office === null) {
        Object.assign(patch, { office_lat: null, office_lng: null, office_radius_m: null });
      } else {
        const lat = coord(b.office.lat, 90);
        const lng = coord(b.office.lng, 180);
        const r = Number(b.office.radiusM);
        if (lat == null || lng == null || (lat === 0 && lng === 0)) throw new HttpError(400, 'Enter a valid office location');
        if (!Number.isInteger(r) || r < 25 || r > 5000) throw new HttpError(400, 'Distance must be between 25 m and 5 km');
        Object.assign(patch, { office_lat: lat, office_lng: lng, office_radius_m: r });
      }
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update');
    const org = must(await db().from('organizations').update(patch).eq('id', staff.org_id).select('*').single());
    return view(org);
  },
});
