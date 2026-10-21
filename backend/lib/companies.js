import { db, must } from './db.js';
import { HttpError } from './http.js';
import { sendWelcomeEmail } from './email.js';

/**
 * Creates a client company and its first admin, all-or-nothing, and emails the admin how to sign in.
 * Used by the platform admin (/api/companies) and by self sign-up (/api/signup).
 */
export async function createCompany({ name, adminName, adminPhone, adminEmail }) {
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
  let invited = true;
  try {
    await sendWelcomeEmail({ to: adminEmail, name: adminName, phone: adminPhone, company: name, owner: true });
  } catch (err) {
    invited = false;
    console.error('[companies] welcome email failed:', err.message);
  }
  return { org, admin, invited };
}
