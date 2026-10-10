import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { coord, eventTime, isLate, istDay, uploadSelfie } from '../../lib/attendance.js';

// POST /api/attendance/check-in { selfie (base64), latitude, longitude, address, timestamp } (Bearer)
export default route({
  async POST(req, { staff }) {
    const { selfie, latitude, longitude, address, timestamp } = body(req);
    const at = eventTime(timestamp);
    const date = istDay(at);

    const existing = must(await db().from('attendance').select('id, check_in_at').eq('staff_id', staff.id).eq('date', date).maybeSingle());
    if (existing?.check_in_at) throw new HttpError(409, 'You have already checked in today');

    const status = isLate(at, staff.org.late_after_minutes) ? 'late' : 'present';
    const record = must(await db().from('attendance').insert({
      staff_id: staff.id,
      org_id: staff.org_id,
      date,
      status,
      check_in_at: at.toISOString(),
      check_in_lat: coord(latitude, 90),
      check_in_lng: coord(longitude, 180),
      check_in_address: address ? String(address).slice(0, 300) : null,
      check_in_selfie: await uploadSelfie(selfie, staff.id, 'checkin'),
    }).select('id').single());

    return { ok: true, attendance: { id: record.id, status, checkInAt: at.toISOString() } };
  },
});
