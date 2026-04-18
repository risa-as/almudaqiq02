import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
        const { tenantId, branchId: authBranchId } = auth;

        const { searchParams } = new URL(request.url);
        const queryBranchId = searchParams.get('branchId');
        
        const querySupplierId = searchParams.get('supplierId');
        
        // Use standard branch filtering
        const branchFilter = queryBranchId && queryBranchId !== 'all' 
            ? queryBranchId 
            : authBranchId || undefined;

        const batches = await prisma.productBatch.findMany({
            where: {
                tenantId,
                ...(branchFilter ? { branchId: branchFilter } : {}),
                ...(querySupplierId ? { product: { supplierId: querySupplierId } } : {})
            },
            include: {
                product: {
                    include: {
                        supplier: true,
                        category: true
                    }
                },
                branch: true
            },
            orderBy: [
                { createdAt: 'desc' }
            ]
        });

        // Some minor post-processing to easily map on frontend
        const result = batches.map(batch => ({
            id: batch.id,
            batchNumber: batch.batchNumber || 'N/A',
            productId: batch.productId,
            productName: batch.product.name,
            categoryId: batch.product.categoryId,
            categoryName: batch.product.category?.name || 'غير محدد',
            supplierId: batch.product.supplierId,
            supplierName: batch.product.supplier?.name || 'بدون مورد',
            branchId: batch.branchId,
            branchName: batch.branch.name,
            expiryDate: batch.expiryDate,
            quantity: batch.quantity,
            costPrice: Number(batch.costPrice),
            createdAt: batch.createdAt
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to fetch batches:', error);
        return NextResponse.json({ error: 'حدث خطأ أثناء جلب الدفعات' }, { status: 500 });
    }
}
