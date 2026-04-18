import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

function getTenantId(r: NextRequest) { return r.headers.get('x-tenant-id') ?? '' }
function getUserId(r: NextRequest)   { return r.headers.get('x-user-id')   ?? '' }

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request)
  const { searchParams } = request.nextUrl
  const status   = searchParams.get('status') ?? undefined
  const branchId = searchParams.get('branchId') ?? undefined

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}),
    },
    include: {
      fromBranch: { select: { name: true } },
      toBranch:   { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(transfers)
}

const ItemSchema = z.object({ productId: z.string(), unitId: z.string(), quantity: z.number().positive() })
const CreateSchema = z.object({
  fromBranchId: z.string(),
  toBranchId:   z.string(),
  items:        z.array(ItemSchema).min(1),
  notes:        z.string().optional(),
})

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request)
  const userId   = getUserId(request)
  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { fromBranchId, toBranchId, items, notes } = parsed.data

  // Validate both branches belong to tenant
  const [from, to] = await Promise.all([
    prisma.branch.findFirst({ where: { id: fromBranchId, tenantId } }),
    prisma.branch.findFirst({ where: { id: toBranchId, tenantId } }),
  ])
  if (!from || !to) return NextResponse.json({ error: 'الفروع غير موجودة' }, { status: 404 })

  const transfer = await prisma.stockTransfer.create({
    data: {
      tenantId,
      fromBranchId,
      toBranchId,
      items: JSON.stringify(items),
      notes,
      requestedBy: userId,
      status: 'PENDING',
    },
    include: { fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } },
  })
  return NextResponse.json(transfer, { status: 201 })
}
