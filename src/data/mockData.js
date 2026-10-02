// Centralized mock data layer for AI features
// All data is deterministic but varies by date to feel "alive"

const STAFF_LIST = [
  { id: '1', name: 'Admin User', role: 'admin', department: 'Management', phone: '9876543210', designation: 'Admin', score: 98 },
  { id: '2', name: 'Staff Member 1', role: 'staff', department: 'Sales', phone: '9876543211', designation: 'Sales Executive', score: 88 },
  { id: '3', name: 'Staff Member 2', role: 'staff', department: 'Marketing', phone: '9876543212', designation: 'Marketing Lead', score: 92 },
  { id: '4', name: 'Staff Member 3', role: 'staff', department: 'Development', phone: '9876543213', designation: 'Developer', score: 75 },
  { id: '5', name: 'Staff Member 4', role: 'staff', department: 'Support', phone: '9876543214', designation: 'Support Agent', score: 85 },
  { id: '6', name: 'Staff Member 5', role: 'staff', department: 'Sales', phone: '9876543215', designation: 'Sales Manager', score: 91 },
  { id: '7', name: 'Staff Member 6', role: 'staff', department: 'HR', phone: '9876543216', designation: 'HR Executive', score: 94 },
  { id: '8', name: 'Staff Member 7', role: 'staff', department: 'Operations', phone: '9876543217', designation: 'Ops Manager', score: 82 },
  { id: '9', name: 'Staff Member 8', role: 'staff', department: 'Finance', phone: '9876543218', designation: 'Accountant', score: 90 },
  { id: '10', name: 'Staff Member 9', role: 'staff', department: 'Development', phone: '9876543219', designation: 'Sr. Developer', score: 78 },
  { id: '11', name: 'Staff Member 10', role: 'staff', department: 'Support', phone: '9876543220', designation: 'Support Lead', score: 86 },
  { id: '12', name: 'Staff Member 11', role: 'staff', department: 'Sales', phone: '9876543221', designation: 'Field Sales', score: 72 },
];

// Day-of-week absence patterns (0=Sun, 1=Mon, ..., 6=Sat)
// Higher value = more likely to be absent on that day
const ABSENCE_PATTERNS = {
  '2':  { 1: 0.15, 5: 0.35 },  // Ravi: often absent Fridays
  '4':  { 1: 0.45, 2: 0.10 },  // Amit: often late Mondays
  '5':  { 5: 0.20 },            // Priya: sometimes absent Fridays
  '8':  { 1: 0.25, 6: 0.30 },  // Vikram: Mondays & Saturdays
  '10': { 1: 0.30, 5: 0.25 },  // Rahul: Mondays & Fridays
  '12': { 5: 0.40, 6: 0.35 },  // Manish: often absent Fri/Sat
};

// Late patterns (probability of being late on that day)
const LATE_PATTERNS = {
  '4':  { 1: 0.60, 2: 0.30, 3: 0.15 }, // Amit: frequently late Mon-Wed
  '8':  { 1: 0.35 },                     // Vikram: late on Mondays
  '10': { 1: 0.40, 4: 0.20 },           // Rahul: late Mon/Thu
  '12': { 1: 0.30, 2: 0.25 },           // Manish: late Mon/Tue
};

// Seed-based pseudo-random (deterministic per date)
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function dateSeed(date, staffId) {
  const d = new Date(date);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + parseInt(staffId) * 7;
}

// Generate attendance for a specific staff member on a specific date
function generateAttendanceRecord(staffId, date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const seed = dateSeed(date, staffId);
  const rand = seededRandom(seed);

  // Weekends — most people off
  if (dayOfWeek === 0) return { status: 'absent', checkIn: null, checkOut: null };

  const absenceProb = ABSENCE_PATTERNS[staffId]?.[dayOfWeek] || 0.05;
  const lateProb = LATE_PATTERNS[staffId]?.[dayOfWeek] || 0.08;

  let status, checkIn, checkOut;

  if (rand < absenceProb) {
    // Check if it's leave or unplanned absence
    status = rand < absenceProb * 0.6 ? 'leave' : 'absent';
    checkIn = null;
    checkOut = null;
  } else if (rand < absenceProb + lateProb) {
    status = 'late';
    const lateMinutes = Math.floor(seededRandom(seed + 1) * 45) + 15; // 15-60 min late
    const h = 9 + Math.floor(lateMinutes / 60);
    const m = lateMinutes % 60;
    checkIn = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const outH = 17 + Math.floor(seededRandom(seed + 2) * 2);
    const outM = Math.floor(seededRandom(seed + 3) * 60);
    checkOut = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
  } else {
    status = 'present';
    const inM = Math.floor(seededRandom(seed + 4) * 25); // 0-25 min (8:35 - 9:00)
    checkIn = `08:${String(35 + inM).padStart(2, '0')}`;
    const outH = 17 + Math.floor(seededRandom(seed + 5) * 2);
    const outM = Math.floor(seededRandom(seed + 6) * 60);
    checkOut = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
  }

  const hours = (checkIn && checkOut) ? calculateHours(checkIn, checkOut) : 0;

  return {
    staffId,
    date: d.toISOString().split('T')[0],
    checkIn,
    checkOut,
    status,
    hours,
    location: status !== 'absent' && status !== 'leave' ? 'Main Office' : null,
  };
}

function calculateHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = checkOut.split(':').map(Number);
  return Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * 10) / 10;
}

