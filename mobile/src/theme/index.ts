/**
 * Design tokens — mirrors the web 019 premium redesign (Indigo/Violet).
 * All screens must consume these instead of hard-coded values.
 * 2026-07: modern consumer-app pass — pill CTAs, softer cards, hero gradient.
 */

export const colors = {
  primary: '#4F46E5',        // indigo-600
  primaryLight: '#6366F1',   // indigo-500
  primaryDark: '#4338CA',    // indigo-700 — pressed states / gradient depth
  primarySoft: '#EEF2FF',    // indigo-50
  violet: '#8B5CF6',
  violetSoft: '#F5F3FF',

  /** تدرّج الهيدر البطولي (نيلي → بنفسجي) */
  gradientFrom: '#4F46E5',   // indigo-600
  gradientTo: '#7C3AED',     // violet-600

  background: '#F6F7FB',     // very light cool gray
  surface: '#FFFFFF',
  border: '#E2E8F0',         // slate-200 — inputs / dividers
  borderSoft: '#EEF1F7',     // hairline for cards on light bg

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
  xl: 20,
  xxl: 28,
  /** أزرار الإجراء الرئيسية — شكل حبة الدواء */
  pill: 999,
  full: 999,
} as const

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  /** عناوين الشاشات الكبيرة */
  title: 26,
} as const

/** أبعاد عناصر التحكم الموحّدة */
export const control = {
  /** ارتفاع زر الإجراء الرئيسي (pill CTA) */
  buttonHeight: 52,
  /** ارتفاع حقول الإدخال */
  inputHeight: 50,
} as const

export const shadow = {
  /** ظل البطاقات الناعم الافتراضي */
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  /** ظل مرتفع — أوراق سفلية / عناصر عائمة */
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  /** ظل ملوّن لزر الإجراء الرئيسي */
  button: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
} as const
