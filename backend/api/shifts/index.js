import { db, must } from '../../lib/db.js';
import { route, body } from '../../lib/http.js';
import { assertUniqueName, shiftFields, shiftView } from '../../lib/shifts.js';

export default route({
  // GET /api/shifts (Bearer, admin) -> the company's shifts with how many people are on each
  async GET(req, { staff: admin }) {
    const shifts = must(await db().from('shifts').select('*').eq('org_id', admin.org_id).order('start_minutes'));
    const people = must(await db().from('staff').select('shift_id').eq('org_id', admin.org_id).eq('active', true));
    return { shifts: shifts.map((s) => shiftView(s, people.filter((p) => p.shift_id === s.id).length)) };
  },

  // POST /api/shifts { name, start: "HH:MM", end: "HH:MM", lateAfter?: "HH:MM" (default start + 15 min) } (Bearer, admin)
  async POST(req, { staff: admin }) {
    const fields = shiftFields(body(req));
    await assertUniqueName(db(), admin.org_id, fields.name);
    const row = must(await db().from('shifts').insert({ ...fields, org_id: admin.org_id }).select('*').single());
    return { ok: true, shift: shiftView(row, 0) };
  },
}, { admin: true });
