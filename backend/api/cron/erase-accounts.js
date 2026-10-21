import { db, must } from '../../lib/db.js';
import { ERASE_AFTER_DAYS, eraseStaff } from '../../lib/account-deletion.js';

// GET /api/cron/erase-accounts (daily, Vercel Cron) -> erases accounts deleted more than 30 days ago.
// Vercel sends "Authorization: Bearer $CRON_SECRET"; without that secret set, nothing runs.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const cutoff = new Date(Date.now() - ERASE_AFTER_DAYS * 86_400_000).toISOString();
    const due = must(await db().from('staff').select('id, phone, org_id, face_ref').lt('deletion_requested_at', cutoff).is('erased_at', null));
    let erased = 0;
    for (const s of due) {
      try { await eraseStaff(s); erased++; } catch (err) { console.error(`[cron/erase-accounts] ${s.id}:`, err.message); }
    }
    return res.status(200).json({ due: due.length, erased });
  } catch (err) {
    console.error('[cron/erase-accounts]', err);
    return res.status(500).json({ message: 'Erase job failed' });
  }
}
