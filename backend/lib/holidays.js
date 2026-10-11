import { db, must } from './db.js';

/** A company's holidays between two dates (inclusive) as Map(date -> name). Without dates: all of them. */
export async function holidayMap(orgId, first = null, last = null) {
  let q = db().from('holidays').select('date, name').eq('org_id', orgId);
  if (first) q = q.gte('date', first);
  if (last) q = q.lte('date', last);
  return new Map(must(await q).map((h) => [h.date, h.name]));
}
