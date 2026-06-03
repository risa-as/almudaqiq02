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
 * Resolve the effective feature map for a tenant: the plan's features merged
 * with any per-tenant overrides on the subscription. Overrides win, so a tenant
 * can be granted (or denied) a single feature regardless of their plan.
 */
export async function getTenantFeatures(tenantId: string): Promise<FeatureMap> {
  try {
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: { select: { features: true } } },
    })
    const planFeatures = parseFeatures(sub?.plan?.features)
    const overrides    = parseFeatureOverrides(sub?.featureOverrides)
    return { ...planFeatures, ...overrides }
  } catch {
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
