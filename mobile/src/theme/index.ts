/**
 * Design tokens — mirrors the web 019 premium redesign (Indigo/Violet).
 * All screens must consume these instead of hard-coded values.
 */

export const colors = {
  primary: '#4F46E5',        // indigo-600
  primaryLight: '#6366F1',   // indigo-500
  primarySoft: '#EEF2FF',    // indigo-50
  violet: '#8B5CF6',
  violetSoft: '#F5F3FF',

  background: '#F8FAFC',     // slate-50
  surface: '#FFFFFF',
  border: '#E2E8F0',         // slate-200

  text: '#0F172A',           // slate-900
  textSecondary: '#64748B',  // slate-500
  textMuted: '#94A3B8',      // slate-400
  onPrimary: '#FFFFFF',

  success: '#10B981',
  successSoft: '#ECFDF5',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const
