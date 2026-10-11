import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { monthDays } from '../../lib/attendance.js';
import { closeRecord, monthName } from '../../lib/month-close.js';

// POST /api/month-close/reopen { month, reason } (Bearer, admin) -> unlocks a closed month so it can be corrected.
// The reason and who reopened it are kept in the month's history; closing it again saves a fresh salary sheet.
export default route({
  async POST(req, { staff: admin }) {
    const b = body(req);
    const { month } = monthDays(b.month);
    const reason = String(b.reason ?? '').trim().slice(0, 300);
    if (reason.length < 3) throw new HttpError(400, 'Say why the month is being reopened');
    const rec = await closeRecord(admin.org_id, month);
    if (!rec?.closed) throw new HttpError(409, `${monthName(month)} is not closed`);
    must(await db().from('month_closes').update({ closed: false }).eq('org_id', admin.org_id).eq('month', month));
    must(await db().from('month_close_log').insert({ org_id: admin.org_id, month, action: 'reopened', reason, by_staff: admin.id, by_name: admin.name, at: new Date().toISOString() }));
    return { ok: true };
  },
}, { admin: true });
