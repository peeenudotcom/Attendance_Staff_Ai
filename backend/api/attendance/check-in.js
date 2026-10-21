import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { coord, currentRecord, eventTime, istDay, selfieBytes, uploadSelfie } from '../../lib/attendance.js';
import { faceCheck, faceEnabled } from '../../lib/face.js';
import { notify } from '../../lib/push.js';
import { isLateFor } from '../../lib/shifts.js';
import { officeDistance } from '../../lib/geo.js';

// POST /api/attendance/check-in { selfie (base64), latitude, longitude, accuracy?, address, timestamp } (Bearer)
// With location lock on, refused unless within the company's office radius (or the person may check in anywhere).
// With face match on, the selfie is compared with the person's reference photo; admins see the result (and get a
// notification when it doesn't match), but check-in is never refused because of it.
export default route({
  async POST(req, { staff }) {
    const { selfie, latitude, longitude, accuracy, address, timestamp } = body(req);
    const at = eventTime(timestamp);
    const lat = coord(latitude, 90);
    const lng = coord(longitude, 180);
    const date = istDay(at);

    const existing = must(await db().from('attendance').select('id, check_in_at').eq('staff_id', staff.id).eq('date', date).maybeSingle());
    if (existing?.check_in_at) throw new HttpError(409, 'You have already checked in today');
    const open = await currentRecord(staff.id, at);
    if (open?.check_in_at && !open.check_out_at) throw new HttpError(409, 'Check out of your last shift first');
    const distance = officeDistance(staff, { lat, lng, accuracy }, { enforce: true });

    const status = isLateFor(at, staff) ? 'late' : 'present';
    const selfiePath = await uploadSelfie(selfie, staff.id, 'checkin');
    const face = staff.org.face_match && faceEnabled() ? await faceCheck(staff, selfieBytes(selfie)) : null;
    const record = must(await db().from('attendance').insert({
      staff_id: staff.id,
      org_id: staff.org_id,
      date,
      status,
      check_in_at: at.toISOString(),
      check_in_lat: lat,
      check_in_lng: lng,
      check_in_distance_m: distance,
      check_in_address: address ? String(address).slice(0, 300) : null,
      check_in_selfie: selfiePath,
      ...(face ? { check_in_face: face.result, check_in_face_score: face.score } : {}),
    }).select('id').single());

    if (face?.result === 'mismatch' || face?.result === 'no_face') {
      const admins = must(await db().from('staff').select('id').eq('org_id', staff.org_id).eq('role', 'admin').eq('active', true));
      await notify(admins.map((a) => a.id).filter((id) => id !== staff.id), {
        title: face.result === 'mismatch' ? 'Face did not match' : 'No face in selfie',
        body: `${staff.name} checked in, but the selfie ${face.result === 'mismatch' ? "doesn't look like their saved photo" : 'shows no clear face'}. See Today on the web dashboard.`,
        data: { screen: 'Team' },
      });
    }

    return { ok: true, attendance: { id: record.id, status, checkInAt: at.toISOString() } };
  },
});
