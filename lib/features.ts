/**
 * Plan feature gating — single source of truth.
 *
 * A plan's `features` column stores a JSON object of boolean flags keyed by the
 * FeatureKeys below, e.g. { "stock_transfers": true, "audit_log": false }.
 *
 * Pages and their backing API routes are gated by these flags. When a flag is
 * off for the tenant's plan, the page is blocked (client) and the API returns
 * 403 (server). Pages NOT listed in PATH_FEATURES are always accessible.
 *
 * This module is dependency-free so it can be imported from both client
 * components and server routes.
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

/**
 * The plan tier that unlocks a feature — used for sidebar badges and the
 * upgrade screen. Reflects the default plan design (Pro grants everything
 * except audit_log; Enterprise grants all). It is a display hint only; actual
 * access is always decided by the tenant plan's `features` flags.
 */
export type PlanTier = 'pro' | 'enterprise'

export const TIER_META: Record<PlanTier, { label: string }> = {
  pro:        { label: 'الأحترافية' },
  enterprise: { label: 'المؤسسات' },
}

/** Human-readable metadata for the super-admin plans UI + sidebar badges. */
export const FEATURES: { key: FeatureKey; label: string; description: string; tier: PlanTier }[] = [
  { key: 'stock_transfers',    label: 'نقل المخزون بين الفروع', description: 'صفحة نقل المخزون بين الفروع',                 tier: 'pro' },
  { key: 'branch_comparison',  label: 'تقارير مقارنة الفروع',   description: 'تقرير مقارنة أداء الفروع',                     tier: 'pro' },
  { key: 'advanced_analytics', label: 'التحليلات المتقدمة',     description: 'لوحة التحليلات الذكية',                        tier: 'pro' },
  { key: 'stock_movement',     label: 'حركة المخزون',           description: 'تقرير حركة المخزون (الوارد/الصادر)',          tier: 'pro' },
  { key: 'ai_assistant',       label: 'المساعد الذكي',          description: 'مساعد الذكاء الاصطناعي للدردشة',               tier: 'pro' },
  { key: 'ai_smart_buy',       label: 'الشراء الذكي',           description: 'توصيات الشراء بالذكاء الاصطناعي',              tier: 'pro' },
  { key: 'audit_log',          label: 'سجل المراجعة',           description: 'سجل تدقيق كل العمليات (حوكمة)',                tier: 'enterprise' },
]

/** Feature + tier metadata required by a page path, or null if ungated. */
export function requiredFeatureMeta(pathname: string) {
  const key = featureForPath(pathname)
  if (!key) return null
  const meta = FEATURES.find(f => f.key === key)
  if (!meta) return null
  return { key, label: meta.label, tier: meta.tier, tierLabel: TIER_META[meta.tier].label }
}

/**
 * Page/route prefix → required feature. Ordered most-specific-first so that
 * featureForPath() matches the deepest path (e.g. smart-buy before purchases).
 */
const PATH_FEATURES: { prefix: string; feature: FeatureKey }[] = [
  { prefix: '/purchases/suppliers/smart-buy', feature: 'ai_smart_buy' },
  { prefix: '/reports/stock-movement',        feature: 'stock_movement' },
  { prefix: '/reports/analytics',             feature: 'advanced_analytics' },
  { prefix: '/reports/branches',              feature: 'branch_comparison' },
  { prefix: '/reports/audit',                 feature: 'audit_log' },
  { prefix: '/transfers',                     feature: 'stock_transfers' },
  { prefix: '/assistant',                     feature: 'ai_assistant' },
]

/** Returns the feature a given page path requires, or null if it is ungated. */
export function featureForPath(pathname: string): FeatureKey | null {
  for (const { prefix, feature } of PATH_FEATURES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return feature
  }
  return null
}

/**
 * Parse the raw `features` column into a normalized FeatureMap.
 * Tolerant of: a JSON object of booleans (canonical), a legacy JSON array of
 * feature-name strings, or empty/invalid input (→ all features off).
 */
export function parseFeatures(raw: string | null | undefined): FeatureMap {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  const out: FeatureMap = {}
  if (Array.isArray(parsed)) {
    // Legacy array of strings: only map values that match a known key.
    for (const v of parsed) {
      if (typeof v === 'string' && (FEATURE_KEYS as readonly string[]).includes(v)) {
        out[v as FeatureKey] = true
      }
    }
    return out
  }
  if (parsed && typeof parsed === 'object') {
    for (const key of FEATURE_KEYS) {
      out[key] = (parsed as Record<string, unknown>)[key] === true
    }
  }
  return out
}

/** True when the given feature flag is explicitly enabled. */
export function hasFeature(features: FeatureMap | null | undefined, key: FeatureKey): boolean {
  return features?.[key] === true
}

/**
 * Parse a PARTIAL override map: only feature keys explicitly present in the JSON
 * are returned (unlike parseFeatures, which fills every key). This lets a tenant
 * override map flip a single feature when merged over the plan's features.
 */
export function parseFeatureOverrides(raw: string | null | undefined): FeatureMap {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const out: FeatureMap = {}
  for (const key of FEATURE_KEYS) {
    const v = (parsed as Record<string, unknown>)[key]
    if (typeof v === 'boolean') out[key] = v
  }
  return out
}
