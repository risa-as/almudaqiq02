import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { amount, description, type, branchId } = body;

        if (!id || isNaN(Number(amount)) || Number(amount) <= 0) {
            return NextResponse.json({ error: 'بيانات التسديد غير صالحة' }, { status: 400 });
        }

        const supplier = await prisma.supplier.findUnique({ where: { id } });
        if (!supplier) {
            return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
        }

        const paymentAmount = Number(amount);

        const result = await prisma.$transaction(async (tx) => {
            // Both PAYMENT and RETURN decrease the balance (debit supplier account)
            const transactionType = type === 'RETURN' ? 'RETURN' : 'PAYMENT';
            const defaultDesc = transactionType === 'RETURN' ? 'مرتجع مشتريات' : 'تسديد دفعة للمورد المستحق';

            const ledgerEntry = await tx.supplierLedger.create({
                data: {
                    supplierId: id,
                    branchId: branchId && branchId !== 'all' ? branchId : null,
                    type: transactionType,
                    amount: paymentAmount,
                    description: description || defaultDesc,
                }
            });

            const updatedSupplier = await tx.supplier.update({
                where: { id },
                data: { balance: { decrement: paymentAmount } }
            });

            return { ledgerEntry, updatedSupplier };
        });

        return NextResponse.json({ success: true, message: 'تم تسجيل الدفعة بنجاح', data: result });

    } catch (error) {
        console.error('Supplier payment error:', error);
        return NextResponse.json({ error: 'حدث خطأ أثناء محاولة تسجيل التسديد' }, { status: 500 });
    }
}
