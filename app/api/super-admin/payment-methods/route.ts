import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  type:          z.enum(['ZAINCASH', 'SUPERKEY', 'MASTERCARD', 'OTHER']),
  name:          z.string().min(2),
  accountNumber: z.string().optional(),
  accountName:   z.string().optional(),
  instructions:  z.string().optional(),
  isActive:      z.boolean().optional(),
  sortOrder:     z.number().int().optional(),
})

export async function GET() {
  return withCloudDb(async () => {
    const methods = await prisma.platformPaymentMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(methods)
  })
}

export async function POST(req: NextRequest) {
  return withCloudDb(async () => {
    const body   = await req.json().catch(() => null)
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const method = await prisma.platformPaymentMethod.create({ data: parsed.data })
    return NextResponse.json(method, { status: 201 })
  })
}
