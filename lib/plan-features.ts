/**
 * Server-side plan feature resolution + API route guard.
 *
 * getTenantFeatures() reads the tenant's active subscription plan and returns
 * its normalized feature map. guardFeature() is a drop-in guard for API routes:
 * it returns a NextResponse (401/403) to return early, or null when allowed.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { parseFeatures, parseFeatureOverrides, hasFeature, type FeatureKey, type FeatureMap } from '@/lib/features'

/**
 * كاش داخل العملية لخريطة ميزات المستأجر.
 *
 * لماذا: getTenantFeatures يُنادى من /api/auth/me ومن guardFeature في كل مسار
 * محمي، وكل نداء رحلةُ قاعدة بيانات كاملة (~520ms قياسًا على Neon). و/api/auth/me
 * يقع على المسار الحرج لكل صفحة: BranchContext وFeatureContext ينتظرانه قبل أن
 * تبدأ الصفحة استعلاماتها. الخطة لا تتغير إلا حين يعدّلها مشرف المنصة، فحفظها
 * لثوانٍ معدودة يُلغي تلك الرحلة من كل طلب تقريبًا.
 *
 * المدة قصيرة (60 ثانية) والإبطال صريح عند أي تعديل على الخطة أو الاشتراك،
 * فلا يبقى مستأجر على ميزات قديمة بعد ترقيته.
 *
 * حدٌّ معروف: الكاش داخل العملية الواحدة. على نشرٍ متعدد النسخ يُبطِل التعديلُ
 * كاشَ النسخة التي عالجته فقط، فتبقى النسخ الأخرى على القيمة القديمة حتى تنتهي
 * الستون ثانية. هذا مقبول لترقية خطة؛ إن لزم إبطال فوري عبر النسخ فالحل مخزن
 * مشترك (Redis) لا رفع المدة.
 */
const FEATURES_TTL_MS = 60_000
const featuresCache = new Map<string, { at: number; value: FeatureMap }>()

/** يُبطل الكاش لمستأجر بعينه، أو للجميع عند تعديل خطة مشتركة. */
export function invalidateTenantFeatures(tenantId?: string): void {
  if (tenantId) featuresCache.delete(tenantId)
  else featuresCache.clear()
}

/**
 * Resolve the effective feature map for a tenant: the plan's features merged
 * with any per-tenant overrides on the subscription. Overrides win, so a tenant
 * can be granted (or denied) a single feature regardless of their plan.
 */
export async function getTenantFeatures(tenantId: string): Promise<FeatureMap> {
  const cached = featuresCache.get(tenantId)
  if (cached && Date.now() - cached.at < FEATURES_TTL_MS) return cached.value

  try {
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: { select: { features: true } } },
    })
    const planFeatures = parseFeatures(sub?.plan?.features)
    const overrides    = parseFeatureOverrides(sub?.featureOverrides)
    const value = { ...planFeatures, ...overrides }
    featuresCache.set(tenantId, { at: Date.now(), value })
    return value
  } catch {
    // فشل مؤقت للقاعدة: لا نخزّن خريطة فارغة كي لا نقفل الميزات لدقيقة كاملة
    return {}
  }
}

/**
 * API-route guard. Usage:
 *   const blocked = await guardFeature('stock_transfers')
 *   if (blocked) return blocked
 */
export async function guardFeature(feature: FeatureKey): Promise<NextResponse | null> {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const features = await getTenantFeatures(auth.tenantId)
  if (!hasFeature(features, feature)) {
    return NextResponse.json(
      { error: 'هذه الميزة غير متاحة في خطتك الحالية', code: 'FEATURE_LOCKED' },
      { status: 403 },
    )
  }
  return null
}
