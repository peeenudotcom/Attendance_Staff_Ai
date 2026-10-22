import { Platform } from 'react-native';

// "930", "0930", "9.30", "9:30" -> "09:30" (Android's number keyboard has no colon).
export function normalizeTime(v) {
  const t = String(v || '').trim().replace(/[.\s]/g, ':');
  if (!t) return '';
  const m = /^(\d{1,2}):?(\d{2})$/.exec(t);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
}
export const TIME_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
