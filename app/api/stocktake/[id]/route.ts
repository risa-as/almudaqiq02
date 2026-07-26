import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/multi-tenant/prisma'
import { canManageStock } from '@/lib/auth'
import { logActionAs } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function findOwnedSession(id: string, auth: { tenantId: string; role: string; branchId?: string | null }) {
  const session = await prisma.stocktakeSession.findFirst({
    where: { id, tenantId: auth.tenantId },
  })
  if (!session) return null
  // Branch-bound roles may only touch their own branch's sessions.
  const isOwner = ['ADMIN', 'SUPER_ADMIN'].includes(auth.role)
  if (!isOwner && auth.branchId && session.branchId !== auth.branchId) return null
  return session
}

/** Session detail with items. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const { id } = await params
  const session = await findOwnedSession(id, auth)
  if (!session) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const items = await prisma.stocktakeItem.findMany({
    where: { sessionId: id },
    orderBy: { productName: 'asc' },
  })

  // ── Category + unit price for the count sheet ──────────────────────────────
  // StocktakeItem only snapshots productName/expectedQty, so the grouping
  // category and the price come from the live Product. A product deleted since
  // the snapshot (or one with no units) yields null/0 rather than dropping the
  // row — the snapshot is what keeps the session auditable.
  const products = await prisma.product.findMany({
    where: { id: { in: items.map(i => i.productId) }, tenantId: auth.tenantId },
    select: {
      id: true,
      category: { select: { name: true } },
      units: { select: { price: true, conversionFactor: true } },
    },
  })
  const infoMap = new Map(products.map(p => {
    // expectedQty is in base units → the smallest unit's price is the match
    const baseUnit = p.units.reduce<(typeof p.units)[number] | null>(
      (best, u) => (!best || u.conversionFactor < best.conversionFactor ? u : best),
      null,
    )
    return [p.id, { categoryName: p.category?.name ?? null, unitPrice: Number(baseUnit?.price ?? 0) }]
  }))

  return NextResponse.json({
    id:          session.id,
    branchId:    session.branchId,
    status:      session.status,
    notes:       session.notes,
    createdAt:   session.createdAt,
    completedAt: session.completedAt,
    items: items.map(i => ({
      id:           i.id,
      productId:    i.productId,
      productName:  i.productName,
      expectedQty:  i.expectedQty,
      countedQty:   i.countedQty,
      note:         i.note,
      difference:   i.countedQty === null ? null : i.countedQty - i.expectedQty,
      categoryName: infoMap.get(i.productId)?.categoryName ?? null,
      unitPrice:    infoMap.get(i.productId)?.unitPrice ?? 0,
    })),
  })
}

/**
 * PATCH — two actions on a DRAFT session:
 *  { counts: [{ itemId, countedQty, note? }] }  → save counted quantities
 *  { action: 'complete' }                       → apply differences to stock
 *  { action: 'cancel' }                         → discard the session
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const { id } = await params
  const session = await findOwnedSession(id, auth)
  if (!session) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  if (session.status !== 'DRAFT') {
    return NextResponse.json({ error: 'هذه الجلسة مُغلقة — لا يمكن تعديلها' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))

  // ── Save counts ──────────────────────────────────────────────────────────────
  if (Array.isArray(body.counts)) {
    const counts = body.counts.slice(0, 500)
    for (const c of counts) {
      if (!c?.itemId) continue
      const counted = c.countedQty === null || c.countedQty === undefined || c.countedQty === ''
        ? null
        : Math.max(0, Math.round(Number(c.countedQty)))
      if (counted !== null && !Number.isFinite(counted)) continue
      await prisma.stocktakeItem.updateMany({
        where: { id: String(c.itemId), sessionId: id },
        data:  {
          countedQty: counted,
          ...(typeof c.note === 'string' ? { note: c.note.slice(0, 300) } : {}),
        },
      })
    }
    return NextResponse.json({ success: true })
  }

  // ── Cancel ───────────────────────────────────────────────────────────────────
  if (body.action === 'cancel') {
    await prisma.stocktakeSession.update({ where: { id }, data: { status: 'CANCELLED', completedAt: new Date() } })
    await logActionAs(auth, 'STOCKTAKE_CANCEL', 'StocktakeSession', id, 'Stocktake cancelled')
    return NextResponse.json({ success: true })
  }

  // ── Complete: apply counted differences to real stock ────────────────────────
  if (body.action === 'complete') {
    const items = await prisma.stocktakeItem.findMany({
      where: { sessionId: id, countedQty: { not: null } },
    })
    const adjustments = items
      .map(i => ({ ...i, diff: (i.countedQty ?? 0) - i.expectedQty }))
      .filter(i => i.diff !== 0)

    let applied = 0
    for (const item of adjustments) {
      await prisma.$transaction(async tx => {
        if (item.diff > 0) {
          // Surplus found: book it as an adjustment batch at the product's cost.
          const product = await tx.product.findFirst({
            where: { id: item.productId, tenantId: auth.tenantId },
            select: { costPrice: true },
          })
          if (!product) return
          await tx.productBatch.create({
            data: {
              tenantId:    auth.tenantId,
              productId:   item.productId,
              branchId:    session.branchId,
              quantity:    item.diff,
              costPrice:   product.costPrice,
              batchNumber: 'STOCKTAKE',
            },
          })
        } else {
          // Shortage: deduct from this branch's batches, oldest first, floor 0.
          let remaining = -item.diff
          const batches = await tx.productBatch.findMany({
            where:   { productId: item.productId, tenantId: auth.tenantId, branchId: session.branchId, quantity: { gt: 0 } },
            orderBy: { createdAt: 'asc' },
          })
          for (const b of batches) {
            if (remaining <= 0) break
            const take = Math.min(b.quantity, remaining)
            await tx.productBatch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } })
            remaining -= take
          }
        }
        await tx.product.updateMany({
          where: { id: item.productId, tenantId: auth.tenantId },
          data:  { baseStock: { increment: item.diff } },
        })
      })
      applied++
    }

    await prisma.stocktakeSession.update({
      where: { id },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })

    await logActionAs(auth, 'STOCKTAKE_COMPLETE', 'StocktakeSession', id,
      `Stocktake completed — ${applied} adjustments of ${items.length} counted items`)

    return NextResponse.json({ success: true, adjustments: applied, counted: items.length })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
