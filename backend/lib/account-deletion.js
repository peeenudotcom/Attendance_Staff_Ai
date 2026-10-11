import { db, must } from './db.js';

export const ERASE_AFTER_DAYS = 30;
const BUCKET = 'selfies';

/** The date (YYYY-MM-DD) by which an account deleted at `requestedAt` is erased. */
export function eraseBy(requestedAt) {
  return new Date(new Date(requestedAt).getTime() + ERASE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Erases a person's personal data and keeps only what the employer needs for payroll: the attendance days,
 * times and hours, no longer linked to a name. Removes selfies (files and links), check-in locations and
 * addresses, leave reasons, call logs, notification tokens and sign-in codes; the staff row keeps its id
 * (so the company's monthly totals still add up) but loses name, phone, email and job details.
 */
export async function eraseStaff(staff) {
  const records = must(await db().from('attendance').select('id, check_in_selfie, check_out_selfie').eq('staff_id', staff.id));
  const files = records.flatMap((r) => [r.check_in_selfie, r.check_out_selfie]).filter(Boolean);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await db().storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (error) throw new Error(`Could not remove selfies: ${error.message}`);
  }
  must(await db().from('attendance').update({
    check_in_selfie: null, check_out_selfie: null,
    check_in_lat: null, check_in_lng: null, check_in_address: null, check_in_distance_m: null,
    check_out_lat: null, check_out_lng: null, check_out_address: null, check_out_distance_m: null,
  }).eq('staff_id', staff.id));
  must(await db().from('leave_requests').update({ reason: null }).eq('staff_id', staff.id));
  must(await db().from('pay_adjustments').update({ note: null }).eq('staff_id', staff.id));
  // Closed months keep a saved salary sheet; take the name out of those too.
  if (staff.org_id) {
    const closes = must(await db().from('month_closes').select('month, snapshot').eq('org_id', staff.org_id));
    for (const c of closes) {
      if (!c.snapshot?.staff?.some((p) => p.id === staff.id)) continue;
      const snapshot = { ...c.snapshot, staff: c.snapshot.staff.map((p) => (p.id === staff.id ? { ...p, name: 'Deleted user', designation: null } : p)) };
      must(await db().from('month_closes').update({ snapshot }).eq('org_id', staff.org_id).eq('month', c.month));
    }
  }
  must(await db().from('call_logs').delete().eq('staff_id', staff.id));
  must(await db().from('push_tokens').delete().eq('staff_id', staff.id));
  if (staff.phone) must(await db().from('otp_codes').delete().eq('phone', staff.phone));
  must(await db().from('staff').update({
    name: 'Deleted user',
    phone: `deleted-${staff.id}`, // phone is required and unique; this can never match a sign-in
    email: null, department: null, designation: null,
    active: false, erased_at: new Date().toISOString(),
  }).eq('id', staff.id));
}
