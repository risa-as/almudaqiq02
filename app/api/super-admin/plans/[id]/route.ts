import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name:         z.string().min(2).optional(),
  maxBranches:  z.number().int().min(-1).optional(),
  monthlyPrice: z.number().min(0).optional(),
  yearlyPrice:  z.number().min(0).optional(),
  isActive:     z.boolean().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const plan = await prisma.subscriptionPlan.update({ where: { id }, data: parsed.data })
  return NextResponse.json(plan)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Soft delete — just deactivate
  await prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
