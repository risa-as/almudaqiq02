import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { verifyBranchToken } from '@/lib/auth'
import { resolveConflict } from '@/lib/sync-engine/conflict-resolver'
import { checkRateLimit } from '@/lib/rate-limit'

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
  const results: { localId: string | number; cloudId?: string; status: 'applied' | 'conflict' | 'error'; reason?: string }[] = []
  const conflicts: unknown[] = []

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: { branchId, status: 'IN_PROGRESS' },
  })

  let applied = 0

  for (const op of operations) {
    try {
      switch (op.table) {
        case 'transactions': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            // Check for duplicate (idempotency)
            const existing = data.cloudId
              ? await prisma.transaction.findUnique({ where: { id: data.cloudId as string } })
              : null
            if (existing) { results.push({ localId: op.localId, cloudId: existing.id, status: 'applied' }); applied++; break }

            const tx = await prisma.transaction.create({
              data: {
                tenantId,
                branchId,
                type:          (data.type as string)          || 'SALE',
                totalAmount:   data.totalAmount as number,
                date:          data.date ? new Date(data.date as string) : new Date(),
                userId:        data.userId as string | undefined,
                notes:         data.notes as string | undefined,
                discount:      (data.discount as number)       || 0,
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
          }
          break
        }

        case 'customers': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            const customer = await prisma.customer.create({
              data: { tenantId, name: data.name as string, phone: data.phone as string, balance: (data.balance as number) || 0 },
            })
            results.push({ localId: op.localId, cloudId: customer.id, status: 'applied' })
            applied++
          } else if (op.type === 'UPDATE' && op.cloudId) {
            const cloudRecord = await prisma.customer.findUnique({ where: { id: op.cloudId } })
            const winner = cloudRecord ? resolveConflict('customers', op.payload, cloudRecord) : op.payload
            await prisma.customer.update({ where: { id: op.cloudId }, data: winner as any })
            results.push({ localId: op.localId, cloudId: op.cloudId, status: 'applied' })
            applied++
          }
          break
        }

        case 'expenses': {
          const data = op.payload as Record<string, unknown>
          if (op.type === 'INSERT') {
            const expense = await prisma.expense.create({
              data: {
                tenantId, branchId,
                title:       data.title as string,
                amount:      data.amount as number,
                category:    data.category as string | undefined,
                description: data.description as string | undefined,
                date:        data.date ? new Date(data.date as string) : new Date(),
              },
            })
            results.push({ localId: op.localId, cloudId: expense.id, status: 'applied' })
            applied++
          }
          break
        }

        default:
          results.push({ localId: op.localId, status: 'error', reason: `Unsupported table: ${op.table}` })
      }
    } catch (err: any) {
      results.push({ localId: op.localId, status: 'error', reason: err.message })
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
