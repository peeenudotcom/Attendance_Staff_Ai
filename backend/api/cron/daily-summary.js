import { db, must } from '../../lib/db.js';
import { istDay, weekday } from '../../lib/attendance.js';
import { dayPeople, daySummary } from '../../lib/day.js';
import { isReviewPhone } from '../../lib/otp.js';
import { sendSummaryWhatsApp, summaryEnabled } from '../../lib/whatsapp.js';

const niceDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// GET /api/cron/daily-summary (Vercel Cron, around 11:00 IST) -> for each company that turned on the daily summary,
// a WhatsApp message to its active admins: "Attendance for {{1}} on {{2}}: {{3}} checked in ({{4}} late), {{5}} not in
// yet, {{6}} on leave." Skipped on the company's weekly off and holidays. Needs CRON_SECRET and WHATSAPP_SUMMARY_TEMPLATE.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: 'Unauthorized' });
  if (!summaryEnabled()) return res.status(200).json({ skipped: 'WhatsApp summary template not set' });
  try {
    const date = istDay(new Date());
    const orgs = must(await db().from('organizations').select('*').eq('daily_summary', true).eq('active', true));
    let sent = 0; let failed = 0; let companies = 0;
    for (const org of orgs) {
      if (org.weekly_off != null && weekday(date) === org.weekly_off) continue;
      const { people, holiday } = await dayPeople(org, date);
      if (holiday || !people.length) continue;
      const sum = daySummary(people);
      const admins = must(await db().from('staff').select('id, phone').eq('org_id', org.id).eq('role', 'admin').eq('active', true))
        .filter((a) => a.phone && !isReviewPhone(a.phone));
      if (!admins.length) continue;
      companies++;
      const values = [org.name, niceDay(date), sum.present + sum.late, sum.late, sum.notYet + sum.absent, sum.leave];
      for (const a of admins) {
        try { await sendSummaryWhatsApp({ phone: a.phone, values }); sent++; } catch (err) { failed++; console.error(`[cron/daily-summary] ${org.id}:`, err.message); }
      }
    }
    return res.status(200).json({ date, companies, sent, failed });
  } catch (err) {
    console.error('[cron/daily-summary]', err);
    return res.status(500).json({ message: 'Summary job failed' });
  }
}
