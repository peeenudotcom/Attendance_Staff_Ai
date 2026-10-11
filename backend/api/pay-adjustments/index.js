import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { istDay, monthDays } from '../../lib/attendance.js';
import { ADJUSTMENT_KINDS, assertMonthsOpen } from '../../lib/month-close.js';

// POST /api/pay-adjustments { staffId, month: "YYYY-MM", kind: advance|bonus|deduction|addition, amount, note? }
// (Bearer, admin) -> records an advance already paid, a bonus or another agreed change against that month's salary.
export default route({
  async POST(req, { staff: admin }) {
    const b = body(req);
    const { month } = monthDays(b.month);
    const next = monthDays(istDay(new Date(Date.now() + 32 * 86_400_000)).slice(0, 7)).month;
    if (month > next) throw new HttpError(400, 'Adjustments can be added up to next month');
    if (!ADJUSTMENT_KINDS[b.kind]) throw new HttpError(400, 'Choose advance, bonus, deduction or addition');
    const amount = Math.round(Number(b.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new HttpError(400, 'Enter an amount above ₹0');
    const person = must(await db().from('staff').select('id, name').eq('id', b.staffId).eq('org_id', admin.org_id).maybeSingle());
    if (!person) throw new HttpError(404, 'Staff member not found');
    await assertMonthsOpen(admin.org_id, [month]);
    const note = b.note == null ? null : String(b.note).trim().slice(0, 200) || null;
    const row = must(await db().from('pay_adjustments').insert({
      org_id: admin.org_id, staff_id: person.id, month, kind: b.kind, amount, note, created_by: admin.id,
    }).select('id').single());
    return { ok: true, id: row.id };
  },
}, { admin: true });
