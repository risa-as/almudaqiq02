import { NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

export async function GET() { return withCloudDb(async () => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const in30Days = new Date(Date.now() + 30 * 86400_000)
  const in7Days  = new Date(Date.now() + 7  * 86400_000)

  const [
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    newThisMonth,
    expiringSoon7,
    expiringSoon30,
    totalBranches,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { status: 'TRIAL' } }),
    prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.tenantSubscription.count({ where: { endDate: { lte: in7Days, gt: now } } }),
    prisma.tenantSubscription.count({ where: { endDate: { lte: in30Days, gt: now } } }),
    prisma.branch.count({ where: { isActive: true } }),
  ])

  return NextResponse.json({
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    newThisMonth,
    expiringSoon7,
    expiringSoon30,
    totalBranches,
  })
}) }
