import { NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { getTenantId } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const [subscription, payments] = await Promise.all([
    prisma.tenantSubscription.findUnique({
      where:   { tenantId },
      include: { plan: true },
    }),
    prisma.paymentRecord.findMany({
      where:   { tenantId },
      orderBy: { paidAt: 'desc' },
      take:    50,
    }),
  ])

  return NextResponse.json({ subscription, payments })
}
