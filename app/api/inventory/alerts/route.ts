import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { readBranchFilter } from '@/lib/branch-scope';

export const dynamic = 'force-dynamic';

const DEFAULT_MIN_STOCK = 10;

export async function GET(req: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    try {
        const { searchParams } = new URL(req.url);
        const branchFilter = readBranchFilter(auth, searchParams.get('branchId'));
        // full=1 → the complete low-stock list instead of the 10-row dashboard
        // preview. The full list is computed in memory below either way, so this
        // costs nothing extra; only the trailing slice is skipped.
        const full = searchParams.get('full') === '1';

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

        // Use the batch sum. Only the all-branches view may fall back to
        // product.baseStock (legacy products without batches): baseStock is the
        // total over every branch, so in a branch view "no batches here" means 0.
        const isBranchView = 'branchId' in branchFilter;
        const lowStockAll = allProducts
            .map(p => ({
                id: p.id,
                name: p.name,
                minimumStock: p.minimumStock,
                baseStock: batchStockMap.has(p.id)
                    ? (batchStockMap.get(p.id) ?? 0)
                    : (isBranchView ? 0 : p.baseStock),
            }))
            .filter(p => {
                const threshold = p.minimumStock > 0 ? p.minimumStock : DEFAULT_MIN_STOCK;
                return p.baseStock <= threshold;
            })
            .sort((a, b) => a.baseStock - b.baseStock);

        // counts is always the true total — the preview badge must not report the
        // truncated length as if it were the whole picture.
        return NextResponse.json({
            lowStock: full ? lowStockAll : lowStockAll.slice(0, 10),
            expiringBatches,
            counts: { lowStock: lowStockAll.length },
        });

    } catch (error) {
        console.error('Failed to fetch inventory alerts:', error);
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}
