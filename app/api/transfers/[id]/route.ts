import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { guardFeature } from '@/lib/plan-features'
import { enqueueSync } from '@/lib/sync-enqueue'
import { logActionAs } from '@/lib/audit'
import { pinnedBranchId } from '@/lib/branch-scope'

/** Thrown inside the completion transaction to roll it back with a user-facing message. */
class TransferError extends Error {}

/** Allowed status moves. Anything else (e.g. PENDING→COMPLETED, COMPLETED→APPROVED) is refused. */
const NEXT_STATUS: Record<string, string[]> = {
  PENDING:  ['APPROVED', 'CANCELLED'],
  APPROVED: ['COMPLETED', 'CANCELLED'],
}

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const blocked = await guardFeature('stock_transfers'); if (blocked) return blocked
  const { id } = await params
  const tenantId = auth.tenantId
  const pinned = pinnedBranchId(auth)
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id, tenantId, ...(pinned ? { OR: [{ fromBranchId: pinned }, { toBranchId: pinned }] } : {}) },
    include: { fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } },
  })
  if (!transfer) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  return NextResponse.json(transfer)
}

const UpdateSchema = z.object({ status: z.enum(['APPROVED', 'COMPLETED', 'CANCELLED']) })

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const blocked = await guardFeature('stock_transfers'); if (blocked) return blocked
  const { id } = await params
  const tenantId = auth.tenantId
  const userId   = auth.userId
  const body   = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // A branch-bound manager may only act on transfers their branch is part of.
  const pinned = pinnedBranchId(auth)
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id, tenantId, ...(pinned ? { OR: [{ fromBranchId: pinned }, { toBranchId: pinned }] } : {}) },
  })
  if (!transfer) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const { status } = parsed.data
  if (!(NEXT_STATUS[transfer.status] ?? []).includes(status)) {
    return NextResponse.json({ error: `لا يمكن تغيير حالة التحويل من ${transfer.status} إلى ${status}` }, { status: 409 })
  }
  // Approval releases the source branch's stock, so it belongs to that branch.
  if (status === 'APPROVED' && pinned && pinned !== transfer.fromBranchId) {
    return NextResponse.json({ error: 'الموافقة من صلاحية الفرع المُرسِل' }, { status: 403 })
  }

  // batchChanges collects every productBatch mutation triggered by COMPLETED.
  // We enqueue them AFTER the transaction commits so each one carries the real
  // post-commit id/quantity that the cloud will need.
  const batchChanges: Array<
    | { op: 'UPDATE'; id: string; quantity: number }
    | { op: 'INSERT'; id: string; productId: string; branchId: string; quantity: number; costPrice: number; batchNumber: string | null; expiryDate: Date | null }
  > = []

  // When COMPLETED: deduct from source, add to dest
  if (status === 'COMPLETED') {
    const items: { productId: string; unitId?: string; quantity: number }[] = JSON.parse(transfer.items as string)

    // Quantities are entered in the chosen unit (e.g. boxes); batches hold base units.
    const unitIds = [...new Set(items.map(i => i.unitId).filter((u): u is string => !!u))]
    const units = unitIds.length
      ? await prisma.productUnit.findMany({ where: { id: { in: unitIds } }, select: { id: true, productId: true, conversionFactor: true } })
      : []
    const unitMap = new Map(units.map(u => [u.id, u]))

    try {
    await prisma.$transaction(async (tx) => {
      // Claim the transfer first: only one request can move APPROVED→COMPLETED,
      // so a double click or a retry can never move the stock twice.
      const claimed = await tx.stockTransfer.updateMany({
        where: { id, tenantId, status: 'APPROVED' },
        data:  { status: 'COMPLETED', approvedBy: userId },
      })
      if (claimed.count !== 1) throw new TransferError('تم تنفيذ هذا التحويل مسبقًا')

      for (const rawItem of items) {
        const unit = rawItem.unitId ? unitMap.get(rawItem.unitId) : undefined
        if (rawItem.unitId && (!unit || unit.productId !== rawItem.productId)) {
          throw new TransferError('وحدة غير صالحة في التحويل')
        }
        const item = { productId: rawItem.productId, quantity: Number(rawItem.quantity) * Number(unit?.conversionFactor ?? 1) }
        // Deduct from source branch — FIFO: oldest batch first
        const batches = await tx.productBatch.findMany({
          where: { tenantId, productId: item.productId, branchId: transfer.fromBranchId, quantity: { gt: 0 } },
          orderBy: { createdAt: 'asc' },
        })
        let remaining = item.quantity
        for (const batch of batches) {
          if (remaining <= 0) break
          const deduct = Math.min(batch.quantity, remaining)
          const updatedSource = await tx.productBatch.update({ where: { id: batch.id }, data: { quantity: { decrement: deduct } } })
          remaining -= deduct

          // baseStock: source decrement
          await tx.product.update({
            where: { id: item.productId },
            data:  { baseStock: { decrement: deduct } },
          })

          batchChanges.push({ op: 'UPDATE', id: batch.id, quantity: updatedSource.quantity })

          // Add to destination branch (tenantId is required on ProductBatch)
          const destBatch = await tx.productBatch.create({
            data: {
              tenantId,
              productId: item.productId,
              branchId: transfer.toBranchId,
              quantity: deduct,
              costPrice: batch.costPrice,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate,
            },
          })

          // baseStock: destination increment (net effect across both = 0)
          await tx.product.update({
            where: { id: item.productId },
            data:  { baseStock: { increment: deduct } },
          })

          batchChanges.push({
            op: 'INSERT',
            id: destBatch.id,
            productId: item.productId,
            branchId: transfer.toBranchId,
            quantity: deduct,
            costPrice: Number(batch.costPrice),
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
          })
        }
        // Moving less than was approved would silently lose the difference.
        if (remaining > 0) throw new TransferError('الكمية المتوفرة في الفرع المُرسِل لا تكفي لإتمام التحويل')
      }
    })
    } catch (err) {
      if (err instanceof TransferError) return NextResponse.json({ error: err.message }, { status: 409 })
      throw err
    }
  } else {
    // Conditional on the status we validated, so two concurrent requests can't both win.
    const moved = await prisma.stockTransfer.updateMany({
      where: { id, tenantId, status: transfer.status },
      data: { status, ...(status === 'APPROVED' ? { approvedBy: userId } : {}) },
    })
    if (moved.count !== 1) return NextResponse.json({ error: 'تغيّرت حالة التحويل — حدّث الصفحة' }, { status: 409 })
  }

  enqueueSync('stockTransfers', 'UPDATE', id, {
    cloudId: id, status,
    ...(status === 'APPROVED' || status === 'COMPLETED' ? { approvedBy: userId } : {}),
  })

  // Sync each batch change individually so the cloud mirrors the FIFO movement.
  // INSERTs carry isTransfer=true so the push handler skips WAC recalculation
  // (transfers move existing stock at its existing cost — no cost change).
  for (const change of batchChanges) {
    if (change.op === 'UPDATE') {
      enqueueSync('productBatches', 'UPDATE', change.id, {
        id: change.id, quantity: change.quantity,
      })
    } else {
      enqueueSync('productBatches', 'INSERT', change.id, {
        id:          change.id,
        productId:   change.productId,
        branchId:    change.branchId,
        quantity:    change.quantity,
        costPrice:   change.costPrice,
        batchNumber: change.batchNumber,
        expiryDate:  change.expiryDate,
        isTransfer:  true,
      })
    }
  }

  await logActionAs(auth, `TRANSFER_${status}`, 'StockTransfer', id,
    `Transfer status changed to ${status}`)

  return NextResponse.json({ success: true })
}
