import { NextRequest, NextResponse } from 'next/server'
import { invalidateTenantFeatures } from '@/lib/plan-features'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name:         z.string().min(2).optional(),
  maxBranches:  z.number().int().min(-1).optional(),
  maxUsers:     z.number().int().min(-1).optional(),
  monthlyPrice: z.number().min(0).optional(),
  yearlyPrice:  z.number().min(0).optional(),
  isActive:     z.boolean().optional(),
  features:     z.record(z.boolean()).optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCloudDb(async () => {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // `features` is stored as a JSON string column — serialize it when present.
    const { features, ...rest } = parsed.data
    const data = { ...rest, ...(features ? { features: JSON.stringify(features) } : {}) }

    const plan = await prisma.subscriptionPlan.update({ where: { id }, data })
    invalidateTenantFeatures() // ميزات الخطة تغيّرت لكل مستأجريها
    return NextResponse.json(plan)
  })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCloudDb(async () => {
    const { id } = await params

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    })
    if (!plan) return NextResponse.json({ error: 'الخطة غير موجودة' }, { status: 404 })
    if (plan._count.subscriptions > 0)
      return NextResponse.json(
        { error: `لا يمكن حذف الخطة — لديها ${plan._count.subscriptions} مشترك نشط` },
        { status: 409 }
      )

    await prisma.subscriptionPlan.delete({ where: { id } })
    invalidateTenantFeatures()
    return NextResponse.json({ success: true })
  })
}
