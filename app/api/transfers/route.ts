import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { guardFeature } from '@/lib/plan-features'
import { enqueueSync } from '@/lib/sync-enqueue'
import { logActionAs } from '@/lib/audit'
import { RELATION_JOIN } from '@/lib/prisma-runtime'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const blocked = await guardFeature('stock_transfers'); if (blocked) return blocked
  const tenantId = auth.tenantId
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
    // جدول التحويلات فارغ اليوم فلا يظهر الفرق في القياس، لكن الشكل مطابق
    // لـ /api/offers (علاقات إلى-واحد) الذي وفّر ~196ms — الكسب يظهر مع أول بيانات.
    ...RELATION_JOIN,
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
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const blocked = await guardFeature('stock_transfers'); if (blocked) return blocked
  const tenantId = auth.tenantId
  const userId   = auth.userId
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
  enqueueSync('stockTransfers', 'INSERT', transfer.id, {
    cloudId: transfer.id, tenantId, fromBranchId, toBranchId,
    items: transfer.items, notes: transfer.notes,
    requestedBy: transfer.requestedBy, status: transfer.status,
    createdAt: transfer.createdAt,
  })

  await logActionAs(auth, 'CREATE_TRANSFER', 'StockTransfer', transfer.id,
    `Transfer ${from.name} → ${to.name} (${items.length} items)`)

  return NextResponse.json(transfer, { status: 201 })
}
