import { db, must } from '../../lib/db.js';
import { route, body, cleanPhone, HttpError } from '../../lib/http.js';
import { publicUser } from '../../lib/auth.js';
import { fmtTime, istDay } from '../../lib/attendance.js';
import { sendWelcomeEmail } from '../../lib/email.js';

const SALARY_TYPES = ['monthly', 'daily', 'hourly', 'weekly'];
const text = (v, max = 120) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

export default route({
  // GET /api/staff (Bearer, admin) -> everyone in the admin's company with today's status
  async GET(req, { staff: admin }) {
    const staff = must(await db().from('staff').select('*').eq('org_id', admin.org_id).eq('active', true).order('name'));
    const today = must(await db().from('attendance').select('staff_id, status, check_in_at, check_out_at')
      .eq('org_id', admin.org_id).eq('date', istDay(new Date())));
    const byStaff = new Map(today.map((t) => [t.staff_id, t]));
    return {
      staff: staff.map((s) => {
        const t = byStaff.get(s.id);
        return {
          ...publicUser(s),
          today: t
            ? { status: t.status, checkIn: fmtTime(t.check_in_at), checkOut: fmtTime(t.check_out_at) }
            : { status: 'absent', checkIn: '—', checkOut: '—' },
        };
      }),
    };
  },

  // POST /api/staff { name, phone, email, department, designation, salaryType, salary, role? } (Bearer, admin)
  async POST(req, { staff: admin }) {
    const b = body(req);
    const name = text(b.name);
    const phone = cleanPhone(b.phone);
    const email = text(b.email, 200)?.toLowerCase() ?? null;
    if (!name) throw new HttpError(400, 'Name is required');
    if (!phone) throw new HttpError(400, 'Enter a valid 10-digit phone number');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Enter a valid email. Sign-in codes are sent there.');
    }
    const salary = b.salary === '' || b.salary == null ? null : Number(b.salary);
    if (salary != null && (!Number.isFinite(salary) || salary < 0)) throw new HttpError(400, 'Enter a valid salary amount');

    const { data, error } = await db().from('staff').insert({
      org_id: admin.org_id,
      name,
      phone,
      email,
      role: b.role === 'admin' ? 'admin' : 'staff',
      department: text(b.department),
      designation: text(b.designation),
      salary_type: SALARY_TYPES.includes(b.salaryType) ? b.salaryType : null,
      salary,
      created_by: admin.id,
    }).select('*').single();
    if (error?.code === '23505') throw new HttpError(409, 'This phone number is already registered');
    if (error) throw new Error(error.message);

    // The account exists either way; a failed welcome email shouldn't undo it.
    let invited = true;
    try {
      await sendWelcomeEmail({ to: email, name, phone, company: admin.org.name, addedBy: admin.name });
    } catch (err) {
      invited = false;
      console.error('[staff] welcome email failed:', err.message);
    }
    return { ok: true, invited, staff: publicUser(data) };
  },
}, { admin: true });
