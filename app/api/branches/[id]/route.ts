import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

function getTenantId(r: NextRequest) { return r.headers.get('x-tenant-id') ?? '' }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = getTenantId(request)

  const branch = await prisma.branch.findFirst({
    where: { id, tenantId },
    include: {
      users: { select: { id: true, username: true, role: true } },
      storeSettings: true,
      _count: { select: { transactions: true, stockBatches: true } },
    },
  })
  if (!branch) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  return NextResponse.json(branch)
}

const UpdateSchema = z.object({
  name:    z.string().min(2).optional(),
  address: z.string().optional(),
  phone:   z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = getTenantId(request)
  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const branch = await prisma.branch.updateMany({
    where: { id, tenantId },
    data: parsed.data,
  })
  if (!branch.count) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = getTenantId(request)

  // Check for transactions before archiving
  const txCount = await prisma.transaction.count({ where: { branchId: id, tenantId } })
  if (txCount > 0) {
    // Soft delete only
    await prisma.branch.updateMany({ where: { id, tenantId }, data: { isActive: false } })
    return NextResponse.json({ success: true, message: 'تم أرشفة الفرع' })
  }

  await prisma.branch.updateMany({ where: { id, tenantId }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
