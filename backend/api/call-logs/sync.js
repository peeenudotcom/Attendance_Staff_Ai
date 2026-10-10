import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';

// POST /api/call-logs/sync { logs: [{ number, name, type, seconds, timestamp (ms) }] } (Bearer; Android only)
export default route({
  async POST(req, { staff }) {
    const logs = body(req).logs;
    if (!Array.isArray(logs)) throw new HttpError(400, 'logs must be a list');
    const rows = logs.slice(0, 500).flatMap((l) => {
      const calledAt = new Date(Number(l.timestamp));
      const number = String(l.number ?? '').slice(0, 40);
      if (!number || Number.isNaN(calledAt.getTime())) return [];
      return [{
        staff_id: staff.id,
        number,
        contact_name: l.name ? String(l.name).slice(0, 120) : null,
        type: l.type ? String(l.type).slice(0, 20) : null,
        duration_seconds: Number.isFinite(Number(l.seconds)) ? Math.round(Number(l.seconds)) : null,
        called_at: calledAt.toISOString(),
      }];
    });
    if (rows.length) {
      must(await db().from('call_logs').upsert(rows, { onConflict: 'staff_id,number,called_at', ignoreDuplicates: true }));
    }
    return { ok: true, synced: rows.length };
  },
});