// Generate 30 days of history for all staff
function getAttendanceHistory(days = 30) {
  const history = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    STAFF_LIST.forEach((staff) => {
      if (staff.role === 'admin') return; // skip admin
      history.push(generateAttendanceRecord(staff.id, date));
    });
  }
  return history;
}

// Get today's attendance for all staff
export function getTodayAttendance() {
  const today = new Date();
  const staff = STAFF_LIST.filter((s) => s.role !== 'admin');
  return staff.map((s) => {
    const record = generateAttendanceRecord(s.id, today);
    return { ...s, ...record };
  });
}

// Get a specific staff member
export function getStaffById(id) {
  return STAFF_LIST.find((s) => s.id === id);
}

// Get staff leave balance
export function getLeaveBalance(staffId) {
  const seed = parseInt(staffId) * 31;
  const casualUsed = Math.floor(seededRandom(seed) * 5);
  const sickUsed = Math.floor(seededRandom(seed + 1) * 3);
  const earnedUsed = Math.floor(seededRandom(seed + 2) * 7);
  const compUsed = Math.floor(seededRandom(seed + 3) * 2);
  return [
    { type: 'Casual Leave', total: 12, used: casualUsed, remaining: 12 - casualUsed },
    { type: 'Sick Leave', total: 8, used: sickUsed, remaining: 8 - sickUsed },
    { type: 'Earned Leave', total: 15, used: earnedUsed, remaining: 15 - earnedUsed },
    { type: 'Comp Off', total: 4, used: compUsed, remaining: 4 - compUsed },
  ];
}

// Get team members on leave for a given date
export function getTeamOnLeave(date) {
  const staff = STAFF_LIST.filter((s) => s.role !== 'admin');
  return staff.filter((s) => {
    const record = generateAttendanceRecord(s.id, date);
    return record.status === 'leave';
  }).map((s) => s.name);
}

// Weekly attendance rate
export function getWeeklyAttendanceRate() {
  const today = new Date();
  const thisWeek = [];
  const lastWeek = [];

  for (let i = 0; i < 7; i++) {
    const d1 = new Date(today);
    d1.setDate(d1.getDate() - i);
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - i - 7);

    STAFF_LIST.filter((s) => s.role !== 'admin').forEach((s) => {
      thisWeek.push(generateAttendanceRecord(s.id, d1));
      lastWeek.push(generateAttendanceRecord(s.id, d2));
    });
  }

  const thisWeekPresent = thisWeek.filter((r) => r.status === 'present' || r.status === 'late').length;
  const lastWeekPresent = lastWeek.filter((r) => r.status === 'present' || r.status === 'late').length;
  const totalThisWeek = thisWeek.filter((r) => new Date(r.date).getDay() !== 0).length || 1;
  const totalLastWeek = lastWeek.filter((r) => new Date(r.date).getDay() !== 0).length || 1;

  const thisRate = Math.round((thisWeekPresent / totalThisWeek) * 100);
  const lastRate = Math.round((lastWeekPresent / totalLastWeek) * 100);

  return { thisWeek: thisRate, lastWeek: lastRate, change: thisRate - lastRate };
}

// Blackout dates (restricted leave dates)
export const BLACKOUT_DATES = [
  '2026-03-31', // Quarter end
  '2026-04-01', // Financial year start
  '2026-04-14', // Ambedkar Jayanti (office event)
];

// Payroll data
export function getPayrollSummary() {
  const today = new Date();
  const daysUntilPayroll = 30 - today.getDate() + 1;
  const totalStaff = STAFF_LIST.filter((s) => s.role !== 'admin').length;
  return {
    totalPayroll: '2,45,000',
    paid: '1,82,000',
    pending: '63,000',
    advances: '15,000',
    dueInDays: daysUntilPayroll > 0 ? daysUntilPayroll : 1,
    staffCount: totalStaff,
  };
}

// Leave requests (pending for admin to review)
export function getLeaveRequests() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 5);

  return [
    {
      id: 'lr1',
      staffId: '2',
      name: 'Staff Member 1',
      department: 'Sales',
      type: 'Casual Leave',
      from: tomorrow.toISOString().split('T')[0],
      to: tomorrow.toISOString().split('T')[0],
      days: 1,
      reason: 'Personal errand',
      status: 'pending',
      attendanceScore: 88,
    },
    {
      id: 'lr2',
      staffId: '4',
      name: 'Staff Member 3',
      department: 'Development',
      type: 'Earned Leave',
      from: nextWeek.toISOString().split('T')[0],
      to: new Date(nextWeek.getTime() + 4 * 86400000).toISOString().split('T')[0],
      days: 5,
      reason: 'Family trip',
      status: 'pending',
      attendanceScore: 75,
    },
    {
      id: 'lr3',
      staffId: '5',
      name: 'Staff Member 4',
      department: 'Support',
      type: 'Sick Leave',
      from: today.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
      days: 1,
      reason: 'Personal reasons',
      status: 'pending',
      attendanceScore: 85,
    },
    {
      id: 'lr4',
      staffId: '12',
      name: 'Staff Member 11',
      department: 'Sales',
      type: 'Casual Leave',
      from: BLACKOUT_DATES[0],
      to: BLACKOUT_DATES[0],
      days: 1,
      reason: 'Travel',
      status: 'pending',
      attendanceScore: 72,
    },
  ];
}

export { STAFF_LIST, getAttendanceHistory, generateAttendanceRecord };
