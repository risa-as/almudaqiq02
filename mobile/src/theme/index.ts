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
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 12,
  /** أزرار الإجراء الرئيسية — زوايا ناعمة صغيرة (وليس حبة دواء) */
  pill: 8,
  /** للعناصر الدائرية فعلًا فقط: صور رمزية / فقاعات أيقونات / نقاط / أزرار مستديرة */
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
  /** ظل البطاقات الناعم الافتراضي — خفيف ومشدود */
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  /** ظل مرتفع — أوراق سفلية / عناصر عائمة */
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  /** ظل ملوّن خفيف لزر الإجراء الرئيسي */
  button: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
} as const
