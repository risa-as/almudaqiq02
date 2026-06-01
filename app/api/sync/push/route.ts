/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SYNC — PUSH ENDPOINT  (app/api/sync/push/route.ts)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Role in the sync pipeline:
 *   Receives a batch of local operations (INSERT / UPDATE / DELETE) from the
 *   desktop sync-worker and applies them to the cloud PostgreSQL database.
 *   This is the "desktop → cloud" direction of the bidirectional sync.
 *
 * Authentication:
 *   Uses a long-lived branch JWT (not a user session) so sync works while
 *   no user is logged in.  tenantId and branchId come from the token — never
 *   from the request payload — to prevent cross-tenant data injection.
 *
 * Idempotency:
 *   Every operation uses the local record id (localId / recordId from SyncQueue)
 *   as the cloud row id.  INSERT uses upsert so a retried push doesn't create
 *   duplicates.  DELETE uses deleteMany so a not-found row is silently ignored.
 *
 * Hard-delete propagation:
 *   After applying a DELETE, we call logCloudDelete() which writes to the
 *   CloudDeleteLog table.  The pull endpoint returns these log entries so OTHER
 *   branches can delete the same record from their local SQLite on the next pull.
 *
 * Tables handled (one `case` per table):
 *   categories, transactions, expenses, cashierShifts, stockTransfers,
 *   products (+ productUnits), productBatches (+ WAC + supplierLedger),
 *   suppliers, offers, storeSettings, customers
 *
 * Connected files:
 *   • electron/sync-worker.js        — calls this endpoint (push step)
 *   • electron/offline-queue.js      — provides the queue rows being pushed
 *   • lib/sync-delete-log.ts         — logCloudDelete() writes to CloudDeleteLog
 *   • app/api/sync/pull/route.ts     — returns CloudDeleteLog to other branches
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { verifyBranchToken } from '@/lib/auth'
import { resolveConflict } from '@/lib/sync-engine/conflict-resolver'
import { checkRateLimit } from '@/lib/rate-limit'
import { logCloudDelete } from '@/lib/sync-delete-log'

export const dynamic = 'force-dynamic'

const OperationSchema = z.object({
  table:     z.string(),
  type:      z.enum(['INSERT', 'UPDATE', 'DELETE']),
  localId:   z.union([z.string(), z.number()]),
  cloudId:   z.string().optional(),
  payload:   z.record(z.unknown()),
  timestamp: z.string().datetime(),
})

const PushSchema = z.object({
  operations: z.array(OperationSchema),
})

