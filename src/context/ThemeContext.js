import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';

const ThemeContext = createContext({});

const DARK = {
  bg: '#150C0F',
  bgCard: '#1F1317',
  bgElevated: '#2B1A1F',
  bgSurface: '#1A1013',
  bgGlass: 'rgba(255, 255, 255, 0.04)',
  bgGlassStrong: 'rgba(255, 255, 255, 0.08)',
  bgGlassBorder: 'rgba(255, 255, 255, 0.06)',
  accentStart: '#9A2E40',
  accentEnd: '#6E1F2D',
  accent: '#9A2E40',
  accentSoft: 'rgba(154, 46, 64, 0.16)',
  accentBorder: 'rgba(154, 46, 64, 0.35)',
  accentGlow: 'rgba(154, 46, 64, 0.45)',
  success: '#45A79F',
  successSoft: 'rgba(69, 167, 159, 0.14)',
  successGlow: 'rgba(69, 167, 159, 0.4)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  warningGlow: 'rgba(245, 158, 11, 0.4)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  dangerGlow: 'rgba(239, 68, 68, 0.4)',
  info: '#5FA9BA',
  infoSoft: 'rgba(95, 169, 186, 0.14)',
  textPrimary: '#F4EFE7',
  textSecondary: '#BBAFA8',
  textMuted: '#7D706B',
  textAccent: '#E39AA6',
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.03)',
  divider: 'rgba(255, 255, 255, 0.04)',
  blurTint: 'dark',
  statusBar: 'light-content',
  // Legacy
  white: '#F4EFE7', black: '#150C0F',
  gray100: 'rgba(255,255,255,0.06)', gray200: 'rgba(255,255,255,0.08)',
  gray300: 'rgba(255,255,255,0.12)', gray400: '#94A3B8', gray500: '#64748B', gray600: '#475569',
  primary: '#150C0F', text: '#F4EFE7', background: '#150C0F', card: '#1F1317',
  successLight: 'rgba(69, 167, 159, 0.15)', warningLight: 'rgba(245, 158, 11, 0.15)',
  dangerLight: 'rgba(239, 68, 68, 0.15)', infoLight: 'rgba(95, 169, 186, 0.15)',
};

const LIGHT = {
  bg: '#F7F3EC',
  bgCard: '#FFFFFF',
  bgElevated: '#EFE8DD',
  bgSurface: '#F7F3EC',
  bgGlass: 'rgba(255, 255, 255, 0.7)',
  bgGlassStrong: 'rgba(255, 255, 255, 0.85)',
  bgGlassBorder: 'rgba(0, 0, 0, 0.06)',
  accentStart: '#8E2A3B',
  accentEnd: '#6A1C29',
  accent: '#802534',
  accentSoft: 'rgba(128, 37, 52, 0.08)',
  accentBorder: 'rgba(128, 37, 52, 0.22)',
  accentGlow: 'rgba(128, 37, 52, 0.25)',
  success: '#368A84',
  successSoft: 'rgba(54, 138, 132, 0.10)',
  successGlow: 'rgba(54, 138, 132, 0.3)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.08)',
  warningGlow: 'rgba(217, 119, 6, 0.3)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.08)',
  dangerGlow: 'rgba(220, 38, 38, 0.3)',
  info: '#2F7A8C',
  infoSoft: 'rgba(47, 122, 140, 0.08)',
  textPrimary: '#2A1418',
  textSecondary: '#6B5A57',
  textMuted: '#9C8D88',
  textAccent: '#802534',
  border: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  divider: 'rgba(0, 0, 0, 0.05)',
  blurTint: 'light',
  statusBar: 'dark-content',
  // Legacy
  white: '#FFFFFF', black: '#2A1418',
  gray100: '#F1F5F9', gray200: '#E2E8F0',
  gray300: '#CBD5E1', gray400: '#94A3B8', gray500: '#64748B', gray600: '#475569',
  primary: '#F7F3EC', text: '#2A1418', background: '#F7F3EC', card: '#FFFFFF',
  successLight: 'rgba(54, 138, 132, 0.1)', warningLight: 'rgba(217, 119, 6, 0.1)',
  dangerLight: 'rgba(220, 38, 38, 0.1)', infoLight: 'rgba(47, 122, 140, 0.1)',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const colors = isDark ? DARK : LIGHT;

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
