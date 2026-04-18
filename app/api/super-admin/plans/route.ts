import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { monthlyPrice: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  })
  return NextResponse.json(plans)
}

const PlanSchema = z.object({
  name:         z.string().min(2),
  maxBranches:  z.number().int().min(-1),
  monthlyPrice: z.number().min(0),
  yearlyPrice:  z.number().min(0),
  features:     z.record(z.boolean()).optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = PlanSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { features, ...rest } = parsed.data
  const plan = await prisma.subscriptionPlan.create({
    data: { ...rest, features: features ? JSON.stringify(features) : '{}' },
  })
  return NextResponse.json(plan, { status: 201 })
}
