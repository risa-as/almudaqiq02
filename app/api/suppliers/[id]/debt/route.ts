import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { amount, description, branchId } = body

    if (!id || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })
    }

    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    const debtAmount = Number(amount)

    const result = await prisma.$transaction(async (tx) => {
      const ledgerEntry = await tx.supplierLedger.create({
        data: {
          supplierId: id,
          branchId: branchId && branchId !== 'all' ? branchId : null,
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

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Supplier debt error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدين' }, { status: 500 })
  }
}
