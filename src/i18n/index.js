import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import common from './strings/common';

// App languages. Each screen keeps its words in src/i18n/strings/<name>.js as { en: {...}, pa: {...}, hi: {...} } and
// registers it below; t('name.key') looks the key up in the chosen language, falling back to English. Server messages
// (errors from the API) and emails stay in English.
export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'hi', label: 'हिंदी' },
];

const namespaces = { common };
/** Adds a screen's strings (called at the top of each strings file's importer, see registerStrings below). */
export function registerStrings(name, dict) { namespaces[name] = dict; }

const STORAGE_KEY = 'lang';
const storage = {
  get: async () => {
    if (Platform.OS === 'web') return localStorage.getItem(STORAGE_KEY);
    return require('expo-secure-store').getItemAsync(STORAGE_KEY);
  },
  set: async (v) => {
    if (Platform.OS === 'web') { localStorage.setItem(STORAGE_KEY, v); return; }
    await require('expo-secure-store').setItemAsync(STORAGE_KEY, v);
  },
};

/** Looks up "ns.key" in `lang` (falling back to English, then the key itself) and fills {name} placeholders. */
export function translate(lang, key, vars) {
  const dot = key.indexOf('.');
  const ns = namespaces[key.slice(0, dot)];
  const k = key.slice(dot + 1);
  let s = ns?.[lang]?.[k] ?? ns?.en?.[k] ?? key;
  if (typeof s === 'function') s = s(vars || {});
  if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, v) => (vars[v] ?? m));
  return s;
}

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (k, v) => translate('en', k, v) });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');
  useEffect(() => {
    storage.get().then((v) => { if (LANGS.some((l) => l.code === v)) setLangState(v); }).catch(() => {});
  }, []);
  const setLang = useCallback((code) => {
    setLangState(code);
    storage.set(code).catch(() => {});
  }, []);
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** { lang, setLang, t } for the current language. */
export const useLang = () => useContext(LanguageContext);

// ---- Dates, in the chosen language (no reliance on the phone's locale data) ----
// Dates are "YYYY-MM-DD" strings in India time, the same as the server uses.

const dayOf = (d) => new Date(`${d}T00:00:00Z`);
/** "Wed" / "ਬੁੱਧ" / "बुध" */
export const weekdayShort = (t, date) => t(`common.wd${dayOf(date).getUTCDay()}`);
/** "Wednesday" */
export const weekdayLong = (t, date) => t(`common.wdl${dayOf(date).getUTCDay()}`);
/** "October" for a month number 1-12 */
export const monthLong = (t, m) => t(`common.m${m}`);
/** "Oct" */
export const monthShort = (t, m) => t(`common.ms${m}`);
/** "Wed, 14 Oct" */
export const fmtDay = (t, date) => `${weekdayShort(t, date)}, ${Number(date.slice(8, 10))} ${monthShort(t, Number(date.slice(5, 7)))}`;
/** "Wed, 14 Oct 2026" */
export const fmtDayYear = (t, date) => `${fmtDay(t, date)} ${date.slice(0, 4)}`;
/** "Wednesday, 14 October" */
export const fmtDayLong = (t, date) => `${weekdayLong(t, date)}, ${Number(date.slice(8, 10))} ${monthLong(t, Number(date.slice(5, 7)))}`;
/** "October 2026" for "2026-10" or a date */
export const fmtMonth = (t, ym) => `${monthLong(t, Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
