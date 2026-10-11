import { db, must } from '../../lib/db.js';
import { route } from '../../lib/http.js';
import { correctionView } from '../../lib/corrections.js';

// GET /api/corrections/company (Bearer, admin) -> { pending (oldest first), recent: the last 100 decided or cancelled }
export default route({
  async GET(req, { staff: admin }) {
    const rows = must(await db().from('correction_requests').select('*').eq('org_id', admin.org_id).order('created_at', { ascending: false }));
    const people = must(await db().from('staff').select('id, name').eq('org_id', admin.org_id));
    const names = new Map(people.map((p) => [p.id, p.name]));
    const view = (r) => correctionView(r, names.get(r.staff_id) ?? 'Unknown');
    return {
      pending: rows.filter((r) => r.status === 'pending').reverse().map(view),
      recent: rows.filter((r) => r.status !== 'pending').slice(0, 100).map(view),
    };
  },
}, { admin: true });
