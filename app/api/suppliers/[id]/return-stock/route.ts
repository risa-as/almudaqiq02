import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

        const { id: supplierId } = await params;
        const body = await request.json();
        const { batchId, quantity, returnAmount, description, branchId } = body;

        const returnQty = Number(quantity);
        const amount = Number(returnAmount);

        if (!supplierId || !batchId || isNaN(returnQty) || returnQty <= 0 || isNaN(amount) || amount < 0) {
            return NextResponse.json({ error: 'بيانات المرتجع غير صالحة' }, { status: 400 });
        }

        const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: auth.tenantId } });
        if (!supplier) {
            return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
        }

        const batch = await prisma.productBatch.findFirst({
            where: { id: batchId, tenantId: auth.tenantId },
            include: { product: true }
        });

        if (!batch) {
            return NextResponse.json({ error: 'لم يتم العثور على الدفعة المحددة' }, { status: 404 });
        }

        if (batch.quantity < returnQty) {
            return NextResponse.json({
                error: `الكمية المطلوبة (${returnQty}) تتجاوز المتوفر في الدفعة (${batch.quantity})`
            }, { status: 400 });
        }

        const batchDesc = description
            || `مرتجع بضاعة - ${batch.product.name} (تشغيلة: ${batch.batchNumber || 'بدون'}) بكمية ${returnQty}`;

        const result = await prisma.$transaction(async (tx) => {
            const updatedBatch = await tx.productBatch.update({
                where: { id: batchId },
                data: { quantity: { decrement: returnQty } }
            });

            // Also decrement product.baseStock so totals stay correct
            await tx.product.update({
                where: { id: batch.productId },
                data:  { baseStock: { decrement: returnQty } },
            });

            const ledgerEntry = await tx.supplierLedger.create({
                data: {
                    supplierId,
                    branchId: branchId && branchId !== 'all' ? branchId : null,
                    type: 'RETURN',
                    amount: amount,
                    description: batchDesc,
                }
            });

            await tx.supplier.update({
                where: { id: supplierId },
                data: { balance: { decrement: amount } }
            });

            await tx.auditLog.create({
                data: {
                    tenantId: auth.tenantId,
                    branchId: auth.branchId || null,
                    userId: auth.userId,
                    action: 'PURCHASE_RETURN',
                    entity: 'Supplier',
                    entityId: supplierId,
                    details: JSON.stringify({ batchId, productId: batch.productId, quantity: returnQty, amount })
                }
            });

            return { updatedBatch, ledgerEntry };
        });

        // Sync ledger entry (cloud derives supplier.balance from type=RETURN)
        enqueueSync('supplierLedger', 'INSERT', result.ledgerEntry.id, {
            id:          result.ledgerEntry.id,
            supplierId:  result.ledgerEntry.supplierId,
            branchId:    result.ledgerEntry.branchId,
            type:        result.ledgerEntry.type,
            amount:      Number(result.ledgerEntry.amount),
            description: result.ledgerEntry.description,
            date:        result.ledgerEntry.date,
        });

        // Sync the batch quantity change (cloud computes delta and adjusts product.baseStock)
        enqueueSync('productBatches', 'UPDATE', batchId, {
            id:       batchId,
            quantity: result.updatedBatch.quantity,
        });

        return NextResponse.json({ success: true, message: 'تم تسجيل المرتجع وخصم المخزون بنجاح' });

    } catch (error) {
        console.error('Supplier return error:', error);
        return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل المرتجع' }, { status: 500 });
    }
}
