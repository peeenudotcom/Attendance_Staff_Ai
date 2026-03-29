import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';

const ThemeContext = createContext({});

const DARK = {
  bg: '#0A0E1A',
  bgCard: '#111827',
  bgElevated: '#1A2236',
  bgSurface: '#151C2E',
  bgGlass: 'rgba(255, 255, 255, 0.04)',
  bgGlassStrong: 'rgba(255, 255, 255, 0.08)',
  bgGlassBorder: 'rgba(255, 255, 255, 0.06)',
  accentStart: '#7C3AED',
  accentEnd: '#3B82F6',
  accent: '#7C3AED',
  accentSoft: 'rgba(124, 58, 237, 0.12)',
  accentBorder: 'rgba(124, 58, 237, 0.25)',
  accentGlow: 'rgba(124, 58, 237, 0.4)',
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
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  textAccent: '#A78BFA',
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.03)',
  divider: 'rgba(255, 255, 255, 0.04)',
  blurTint: 'dark',
  statusBar: 'light-content',
  // Legacy
  white: '#F8FAFC', black: '#0A0E1A',
  gray100: 'rgba(255,255,255,0.06)', gray200: 'rgba(255,255,255,0.08)',
  gray300: 'rgba(255,255,255,0.12)', gray400: '#94A3B8', gray500: '#64748B', gray600: '#475569',
  primary: '#0A0E1A', text: '#F8FAFC', background: '#0A0E1A', card: '#111827',
  successLight: 'rgba(16, 185, 129, 0.15)', warningLight: 'rgba(245, 158, 11, 0.15)',
  dangerLight: 'rgba(239, 68, 68, 0.15)', infoLight: 'rgba(59, 130, 246, 0.15)',
};

const LIGHT = {
  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgElevated: '#F1F5F9',
  bgSurface: '#F8FAFC',
  bgGlass: 'rgba(255, 255, 255, 0.7)',
  bgGlassStrong: 'rgba(255, 255, 255, 0.85)',
  bgGlassBorder: 'rgba(0, 0, 0, 0.06)',
  accentStart: '#7C3AED',
  accentEnd: '#3B82F6',
  accent: '#7C3AED',
  accentSoft: 'rgba(124, 58, 237, 0.08)',
  accentBorder: 'rgba(124, 58, 237, 0.2)',
  accentGlow: 'rgba(124, 58, 237, 0.25)',
  success: '#059669',
  successSoft: 'rgba(5, 150, 105, 0.08)',
  successGlow: 'rgba(5, 150, 105, 0.3)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.08)',
  warningGlow: 'rgba(217, 119, 6, 0.3)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.08)',
  dangerGlow: 'rgba(220, 38, 38, 0.3)',
  info: '#2563EB',
  infoSoft: 'rgba(37, 99, 235, 0.08)',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textAccent: '#7C3AED',
  border: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  divider: 'rgba(0, 0, 0, 0.05)',
  blurTint: 'light',
  statusBar: 'dark-content',
  // Legacy
  white: '#FFFFFF', black: '#0F172A',
  gray100: '#F1F5F9', gray200: '#E2E8F0',
  gray300: '#CBD5E1', gray400: '#94A3B8', gray500: '#64748B', gray600: '#475569',
  primary: '#F8FAFC', text: '#0F172A', background: '#F8FAFC', card: '#FFFFFF',
  successLight: 'rgba(5, 150, 105, 0.1)', warningLight: 'rgba(217, 119, 6, 0.1)',
  dangerLight: 'rgba(220, 38, 38, 0.1)', infoLight: 'rgba(37, 99, 235, 0.1)',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const colors = isDark ? DARK : LIGHT;

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
