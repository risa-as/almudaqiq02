import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const DEFAULT_MIN_STOCK = 10;

export async function GET(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const branchId = searchParams.get('branchId');
        const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        // 1. Aggregate batch stock per product (same logic as /api/products)
        const [batchSums, allProducts, expiringBatches] = await Promise.all([
            prisma.productBatch.groupBy({
                by: ['productId'],
                where: { tenantId, ...branchFilter },
                _sum: { quantity: true },
            }),
            prisma.product.findMany({
                where: { tenantId },
                select: { id: true, name: true, baseStock: true, minimumStock: true },
            }),
            prisma.productBatch.findMany({
                where: {
                    tenantId,
                    ...branchFilter,
                    quantity: { gt: 0 },
                    expiryDate: { lte: thirtyDaysFromNow },
                },
                include: {
                    product: { select: { name: true } },
                },
                take: 10,
            }),
        ]);

        const batchStockMap = new Map(
            batchSums.map(b => [b.productId, b._sum.quantity ?? 0])
        );

        // Use batch sum if available, fall back to product.baseStock for products with no batches
        const lowStock = allProducts
            .map(p => ({
                id: p.id,
                name: p.name,
                minimumStock: p.minimumStock,
                baseStock: batchStockMap.has(p.id)
                    ? (batchStockMap.get(p.id) ?? 0)
                    : p.baseStock,
            }))
            .filter(p => {
                const threshold = p.minimumStock > 0 ? p.minimumStock : DEFAULT_MIN_STOCK;
                return p.baseStock <= threshold;
            })
            .sort((a, b) => a.baseStock - b.baseStock)
            .slice(0, 10);

        return NextResponse.json({ lowStock, expiringBatches });

    } catch (error) {
        console.error('Failed to fetch inventory alerts:', error);
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}
