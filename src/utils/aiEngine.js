// AI Engine — pure-logic algorithms for all AI features
// No React dependencies — can be used anywhere

import {
  getTodayAttendance,
  getWeeklyAttendanceRate,
  getPayrollSummary,
  getTeamOnLeave,
  getLeaveBalance,
  getLeaveRequests,
  getAttendanceHistory,
  generateAttendanceRecord,
  STAFF_LIST,
  BLACKOUT_DATES,
} from '../data/mockData';

// ─────────────────────────────────────────────
// Feature 1: Daily Briefing Generator
// ─────────────────────────────────────────────

export function generateDailyBriefing() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const isWeekend = isSunday || isSaturday;

  const today = getTodayAttendance();
  const rates = getWeeklyAttendanceRate();
  const payroll = getPayrollSummary();
  const totalStaff = today.length;

  // Time-based greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Weekend handling
  if (isWeekend) {
    const pred = predictTomorrowAbsences();
    const parts = [`${greeting}! It's ${isSunday ? 'Sunday' : 'Saturday'} — office is closed today.`];
    if (payroll.dueInDays <= 5) {
      parts.push(`Payroll is due in ${payroll.dueInDays} ${payroll.dueInDays === 1 ? 'day' : 'days'}.`);
    }
    parts.push(`Weekly attendance was ${rates.thisWeek}% this week.`);
    if (!isSunday && pred.predictedAbsent.length > 0) {
      parts.push(`AI predicts ${pred.predictedAbsent.length} possible absence(s) on Monday.`);
    }
    return {
      text: parts.join(' '),
      stats: { present: '-', late: '-', absent: '-', onLeave: '-', total: totalStaff },
      greeting,
      isWeekend: true,
    };
  }

  const present = today.filter((s) => s.status === 'present').length;
  const late = today.filter((s) => s.status === 'late').length;
  const absent = today.filter((s) => s.status === 'absent').length;
  const onLeave = today.filter((s) => s.status === 'leave');
  const checkedIn = present + late;

  const parts = [];
  parts.push(`${greeting}! ${checkedIn} of ${totalStaff} staff checked in today.`);

  if (onLeave.length > 0) {
    const names = onLeave.map((s) => s.name.split(' ')[0]).join(' and ');
    parts.push(`${names} ${onLeave.length === 1 ? 'is' : 'are'} on leave.`);
  }

  if (absent > 0) {
    parts.push(`${absent} unplanned ${absent === 1 ? 'absence' : 'absences'} today.`);
  }

  if (late > 0) {
    const lateNames = today.filter((s) => s.status === 'late').map((s) => s.name.split(' ')[0]);
    parts.push(`${lateNames.join(', ')} arrived late.`);
  }

  if (payroll.dueInDays <= 5) {
    parts.push(`Payroll is due in ${payroll.dueInDays} ${payroll.dueInDays === 1 ? 'day' : 'days'}.`);
  }

  const changeText = rates.change > 0 ? `up ${rates.change}%` : rates.change < 0 ? `down ${Math.abs(rates.change)}%` : 'same as';
  parts.push(`Team attendance is ${rates.thisWeek}% this week — ${changeText} from last week.`);

  return {
    text: parts.join(' '),
    stats: { present, late, absent, onLeave: onLeave.length, total: totalStaff },
    greeting,
    isWeekend: false,
  };
}

// ─────────────────────────────────────────────
// Feature 2: Predictive Attendance
// ─────────────────────────────────────────────

