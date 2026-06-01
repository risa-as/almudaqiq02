import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  type:          z.enum(['ZAINCASH', 'SUPERKEY', 'MASTERCARD', 'OTHER']).optional(),
  name:          z.string().min(2).optional(),
  accountNumber: z.string().nullable().optional(),
  accountName:   z.string().nullable().optional(),
  instructions:  z.string().nullable().optional(),
  isActive:      z.boolean().optional(),
  sortOrder:     z.number().int().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCloudDb(async () => {
    const { id } = await params
    const body   = await req.json().catch(() => null)
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const method = await prisma.platformPaymentMethod.update({ where: { id }, data: parsed.data })
    return NextResponse.json(method)
  })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCloudDb(async () => {
    const { id } = await params
    await prisma.platformPaymentMethod.delete({ where: { id } })
    return NextResponse.json({ success: true })
  })
}
