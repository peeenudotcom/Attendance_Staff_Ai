import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { coord, eventTime, istDay, uploadSelfie } from '../../lib/attendance.js';
import { officeDistance } from '../../lib/geo.js';

// POST /api/attendance/check-out { selfie (base64), latitude, longitude, accuracy?, address, timestamp } (Bearer)
// Never blocked by location lock (people leave from site visits); the distance is recorded.
export default route({
  async POST(req, { staff }) {
    const { selfie, latitude, longitude, accuracy, address, timestamp } = body(req);
    const lat = coord(latitude, 90);
    const lng = coord(longitude, 180);
    const at = eventTime(timestamp);

    const record = must(await db().from('attendance').select('*').eq('staff_id', staff.id).eq('date', istDay(at)).maybeSingle());
    if (!record?.check_in_at) throw new HttpError(400, 'No check-in found for today');
    if (record.check_out_at) throw new HttpError(409, 'You have already checked out today');

    const workedMinutes = Math.max(0, Math.round((at - new Date(record.check_in_at)) / 60_000));
    must(await db().from('attendance').update({
      check_out_at: at.toISOString(),
      check_out_lat: lat,
      check_out_lng: lng,
      check_out_distance_m: officeDistance(staff, { lat, lng, accuracy }),
      check_out_address: address ? String(address).slice(0, 300) : null,
      check_out_selfie: await uploadSelfie(selfie, staff.id, 'checkout'),
      worked_minutes: workedMinutes,
    }).eq('id', record.id));

    return { ok: true, attendance: { id: record.id, checkOutAt: at.toISOString(), workedMinutes } };
  },
});
