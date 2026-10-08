import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { resolveOptionalBranchId } from '@/lib/branch-scope'
import { enqueueSync } from '@/lib/sync-enqueue'
import { logActionAs } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { amount, description, branchId } = body

    if (!id || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })
    }

    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: auth.tenantId } })
    if (!supplier) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    // The ledger entry is scoped to the caller's branch (staff are pinned to it).
    const ledgerBranchId = await resolveOptionalBranchId(auth, branchId)
    if (ledgerBranchId === undefined) return NextResponse.json({ error: 'الفرع غير صالح' }, { status: 400 })

    const debtAmount = Number(amount)

    const result = await prisma.$transaction(async (tx) => {
      const ledgerEntry = await tx.supplierLedger.create({
        data: {
          supplierId: id,
          branchId: ledgerBranchId,
          type:        'PURCHASE',
          amount:      debtAmount,
          description: description || 'رصيد افتتاحي — دين سابق',
        },
      })

      const updatedSupplier = await tx.supplier.update({
        where: { id },
        data:  { balance: { increment: debtAmount } },
      })

      return { ledgerEntry, updatedSupplier }
    })

    // Sync the debt ledger entry — push handler derives supplier.balance increment.
    enqueueSync('supplierLedger', 'INSERT', result.ledgerEntry.id, {
      id:          result.ledgerEntry.id,
      supplierId:  result.ledgerEntry.supplierId,
      branchId:    result.ledgerEntry.branchId,
      type:        result.ledgerEntry.type,
      amount:      Number(result.ledgerEntry.amount),
      description: result.ledgerEntry.description,
      date:        result.ledgerEntry.date,
    })

    await logActionAs(auth, 'SUPPLIER_DEBT', 'Supplier', id, `${supplier.name} — amount: ${debtAmount}`)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Supplier debt error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدين' }, { status: 500 })
  }
}
