import { Platform } from 'react-native';

export const COLORS = {
  // Core brand
  bg: '#0A0E1A',
  bgCard: '#111827',
  bgElevated: '#1A2236',
  bgSurface: '#151C2E',
  bgGlass: 'rgba(255, 255, 255, 0.04)',
  bgGlassStrong: 'rgba(255, 255, 255, 0.08)',
  bgGlassBorder: 'rgba(255, 255, 255, 0.06)',

  // Accent gradient stops
  accentStart: '#7C3AED',
  accentEnd: '#3B82F6',
  accent: '#7C3AED',
  accentSoft: 'rgba(124, 58, 237, 0.12)',
  accentBorder: 'rgba(124, 58, 237, 0.25)',
  accentGlow: 'rgba(124, 58, 237, 0.4)',

  // Status
  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  successGlow: 'rgba(16, 185, 129, 0.4)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  warningGlow: 'rgba(245, 158, 11, 0.4)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  dangerGlow: 'rgba(239, 68, 68, 0.4)',
  info: '#3B82F6',
  infoSoft: 'rgba(59, 130, 246, 0.12)',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  textAccent: '#A78BFA',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.03)',
  divider: 'rgba(255, 255, 255, 0.04)',

  // Legacy compat
  white: '#F8FAFC',
  black: '#0A0E1A',
  gray50: '#F8FAFC',
  gray100: 'rgba(255,255,255,0.06)',
  gray200: 'rgba(255,255,255,0.08)',
  gray300: 'rgba(255,255,255,0.12)',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  primary: '#0A0E1A',
  text: '#F8FAFC',
  textSecondaryLegacy: '#94A3B8',
  textMutedLegacy: '#475569',
  background: '#0A0E1A',
  card: '#111827',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  infoLight: 'rgba(59, 130, 246, 0.15)',
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const RADIUS = { xs: 6, sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, full: 999 };

export const FONTS = {
  h1: { fontSize: 30, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.8 },
  h2: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.4 },
  h3: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
  body: { fontSize: 15, fontWeight: '400', color: COLORS.textPrimary, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },
  caption: { fontSize: 13, fontWeight: '400', color: COLORS.textSecondary },
  captionMedium: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  small: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted },
  button: { fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
  mono: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
};

export const SHADOWS = {
  glow: (color = COLORS.accentGlow) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  }),
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  accent: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const GLASS = {
  card: {
    backgroundColor: COLORS.bgGlass,
    borderWidth: 1,
    borderColor: COLORS.bgGlassBorder,
  },
  strong: {
    backgroundColor: COLORS.bgGlassStrong,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
};
