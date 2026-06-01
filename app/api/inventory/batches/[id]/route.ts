import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
        const { tenantId } = auth;

        const { id } = await params;
        const body = await request.json();
        const { batchNumber, expiryDate, quantity, costPrice } = body;

        // Verify the batch belongs to this tenant
        const existing = await prisma.productBatch.findFirst({
            where: { id, tenantId }
        });
        if (!existing) return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });

        // Capture quantity delta so we can keep product.baseStock consistent
        const newQty = quantity !== undefined ? Number(quantity) : Number(existing.quantity);
        const delta  = newQty - Number(existing.quantity);

        const updated = await prisma.$transaction(async (tx) => {
            const batch = await tx.productBatch.update({
                where: { id },
                data: {
                    ...(batchNumber !== undefined && { batchNumber }),
                    ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
                    ...(quantity !== undefined && { quantity: newQty }),
                    ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
                },
                include: {
                    product: { include: { supplier: true, category: true } },
                    branch: true
                }
            });

            if (delta !== 0) {
                await tx.product.update({
                    where: { id: existing.productId },
                    data:  { baseStock: { increment: delta } },
                });
            }

            return batch;
        });

        // Sync the batch edit — push handler recomputes the delta and adjusts baseStock
        enqueueSync('productBatches', 'UPDATE', id, {
            id,
            ...(batchNumber !== undefined ? { batchNumber } : {}),
            ...(expiryDate  !== undefined ? { expiryDate } : {}),
            ...(quantity    !== undefined ? { quantity: newQty } : {}),
            ...(costPrice   !== undefined ? { costPrice: Number(costPrice) } : {}),
        });

        return NextResponse.json({
            id: updated.id,
            batchNumber: updated.batchNumber || 'N/A',
            productId: updated.productId,
            productName: updated.product.name,
            categoryId: updated.product.categoryId,
            categoryName: updated.product.category?.name || 'غير محدد',
            supplierId: updated.product.supplierId,
            supplierName: updated.product.supplier?.name || 'بدون مورد',
            branchId: updated.branchId,
            branchName: updated.branch.name,
            expiryDate: updated.expiryDate,
            quantity: updated.quantity,
            costPrice: Number(updated.costPrice),
            createdAt: updated.createdAt
        });
    } catch (error) {
        console.error('Failed to update batch:', error);
        return NextResponse.json({ error: 'حدث خطأ أثناء تعديل الدفعة' }, { status: 500 });
    }
}
