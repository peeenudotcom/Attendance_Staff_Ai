// Chat responder — wraps aiEngine.matchChatQuery with message formatting
import { matchChatQuery } from './aiEngine';

export function getChatResponse(query, userId, context = {}) {
  return matchChatQuery(query, userId, context);
}

// Dynamic quick replies based on role
export function getQuickReplies(isAdmin) {
  if (isAdmin) {
    return [
      'Team status',
      'Approve leave',
      'Schedule meeting',
      "Who's absent?",
      'Notifications',
      'Send reminder',
      'Top performers',
      'Prediction',
      'Department status',
      'Payroll',
    ];
  }
  return [
    'Leave balance',
    'My attendance',
    'My check in',
    "Who's absent?",
    'Team status',
    'Prediction',
  ];
}

// Legacy export for backwards compat
export const QUICK_REPLIES = [
  'Team status',
  'Schedule meeting',
  'Approve leave',
  "Who's absent?",
  'Notifications',
  'Top performers',
  'Leave balance',
  'Prediction',
];
