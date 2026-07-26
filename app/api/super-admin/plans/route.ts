import { NextRequest, NextResponse } from 'next/server'
import { invalidateTenantFeatures } from '@/lib/plan-features'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  return withCloudDb(async () => {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { monthlyPrice: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    })
    return NextResponse.json(plans)
  })
}

const PlanSchema = z.object({
  name:         z.string().min(2),
  maxBranches:  z.number().int().min(-1),
  maxUsers:     z.number().int().min(-1),
  monthlyPrice: z.number().min(0),
  yearlyPrice:  z.number().min(0),
  features:     z.record(z.boolean()).optional(),
})

export async function POST(request: NextRequest) {
  return withCloudDb(async () => {
    const body = await request.json().catch(() => null)
    const parsed = PlanSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { features, ...rest } = parsed.data
    const plan = await prisma.subscriptionPlan.create({
      data: { ...rest, features: features ? JSON.stringify(features) : '{}' },
    })
    invalidateTenantFeatures() // خطة جديدة/معدّلة تخص عدة مستأجرين
    return NextResponse.json(plan, { status: 201 })
  })
}
