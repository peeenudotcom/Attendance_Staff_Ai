// Haazri design tokens (navy header, yellow highlight, white sheet). One light theme for the whole app.
export const T = {
  navy: '#13213D',          // header background, primary buttons
  navyDeep: '#0E1A33',      // headings on white
  onNavy: '#FFFFFF',
  onNavyMuted: '#C3CCDD',   // subtitles on the navy header
  onNavyLine: '#2C3C5E',     // solid (no see-through "glass")
  onNavyGlass: '#1D2C4B',    // header controls: search box, pills
  onNavyGlassStrong: '#33476F', // the chosen option in a header control
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
  radius: 12,
  radiusLg: 18,
  sheetRadius: 24,
  pad: 18,                  // screen side padding
};

/** Avatar colours, picked from the person's name so it stays the same. */
export const AVATAR_TINTS = ['#E6EEFC', '#E5F4EC', '#FCE8EC', '#EEE9FB', '#FDF1D6', '#E6F4FB'];

/** Colour for a day / person status. */
export const STATUS_COLOR = {
  present: T.green, late: T.amber, half: T.amber, absent: T.red, leave: T.blue, holiday: T.blue, off: T.textFaint,
  pending: T.textFaint, before: T.textFaint, left: T.textFaint,
};
