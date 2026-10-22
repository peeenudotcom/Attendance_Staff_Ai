// Haazri design tokens: light Apple-style screens (soft grey page, white rounded sheet, frosted-glass bars), navy for
// main buttons and text, yellow as the highlight. The onNavy* names are the colours used ON THE HEADER (now light).
export const T = {
  navy: '#13213D',          // primary buttons
  navyDeep: '#0E1A33',      // headings
  page: '#EEF1F6',          // header and page background
  white: '#FFFFFF',
  onNavy: '#0E1A33',        // text and icons on the header
  onNavyMuted: '#6B7488',   // subtitles on the header
  onNavyLine: 'rgba(14,26,51,0.08)',
  onNavyGlass: 'rgba(255,255,255,0.72)',  // frosted controls on the header: search box, pills
  onNavyGlassStrong: '#FFFFFF',           // the chosen option in a header control
  glassBorder: 'rgba(255,255,255,0.9)',
  shadow: { shadowColor: '#0E1A33', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  yellow: '#F6CF4C',        // selected day, Add button, active tab bar line
  yellowSoft: '#FCEFC2',    // admin chip, pending pill
  onYellow: '#13213D',
  bg: '#FFFFFF',            // sheet
  surface: '#F5F6F9',       // inputs, grey chips
  text: '#0F1B33',
  textMuted: '#6B7488',
  textFaint: '#9AA2B1',
  line: '#E7EAF0',
  green: '#2E9E5B', greenSoft: '#E4F4EA',
  amber: '#D99A00', amberSoft: '#FDF1D6',
  red: '#C62828', redSoft: '#FDECEC',
  blue: '#7CC4E8', blueSoft: '#E6F4FB',
  radius: 14,
  radiusLg: 20,
  sheetRadius: 28,
  pad: 18,                  // screen side padding
};

/** Avatar colours, picked from the person's name so it stays the same. */
export const AVATAR_TINTS = ['#E6EEFC', '#E5F4EC', '#FCE8EC', '#EEE9FB', '#FDF1D6', '#E6F4FB'];

/** Colour for a day / person status. */
export const STATUS_COLOR = {
  present: T.green, late: T.amber, half: T.amber, absent: T.red, leave: T.blue, holiday: T.blue, off: T.textFaint,
  pending: T.textFaint, before: T.textFaint, left: T.textFaint,
};
