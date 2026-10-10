import { db, must } from '../../lib/db.js';
import { route, body, cleanPhone, HttpError } from '../../lib/http.js';
import { publicUser } from '../../lib/auth.js';

const text = (v, max = 120) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default route({
  // GET /api/companies (platform admin) -> every client company with its staff count
  async GET() {
    const orgs = must(await db().from('organizations').select('*, staff(count)').order('created_at'));
    return {
      companies: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        logoUrl: o.logo_url,
        lateAfterMinutes: o.late_after_minutes,
        active: o.active,
        staffCount: o.staff?.[0]?.count ?? 0,
        createdAt: o.created_at,
      })),
    };
  },

  // POST /api/companies { name, adminName, adminPhone, adminEmail } (platform admin)
  // -> a new client company and its first admin, who can then sign in and add staff.
  async POST(req) {
    const b = body(req);
    const name = text(b.name);
    const adminName = text(b.adminName);
    const adminPhone = cleanPhone(b.adminPhone);
    const adminEmail = text(b.adminEmail, 200)?.toLowerCase() ?? null;
    if (!name) throw new HttpError(400, 'Company name is required');
    if (!adminName) throw new HttpError(400, "The admin's name is required");
    if (!adminPhone) throw new HttpError(400, "Enter the admin's 10-digit phone number");
    if (!adminEmail || !EMAIL.test(adminEmail)) throw new HttpError(400, "Enter the admin's email. Sign-in codes are sent there.");

    const taken = must(await db().from('staff').select('id').eq('phone', adminPhone).maybeSingle());
    if (taken) throw new HttpError(409, 'This phone number is already registered');

    const org = must(await db().from('organizations').insert({ name }).select('*').single());
    const { data: admin, error } = await db().from('staff')
      .insert({ org_id: org.id, name: adminName, phone: adminPhone, email: adminEmail, role: 'admin', designation: 'Owner' })
      .select('*').single();
    if (error) {
      await db().from('organizations').delete().eq('id', org.id); // keep company + admin all-or-nothing
      if (error.code === '23505') throw new HttpError(409, 'This phone number is already registered');
      throw new Error(error.message);
    }
    return { ok: true, company: { id: org.id, name: org.name }, admin: publicUser({ ...admin, org }) };
  },
}, { platform: true });
