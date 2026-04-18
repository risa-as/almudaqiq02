import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const branchId = request.nextUrl.searchParams.get('branchId')
    const specificBranch = branchId && branchId !== 'all' ? branchId : null

    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const ledger = await prisma.supplierLedger.findMany({
      where:   { supplierId: id, ...(specificBranch ? { branchId: specificBranch } : {}) },
      orderBy: { date: 'desc' },
    })

    // Compute branch-scoped balance from ledger
    const branchBalance = ledger.reduce((acc, e) =>
      acc + (e.type === 'PURCHASE' ? Number(e.amount) : -Number(e.amount)), 0)

    return NextResponse.json({
      supplier: {
        ...supplier,
        balance: specificBranch ? branchBalance : Number(supplier.balance),
      },
      ledger,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, phone, address, balance, creditLimit, notes } = body

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        phone:   phone   || undefined,
        address: address || undefined,
        balance: balance !== undefined ? Number(balance) : undefined,
        creditLimit: creditLimit !== undefined ? (creditLimit ? Number(creditLimit) : null) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'فشل تحديث المورد' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const linkedProducts = await prisma.product.count({ where: { supplierId: id } })
    if (linkedProducts > 0) {
      return NextResponse.json({
        error: 'لا يمكن حذف المورد لارتباطه بمنتجات في المخزون. يرجى إزالة ارتباطه بالمنتجات أولاً.',
      }, { status: 400 })
    }

    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    if (Number(supplier.balance) !== 0) {
      return NextResponse.json({
        error: 'لا يمكن حذف مورد يمتلك رصيد معلق. يرجى تصفية الحساب أولاً.',
      }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplierLedger.deleteMany({ where: { supplierId: id } })
      await tx.supplier.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}
