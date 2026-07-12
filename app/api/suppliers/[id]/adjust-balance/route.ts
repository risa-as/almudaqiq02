import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { enqueueSync } from '@/lib/sync-enqueue'
import { logActionAs } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { newBalance, description, branchId } = body

    if (newBalance === undefined || newBalance === null || isNaN(Number(newBalance))) {
      return NextResponse.json({ error: 'قيمة الرصيد غير صالحة' }, { status: 400 })
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const target = Number(newBalance)
    // specificBranch matches the list-API scoping: when a branch is selected the
    // displayed balance is computed from that branch's ledger entries; otherwise
    // it is the global stored supplier.balance field.
    const specificBranch =
      branchId && branchId !== 'all' ? String(branchId) : null

    const result = await prisma.$transaction(async (tx) => {
      // 1. Compute the CURRENT balance exactly as the list view shows it, so the
      //    diff actually zeroes out what the user sees.
      let currentScoped: number
      if (specificBranch) {
        const grouped = await tx.supplierLedger.groupBy({
          by: ['type'],
          where: { supplierId: id, branchId: specificBranch },
          _sum: { amount: true },
        })
        currentScoped = grouped.reduce(
          (acc, r) =>
            acc + (r.type === 'PURCHASE' ? Number(r._sum.amount ?? 0) : -Number(r._sum.amount ?? 0)),
          0,
        )
      } else {
        currentScoped = Number(supplier.balance)
      }

      const diff = target - currentScoped // +ve = increase debt, -ve = decrease

      // 2. Ledger entry direction must match the balance computation:
      //    PURCHASE adds to balance, PAYMENT subtracts. Tag it with the SAME
      //    branch scope so the branch-scoped view picks it up.
      const ledgerType = diff >= 0 ? 'PURCHASE' : 'PAYMENT'

      const entry = await tx.supplierLedger.create({
        data: {
          supplierId:  id,
          branchId:    specificBranch,
          type:        ledgerType,
          amount:      Math.abs(diff),
          description: description || 'تسوية رصيد يدوية',
        },
      })

      // 3. Global stored field always moves by the same diff to stay consistent
      //    with the per-branch ledger total.
      await tx.supplier.update({
        where: { id },
        data:  { balance: { increment: diff } },
      })

      return { entry, scopedBalance: target }
    })

    // Only the ledger entry is synced — the cloud push handler derives the
    // balance change from it via increment (a suppliers UPDATE would double-count).
    enqueueSync('supplierLedger', 'INSERT', result.entry.id, {
      id:          result.entry.id,
      supplierId:  id,
      branchId:    result.entry.branchId,
      type:        result.entry.type,
      amount:      Number(result.entry.amount),
      description: result.entry.description,
      date:        result.entry.date,
    })

    await logActionAs(auth, 'SUPPLIER_ADJUST_BALANCE', 'Supplier', id,
      `${supplier.name} — new balance: ${result.scopedBalance}`)

    return NextResponse.json({ success: true, balance: result.scopedBalance })
  } catch (error) {
    console.error('adjust-balance error:', error)
    return NextResponse.json({ error: 'فشل تسوية الرصيد' }, { status: 500 })
  }
}
