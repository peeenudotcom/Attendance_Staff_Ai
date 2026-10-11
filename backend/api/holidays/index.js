import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { assertMonthsOpen } from '../../lib/month-close.js';

const view = (h) => ({ id: h.id, date: h.date, name: h.name });

export default route({
  // GET /api/holidays?year=YYYY (Bearer) -> the company's holidays for a year (default: this year and next),
  // for everyone: the app shows them and skips reminders on them.
  async GET(req, { staff }) {
    const year = req.query.year ? Number(req.query.year) : null;
    if (year !== null && !(year >= 2000 && year <= 2100)) throw new HttpError(400, 'Invalid year');
    const thisYear = new Date().getUTCFullYear();
    const first = `${year ?? thisYear}-01-01`;
    const last = `${year ?? thisYear + 1}-12-31`;
    const rows = must(await db().from('holidays').select('*').eq('org_id', staff.org_id).gte('date', first).lte('date', last).order('date'));
    return { holidays: rows.map(view) };
  },

  // POST /api/holidays { date: "YYYY-MM-DD", name } (Bearer, admin) -> adds a company holiday
  async POST(req, { staff }) {
    if (staff.role !== 'admin') throw new HttpError(403, 'Only admins can do this');
    const b = body(req);
    const date = String(b.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new HttpError(400, 'Choose a date');
    await assertMonthsOpen(staff.org_id, [date]);
    const name = String(b.name || '').trim().slice(0, 60);
    if (!name) throw new HttpError(400, 'Give the holiday a name');
    const { data, error } = await db().from('holidays').insert({ org_id: staff.org_id, date, name }).select('*').single();
    if (error?.code === '23505') throw new HttpError(409, 'There is already a holiday on that date');
    if (error) throw new Error(error.message);
    return { ok: true, holiday: view(data) };
  },
});
