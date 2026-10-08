import { Prisma } from '@prisma/client'
import { IS_ELECTRON } from '@/lib/prisma-runtime'

/**
 * Shared server-side planning for REFUND (/api/transactions/refund) and RETURN
 * (/api/transactions/return).
 *
 * The client only says WHAT comes back (product, unit, quantity). How much money
 * goes back, and at what cost the goods re-enter stock, is derived here from the
 * original sale lines — a client-sent price or total is never trusted, otherwise a
 * cashier could "return" one item at any price and pay the difference out of the
 * drawer.
 */

export class ReturnError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export interface RequestedReturnItem { productId: string; unitId: string; quantity: unknown }

export interface PlannedReturnLine {
  productId: string
  unitId: string
  quantity: number
  /** Sold unit price (weighted over the original lines for this product+unit). */
  unitPrice: number
  /** Line total refunded for this line. */
  amount: number
  /** Cost of the returned goods (reverses COGS in the profit report). */
  cost: number
  /** Quantity in base units, for the stock movement. */
  baseQty: number
}

export interface ReturnPlan {
  lines: PlannedReturnLine[]
  /** Money owed back: Σ line amounts, capped at what is still refundable on the sale. */
  amount: number
}

type Tx = Prisma.TransactionClient

/**
 * Must be called INSIDE the write transaction: on Postgres it takes a lock keyed
 * on the original sale, so two simultaneous refunds of the same invoice are
 * serialised and the second one sees the first one's lines.
 */
export async function planReturn(
  tx: Tx,
  tenantId: string,
  originalTx: { id: string; totalAmount: unknown },
  items: RequestedReturnItem[],
): Promise<ReturnPlan> {
  if (!Array.isArray(items) || items.length === 0) throw new ReturnError('لا توجد مواد للإرجاع')
  for (const it of items) {
    const q = Number(it.quantity)
    if (!it.productId || !it.unitId || !Number.isFinite(q) || q <= 0) {
      throw new ReturnError('بيانات المواد المرتجعة غير صالحة')
    }
  }

  if (!IS_ELECTRON) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'return:' + originalTx.id}))`
  }

  const [soldLines, priorLines, priorTxs, units] = await Promise.all([
    tx.transactionItem.findMany({
      where: { transactionId: originalTx.id },
      select: { productId: true, unitId: true, quantity: true, price: true, cost: true },
    }),
    tx.transactionItem.findMany({
      where: { transaction: { tenantId, originalTxId: originalTx.id, type: { in: ['REFUND', 'RETURN'] } } },
      select: { productId: true, unitId: true, quantity: true },
    }),
    tx.transaction.findMany({
      where: { tenantId, originalTxId: originalTx.id, type: { in: ['REFUND', 'RETURN'] } },
      select: { type: true, totalAmount: true },
    }),
    tx.productUnit.findMany({
      where: { id: { in: [...new Set(items.map(i => i.unitId))] }, product: { tenantId } },
      select: { id: true, productId: true, conversionFactor: true },
    }),
  ])

  const key = (p: string, u: string) => `${p}|${u}`
  const sold = new Map<string, { qty: number; value: number; cost: number }>()
  for (const l of soldLines) {
    const k = key(l.productId, l.unitId)
    const s = sold.get(k) ?? { qty: 0, value: 0, cost: 0 }
    s.qty   += Number(l.quantity)
    s.value += Number(l.quantity) * Number(l.price)
    s.cost  += Number(l.cost ?? 0)
    sold.set(k, s)
  }
  const returned = new Map<string, number>()
  for (const l of priorLines) {
    const k = key(l.productId, l.unitId)
    returned.set(k, (returned.get(k) ?? 0) + Math.abs(Number(l.quantity)))
  }
  const unitMap = new Map(units.map(u => [u.id, u]))

  const requested = new Map<string, number>()
  for (const it of items) {
    const k = key(it.productId, it.unitId)
    requested.set(k, (requested.get(k) ?? 0) + Number(it.quantity))
  }

  const lines: PlannedReturnLine[] = []
  for (const [k, qty] of requested) {
    const [productId, unitId] = k.split('|')
    const s = sold.get(k)
    const unit = unitMap.get(unitId)
    if (!s || s.qty <= 0 || !unit || unit.productId !== productId) {
      throw new ReturnError('الصنف المطلوب إرجاعه غير موجود في الفاتورة الأصلية')
    }
    const remaining = s.qty - (returned.get(k) ?? 0)
    if (qty > remaining + 1e-9) {
      throw new ReturnError(`الكمية المطلوب إرجاعها تتجاوز المتاح (المتبقّي: ${Math.max(0, remaining)})`)
    }
    const unitPrice = s.value / s.qty
    lines.push({
      productId,
      unitId,
      quantity: qty,
      unitPrice,
      amount: qty * unitPrice,
      cost: (s.cost / s.qty) * qty,
      baseQty: qty * Number(unit.conversionFactor),
    })
  }

  // Never give back more than the customer actually paid for this sale. The line
  // prices are pre-discount, so a full return of a discounted invoice is capped
  // at the invoice total (minus whatever was already refunded).
  const alreadyRefunded = priorTxs.reduce(
    (sum, t) => sum + Math.abs(Number(t.totalAmount)),
    0,
  )
  const refundable = Math.max(0, Number(originalTx.totalAmount) - alreadyRefunded)
  const gross = lines.reduce((sum, l) => sum + l.amount, 0)
  return { lines, amount: Math.min(gross, refundable) }
}

/**
 * Put returned goods back into THIS branch's batches (stock is per branch —
 * bumping only Product.baseStock left the goods unsellable at the till).
 */
export async function restockReturnedLines(
  tx: Tx,
  tenantId: string,
  branchId: string,
  lines: PlannedReturnLine[],
) {
  for (const line of lines) {
    if (line.baseQty <= 0) continue
    const recentBatch = await tx.productBatch.findFirst({
      where: { productId: line.productId, tenantId, branchId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (recentBatch) {
      await tx.productBatch.update({
        where: { id: recentBatch.id },
        data: { quantity: { increment: line.baseQty } },
      })
    } else {
      await tx.productBatch.create({
        data: {
          tenant:  { connect: { id: tenantId } },
          product: { connect: { id: line.productId } },
          branch:  { connect: { id: branchId } },
          quantity: line.baseQty,
          costPrice: line.baseQty > 0 ? line.cost / line.baseQty : 0,
          batchNumber: `REFUND-${Date.now()}`,
        },
      })
    }
    await tx.product.update({
      where: { id: line.productId, tenantId },
      data: { baseStock: { increment: line.baseQty } },
    })
  }
}

/** Debt a return wipes off the customer: at most the unpaid part of the original sale. */
export function debtReductionFor(
  originalTx: { customerId: string | null; paymentMethod: string | null; totalAmount: unknown; paidAmount: unknown },
  refundAmount: number,
): number {
  if (!originalTx.customerId) return 0
  if (originalTx.paymentMethod !== 'CREDIT' && originalTx.paymentMethod !== 'SPLIT') return 0
  const owed = originalTx.paymentMethod === 'SPLIT'
    ? Math.max(0, Number(originalTx.totalAmount) - Number(originalTx.paidAmount || 0))
    : Number(originalTx.totalAmount)
  return Math.max(0, Math.min(refundAmount, owed))
}
