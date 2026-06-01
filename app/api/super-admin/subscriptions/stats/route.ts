import { NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

export async function GET() { return withCloudDb(async () => {
  const now     = new Date()
  const in7Days = new Date(Date.now() + 7 * 86400_000)

  const select = {
    id:      true,
    name:    true,
    status:  true,
    subscription: {
      select: {
        endDate:           true,
        trialEndDate:      true,
        gracePeriodEndsAt: true,
        plan: { select: { name: true } },
      },
    },
  }

  const [active, trial, grace, suspended, cancelled, expiringSoon] = await Promise.all([
    prisma.tenant.findMany({ where: { status: 'ACTIVE' },    select }),
    prisma.tenant.findMany({ where: { status: 'TRIAL' },     select }),
    prisma.tenant.findMany({ where: { status: 'GRACE' },     select }),
    prisma.tenant.findMany({ where: { status: 'SUSPENDED' }, select }),
    prisma.tenant.findMany({ where: { status: 'CANCELLED' }, select }),
    prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        subscription: { endDate: { gt: now, lte: in7Days } },
      },
      select,
    }),
  ])

  return NextResponse.json({
    counts: {
      total:        active.length + trial.length + grace.length + suspended.length + cancelled.length,
      active:       active.length,
      trial:        trial.length,
      expiringSoon: expiringSoon.length,
      grace:        grace.length,
      suspended:    suspended.length,
      cancelled:    cancelled.length,
    },
    lists: { active, trial, expiringSoon, grace, suspended, cancelled },
  })
}) }
