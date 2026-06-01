import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

const RenewSchema = z.object({
  months: z.number().int().min(1).max(12),
  amount: z.number().min(0),
  notes:  z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withCloudDb(async () => {
    const { id } = await params
    const body   = await request.json().catch(() => null)
    const parsed = RenewSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { months, amount, notes } = parsed.data

    const sub = await prisma.tenantSubscription.findUnique({
      where:   { tenantId: id },
      include: { plan: true },
    })
    if (!sub) return NextResponse.json({ error: 'لا يوجد اشتراك لهذا المستأجر' }, { status: 404 })

    const now      = new Date()
    const baseDate = sub.endDate && sub.endDate > now ? sub.endDate : now
    const newEnd   = new Date(baseDate)
    newEnd.setMonth(newEnd.getMonth() + months)

    await prisma.$transaction([
      prisma.tenant.update({ where: { id }, data: { status: 'ACTIVE' } }),
      prisma.tenantSubscription.update({
        where: { tenantId: id },
        data:  { status: 'ACTIVE', endDate: newEnd, gracePeriodEndsAt: null },
      }),
      prisma.paymentRecord.create({
        data: { tenantId: id, amount, months, planName: sub.plan.name, notes: notes ?? null },
      }),
    ])

    const updated = await prisma.tenant.findUnique({
      where:   { id },
      include: {
        subscription:   { include: { plan: true } },
        paymentRecords: { orderBy: { paidAt: 'desc' }, take: 20 },
        _count:         { select: { branches: true, users: true } },
      },
    })

    return NextResponse.json(updated)
  })
}
