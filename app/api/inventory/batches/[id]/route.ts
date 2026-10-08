import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { canManageStock } from '@/lib/auth';
import { pinnedBranchId } from '@/lib/branch-scope';
import { logActionAs } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
        if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        const { tenantId } = auth;
        const pinned = pinnedBranchId(auth);

        const { id } = await params;
        const body = await request.json();
        const { batchNumber, expiryDate, quantity, costPrice } = body;

        // Verify the batch belongs to this tenant
        // Staff may only edit batches of their own branch.
        const existing = await prisma.productBatch.findFirst({
            where: { id, tenantId, ...(pinned ? { branchId: pinned } : {}) }
        });
        if (!existing) return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
        if (quantity !== undefined && (!Number.isInteger(Number(quantity)) || Number(quantity) < 0)) {
            return NextResponse.json({ error: 'الكمية يجب أن تكون عددًا صحيحًا ≥ 0' }, { status: 400 });
        }
        if (costPrice !== undefined && !(Number(costPrice) >= 0)) {
            return NextResponse.json({ error: 'سعر التكلفة غير صالح' }, { status: 400 });
        }

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

        // A manual stock correction is exactly what an audit trail is for.
        if (delta !== 0 || (costPrice !== undefined && Number(costPrice) !== Number(existing.costPrice))) {
            await logActionAs(auth, 'EDIT_BATCH', 'ProductBatch', id, JSON.stringify({
                product: updated.product.name,
                ...(delta !== 0 ? { quantity: `${Number(existing.quantity)} → ${newQty}` } : {}),
                ...(costPrice !== undefined ? { costPrice: `${Number(existing.costPrice)} → ${Number(costPrice)}` } : {}),
            }));
        }

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