export function predictTomorrowAbsences() {
  const history = getAttendanceHistory(28); // 4 weeks
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDay();

  if (tomorrowDay === 0) {
    return { predictedAbsent: [], predictedLate: [], confidence: 95, note: 'Tomorrow is Sunday — office closed.' };
  }

  const staff = STAFF_LIST.filter((s) => s.role !== 'admin');
  const predictions = [];

  staff.forEach((s) => {
    const staffHistory = history.filter((h) => h.staffId === s.id);
    const sameDayRecords = staffHistory.filter((h) => new Date(h.date).getDay() === tomorrowDay);

    if (sameDayRecords.length === 0) return;

    // Weighted: recent weeks count more (exponential decay)
    let absentWeight = 0;
    let lateWeight = 0;
    let totalWeight = 0;

    sameDayRecords.forEach((record, idx) => {
      const weight = Math.pow(1.5, idx); // more recent = higher weight
      totalWeight += weight;
      if (record.status === 'absent' || record.status === 'leave') absentWeight += weight;
      if (record.status === 'late') lateWeight += weight;
    });

    const absentProb = Math.round((absentWeight / totalWeight) * 100);
    const lateProb = Math.round((lateWeight / totalWeight) * 100);

    predictions.push({
      ...s,
      absentProb,
      lateProb,
      risk: absentProb > 30 ? 'absent' : lateProb > 25 ? 'late' : 'normal',
    });
  });

  const predictedAbsent = predictions
    .filter((p) => p.risk === 'absent')
    .sort((a, b) => b.absentProb - a.absentProb);

  const predictedLate = predictions
    .filter((p) => p.risk === 'late')
    .sort((a, b) => b.lateProb - a.lateProb);

  // Overall confidence based on data quality
  const avgDataPoints = predictions.reduce((sum, p) => {
    const records = history.filter((h) => h.staffId === p.id && new Date(h.date).getDay() === tomorrowDay);
    return sum + records.length;
  }, 0) / (predictions.length || 1);

  const confidence = Math.min(95, Math.round(60 + avgDataPoints * 8));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    predictedAbsent,
    predictedLate,
    confidence,
    day: dayNames[tomorrowDay],
    note: null,
  };
}

// ─────────────────────────────────────────────
// Feature 3: Leave Request Evaluator
// ─────────────────────────────────────────────

export function evaluateLeaveRequest(request) {
  const reasons = [];
  let score = 100; // Start at 100, deduct for issues

  // 1. Check blackout dates
  if (BLACKOUT_DATES.includes(request.from) || BLACKOUT_DATES.includes(request.to)) {
    reasons.push('Falls on a restricted/blackout date');
    score -= 40;
  }

  // 2. Check leave balance
  const balance = getLeaveBalance(request.staffId);
  const typeBalance = balance.find((b) => b.type === request.type);
  if (typeBalance && typeBalance.remaining < request.days) {
    reasons.push(`Insufficient balance (${typeBalance.remaining} left, ${request.days} requested)`);
    score -= 50;
  } else if (typeBalance) {
    reasons.push(`Balance OK (${typeBalance.remaining} ${request.type} remaining)`);
  }

  // 3. Team conflict
  const teamOnLeave = getTeamOnLeave(new Date(request.from));
  if (teamOnLeave.length >= 2) {
    reasons.push(`Team conflict: ${teamOnLeave.length} others already on leave`);
    score -= 25;
  } else {
    reasons.push('No team scheduling conflict');
  }

  // 4. Duration check
  if (request.days <= 1 && (request.type === 'Casual Leave' || request.type === 'Sick Leave')) {
    reasons.push('Short-duration leave (1 day) — low risk');
    score += 10;
  } else if (request.days >= 5) {
    reasons.push(`Extended leave (${request.days} days) — needs review`);
    score -= 15;
  }

  // 5. Attendance score
  if (request.attendanceScore >= 85) {
    reasons.push(`Strong attendance record (${request.attendanceScore}%)`);
    score += 10;
  } else if (request.attendanceScore < 75) {
    reasons.push(`Low attendance score (${request.attendanceScore}%) — review recommended`);
    score -= 15;
  }

  const recommendation = score >= 70 ? 'approve' : 'review';
  const confidence = Math.min(98, Math.max(55, score));

  return {
    recommendation,
    confidence,
    reasons,
    score,
  };
}

// ─────────────────────────────────────────────
// Feature 5: Smart Notifications Generator
// ─────────────────────────────────────────────

