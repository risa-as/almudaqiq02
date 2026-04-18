import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
        const { tenantId } = auth;

        const body = await request.json();
        const { batchNumber, expiryDate, quantity, costPrice } = body;

        // Verify the batch belongs to this tenant
        const existing = await prisma.productBatch.findFirst({
            where: { id: params.id, tenantId }
        });
        if (!existing) return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });

        const updated = await prisma.productBatch.update({
            where: { id: params.id },
            data: {
                ...(batchNumber !== undefined && { batchNumber }),
                ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
                ...(quantity !== undefined && { quantity: Number(quantity) }),
                ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
            },
            include: {
                product: { include: { supplier: true, category: true } },
                branch: true
            }
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
