import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { enqueueSync } from '@/lib/sync-enqueue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const { tenantId } = auth

    const branchId = request.nextUrl.searchParams.get('branchId')
    const specificBranch = branchId && branchId !== 'all' ? branchId : null

    const [suppliers, ledgerTotals] = await Promise.all([
      prisma.supplier.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { products: true, ledger: true } } },
      }),
      // Compute balance per supplier scoped to the selected branch (or global)
      prisma.supplierLedger.groupBy({
        by: ['supplierId', 'type'],
        where: specificBranch
          ? { supplier: { tenantId }, branchId: specificBranch }
          : { supplier: { tenantId } },
        _sum: { amount: true },
      }),
    ])

    // Build balance map: PURCHASE adds debt, PAYMENT/RETURN reduces it
    const balanceMap = new Map<string, number>()
    for (const row of ledgerTotals) {
      const prev = balanceMap.get(row.supplierId) ?? 0
      const amt  = Number(row._sum.amount ?? 0)
      balanceMap.set(row.supplierId, prev + (row.type === 'PURCHASE' ? amt : -amt))
    }

    const result = suppliers.map(s => ({
      ...s,
      balance: specificBranch
        ? (balanceMap.get(s.id) ?? 0)   // branch-scoped: always from ledger
        : Number(s.balance),             // global view: use stored field
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'فشل جلب الموردين' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const { tenantId } = auth

    const body = await request.json()
    const { name, phone, address, balance, creditLimit, notes, branchId } = body

    if (!name) return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })

    const openingBalance = Number(balance) || 0
    // Attribute the opening balance to the active branch so branch-scoped and
    // global views stay consistent. Falls back to the user's branch, else null.
    const openingBranch =
      branchId && branchId !== 'all' ? String(branchId) : (auth.branchId ?? null)

    const { supplier, openingEntry } = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          tenant:  { connect: { id: tenantId } },
          name,
          phone:   phone   || undefined,
          address: address || undefined,
          balance: openingBalance,
          creditLimit: creditLimit ? Number(creditLimit) : null,
          notes: notes || null,
        },
      })

      // Mirror the opening balance as a ledger entry so supplier.balance always
      // equals the ledger sum (prevents the stored/ledger divergence bug).
      let openingEntry = null
      if (openingBalance !== 0) {
        openingEntry = await tx.supplierLedger.create({
          data: {
            supplierId:  supplier.id,
            branchId:    openingBranch,
            type:        openingBalance > 0 ? 'PURCHASE' : 'PAYMENT',
            amount:      Math.abs(openingBalance),
            description: 'رصيد افتتاحي',
          },
        })
      }

      return { supplier, openingEntry }
    })

    // balance is intentionally synced as 0 — the opening-balance ledger entry
    // below drives the cloud balance via increment (avoids double-counting).
    enqueueSync('suppliers', 'INSERT', supplier.id, {
      id: supplier.id, tenantId, name, phone: phone || null,
      address: address || null, balance: 0,
      creditLimit: creditLimit ? Number(creditLimit) : null, notes: notes || null,
    })

    if (openingEntry) {
      enqueueSync('supplierLedger', 'INSERT', openingEntry.id, {
        id:          openingEntry.id,
        supplierId:  supplier.id,
        branchId:    openingEntry.branchId,
        type:        openingEntry.type,
        amount:      Number(openingEntry.amount),
        description: openingEntry.description,
        date:        openingEntry.date,
      })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'فشل إنشاء المورد' }, { status: 500 })
  }
}
