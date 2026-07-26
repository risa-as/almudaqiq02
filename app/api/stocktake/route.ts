import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/multi-tenant/prisma'
import { canManageStock } from '@/lib/auth'
import { logActionAs } from '@/lib/audit'
import { RELATION_JOIN } from '@/lib/prisma-runtime'

export const dynamic = 'force-dynamic'

/**
 * Resolve which branch this stocktake targets.
 * Branch-bound roles are locked to their own branch; owners/admins use the
 * requested branch (validated against the tenant).
 */
async function resolveBranch(auth: { tenantId: string; role: string; branchId?: string | null }, requested?: string | null) {
  const isOwner = ['ADMIN', 'SUPER_ADMIN'].includes(auth.role)
  const target = !isOwner && auth.branchId ? auth.branchId : requested
  if (!target || target === 'all') return null
  return prisma.branch.findFirst({ where: { id: target, tenantId: auth.tenantId }, select: { id: true, name: true } })
}

/** List stocktake sessions. */
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

  const sessions = await prisma.stocktakeSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { items: { select: { expectedQty: true, countedQty: true } } },
    // جلسات + بنودها في رحلة واحدة: قياسًا ~762ms ← ~528ms.
    ...RELATION_JOIN,
  })

  const branches = await prisma.branch.findMany({
    where: { tenantId: auth.tenantId },
    select: { id: true, name: true },
  })
  const branchName = new Map(branches.map(b => [b.id, b.name]))

  return NextResponse.json({
    sessions: sessions.map(s => {
      const counted = s.items.filter(i => i.countedQty !== null)
      const diffs = counted.filter(i => (i.countedQty ?? 0) !== i.expectedQty)
      return {
        id:          s.id,
        branchId:    s.branchId,
        branchName:  branchName.get(s.branchId) ?? '—',
        status:      s.status,
        notes:       s.notes,
        createdAt:   s.createdAt,
        completedAt: s.completedAt,
        totalItems:  s.items.length,
        countedItems: counted.length,
        diffItems:   diffs.length,
      }
    }),
  })
}

/** Start a stocktake: snapshot the branch's current stock as expected quantities. */
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const branch = await resolveBranch(auth, body.branchId)
  if (!branch) return NextResponse.json({ error: 'يرجى اختيار فرع محدد للجرد' }, { status: 400 })

  // Refuse a second open session for the same branch.
  const open = await prisma.stocktakeSession.findFirst({
    where: { tenantId: auth.tenantId, branchId: branch.id, status: 'DRAFT' },
    select: { id: true },
  })
  if (open) {
    return NextResponse.json({ error: 'توجد جلسة جرد مفتوحة لهذا الفرع — أكملها أو ألغِها أولاً', sessionId: open.id }, { status: 409 })
  }

  // Snapshot: current stock per product in BASE units from this branch's batches.
  const [batches, products] = await Promise.all([
    prisma.productBatch.findMany({
      where: { tenantId: auth.tenantId, branchId: branch.id },
      select: { productId: true, quantity: true },
    }),
    prisma.product.findMany({
      where: { tenantId: auth.tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 2000,
    }),
  ])

  const stockMap = new Map<string, number>()
  for (const b of batches) stockMap.set(b.productId, (stockMap.get(b.productId) ?? 0) + b.quantity)

  const session = await prisma.stocktakeSession.create({
    data: {
      tenantId:  auth.tenantId,
      branchId:  branch.id,
      notes:     typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
      createdBy: auth.userId,
      items: {
        create: products.map(p => ({
          productId:   p.id,
          productName: p.name,
          expectedQty: Math.max(0, Math.round(stockMap.get(p.id) ?? 0)),
        })),
      },
    },
    select: { id: true },
  })

  await logActionAs(auth, 'STOCKTAKE_START', 'StocktakeSession', session.id,
    `Stocktake started for branch ${branch.name} (${products.length} products)`)

  return NextResponse.json({ success: true, sessionId: session.id }, { status: 201 })
}
