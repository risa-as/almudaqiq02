/**
 * نسخة مطابقة لمفاتيح lib/features.ts في مشروع الويب — تُحدَّث يدويًا عند إضافة
 * ميزة جديدة هناك (لا استيراد متبادل بين المشروعين — قرار research R8).
 */
export const FEATURE_KEYS = [
  'stock_transfers',
  'branch_comparison',
  'advanced_analytics',
  'stock_movement',
  'ai_assistant',
  'ai_smart_buy',
  'audit_log',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type FeatureMap = Partial<Record<FeatureKey, boolean>>

export function hasFeature(features: FeatureMap | null | undefined, key: FeatureKey): boolean {
  return features?.[key] === true
}