type OpResult = {
  localId: string | number
  cloudId?: string
  status: 'applied' | 'conflict' | 'error'
  reason?: string
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Branch token required' }, { status: 401 })

  let branchPayload: Awaited<ReturnType<typeof verifyBranchToken>>
  try { branchPayload = await verifyBranchToken(token) }
  catch { return NextResponse.json({ error: 'Invalid branch token' }, { status: 401 }) }

  const { branchId, tenantId } = branchPayload

  // Rate limit: 60 push requests per minute per branch
  const rl = checkRateLimit(`sync:push:${branchId}`, { limit: 60, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many sync requests' }, { status: 429 })
  }

  const body   = await request.json().catch(() => null)
  const parsed = PushSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { operations } = parsed.data
  const results: OpResult[] = []
  const conflicts: unknown[] = []

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: { tenantId, branchId, status: 'IN_PROGRESS' },
  })

  let applied = 0

  for (const op of operations) {
    // The local record id is the stable idempotency key: the cloud row is
    // created with this same id, so a retried push finds the existing row
    // instead of creating a duplicate.
    const syncId = op.cloudId ?? String(op.localId)

    try {
      switch (op.table) {
        case 'categories': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT' || op.type === 'UPDATE') {
            // Validate parentId only when the field is present in the payload
            const rawParentId = data.parentId !== undefined
              ? (data.parentId as string | null)
              : undefined
            const safeParentId = rawParentId != null
              ? (await prisma.category.findFirst({ where: { id: rawParentId, tenantId } }))?.id ?? null
              : rawParentId === null ? null : undefined

            if (op.type === 'INSERT') {
              await prisma.category.upsert({
                where: { id: syncId },
                create: {
                  id: syncId, tenantId,
                  name:        data.name as string,
                  description: (data.description as string | undefined) ?? null,
                  parentId:    safeParentId ?? null,
                  sortOrder:   (data.sortOrder as number | undefined) ?? 0,
                },
                update: {
                  name:        data.name as string,
                  description: (data.description as string | undefined) ?? null,
                  parentId:    safeParentId ?? null,
                  sortOrder:   (data.sortOrder as number | undefined) ?? 0,
                },
              })
            } else {
              // UPDATE — partial: only set fields present in the payload
              await prisma.category.updateMany({
                where: { id: syncId, tenantId },
                data: {
                  ...(data.name        !== undefined ? { name:        data.name        as string }                                : {}),
                  ...(data.description !== undefined ? { description: (data.description as string | undefined) ?? null }          : {}),
                  ...(data.sortOrder   !== undefined ? { sortOrder:   data.sortOrder   as number }                                : {}),
                  ...(safeParentId     !== undefined ? { parentId:    safeParentId }                                              : {}),
                },
              })
            }
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'DELETE') {
            await prisma.category.deleteMany({ where: { id: syncId, tenantId } }).catch(() => {})
            await logCloudDelete(tenantId, 'categories', syncId)
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported category op: ${op.type}` })
          }
          break
        }

        case 'transactions': {
          if (op.type !== 'INSERT') {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported transaction op: ${op.type}` })
            break
          }
          const data = op.payload as Record<string, unknown>

          // Idempotency — already pushed?
          const existing = await prisma.transaction.findUnique({ where: { id: syncId } })
          if (existing) {
            results.push({ localId: op.localId, cloudId: existing.id, status: 'applied' })
            applied++
            break
          }

          // Guard FK links: only attach user/customer if they exist on the cloud,
          // so a missing reference never rejects an offline sale.
          const txUserId = data.userId
            ? (await prisma.user.findUnique({ where: { id: data.userId as string } }))?.id
            : undefined
          const txCustomerId = data.customerId
            ? (await prisma.customer.findUnique({ where: { id: data.customerId as string } }))?.id
            : undefined

          const tx = await prisma.transaction.create({
            data: {
              id:            syncId,
              tenantId,
              branchId,
              type:          (data.type as string)          || 'SALE',
              totalAmount:   data.totalAmount as number,
              date:          data.date ? new Date(data.date as string) : new Date(),
              receiptNumber: (data.receiptNumber as string | undefined) ?? null,
              userId:        txUserId,
              customerId:    txCustomerId,
              notes:         data.notes as string | undefined,
              discount:      (data.discount as number)       || 0,
              priceEdited:   (data.priceEdited as boolean)   ?? false,
              paymentMethod: (data.paymentMethod as string)  || 'CASH',
              paidAmount:    data.paidAmount as number | undefined,
              items:         data.items ? {
                create: (data.items as any[]).map((item: any) => ({
                  productId: item.productId,
                  unitId:    item.unitId,
                  quantity:  item.quantity,
                  price:     item.price,
                  cost:      item.cost || 0,
                })),
              } : undefined,
            },
          })
          results.push({ localId: op.localId, cloudId: tx.id, status: 'applied' })
          applied++
          break
        }

        case 'expenses': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            const existing = await prisma.expense.findUnique({ where: { id: syncId } })
            if (existing) {
              results.push({ localId: op.localId, cloudId: existing.id, status: 'applied' })
              applied++
              break
            }
            const expense = await prisma.expense.create({
              data: {
                id: syncId, tenantId, branchId,
                title:       data.title as string,
                amount:      data.amount as number,
                category:    data.category as string | undefined,
                description: data.description as string | undefined,
                date:        data.date ? new Date(data.date as string) : new Date(),
              },
            })
            results.push({ localId: op.localId, cloudId: expense.id, status: 'applied' })
            applied++
          } else if (op.type === 'UPDATE') {
            await prisma.expense.updateMany({
              where: { id: syncId, tenantId },
              data: {
                title:       data.title       as string | undefined,
                amount:      data.amount      as number | undefined,
                category:    data.category    as string | undefined,
                description: data.description as string | undefined,
                date:        data.date ? new Date(data.date as string) : undefined,
              },
            })
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'DELETE') {
            await prisma.expense.deleteMany({ where: { id: syncId, tenantId } }).catch(() => {})
            await logCloudDelete(tenantId, 'expenses', syncId)
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported expense op: ${op.type}` })
          }
          break
        }

        case 'cashierShifts': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            const existing = await prisma.cashierShift.findUnique({ where: { id: syncId } })
            if (existing) {
              results.push({ localId: op.localId, cloudId: existing.id, status: 'applied' })
              applied++
              break
            }
            const cloudUserId = data.userId
              ? (await prisma.user.findUnique({ where: { id: data.userId as string } }))?.id
              : undefined
            const shift = await prisma.cashierShift.create({
              data: {
                id:             syncId,
                tenantId,
                branchId,
                userId:         cloudUserId ?? (data.userId as string),
                openingAmount:  data.openingAmount as number ?? 0,
                closingAmount:  data.closingAmount as number ?? null,
                expectedAmount: data.expectedAmount as number ?? null,
                difference:     data.difference as number ?? null,
                openedAt:       data.openedAt ? new Date(data.openedAt as string) : new Date(),
                closedAt:       data.closedAt ? new Date(data.closedAt as string) : null,
                notes:          data.notes as string ?? null,
              },
            })
            results.push({ localId: op.localId, cloudId: shift.id, status: 'applied' })
            applied++
          } else if (op.type === 'UPDATE') {
            const data = op.payload as Record<string, unknown>
            await prisma.cashierShift.update({
              where: { id: syncId },
              data: {
                closingAmount:  data.closingAmount as number ?? null,
                expectedAmount: data.expectedAmount as number ?? null,
                difference:     data.difference as number ?? null,
                closedAt:       data.closedAt ? new Date(data.closedAt as string) : null,
                notes:          data.notes as string ?? null,
              },
            }).catch(() => {})
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported shift op: ${op.type}` })
          }
          break
        }

        case 'stockTransfers': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            const existing = await prisma.stockTransfer.findUnique({ where: { id: syncId } })
            if (existing) {
              results.push({ localId: op.localId, cloudId: existing.id, status: 'applied' })
              applied++
              break
            }
            const transfer = await prisma.stockTransfer.create({
              data: {
                id:           syncId,
                tenantId,
                fromBranchId: data.fromBranchId as string,
                toBranchId:   data.toBranchId as string,
                items:        data.items as string,
                notes:        data.notes as string | undefined,
                requestedBy:  data.requestedBy as string ?? branchId,
                status:       (data.status as string) ?? 'PENDING',
              },
            })
            results.push({ localId: op.localId, cloudId: transfer.id, status: 'applied' })
            applied++
          } else if (op.type === 'UPDATE') {
            await prisma.stockTransfer.update({
              where: { id: syncId },
              data: {
                status:     data.status as string | undefined,
                approvedBy: data.approvedBy as string | undefined,
              },
            }).catch(() => {})
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported stockTransfer op: ${op.type}` })
          }
          break
        }

        case 'products': {
          const data = op.payload as Record<string, unknown>

          // Validate FK references exist on cloud — fall back to null if not found
          // (prevents FK constraint errors when desktop-only categories/suppliers are pushed)
          const rawCategoryId = (data.categoryId as string | undefined) ?? null
          const rawSupplierId = (data.supplierId as string | undefined) ?? null
          const safeCategory = rawCategoryId
            ? (await prisma.category.findFirst({ where: { id: rawCategoryId, tenantId } }))?.id ?? null
            : null
          const safeSupplier = rawSupplierId
            ? (await prisma.supplier.findFirst({ where: { id: rawSupplierId, tenantId } }))?.id ?? null
            : null

          if (op.type === 'INSERT') {
            await prisma.product.upsert({
              where: { id: syncId },
              create: {
                id:           syncId,
                tenantId,
                name:         data.name         as string,
                description:  (data.description as string | undefined) ?? null,
                costPrice:    (data.costPrice   as number) || 0,
                baseStock:    (data.baseStock   as number) || 0,
                minimumStock: (data.minimumStock as number) || 0,
                categoryId:   safeCategory,
                supplierId:   safeSupplier,
              },
              update: {
                name:         data.name         as string,
                description:  (data.description as string | undefined) ?? null,
                costPrice:    (data.costPrice   as number) || 0,
                baseStock:    (data.baseStock   as number) || 0,
                minimumStock: (data.minimumStock as number) || 0,
                supplierId:   safeSupplier,
                categoryId:   safeCategory,
              },
            })
          } else if (op.type === 'UPDATE') {
            // Partial update — only set fields that are present in the payload
            await prisma.product.updateMany({
              where: { id: syncId, tenantId },
              data: {
                ...(data.name        !== undefined ? { name:         data.name        as string }  : {}),
                ...(data.description !== undefined ? { description:  (data.description as string | undefined) ?? null } : {}),
                ...(data.costPrice   !== undefined ? { costPrice:    data.costPrice   as number }  : {}),
                ...(data.minimumStock!== undefined ? { minimumStock: (data.minimumStock as number) || 0 }  : {}),
                ...(data.categoryId  !== undefined ? { categoryId:   safeCategory } : {}),
                ...(data.supplierId  !== undefined ? { supplierId:   safeSupplier } : {}),
                ...(data.isQuickSale !== undefined ? { isQuickSale:  data.isQuickSale as boolean } : {}),
              },
            })
          }
          if (op.type === 'INSERT' || op.type === 'UPDATE') {
            for (const unit of (data.units as any[] | undefined) ?? []) {
              if (!unit?.id) continue
              await prisma.productUnit.upsert({
                where: { id: unit.id },
                create: {
                  id: unit.id, productId: syncId, tenantId,
                  name: unit.name, price: unit.price || 0,
                  conversionFactor: unit.conversionFactor || 1,
                  barcode: unit.barcode || null,
                },
                update: {
                  name: unit.name, price: unit.price || 0,
                  conversionFactor: unit.conversionFactor || 1,
                  barcode: unit.barcode || null,
                },
              }).catch(() => {})
            }
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'DELETE') {
            // Delete dependent records that don't auto-cascade in all DBs
            await prisma.productUnit.deleteMany({ where: { productId: syncId } }).catch(() => {})
            try {
              await prisma.product.delete({ where: { id: syncId } })
            } catch (delErr: any) {
              // P2025 = record not found → already deleted → treat as success
              if (delErr?.code !== 'P2025') throw delErr
            }
            await logCloudDelete(tenantId, 'products', syncId)
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported product op: ${op.type}` })
          }
          break
        }

        case 'productBatches': {
          const data = op.payload as Record<string, unknown>

          if (op.type === 'INSERT') {
            // Idempotency — already pushed?
            const existingBatch = await prisma.productBatch.findUnique({ where: { id: syncId } })
            if (existingBatch) {
              results.push({ localId: op.localId, cloudId: existingBatch.id, status: 'applied' })
              applied++
              break
            }

            const productId    = data.productId  as string
            const batchBranchId = (data.branchId as string | undefined) ?? branchId
            const qtyToAdd     = data.quantity   as number
            const batchCost    = data.costPrice  as number
            // isTransfer = batch created by a stock-transfer (moving existing stock).
            // We still bump baseStock so the matching source-batch UPDATE that
            // decrements it nets out to zero, but we skip WAC because no new
            // stock is entering the system at a different cost.
            const isTransfer   = data.isTransfer === true

            const cloudProduct = await prisma.product.findUnique({ where: { id: productId } })
            if (!cloudProduct) {
              results.push({ localId: op.localId, status: 'error', reason: 'Product not found on cloud' })
              break
            }

            // WAC = weighted average cost. Only recalculate for real stock-ins, not transfers.
            const curStock = Number(cloudProduct.baseStock)
            const curCost  = Number(cloudProduct.costPrice)
            const newWAC   = curStock > 0
              ? ((curStock * curCost) + (qtyToAdd * batchCost)) / (curStock + qtyToAdd)
              : batchCost

            await prisma.$transaction(async (tx) => {
              await tx.productBatch.create({
                data: {
                  id:          syncId,
                  tenantId,
                  productId,
                  branchId:    batchBranchId,
                  quantity:    qtyToAdd,
                  costPrice:   batchCost,
                  batchNumber: (data.batchNumber as string | undefined) ?? null,
                  expiryDate:  data.expiryDate ? new Date(data.expiryDate as string) : null,
                },
              })

              await tx.product.update({
                where: { id: productId },
                data: {
                  baseStock: { increment: qtyToAdd },
                  ...(isTransfer ? {} : { costPrice: newWAC }),
                  ...(data.supplierId && !isTransfer ? { supplierId: data.supplierId as string } : {}),
                },
              })
            })
            // NOTE: supplierLedger entries are NOT created here anymore — they are
            // enqueued separately by the originating route (stock-in / payment / debt /
            // return-stock) and handled by the 'supplierLedger' push case below.
            // This avoids the duplicate-ledger bug where both desktop and cloud created
            // entries with different IDs.

            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'UPDATE') {
            // Batch quantity / cost adjustments (e.g., return-stock decrements batch qty,
            // PATCH edits batch fields, transfer FIFO decrements source batches).
            // We compute the delta against the existing cloud row and reflect it on
            // product.baseStock so totals stay consistent across branches.
            const existing = await prisma.productBatch.findUnique({ where: { id: syncId } })
            if (!existing) {
              results.push({ localId: op.localId, status: 'error', reason: 'Batch not found on cloud' })
              break
            }

            const newQty = data.quantity !== undefined ? Number(data.quantity) : Number(existing.quantity)
            const delta  = newQty - Number(existing.quantity)

            await prisma.$transaction(async (tx) => {
              await tx.productBatch.update({
                where: { id: syncId },
                data: {
                  ...(data.quantity    !== undefined ? { quantity:    newQty } : {}),
                  ...(data.costPrice   !== undefined ? { costPrice:   Number(data.costPrice) } : {}),
                  ...(data.batchNumber !== undefined ? { batchNumber: (data.batchNumber as string | undefined) ?? null } : {}),
                  ...(data.expiryDate  !== undefined ? { expiryDate:  data.expiryDate ? new Date(data.expiryDate as string) : null } : {}),
                },
              })

              if (delta !== 0) {
                await tx.product.update({
                  where: { id: existing.productId },
                  data:  { baseStock: { increment: delta } },
                })
              }
            })

            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'DELETE') {
            // Removing a batch — also reduce product.baseStock by its quantity.
            const existing = await prisma.productBatch.findUnique({ where: { id: syncId } })
            if (existing) {
              await prisma.$transaction(async (tx) => {
                await tx.product.update({
                  where: { id: existing.productId },
                  data:  { baseStock: { decrement: Number(existing.quantity) } },
                })
                await tx.productBatch.delete({ where: { id: syncId } }).catch(() => {})
              })
              await logCloudDelete(tenantId, 'productBatches', syncId)
            }
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported productBatches op: ${op.type}` })
          }
          break
        }

        case 'suppliers': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            await prisma.supplier.upsert({
              where: { id: syncId },
              create: {
                id: syncId, tenantId,
                name:        data.name        as string,
                phone:       (data.phone       as string | undefined) ?? null,
                address:     (data.address     as string | undefined) ?? null,
                balance:     (data.balance     as number) || 0,
                creditLimit: (data.creditLimit as number | undefined) ?? null,
                notes:       (data.notes       as string | undefined) ?? null,
              },
              update: {
                name:        data.name        as string,
                phone:       (data.phone       as string | undefined) ?? null,
                address:     (data.address     as string | undefined) ?? null,
                balance:     (data.balance     as number) || 0,
                creditLimit: (data.creditLimit as number | undefined) ?? null,
                notes:       (data.notes       as string | undefined) ?? null,
              },
            })
          } else if (op.type === 'UPDATE') {
            await prisma.supplier.updateMany({
              where: { id: syncId, tenantId },
              data: {
                ...(data.name        !== undefined ? { name:        data.name        as string }  : {}),
                ...(data.phone       !== undefined ? { phone:       (data.phone as string | undefined) ?? null }   : {}),
                ...(data.address     !== undefined ? { address:     (data.address as string | undefined) ?? null } : {}),
                ...(data.balance     !== undefined ? { balance:     data.balance     as number }  : {}),
                ...(data.creditLimit !== undefined ? { creditLimit: (data.creditLimit as number | undefined) ?? null } : {}),
                ...(data.notes       !== undefined ? { notes:       (data.notes as string | undefined) ?? null }   : {}),
              },
            })
          } else if (op.type === 'DELETE') {
            await prisma.supplierLedger.deleteMany({ where: { supplierId: syncId } }).catch(() => {})
            await prisma.supplier.deleteMany({ where: { id: syncId, tenantId } }).catch(() => {})
            await logCloudDelete(tenantId, 'suppliers', syncId)
          }
          results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
          applied++
          break
        }

        case 'offers': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            await prisma.offer.upsert({
              where: { id: syncId },
              create: {
                id: syncId, tenantId,
                name:        data.name  as string,
                type:        data.type  as string,
                value:       (data.value as number) || 0,
                buyQuantity: (data.buyQuantity as number | undefined) ?? null,
                getQuantity: (data.getQuantity as number | undefined) ?? null,
                productId:   (data.productId  as string | undefined) ?? null,
                categoryId:  (data.categoryId as string | undefined) ?? null,
                branchId:    (data.branchId   as string | undefined) ?? null,
                startDate:   data.startDate ? new Date(data.startDate as string) : new Date(),
                endDate:     data.endDate   ? new Date(data.endDate   as string) : null,
                isActive:    (data.isActive as boolean) ?? true,
              },
              update: {
                name:        data.name  as string,
                type:        data.type  as string,
                value:       (data.value as number) || 0,
                buyQuantity: (data.buyQuantity as number | undefined) ?? null,
                getQuantity: (data.getQuantity as number | undefined) ?? null,
                productId:   (data.productId  as string | undefined) ?? null,
                categoryId:  (data.categoryId as string | undefined) ?? null,
                branchId:    (data.branchId   as string | undefined) ?? null,
                startDate:   data.startDate ? new Date(data.startDate as string) : undefined,
                endDate:     data.endDate   ? new Date(data.endDate   as string) : null,
                isActive:    (data.isActive as boolean) ?? true,
              },
            })
          } else if (op.type === 'UPDATE') {
            await prisma.offer.updateMany({
              where: { id: syncId, tenantId },
              data: {
                ...(data.name       !== undefined ? { name:        data.name  as string }  : {}),
                ...(data.type       !== undefined ? { type:        data.type  as string }  : {}),
                ...(data.value      !== undefined ? { value:       data.value as number }  : {}),
                ...(data.isActive   !== undefined ? { isActive:    data.isActive as boolean } : {}),
                ...(data.startDate  !== undefined ? { startDate:   new Date(data.startDate as string) } : {}),
                ...(data.endDate    !== undefined ? { endDate:     data.endDate ? new Date(data.endDate as string) : null } : {}),
                ...(data.productId  !== undefined ? { productId:   (data.productId  as string | undefined) ?? null } : {}),
                ...(data.categoryId !== undefined ? { categoryId:  (data.categoryId as string | undefined) ?? null } : {}),
              },
            })
          } else if (op.type === 'DELETE') {
            await prisma.offer.deleteMany({ where: { id: syncId, tenantId } }).catch(() => {})
            await logCloudDelete(tenantId, 'offers', syncId)
          }
          results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
          applied++
          break
        }

        case 'storeSettings': {
          const data = op.payload as Record<string, unknown>
          // storeSettings is identified by branchId on cloud — partial update only
          await prisma.storeSettings.updateMany({
            where: { tenantId, branchId },
            data: {
              ...(data.storeName     !== undefined ? { storeName:     data.storeName     as string }  : {}),
              ...(data.storePhone    !== undefined ? { storePhone:    data.storePhone    as string }  : {}),
              ...(data.storeAddress  !== undefined ? { storeAddress:  data.storeAddress  as string }  : {}),
              ...(data.footerMessage !== undefined ? { footerMessage: data.footerMessage as string }  : {}),
              ...(data.autoPrint     !== undefined ? { autoPrint:     data.autoPrint     as boolean } : {}),
              ...(data.currency      !== undefined ? { currency:      data.currency      as string }  : {}),
            },
          })
          results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
          applied++
          break
        }

        case 'supplierLedger': {
          // Supplier ledger entries (PURCHASE / PAYMENT / RETURN) — written by
          // suppliers/[id]/payment, suppliers/[id]/debt, suppliers/[id]/return-stock,
          // and inventory/batch (stock-in).  We create the entry with its local id
          // (idempotency) and derive supplier.balance from the entry type so the
          // cloud balance stays consistent without needing a separate suppliers UPDATE.
          const data = op.payload as Record<string, unknown>
          if (op.type !== 'INSERT') {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported supplierLedger op: ${op.type}` })
            break
          }

          // Idempotency — already pushed?
          const existingLedger = await prisma.supplierLedger.findUnique({ where: { id: syncId } })
          if (existingLedger) {
            results.push({ localId: op.localId, cloudId: existingLedger.id, status: 'applied' })
            applied++
            break
          }

          const supplierId = data.supplierId as string
          const ledgerType = (data.type as string) || 'PURCHASE'
          const amount     = Number(data.amount) || 0

          // Verify supplier exists on cloud and belongs to this tenant
          const supplierExists = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } })
          if (!supplierExists) {
            results.push({ localId: op.localId, status: 'error', reason: 'Supplier not found on cloud' })
            break
          }

          await prisma.$transaction(async (tx) => {
            await tx.supplierLedger.create({
              data: {
                id:          syncId,
                supplierId,
                branchId:    (data.branchId as string | undefined) ?? null,
                type:        ledgerType,
                amount,
                description: (data.description as string | undefined) ?? null,
                date:        data.date ? new Date(data.date as string) : new Date(),
              },
            })

            // Balance: PURCHASE increases what we owe; PAYMENT / RETURN decrease it.
            const delta = ledgerType === 'PURCHASE' ? amount : -amount
            if (delta !== 0) {
              await tx.supplier.update({
                where: { id: supplierId, tenantId },
                data:  { balance: { increment: delta } },
              })
            }
          })

          results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
          applied++
          break
        }

        case 'customers': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            const existing = await prisma.customer.findUnique({ where: { id: syncId } })
            if (existing) {
              results.push({ localId: op.localId, cloudId: existing.id, status: 'applied' })
              applied++
              break
            }
            const customer = await prisma.customer.create({
              data: {
                id: syncId, tenantId,
                name:    data.name    as string,
                phone:   (data.phone   as string | undefined) ?? null,
                address: (data.address as string | undefined) ?? null,
                balance: (data.balance as number) || 0,
                ...(data.branchId ? { branchId: data.branchId as string } : {}),
              },
            })
            results.push({ localId: op.localId, cloudId: customer.id, status: 'applied' })
            applied++
          } else if (op.type === 'UPDATE') {
            await prisma.customer.updateMany({
              where: { id: syncId, tenantId },
              data: {
                ...(data.name    !== undefined ? { name:    data.name    as string } : {}),
                ...(data.phone   !== undefined ? { phone:   (data.phone   as string | undefined) ?? null } : {}),
                ...(data.address !== undefined ? { address: (data.address as string | undefined) ?? null } : {}),
                ...(data.balance !== undefined ? { balance: data.balance as number } : {}),
              },
            })
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'DELETE') {
            await prisma.customer.deleteMany({ where: { id: syncId, tenantId } }).catch(() => {})
            await logCloudDelete(tenantId, 'customers', syncId)
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported customer op: ${op.type}` })
          }
          break
        }

        case 'users': {
          const data = op.payload as Record<string, unknown>

          // branchId on the desktop is the LOCAL branch id. We can't trust it
          // across the identity boundary, so we map any non-null local branchId
          // to THIS branch's cloud id (from the token), and null stays null.
          const userBranchId = data.branchId ? branchId : null

          if (op.type === 'INSERT') {
            await prisma.user.upsert({
              where: { id: syncId },
              create: {
                id: syncId, tenantId,
                username: data.username as string,
                password: data.password as string, // already bcrypt-hashed on desktop
                role:     (data.role as any) || 'CASHIER',
                email:    (data.email as string | undefined) ?? null,
                branchId: userBranchId,
              },
              update: {
                ...(data.username !== undefined ? { username: data.username as string } : {}),
                ...(data.password !== undefined ? { password: data.password as string } : {}),
                ...(data.role     !== undefined ? { role:     data.role as any } : {}),
                ...(data.email    !== undefined ? { email:    (data.email as string | undefined) ?? null } : {}),
                ...(data.branchId !== undefined ? { branchId: userBranchId } : {}),
              },
            })
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'UPDATE') {
            // Partial update — only set fields present in the payload
            await prisma.user.updateMany({
              where: { id: syncId, tenantId },
              data: {
                ...(data.username !== undefined ? { username: data.username as string } : {}),
                ...(data.password !== undefined ? { password: data.password as string } : {}),
                ...(data.role     !== undefined ? { role:     data.role as any } : {}),
                ...(data.email    !== undefined ? { email:    (data.email as string | undefined) ?? null } : {}),
                ...(data.branchId !== undefined ? { branchId: userBranchId } : {}),
              },
            })
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else if (op.type === 'DELETE') {
            // Clear refresh tokens first (FK does not cascade in all DBs)
            await prisma.refreshToken.deleteMany({ where: { userId: syncId } }).catch(() => {})
            await prisma.user.deleteMany({ where: { id: syncId, tenantId } }).catch(() => {})
            await logCloudDelete(tenantId, 'users', syncId)
            results.push({ localId: op.localId, cloudId: syncId, status: 'applied' })
            applied++
          } else {
            results.push({ localId: op.localId, status: 'error', reason: `Unsupported user op: ${op.type}` })
          }
          break
        }

        default:
          results.push({ localId: op.localId, status: 'error', reason: `Unsupported table: ${op.table}` })
      }
    } catch (err: any) {
      results.push({ localId: op.localId, status: 'error', reason: err?.message ?? 'Server error' })
    }
  }

  // Update sync log
  await prisma.syncLog.update({
    where: { id: syncLog.id },
    data: {
      status: 'SUCCESS',
      completedAt: new Date(),
      recordsPushed: applied,
      conflicts: conflicts.length > 0 ? JSON.stringify(conflicts) : null,
    },
  })

  return NextResponse.json({
    success: true,
    applied,
    conflicts: conflicts.length,
    results,
  })
}
