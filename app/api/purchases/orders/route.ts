import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/multi-tenant/prisma'
import { canManageStock } from '@/lib/auth'
import { logActionAs } from '@/lib/audit'
import { RELATION_JOIN } from '@/lib/prisma-runtime'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  branchId:   z.string().min(1),
  supplierId: z.string().nullable().optional(),
  notes:      z.string().max(500).nullable().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity:  z.number().int().positive(), // BASE units
    costPrice: z.number().nonnegative(),    // per BASE unit
  })).min(1).max(200),
})

/** List purchase orders. */
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branchId')

  const where: any = { tenantId: auth.tenantId }
  const isOwner = ['ADMIN', 'SUPER_ADMIN'].includes(auth.role)
  if (!isOwner && auth.branchId) where.branchId = auth.branchId
  else if (branchId && branchId !== 'all') where.branchId = branchId

  const orders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { items: { select: { quantity: true, costPrice: true, receivedQty: true } } },
    // فارغ اليوم فلا يظهر الفرق، لكن الشكل مطابق لـ /api/stocktake (بنود إلى-متعدد)
    // الذي وفّر ~234ms — الكسب يظهر مع أول أوامر شراء.
    ...RELATION_JOIN,
  })

  return NextResponse.json({
    orders: orders.map(o => ({
      id:           o.id,
      branchId:     o.branchId,
      supplierName: o.supplierName ?? 'غير محدد',
      status:       o.status,
      notes:        o.notes,
      createdAt:    o.createdAt,
      orderedAt:    o.orderedAt,
      receivedAt:   o.receivedAt,
      itemsCount:   o.items.length,
      totalCost:    Math.round(o.items.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0) * 100) / 100,
    })),
  })
}

/** Create a DRAFT purchase order. */
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })

  const { branchId: requestedBranch, supplierId, notes, items } = parsed.data

  // Branch-bound users are locked to their own branch.
  const isOwner = ['ADMIN', 'SUPER_ADMIN'].includes(auth.role)
  const targetBranchId = !isOwner && auth.branchId ? auth.branchId : requestedBranch
  const branch = await prisma.branch.findFirst({
    where: { id: targetBranchId, tenantId: auth.tenantId },
    select: { id: true, name: true },
  })
  if (!branch) return NextResponse.json({ error: 'الفرع غير موجود' }, { status: 404 })

  let supplierName: string | null = null
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: auth.tenantId },
      select: { name: true },
    })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    supplierName = supplier.name
  }

  // Validate all products belong to the tenant, snapshot names.
  const products = await prisma.product.findMany({
    where:  { id: { in: items.map(i => i.productId) }, tenantId: auth.tenantId },
    select: { id: true, name: true },
  })
  const nameMap = new Map(products.map(p => [p.id, p.name]))
  if (products.length !== new Set(items.map(i => i.productId)).size) {
    return NextResponse.json({ error: 'بعض المنتجات غير موجودة' }, { status: 400 })
  }

  const order = await prisma.purchaseOrder.create({
    data: {
      tenantId:   auth.tenantId,
      branchId:   branch.id,
      supplierId: supplierId ?? null,
      supplierName,
      notes:      notes ?? null,
      createdBy:  auth.userId,
      items: {
        create: items.map(i => ({
          productId:   i.productId,
          productName: nameMap.get(i.productId) ?? '—',
          quantity:    i.quantity,
          costPrice:   i.costPrice,
        })),
      },
    },
    select: { id: true },
  })

  await logActionAs(auth, 'CREATE_PURCHASE_ORDER', 'PurchaseOrder', order.id,
    `PO draft for ${branch.name}${supplierName ? ` — supplier: ${supplierName}` : ''} (${items.length} items)`)

  return NextResponse.json({ success: true, orderId: order.id }, { status: 201 })
}
