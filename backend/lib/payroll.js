/**
 * Pay for one person for one month, from their monthly-sheet totals.
 *
 * - monthly: salary ÷ days in the month, for each paid day (present, late, weekly off, paid leave; half days count half)
 * - weekly:  the same, at salary ÷ 7 a day
 * - daily:   the daily rate for each day worked (present or late; a half day counts half)
 * - hourly:  the hourly rate for each hour between check-in and check-out
 *
 * Absent days and unpaid leave are not paid. With `lateCutEvery` (say 3), every 3 late marks cut half a day
 * (not for hourly pay, which already pays only the hours worked). Days before joining, and days still to come in
 * the current month, are not counted, so a month in progress shows pay so far.
 */
export function monthPay({ salaryType, salary, totals, daysInMonth, lateCutEvery }) {
  const t = totals;
  const half = t.half ?? 0;
  const worked = t.present + t.late + half / 2;
  const base = {
    worked,
    half,
    paidLeave: t.paidLeave,
    unpaidLeave: t.unpaidLeave,
    absent: t.absent,
    off: t.off,
    late: t.late,
    hours: Math.round((t.minutes / 60) * 10) / 10,
  };
  if (!salaryType || salary == null) return { ...base, rate: null, payDays: null, lateCutDays: 0, pay: null, missing: true };

  const lateCutDays = salaryType !== 'hourly' && lateCutEvery ? Math.floor(t.late / lateCutEvery) * 0.5 : 0;
  let rate; let payDays = null; let pay;
  if (salaryType === 'hourly') {
    rate = salary;
    pay = salary * (t.minutes / 60);
  } else if (salaryType === 'daily') {
    rate = salary;
    payDays = Math.max(0, worked - lateCutDays);
    pay = salary * payDays;
  } else {
    rate = salary / (salaryType === 'weekly' ? 7 : daysInMonth);
    payDays = Math.max(0, worked + t.off + t.paidLeave - lateCutDays);
    pay = rate * payDays;
  }
  return { ...base, rate: Math.round(rate * 100) / 100, payDays, lateCutDays, pay: Math.round(pay), missing: false };
}