export function generateSmartNotifications(isAdmin) {
  const today = getTodayAttendance();
  const payroll = getPayrollSummary();
  const rates = getWeeklyAttendanceRate();
  const pred = predictTomorrowAbsences();
  const now = new Date();
  const notifications = [];

  // Priority: critical > high > medium > low
  const absent = today.filter((s) => s.status === 'absent');
  const late = today.filter((s) => s.status === 'late');
  const onLeave = today.filter((s) => s.status === 'leave');

  // Admin notifications
  if (isAdmin) {
    if (absent.length >= 3) {
      notifications.push({
        id: 'n1', type: 'alert', priority: 'critical',
        title: 'High Absence Alert',
        body: `${absent.length} staff absent today — ${absent.map((s) => s.name.split(' ')[0]).join(', ')}. This is above normal.`,
        action: 'view_absent', time: '2m ago',
      });
    }

    if (payroll.dueInDays <= 3) {
      notifications.push({
        id: 'n2', type: 'payroll', priority: 'critical',
        title: 'Payroll Due Soon',
        body: `₹${payroll.pending} pending for ${payroll.staffCount} staff. Due in ${payroll.dueInDays} day${payroll.dueInDays === 1 ? '' : 's'}.`,
        action: 'open_payroll', time: '5m ago',
      });
    }

    const pendingLeaves = getLeaveRequests().filter((r) => r.status === 'pending');
    if (pendingLeaves.length > 0) {
      notifications.push({
        id: 'n3', type: 'leave', priority: 'high',
        title: `${pendingLeaves.length} Pending Leave Request${pendingLeaves.length > 1 ? 's' : ''}`,
        body: pendingLeaves.map((r) => `${r.name}: ${r.type} (${r.days}d)`).join('\n'),
        action: 'open_leaves', time: '15m ago',
      });
    }

    if (pred.predictedAbsent.length > 0 && !pred.note) {
      notifications.push({
        id: 'n4', type: 'prediction', priority: 'medium',
        title: `AI: ${pred.predictedAbsent.length} May Be Absent ${pred.day}`,
        body: pred.predictedAbsent.map((s) => `${s.name} (${s.absentProb}% chance)`).join(', '),
        action: 'view_prediction', time: '30m ago',
      });
    }

    if (rates.change < -5) {
      notifications.push({
        id: 'n5', type: 'trend', priority: 'medium',
        title: 'Attendance Dropping',
        body: `Weekly rate fell from ${rates.lastWeek}% to ${rates.thisWeek}% (${rates.change}%). Consider a team check-in.`,
        action: 'view_reports', time: '1h ago',
      });
    }

    if (late.length > 0) {
      notifications.push({
        id: 'n6', type: 'late', priority: 'low',
        title: `${late.length} Late Arrival${late.length > 1 ? 's' : ''} Today`,
        body: late.map((s) => `${s.name} checked in at ${s.checkIn}`).join('\n'),
        action: 'view_late', time: '1h ago',
      });
    }
  }

  // Staff notifications
  if (!isAdmin) {
    const hour = now.getHours();
    if (hour >= 8 && hour <= 10) {
      notifications.push({
        id: 'ns1', type: 'reminder', priority: 'high',
        title: 'Mark Your Attendance',
        body: 'Don\'t forget to check in! Tap here to check in with a selfie.',
        action: 'check_in', time: 'Just now',
      });
    }
    if (hour >= 17) {
      notifications.push({
        id: 'ns2', type: 'reminder', priority: 'medium',
        title: 'Time to Check Out',
        body: 'End of day! Remember to check out before leaving.',
        action: 'check_out', time: 'Just now',
      });
    }
    notifications.push({
      id: 'ns3', type: 'info', priority: 'low',
      title: 'Weekly Summary',
      body: `Your attendance this week: ${rates.thisWeek}%. ${rates.change >= 0 ? 'Great consistency!' : 'Try to improve next week.'}`,
      action: 'view_history', time: '2h ago',
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return notifications;
}

// ─────────────────────────────────────────────
// Feature 6: Meeting Scheduler
// ─────────────────────────────────────────────

export function findBestMeetingSlots(daysAhead = 5) {
  const slots = [];
  const staff = STAFF_LIST.filter((s) => s.role !== 'admin');

  for (let d = 1; d <= daysAhead; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    if (date.getDay() === 0) continue; // skip Sunday

    const dayAttendance = staff.map((s) => generateAttendanceRecord(s.id, date));
    const present = dayAttendance.filter((r) => r.status === 'present' || r.status === 'late');
    const presentPct = Math.round((present.length / staff.length) * 100);
    const dayName = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
    const absent = dayAttendance.filter((r) => r.status === 'absent' || r.status === 'leave');
    const absentNames = absent.map((r) => {
      const s = staff.find((st) => st.id === r.staffId);
      return s ? s.name.split(' ')[0] : '';
    }).filter(Boolean);

    slots.push({
      date: date.toISOString().split('T')[0],
      dayName,
      presentCount: present.length,
      totalStaff: staff.length,
      presentPct,
      absentNames,
      score: presentPct, // higher = better for meeting
    });
  }

  slots.sort((a, b) => b.score - a.score);
  return slots;
}

// ─────────────────────────────────────────────
// Feature 7: Enhanced Chat Query Matcher
// ─────────────────────────────────────────────

export function matchChatQuery(query, userId, context = {}) {
  const q = query.toLowerCase().trim();

  // Intent patterns — ordered by specificity (most specific first)
  const intents = [
    // Admin commands
    {
      patterns: ['approve leave', 'approve request', "approve ravi", "approve amit", "approve priya", "approve manish", 'auto approve'],
      intent: 'admin_approve_leave',
    },
    {
      patterns: ['reject leave', 'reject request', 'deny leave'],
      intent: 'admin_reject_leave',
    },
    {
      patterns: ['mark attendance for', 'mark present', 'mark absent'],
      intent: 'admin_mark_attendance',
    },
    {
      patterns: ['send reminder', 'remind staff', 'send notification', 'notify team', 'notify staff'],
      intent: 'admin_send_reminder',
    },

    // Meeting scheduler
    {
      patterns: ['schedule meeting', 'team meeting', 'find meeting time', 'best day for meeting', 'when to meet', 'schedule a meeting', 'plan meeting'],
      intent: 'schedule_meeting',
    },

    // WhatsApp
    {
      patterns: ['whatsapp', 'send whatsapp', 'whatsapp check', 'whatsapp attendance'],
      intent: 'whatsapp_integration',
    },

    // Notifications
    {
      patterns: ['notifications', 'alerts', 'what did i miss', 'any updates', 'show notifications', 'pending alerts'],
      intent: 'notifications',
    },

    // Check-in history
    {
      patterns: ['when did i check in', 'my check in time', 'check in yesterday', 'last check in', 'check in history', 'my check in'],
      intent: 'checkin_history',
    },

    // Who is late
    {
      patterns: ['who is late', "who's late", 'late today', 'who came late', 'late arrivals'],
      intent: 'who_late',
    },

    // Who is on leave
    {
      patterns: ['who is on leave', "who's on leave", 'on leave today', 'leave today'],
      intent: 'who_on_leave',
    },

    // Top performers
    {
      patterns: ['top performer', 'best attendance', 'star employee', 'top staff', 'best staff', 'top 5', 'leaderboard'],
      intent: 'top_performers',
    },

    // Worst attendance
    {
      patterns: ['low attendance', 'worst attendance', 'poor attendance', 'who needs improvement', 'least present'],
      intent: 'low_performers',
    },

    // Department status
    {
      patterns: ['sales team', 'marketing team', 'dev team', 'development team', 'support team', 'hr team', 'department', 'dept status'],
      intent: 'dept_status',
    },

    // Overtime / hours
    {
      patterns: ['overtime', 'extra hours', 'who worked most', 'total hours', 'working hours'],
      intent: 'overtime',
    },

    // Original intents
    {
      patterns: ['leave balance', 'how many leaves', 'leave left', 'my leaves', 'remaining leave'],
      intent: 'leave_balance',
    },
    {
      patterns: ['who is absent', "who's absent", 'absent today', 'who absent', 'who all absent'],
      intent: 'who_absent',
    },
    {
      patterns: ['my attendance', 'my score', 'attendance score', 'my record'],
      intent: 'my_attendance',
    },
    {
      patterns: ['team status', 'how many present', 'team today', 'staff status', 'today status', 'status update'],
      intent: 'team_status',
    },
    {
      patterns: ['payroll', 'salary', 'when salary', 'pay date', 'salary date'],
      intent: 'payroll',
    },
    {
      patterns: ['prediction', 'tomorrow', 'predict', 'forecast', 'tomorrow attendance'],
      intent: 'prediction',
    },
    {
      patterns: ['help', 'what can you do', 'commands', 'options', 'menu'],
      intent: 'help',
    },
    {
      patterns: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'good afternoon'],
      intent: 'greeting',
    },
    {
      patterns: ['thank', 'thanks', 'thx', 'great', 'awesome', 'perfect', 'nice'],
      intent: 'thanks',
    },
  ];

  for (const { patterns, intent } of intents) {
    if (patterns.some((p) => q.includes(p))) {
      return generateChatResponse(intent, userId, q, context);
    }
  }

  // Fuzzy fallback — check if they mentioned a staff name
  const staffMatch = STAFF_LIST.find((s) => q.includes(s.name.toLowerCase().split(' ')[0].toLowerCase()));
  if (staffMatch) {
    return generateStaffInfoResponse(staffMatch);
  }

  return {
    intent: 'unknown',
    response: "I can help with a lot! Try:\n\n  \"Team status\" — Who's present/absent\n  \"Schedule meeting\" — Best day for team meeting\n  \"Approve leave\" — Quick leave approval\n  \"Top performers\" — Staff leaderboard\n  \"Notifications\" — Pending alerts\n  \"Send reminder\" — Notify your team\n  \"Who's late?\" — Late arrivals\n  \"My check in\" — Your check-in history\n\nJust ask naturally!",
    actions: [],
  };
}

function generateStaffInfoResponse(staff) {
  const today = getTodayAttendance();
  const staffToday = today.find((s) => s.id === staff.id);
  const balance = getLeaveBalance(staff.id);
  const totalLeave = balance.reduce((s, b) => s + b.remaining, 0);

  return {
    intent: 'staff_info',
    response: `${staff.name} (${staff.designation})\n  Department: ${staff.department}\n  Today: ${staffToday ? staffToday.status.toUpperCase() : 'N/A'}${staffToday?.checkIn ? ` (In: ${staffToday.checkIn})` : ''}\n  Attendance Score: ${staff.score}%\n  Leave Remaining: ${totalLeave} days`,
  };
}

// Intents that act on other people's data or send messages to the team.
const ADMIN_INTENTS = ['admin_approve_leave', 'admin_reject_leave', 'admin_mark_attendance', 'admin_send_reminder', 'schedule_meeting', 'whatsapp_integration', 'payroll'];

function generateChatResponse(intent, userId, rawQuery, context) {
  const isAdmin = context.isAdmin === true;
  if (!isAdmin && ADMIN_INTENTS.includes(intent)) {
    return { intent, response: "That's an admin action, so I can't do it from a staff account. Please ask your admin." };
  }
  const today = getTodayAttendance();
  const payroll = getPayrollSummary();

  switch (intent) {

    // ── Admin Commands ──────────────────────

    case 'admin_approve_leave': {
      const requests = getLeaveRequests().filter((r) => r.status === 'pending');
      if (requests.length === 0) {
        return { intent, response: 'No pending leave requests to approve.' };
      }
      // Check if a specific name was mentioned
      const matchedReq = requests.find((r) => rawQuery.includes(r.name.toLowerCase().split(' ')[0].toLowerCase()));
      if (matchedReq) {
        const eval_ = evaluateLeaveRequest(matchedReq);
        return {
          intent, response: `Leave request for ${matchedReq.name}:\n  Type: ${matchedReq.type}\n  Duration: ${matchedReq.days} day(s)\n  Reason: ${matchedReq.reason}\n  AI Confidence: ${eval_.confidence}%\n\nAI recommends: ${eval_.recommendation === 'approve' ? 'APPROVE' : 'REVIEW'}`,
          actions: [
            { label: 'Approve', action: 'approve_leave', data: { id: matchedReq.id, name: matchedReq.name } },
            { label: 'Reject', action: 'reject_leave', data: { id: matchedReq.id, name: matchedReq.name } },
          ],
        };
      }
      const list = requests.map((r) => {
        const eval_ = evaluateLeaveRequest(r);
        return `  ${r.name}: ${r.type} (${r.days}d) — AI: ${eval_.recommendation === 'approve' ? 'Approve' : 'Review'} ${eval_.confidence}%`;
      });
      return {
        intent, response: `${requests.length} pending request(s):\n${list.join('\n')}\n\nSay "approve [name]" to approve a specific request.`,
        actions: requests.length > 0 ? [{ label: 'Approve All AI-Recommended', action: 'approve_all_recommended' }] : [],
      };
    }

    case 'admin_reject_leave': {
      const requests = getLeaveRequests().filter((r) => r.status === 'pending');
      if (requests.length === 0) return { intent, response: 'No pending leave requests.' };
      return {
        intent, response: `${requests.length} pending request(s). Say "reject [name]" to reject a specific request.\n\n${requests.map((r) => `  ${r.name}: ${r.type} (${r.days}d)`).join('\n')}`,
      };
    }

    case 'admin_mark_attendance': {
      return {
        intent, response: 'To mark attendance for a staff member remotely:\n\n1. Open the staff member\'s profile\n2. Use "Override Attendance" option\n3. Select status: Present, Absent, or Half-day\n\nOr navigate to Live Track to see who hasn\'t checked in yet.',
        actions: [{ label: 'Open Live Track', action: 'navigate', data: { screen: 'LiveTrack' } }],
      };
    }

    case 'admin_send_reminder': {
      const notCheckedIn = today.filter((s) => s.status === 'absent' && !s.checkIn);
      if (notCheckedIn.length === 0) {
        return { intent, response: 'Everyone has checked in today! No reminders needed.' };
      }
      const names = notCheckedIn.map((s) => s.name.split(' ')[0]);
      return {
        intent, response: `${notCheckedIn.length} staff haven't checked in:\n  ${names.join(', ')}\n\nI'll send them a push notification reminder to mark attendance.`,
        actions: [
          { label: 'Send Reminder to All', action: 'send_reminder', data: { staffIds: notCheckedIn.map((s) => s.id) } },
          { label: 'Send via WhatsApp', action: 'whatsapp_reminder', data: { names } },
        ],
      };
    }

    // ── Meeting Scheduler ───────────────────

    case 'schedule_meeting': {
      const slots = findBestMeetingSlots(7);
      if (slots.length === 0) return { intent, response: 'No available meeting slots found in the next week.' };
      const best = slots[0];
      const top3 = slots.slice(0, 3);
      let resp = `Best days for a team meeting:\n`;
      top3.forEach((s, i) => {
        const marker = i === 0 ? ' (Best)' : '';
        resp += `\n  ${i + 1}. ${s.dayName}${marker}\n     ${s.presentCount}/${s.totalStaff} staff available (${s.presentPct}%)`;
        if (s.absentNames.length > 0) resp += `\n     Absent: ${s.absentNames.join(', ')}`;
      });
      resp += `\n\nRecommended: ${best.dayName} with ${best.presentPct}% team availability.`;
      return {
        intent, response: resp,
        actions: [
          { label: `Schedule for ${best.dayName}`, action: 'schedule_confirm', data: { date: best.date, day: best.dayName } },
        ],
      };
    }

    // ── WhatsApp Integration ────────────────

    case 'whatsapp_integration': {
      return {
        intent, response: 'WhatsApp Integration:\n\n  Staff can check in/out by sending:\n  "Check in" to the TARAhut WhatsApp number\n\n  Admins can:\n  - Send bulk attendance reminders\n  - Share payslips via WhatsApp\n  - Receive daily briefing on WhatsApp\n\nTap below to set up WhatsApp notifications.',
        actions: [
          { label: 'Send Team Reminder via WhatsApp', action: 'whatsapp_broadcast' },
          { label: 'Set Up WhatsApp Alerts', action: 'whatsapp_setup' },
        ],
      };
    }

    // ── Notifications ───────────────────────

    case 'notifications': {
      const notifs = generateSmartNotifications(isAdmin);
      if (notifs.length === 0) return { intent, response: 'All clear! No pending notifications.' };
      let resp = `You have ${notifs.length} notification${notifs.length > 1 ? 's' : ''}:\n`;
      notifs.forEach((n, i) => {
        const icon = n.priority === 'critical' ? '🔴' : n.priority === 'high' ? '🟡' : '🔵';
        resp += `\n${icon} ${n.title}\n   ${n.body}\n   ${n.time}`;
      });
      return {
        intent, response: resp,
        actions: [{ label: 'View All Notifications', action: 'navigate', data: { screen: 'Notifications' } }],
      };
    }

    // ── Check-in History ────────────────────

    case 'checkin_history': {
      const history = getAttendanceHistory(7);
      const myHistory = history.filter((h) => h.staffId === (userId || '2')).slice(-5);
      if (myHistory.length === 0) return { intent, response: 'No recent check-in records found.' };
      let resp = 'Your recent check-ins:\n';
      myHistory.reverse().forEach((h) => {
        const d = new Date(h.date);
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        resp += `\n  ${dayName}: ${h.status.toUpperCase()}`;
        if (h.checkIn) resp += ` (In: ${h.checkIn}`;
        if (h.checkOut) resp += `, Out: ${h.checkOut}`;
        if (h.checkIn) resp += `)`;
        if (h.hours) resp += ` — ${h.hours}h`;
      });
      return { intent, response: resp };
    }

    // ── Who's Late ──────────────────────────

    case 'who_late': {
      const late = today.filter((s) => s.status === 'late');
      if (late.length === 0) return { intent, response: 'No late arrivals today! Everyone was on time.' };
      const lines = late.map((s) => `  ${s.name} — checked in at ${s.checkIn} (${s.department})`);
      return { intent, response: `${late.length} late arrival${late.length > 1 ? 's' : ''} today:\n${lines.join('\n')}` };
    }

    // ── Who's on Leave ──────────────────────

    case 'who_on_leave': {
      const onLeave = today.filter((s) => s.status === 'leave');
      if (onLeave.length === 0) return { intent, response: 'No one is on leave today.' };
      const lines = onLeave.map((s) => `  ${s.name} (${s.department})`);
      return { intent, response: `${onLeave.length} on leave today:\n${lines.join('\n')}` };
    }

    // ── Top Performers ──────────────────────

    case 'top_performers': {
      const sorted = [...STAFF_LIST].filter((s) => s.role !== 'admin').sort((a, b) => b.score - a.score).slice(0, 5);
      let resp = 'Top 5 Attendance Leaders:\n';
      sorted.forEach((s, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        resp += `\n${medal} ${i + 1}. ${s.name} — ${s.score}% (${s.department})`;
      });
      return { intent, response: resp };
    }

    // ── Low Performers ──────────────────────

    case 'low_performers': {
      const sorted = [...STAFF_LIST].filter((s) => s.role !== 'admin').sort((a, b) => a.score - b.score).slice(0, 5);
      let resp = 'Staff Needing Improvement:\n';
      sorted.forEach((s, i) => {
        resp += `\n  ${i + 1}. ${s.name} — ${s.score}% (${s.department})`;
      });
      resp += '\n\nConsider a one-on-one check-in with these team members.';
      return { intent, response: resp };
    }

    // ── Department Status ───────────────────

    case 'dept_status': {
      const depts = {};
      today.forEach((s) => {
        if (!depts[s.department]) depts[s.department] = { total: 0, present: 0, late: 0, absent: 0, leave: 0 };
        depts[s.department].total++;
        depts[s.department][s.status]++;
      });
      let resp = 'Department-wise Status:\n';
      Object.entries(depts).forEach(([dept, d]) => {
        const rate = Math.round(((d.present + d.late) / d.total) * 100);
        resp += `\n  ${dept}: ${d.present + d.late}/${d.total} present (${rate}%)`;
        if (d.absent) resp += ` | ${d.absent} absent`;
        if (d.leave) resp += ` | ${d.leave} leave`;
      });
      return { intent, response: resp };
    }

    // ── Overtime ────────────────────────────

    case 'overtime': {
      const todayPresent = today.filter((s) => s.hours > 0).sort((a, b) => b.hours - a.hours);
      if (todayPresent.length === 0) return { intent, response: 'No working hours data available yet today.' };
      const avgHours = Math.round(todayPresent.reduce((s, p) => s + p.hours, 0) / todayPresent.length * 10) / 10;
      const overtime = todayPresent.filter((s) => s.hours > 9);
      let resp = `Working Hours Today:\n  Average: ${avgHours}h\n  Overtime (>9h): ${overtime.length} staff\n\nTop workers:`;
      todayPresent.slice(0, 5).forEach((s) => {
        resp += `\n  ${s.name}: ${s.hours}h${s.hours > 9 ? ' (OT)' : ''}`;
      });
      return { intent, response: resp };
    }

    // ── Original Intents (Enhanced) ─────────

    case 'leave_balance': {
      const balance = getLeaveBalance(userId || '2');
      const lines = balance.map((b) => `  ${b.type}: ${b.remaining} of ${b.total} remaining`);
      const total = balance.reduce((s, b) => s + b.remaining, 0);
      return {
        intent, response: `Here's your leave balance:\n${lines.join('\n')}\n\nTotal available: ${total} days${total < 5 ? '\n\n⚠️ Low balance — plan ahead!' : ''}`,
        actions: [{ label: 'Apply for Leave', action: 'navigate', data: { screen: 'Leave' } }],
      };
    }

    case 'who_absent': {
      const absent = today.filter((s) => s.status === 'absent' || s.status === 'leave');
      if (absent.length === 0) return { intent, response: 'Everyone is present today! Full attendance. 🎉' };
      const names = absent.map((s) => `  ${s.name} (${s.status === 'leave' ? 'On Leave' : 'Absent'}) — ${s.department}`);
      return {
        intent, response: `${absent.length} staff not in today:\n${names.join('\n')}`,
        actions: isAdmin && absent.some((s) => s.status === 'absent') ? [{ label: 'Send Reminder', action: 'send_reminder' }] : [],
      };
    }

    case 'my_attendance': {
      const rates = getWeeklyAttendanceRate();
      const trend = rates.change > 0 ? '↑ Improving!' : rates.change < 0 ? '↓ Declining' : '→ Steady';
      return {
        intent,
        response: `Your Attendance Dashboard:\n  This week: ${rates.thisWeek}%\n  Last week: ${rates.lastWeek}%\n  Trend: ${trend} (${Math.abs(rates.change)}%)\n\n${rates.thisWeek >= 90 ? 'Excellent consistency! Keep it up!' : rates.thisWeek >= 75 ? 'Good, but room for improvement.' : 'Needs attention — try to be more consistent.'}`,
        actions: [{ label: 'View Full History', action: 'navigate', data: { screen: 'History' } }],
      };
    }

    case 'team_status': {
      const present = today.filter((s) => s.status === 'present').length;
      const late = today.filter((s) => s.status === 'late').length;
      const absent = today.filter((s) => s.status === 'absent').length;
      const leave = today.filter((s) => s.status === 'leave').length;
      const rate = Math.round(((present + late) / today.length) * 100);
      return {
        intent,
        response: `Team Status Today:\n  ✅ Present: ${present}\n  ⏰ Late: ${late}\n  ❌ Absent: ${absent}\n  📋 On Leave: ${leave}\n  👥 Total: ${today.length}\n\n  Attendance Rate: ${rate}%${rate >= 90 ? ' — Excellent!' : rate >= 75 ? ' — Good' : ' — Needs attention'}`,
      };
    }

    case 'payroll': {
      return {
        intent,
        response: `Payroll Summary:\n  Total: ₹${payroll.totalPayroll}\n  Paid: ₹${payroll.paid}\n  Pending: ₹${payroll.pending}\n  Due in: ${payroll.dueInDays} days\n\n${payroll.dueInDays <= 5 ? '⚠️ Payroll is due soon! Process pending salaries.' : '✅ Payroll is on track.'}`,
        actions: [{ label: 'Open Payroll', action: 'navigate', data: { screen: 'Payroll' } }],
      };
    }

    case 'prediction': {
      const pred = predictTomorrowAbsences();
      if (pred.note) return { intent, response: pred.note };
      const absentNames = pred.predictedAbsent.map((s) => `  ${s.name} — ${s.absentProb}% chance`);
      const lateNames = pred.predictedLate.map((s) => `  ${s.name} — ${s.lateProb}% chance`);
      let resp = `AI Prediction for ${pred.day} (${pred.confidence}% confidence):\n`;
      if (absentNames.length) resp += `\nLikely absent:\n${absentNames.join('\n')}`;
      if (lateNames.length) resp += `\nLikely late:\n${lateNames.join('\n')}`;
      if (!absentNames.length && !lateNames.length) resp += '\nNo attendance risks detected. Looking good!';
      return { intent, response: resp };
    }

    case 'greeting': {
      const hour = new Date().getHours();
      const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      const present = today.filter((s) => s.status === 'present' || s.status === 'late').length;
      return { intent, response: `${g}! 👋\n\n${present} of ${today.length} staff are in today. How can I help?\n\nTry: "team status", "schedule meeting", "notifications", or "approve leave"` };
    }

    case 'thanks': {
      const responses = [
        'Happy to help! Let me know if you need anything else.',
        'Anytime! I\'m here whenever you need me.',
        'Glad I could help! Ask me anything, anytime.',
        'You\'re welcome! Anything else I can do?',
      ];
      return { intent, response: responses[Math.floor(Math.random() * responses.length)] };
    }

    case 'help': {
      return {
        intent,
        response: '🤖 TARAhut AI Assistant\n\nI can help with:\n\n📊 Status & Reports:\n  "Team status" — Who\'s present/absent/late\n  "Department status" — By department\n  "Top performers" — Attendance leaderboard\n  "Overtime" — Working hours today\n\n📅 Planning:\n  "Schedule meeting" — Best day for team meeting\n  "Prediction" — Tomorrow\'s attendance forecast\n\n👤 Personal:\n  "Leave balance" — Your remaining leaves\n  "My attendance" — Your score & trend\n  "My check in" — Recent check-in history\n\n⚡ Admin Commands:\n  "Approve leave" — Review & approve requests\n  "Send reminder" — Notify absent staff\n  "Notifications" — View pending alerts\n\n💬 Smart:\n  "WhatsApp" — WhatsApp integration\n  Say any staff name for their info\n\nJust type naturally!',
      };
    }

    default:
      return { intent: 'unknown', response: 'I didn\'t understand that. Type "help" to see what I can do.' };
  }
}
