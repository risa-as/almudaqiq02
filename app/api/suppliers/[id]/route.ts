import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { enqueueSync } from '@/lib/sync-enqueue'
import { logCloudDelete } from '@/lib/sync-delete-log'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const branchId = request.nextUrl.searchParams.get('branchId')
    const specificBranch = branchId && branchId !== 'all' ? branchId : null

    // رحلتان متتاليتان بلا داعٍ: سجلّ المورد مستقلّ عن التحقق من ملكيته.
    // الحارس 404 يبقى قبل أي استعمال للسجلّ، فلا يُعاد شيء لمستأجر غير مالك.
    const [supplier, ledger] = await Promise.all([
      prisma.supplier.findFirst({ where: { id, tenantId: auth.tenantId } }),
      prisma.supplierLedger.findMany({
        where:   { supplierId: id, ...(specificBranch ? { branchId: specificBranch } : {}) },
        orderBy: { date: 'desc' },
      }),
    ])
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

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
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const exists = await prisma.supplier.findFirst({ where: { id, tenantId: auth.tenantId }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

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

    enqueueSync('suppliers', 'UPDATE', updated.id, {
      id: updated.id, name: updated.name, phone: updated.phone,
      address: updated.address, balance: Number(updated.balance),
      creditLimit: updated.creditLimit ? Number(updated.creditLimit) : null,
      notes: updated.notes,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'فشل تحديث المورد' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { id } = await params

    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: auth.tenantId } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const linkedProducts = await prisma.product.count({ where: { supplierId: id, tenantId: auth.tenantId } })
    if (linkedProducts > 0) {
      return NextResponse.json({
        error: 'لا يمكن حذف المورد لارتباطه بمنتجات في المخزون. يرجى إزالة ارتباطه بالمنتجات أولاً.',
      }, { status: 400 })
    }

    if (Number(supplier.balance) !== 0) {
      return NextResponse.json({
        error: 'لا يمكن حذف مورد يمتلك رصيد معلق. يرجى تصفية الحساب أولاً.',
      }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplierLedger.deleteMany({ where: { supplierId: id } })
      await tx.supplier.delete({ where: { id } })
    })

    enqueueSync('suppliers', 'DELETE', id, { id })
    await logCloudDelete(auth.tenantId, 'suppliers', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}
