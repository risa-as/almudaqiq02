import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

function getTenantId(r: NextRequest) { return r.headers.get('x-tenant-id') ?? '' }
function getUserId(r: NextRequest)   { return r.headers.get('x-user-id')   ?? '' }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = getTenantId(request)
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id, tenantId },
    include: { fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } },
  })
  if (!transfer) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  return NextResponse.json(transfer)
}

const UpdateSchema = z.object({ status: z.enum(['APPROVED', 'COMPLETED', 'CANCELLED']) })

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = getTenantId(request)
  const userId   = getUserId(request)
  const body   = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const transfer = await prisma.stockTransfer.findFirst({ where: { id, tenantId } })
  if (!transfer) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const { status } = parsed.data

  // When COMPLETED: deduct from source, add to dest
  if (status === 'COMPLETED' && transfer.status === 'APPROVED') {
    const items: { productId: string; quantity: number }[] = JSON.parse(transfer.items as string)

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        // Deduct from source branch — FIFO: oldest batch first
        const batches = await tx.productBatch.findMany({
          where: { productId: item.productId, branchId: transfer.fromBranchId, quantity: { gt: 0 } },
          orderBy: { createdAt: 'asc' },
        })
        let remaining = item.quantity
        for (const batch of batches) {
          if (remaining <= 0) break
          const deduct = Math.min(batch.quantity, remaining)
          await tx.productBatch.update({ where: { id: batch.id }, data: { quantity: { decrement: deduct } } })
          remaining -= deduct

          // Add to destination branch
          await tx.productBatch.create({
            data: {
              productId: item.productId,
              branchId: transfer.toBranchId,
              quantity: deduct,
              costPrice: batch.costPrice,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate,
            },
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

  return NextResponse.json({ success: true })
}
