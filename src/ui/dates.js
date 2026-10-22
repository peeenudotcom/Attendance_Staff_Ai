// Date helpers for "YYYY-MM-DD" strings in India time (the same as the server uses).
const DAY = 86_400_000;
export const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const weekday = (d) => new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = Sunday
/** The Monday-to-Sunday week containing `date`, as 7 dates. */
export function weekOf(date) {
  const monday = addDays(date, -((weekday(date) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
/** Every date from `from` to `to`, inclusive. */
export function datesBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
/** A month ("YYYY-MM") as weeks (Monday first); days outside the month are null. */
export function monthWeeks(ym) {
  const first = `${ym}-01`;
  const lead = (weekday(first) + 6) % 7;
  const days = [];
  for (let d = first; d.slice(0, 7) === ym; d = addDays(d, 1)) days.push(d);
  const cells = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export const shiftMonth = (ym, n) => {
  let y = Number(ym.slice(0, 4)); let m = Number(ym.slice(5, 7)) + n;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
};
