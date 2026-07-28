import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { verifyBranchToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Cloud-side subscription probe for the desktop app.
 *
 * Authenticated with the branch token the sync worker already holds — NOT with
 * user credentials — so a desktop install can refresh its cached subscription
 * on demand (Settings → "تحديث الحالة") without asking for the password again.
 *
 * Read-only: it never writes, and returns nothing tenant-identifying beyond the
 * subscription window the desktop needs to enforce the gate locally.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Branch token required' }, { status: 401 })

  let branchPayload: Awaited<ReturnType<typeof verifyBranchToken>>
  try { branchPayload = await verifyBranchToken(token) }
  catch { return NextResponse.json({ error: 'Invalid branch token' }, { status: 401 }) }

  const { branchId, tenantId } = branchPayload

  // Revocation check — mirrors /api/sync/status.
  const branchRow = await prisma.branch.findFirst({
    where:  { id: branchId, tenantId },
    select: { tokenVersion: true },
  })
  if (!branchRow || (branchPayload.tv ?? 0) !== (branchRow.tokenVersion ?? 0)) {
    return NextResponse.json({ error: 'Branch token revoked', code: 'TOKEN_REVOKED' }, { status: 401 })
  }

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: {
      status:       true,
      subscription: {
        select: {
          status: true, endDate: true, trialEndDate: true,
          gracePeriodEndsAt: true, plan: { select: { name: true } },
        },
      },
    },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  return NextResponse.json({
    tenant:       { status: tenant.status },
    subscription: tenant.subscription ? {
      status:            tenant.subscription.status,
      endDate:           tenant.subscription.endDate,
      trialEndDate:      tenant.subscription.trialEndDate,
      gracePeriodEndsAt: tenant.subscription.gracePeriodEndsAt,
      planName:          tenant.subscription.plan?.name ?? null,
    } : null,
    serverTime: new Date().toISOString(),
  })
}
