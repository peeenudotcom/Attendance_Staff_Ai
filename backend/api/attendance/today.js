import { route } from '../../lib/http.js';
import { currentRecord, fmtHours, fmtTime, selfieUrl } from '../../lib/attendance.js';

// GET /api/attendance/today (Bearer) -> today's record (or a night shift's still-open one from yesterday), or {} before check-in
export default route({
  async GET(req, { staff }) {
    const r = await currentRecord(staff.id);
    if (!r) return {};
    return {
      id: r.id,
      checkedIn: !!r.check_in_at,
      checkedOut: !!r.check_out_at,
      status: r.status,
      checkIn: fmtTime(r.check_in_at),
      checkOut: fmtTime(r.check_out_at),
      hours: fmtHours(r.worked_minutes),
      location: r.check_in_address,
      checkInSelfie: await selfieUrl(r.check_in_selfie),
    };
  },
});
