import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

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
            ],
            // دفعات + منتج + مورد + قسم + فرع: قياسًا ~1486ms ← ~746ms على 149 دفعة.
            ...RELATION_JOIN
        });

        // Build per-product sequential counters for auto-numbering null/INITIAL batches
        const productSeq = new Map<string, number>();

        // Some minor post-processing to easily map on frontend
        const result = batches.map(batch => {
            let batchNumber = batch.batchNumber;
            if (!batchNumber || batchNumber === 'INITIAL') {
                const seq = (productSeq.get(batch.productId) ?? 0) + 1;
                productSeq.set(batch.productId, seq);
                const d = new Date(batch.createdAt);
                const yy = String(d.getFullYear()).slice(2);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                batchNumber = `B${yy}${mm}${dd}-${String(seq).padStart(2, '0')}`;
            }
            return {
            id: batch.id,
            batchNumber,
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
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to fetch batches:', error);
        return NextResponse.json({ error: 'حدث خطأ أثناء جلب الدفعات' }, { status: 500 });
    }
}
