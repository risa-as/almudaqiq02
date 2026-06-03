import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { guardFeature } from '@/lib/plan-features'
import { enqueueSync } from '@/lib/sync-enqueue'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const blocked = await guardFeature('stock_transfers'); if (blocked) return blocked
  const { id } = await params
  const tenantId = auth.tenantId
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id, tenantId },
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

  const transfer = await prisma.stockTransfer.findFirst({ where: { id, tenantId } })
  if (!transfer) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const { status } = parsed.data

  // batchChanges collects every productBatch mutation triggered by COMPLETED.
  // We enqueue them AFTER the transaction commits so each one carries the real
  // post-commit id/quantity that the cloud will need.
  const batchChanges: Array<
    | { op: 'UPDATE'; id: string; quantity: number }
    | { op: 'INSERT'; id: string; productId: string; branchId: string; quantity: number; costPrice: number; batchNumber: string | null; expiryDate: Date | null }
  > = []

  // When COMPLETED: deduct from source, add to dest
  if (status === 'COMPLETED' && transfer.status === 'APPROVED') {
    const items: { productId: string; quantity: number }[] = JSON.parse(transfer.items as string)

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
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
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'COMPLETED', approvedBy: userId },
      })
    })
  } else {
    await prisma.stockTransfer.update({
      where: { id },
      data: { status, ...(status === 'APPROVED' ? { approvedBy: userId } : {}) },
    })
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

  return NextResponse.json({ success: true })
}
