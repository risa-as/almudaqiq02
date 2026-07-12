import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/multi-tenant/prisma'
import { canManageStock } from '@/lib/auth'
import { logActionAs } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function findOwnedOrder(id: string, auth: { tenantId: string; role: string; branchId?: string | null }) {
  const order = await prisma.purchaseOrder.findFirst({ where: { id, tenantId: auth.tenantId } })
  if (!order) return null
  const isOwner = ['ADMIN', 'SUPER_ADMIN'].includes(auth.role)
  if (!isOwner && auth.branchId && order.branchId !== auth.branchId) return null
  return order
}

/** Order detail with items. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const { id } = await params
  const order = await findOwnedOrder(id, auth)
  if (!order) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const items = await prisma.purchaseOrderItem.findMany({
    where: { orderId: id },
    orderBy: { productName: 'asc' },
  })

  return NextResponse.json({
    id:           order.id,
    branchId:     order.branchId,
    supplierId:   order.supplierId,
    supplierName: order.supplierName,
    status:       order.status,
    notes:        order.notes,
    createdAt:    order.createdAt,
    orderedAt:    order.orderedAt,
    receivedAt:   order.receivedAt,
    items: items.map(i => ({
      id:          i.id,
      productId:   i.productId,
      productName: i.productName,
      quantity:    i.quantity,
      costPrice:   Number(i.costPrice),
      receivedQty: i.receivedQty,
      total:       Math.round(i.quantity * Number(i.costPrice) * 100) / 100,
    })),
  })
}

/**
 * PATCH actions:
 *  { action: 'order' }   DRAFT → ORDERED (sent to supplier)
 *  { action: 'cancel' }  DRAFT/ORDERED → CANCELLED
 *  { action: 'receive', received: [{ itemId, receivedQty }], paidAmount? }
 *      ORDERED (or DRAFT) → RECEIVED: books stock batches, WAC, supplier ledger.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const { id } = await params
  const order = await findOwnedOrder(id, auth)
  if (!order) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const body = await request.json().catch(() => ({}))

  if (body.action === 'order') {
    if (order.status !== 'DRAFT') return NextResponse.json({ error: 'الطلب ليس مسودة' }, { status: 400 })
    await prisma.purchaseOrder.update({ where: { id }, data: { status: 'ORDERED', orderedAt: new Date() } })
    await logActionAs(auth, 'ORDER_PURCHASE_ORDER', 'PurchaseOrder', id, 'PO marked as ordered')
    return NextResponse.json({ success: true })
  }

  if (body.action === 'cancel') {
    if (!['DRAFT', 'ORDERED'].includes(order.status)) {
      return NextResponse.json({ error: 'لا يمكن إلغاء طلب مستلَم' }, { status: 400 })
    }
    await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } })
    await logActionAs(auth, 'CANCEL_PURCHASE_ORDER', 'PurchaseOrder', id, 'PO cancelled')
    return NextResponse.json({ success: true })
  }

  if (body.action === 'receive') {
    if (!['DRAFT', 'ORDERED'].includes(order.status)) {
      return NextResponse.json({ error: 'هذا الطلب مستلَم أو ملغى' }, { status: 400 })
    }

    const items = await prisma.purchaseOrderItem.findMany({ where: { orderId: id } })
    const receivedMap = new Map<string, number>()
    if (Array.isArray(body.received)) {
      for (const r of body.received) {
        const qty = Math.max(0, Math.round(Number(r?.receivedQty)))
        if (r?.itemId && Number.isFinite(qty)) receivedMap.set(String(r.itemId), qty)
      }
    }

    let totalInvoice = 0
    let receivedLines = 0

    await prisma.$transaction(async tx => {
      for (const item of items) {
        // Default: received exactly what was ordered.
        const receivedQty = receivedMap.has(item.id) ? receivedMap.get(item.id)! : item.quantity
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty } })
        if (receivedQty <= 0) continue
        receivedLines++

        const unitCost = Number(item.costPrice)
        totalInvoice += receivedQty * unitCost

        await tx.productBatch.create({
          data: {
            tenantId:    auth.tenantId,
            productId:   item.productId,
            branchId:    order.branchId,
            quantity:    receivedQty,
            costPrice:   unitCost,
            batchNumber: `PO-${order.id.slice(-6).toUpperCase()}`,
          },
        })

        // Weighted-average cost update, mirroring the stock-in route.
        const product = await tx.product.findFirst({
          where:  { id: item.productId, tenantId: auth.tenantId },
          select: { baseStock: true, costPrice: true },
        })
        if (product) {
          const oldStock = product.baseStock
          const oldCost  = Number(product.costPrice)
          const newCost  = oldStock > 0
            ? (oldStock * oldCost + receivedQty * unitCost) / (oldStock + receivedQty)
            : unitCost
          await tx.product.updateMany({
            where: { id: item.productId, tenantId: auth.tenantId },
            data:  { baseStock: { increment: receivedQty }, costPrice: newCost },
          })
        }
      }

      // Supplier ledger: PURCHASE adds to what we owe; optional immediate payment.
      if (order.supplierId && totalInvoice > 0) {
        const paid = Math.max(0, Number(body.paidAmount) || 0)
        await tx.supplierLedger.create({
          data: {
            supplierId:  order.supplierId,
            branchId:    order.branchId,
            type:        'PURCHASE',
            amount:      totalInvoice,
            description: `أمر شراء ${order.id.slice(-6).toUpperCase()} — استلام ${receivedLines} صنف`,
          },
        })
        if (paid > 0) {
          await tx.supplierLedger.create({
            data: {
              supplierId:  order.supplierId,
              branchId:    order.branchId,
              type:        'PAYMENT',
              amount:      Math.min(paid, totalInvoice),
              description: `تسديد دفعة عند استلام أمر الشراء ${order.id.slice(-6).toUpperCase()}`,
            },
          })
        }
        const credit = totalInvoice - Math.min(paid, totalInvoice)
        if (credit > 0) {
          await tx.supplier.update({
            where: { id: order.supplierId },
            data:  { balance: { increment: credit } },
          })
        }
      }

      await tx.purchaseOrder.update({
        where: { id },
        data:  { status: 'RECEIVED', receivedAt: new Date() },
      })
    }, { timeout: 60_000 })

    await logActionAs(auth, 'RECEIVE_PURCHASE_ORDER', 'PurchaseOrder', id,
      `PO received — ${receivedLines} lines, total: ${Math.round(totalInvoice * 100) / 100}`)

    return NextResponse.json({ success: true, receivedLines, totalInvoice: Math.round(totalInvoice * 100) / 100 })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
