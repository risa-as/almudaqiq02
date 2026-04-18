import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'

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
    const { name, phone, address, balance, creditLimit, notes } = body

    if (!name) return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })

    const supplier = await prisma.supplier.create({
      data: {
        tenant:  { connect: { id: tenantId } },
        name,
        phone:   phone   || undefined,
        address: address || undefined,
        balance: Number(balance) || 0,
        creditLimit: creditLimit ? Number(creditLimit) : null,
        notes: notes || null,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'فشل إنشاء المورد' }, { status: 500 })
  }
}
