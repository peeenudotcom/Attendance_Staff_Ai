import { db, must } from '../../lib/db.js';
import { route, body, HttpError } from '../../lib/http.js';
import { fmtTime, istDay } from '../../lib/attendance.js';
import { sendWelcomeEmail } from '../../lib/email.js';
import { staffFields, adminView } from '../../lib/staff-fields.js';

export default route({
  // GET /api/staff[?include=inactive] (Bearer, admin) -> the admin's company with today's status
  async GET(req, { staff: admin }) {
    let q = db().from('staff').select('*').eq('org_id', admin.org_id).order('name');
    if (req.query.include !== 'inactive') q = q.eq('active', true);
    const staff = must(await q);
    const today = must(await db().from('attendance').select('staff_id, status, check_in_at, check_out_at')
      .eq('org_id', admin.org_id).eq('date', istDay(new Date())));
    const byStaff = new Map(today.map((t) => [t.staff_id, t]));
    return {
      staff: staff.map((s) => {
        const t = byStaff.get(s.id);
        return {
          ...adminView(s),
          today: t
            ? { status: t.status, checkIn: fmtTime(t.check_in_at), checkOut: fmtTime(t.check_out_at) }
            : { status: 'absent', checkIn: '—', checkOut: '—' },
        };
      }),
    };
  },

  // POST /api/staff { name, phone, email, department?, designation?, salaryType?, salary?, role? } (Bearer, admin)
  async POST(req, { staff: admin }) {
    const fields = staffFields(body(req));
    const { data, error } = await db().from('staff')
      .insert({ role: 'staff', ...fields, org_id: admin.org_id, created_by: admin.id })
      .select('*').single();
    if (error?.code === '23505') throw new HttpError(409, 'This phone number is already registered');
    if (error) throw new Error(error.message);

    // The account exists either way; a failed welcome email shouldn't undo it.
    let invited = true;
    try {
      await sendWelcomeEmail({ to: data.email, name: data.name, phone: data.phone, company: admin.org.name, addedBy: admin.name });
    } catch (err) {
      invited = false;
      console.error('[staff] welcome email failed:', err.message);
    }
    return { ok: true, invited, staff: adminView(data) };
  },
}, { admin: true });
