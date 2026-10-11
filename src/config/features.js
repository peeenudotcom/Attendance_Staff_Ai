// Screens and sections that still render hardcoded sample data are hidden from
// the store build. Flip this to true for demos. When a screen is wired to the
// API, remove its gate instead of relying on this flag.
export const SHOW_SAMPLE_DATA = false;

// Reading the phone's call history (Android only). Google Play only allows call-log permissions for
// default phone/SMS apps, so this stays off for store builds; app.json also blocks those permissions.
// Turning it on needs a private build with the call-log permissions un-blocked.
export const ENABLE_CALL_LOGS = false;
