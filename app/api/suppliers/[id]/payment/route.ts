import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logActionAs } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

        const { id } = await params;
        const body = await request.json();
        const { amount, description, type, branchId } = body;

        if (!id || isNaN(Number(amount)) || Number(amount) <= 0) {
            return NextResponse.json({ error: 'بيانات التسديد غير صالحة' }, { status: 400 });
        }

        const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: auth.tenantId } });
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

        // Sync the ledger entry — the push handler will derive the supplier balance
        // change from the entry type (PAYMENT / RETURN both decrement the balance).
        enqueueSync('supplierLedger', 'INSERT', result.ledgerEntry.id, {
            id:          result.ledgerEntry.id,
            supplierId:  result.ledgerEntry.supplierId,
            branchId:    result.ledgerEntry.branchId,
            type:        result.ledgerEntry.type,
            amount:      Number(result.ledgerEntry.amount),
            description: result.ledgerEntry.description,
            date:        result.ledgerEntry.date,
        });

        await logActionAs(auth, result.ledgerEntry.type === 'RETURN' ? 'SUPPLIER_RETURN' : 'SUPPLIER_PAYMENT',
            'Supplier', id, `${supplier.name} — amount: ${paymentAmount}`);

        return NextResponse.json({ success: true, message: 'تم تسجيل الدفعة بنجاح', data: result });

    } catch (error) {
        console.error('Supplier payment error:', error);
        return NextResponse.json({ error: 'حدث خطأ أثناء محاولة تسجيل التسديد' }, { status: 500 });
    }
}
