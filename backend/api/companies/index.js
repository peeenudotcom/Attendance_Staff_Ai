import { db, must } from '../../lib/db.js';
import { route, body, cleanPhone, HttpError } from '../../lib/http.js';
import { publicUser } from '../../lib/auth.js';
import { createCompany } from '../../lib/companies.js';
import { emailProblem } from '../../lib/email-check.js';

const text = (v, max = 120) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

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
    const badEmail = emailProblem(adminEmail);
    if (badEmail) throw new HttpError(400, badEmail);

    const { org, admin, invited } = await createCompany({ name, adminName, adminPhone, adminEmail });
    return { ok: true, invited, company: { id: org.id, name: org.name }, admin: publicUser({ ...admin, org }) };
  },
}, { platform: true });
