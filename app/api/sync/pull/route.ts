import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { verifyBranchToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Tables sent DOWN to the branch (catalog + settings — read-only on branch)
const PULLABLE_TABLES = ['products', 'productUnits', 'categories', 'offers', 'storeSettings', 'suppliers'] as const

const Schema = z.object({
  lastSyncAt: z.string().datetime().optional(),
  tables:     z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  // Authenticate via branch token
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Branch token required' }, { status: 401 })

  let branchPayload: Awaited<ReturnType<typeof verifyBranchToken>>
  try { branchPayload = await verifyBranchToken(token) }
  catch { return NextResponse.json({ error: 'Invalid branch token' }, { status: 401 }) }

  const { branchId, tenantId } = branchPayload

  const body   = await request.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  const lastSyncAt = parsed.success && parsed.data.lastSyncAt ? new Date(parsed.data.lastSyncAt) : undefined
  const since  = lastSyncAt ? { updatedAt: { gt: lastSyncAt } } : {}

  const [products, productUnits, categories, offers, storeSettings, suppliers] = await Promise.all([
    prisma.product.findMany({ where: { tenantId, ...since }, include: { units: true } }),
    prisma.productUnit.findMany({ where: { product: { tenantId } } }),
    prisma.category.findMany({ where: { tenantId, ...since } }),
    prisma.offer.findMany({ where: { tenantId, isActive: true, ...since } }),
    prisma.storeSettings.findFirst({ where: { tenantId, branchId } }),
    prisma.supplier.findMany({ where: { tenantId, ...since } }),
  ])

  // Branch-specific stock
  const productBatches = await prisma.productBatch.findMany({
    where: { branchId, ...(lastSyncAt ? { createdAt: { gt: lastSyncAt } } : {}) },
  })

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    products,
    productUnits,
    categories,
    offers,
    storeSettings,
    suppliers,
    productBatches,
  })
}
