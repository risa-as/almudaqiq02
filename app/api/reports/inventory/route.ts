import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/multi-tenant/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId     = auth.tenantId;
    const userBranchId = auth.branchId ?? '';

    const { searchParams } = new URL(request.url);
    const branchId    = searchParams.get('branchId') || userBranchId || undefined;
    const useBranch   = branchId && branchId !== 'all';

    try {
        // ── Fetch products (no branchId on Product model) ─────────────
        // ثلاثة استعلامات مستقلّة (المنتجات، دفعات الفرع، الدفعات المنتهية قريبًا)
        // كانت متتالية = ثلاث رحلات (~1.6 ثانية). التاريخ يُحسب محليًا فلا تبعية.
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

        const [products, batches, expiringBatches] = await Promise.all([
            prisma.product.findMany({
                where: { tenantId },
                include: { category: true, supplier: true },
                ...RELATION_JOIN
            }),
            // Batches for the selected branch (or all)
            prisma.productBatch.findMany({
                where: {
                    tenantId,
                    ...(useBranch ? { branchId } : {}),
                    quantity: { gt: 0 }
                },
                include: { product: { include: { category: true } } },
                ...RELATION_JOIN
            }),
            // Expiring batches (≤ 30 days)
            prisma.productBatch.findMany({
                where: {
                    tenantId,
                    ...(useBranch ? { branchId } : {}),
                    expiryDate: { not: null, lte: thirtyDaysFromNow },
                    quantity: { gt: 0 }
                },
                include: { product: { include: { category: true } } },
                orderBy: { expiryDate: 'asc' },
                ...RELATION_JOIN
            }),
        ]);

        // ── Build per-product stock map from batches ───────────────────
        // When a branch is selected, stock = sum of batches for that branch
        // When no branch selected, fall back to product.baseStock (global)
        const batchStockMap = new Map<string, number>();
        for (const b of batches) {
            batchStockMap.set(b.productId, (batchStockMap.get(b.productId) ?? 0) + Number(b.quantity));
        }

        const getStock = (p: any): number =>
            useBranch
                ? (batchStockMap.get(p.id) ?? 0)
                : p.baseStock;

        // ── Expiring batches (≤ 30 days) — تُجلب أعلاه بالتوازي ─────────

        // ── Compute stats using branch-scoped stock ────────────────────
        let totalValuation = 0;
        let totalItems     = 0;
        const valuationByCategory: Record<string, number> = {};

        // Only count products that have stock in this branch
        const activeProducts = useBranch
            ? products.filter(p => (batchStockMap.get(p.id) ?? 0) > 0 || batchStockMap.has(p.id))
            : products;

        for (const p of (useBranch ? products : products)) {
            const stock = getStock(p);
            if (useBranch && stock === 0 && !batchStockMap.has(p.id)) continue;
            const val = Number(p.costPrice) * stock;
            totalValuation += val;
            totalItems     += stock;
            const cat = p.category?.name || 'بدون تصنيف';
            valuationByCategory[cat] = (valuationByCategory[cat] ?? 0) + val;
        }

        // Stock classifications using branch-scoped stock
        const productsWithStock = products.map(p => ({ ...p, branchStock: getStock(p) }));
        // When branch is selected, only show products that exist in that branch's batches
        const scopedProducts = useBranch
            ? productsWithStock.filter(p => batchStockMap.has(p.id) || p.branchStock === 0)
            : productsWithStock;

        const outOfStock   = scopedProducts.filter(p => p.branchStock === 0 && (!useBranch || batchStockMap.has(p.id)));
        const lowStock     = scopedProducts.filter(p => p.branchStock > 0 && p.branchStock <= 5);
        const warningStock = scopedProducts.filter(p => p.branchStock > 5 && p.branchStock <= 20);

        // ── Expiry enrichment ──────────────────────────────────────────
        const enrichedBatches = expiringBatches.map((b: any) => {
            const expiry   = new Date(b.expiryDate);
            const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
            const urgency  = daysLeft <= 0 ? 'expired' : daysLeft <= 7 ? 'critical' : 'warning';
            return {
                id:          b.id,
                batchNumber: b.batchNumber || '—',
                productName: b.product.name,
                category:    b.product.category?.name || '—',
                expiryDate:  b.expiryDate,
                daysLeft,
                urgency,
                quantity:    Number(b.quantity)
            };
        });

        const distribution = Object.entries(valuationByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return NextResponse.json({
            stats: {
                totalValuation,
                totalProducts:    useBranch ? scopedProducts.length : products.length,
                totalItems,
                outOfStockCount:  outOfStock.length,
                lowStockCount:    lowStock.length,
                warningStockCount: warningStock.length,
                expiringCount:    enrichedBatches.length,
                expiredCount:     enrichedBatches.filter((b: any) => b.urgency === 'expired').length,
                criticalCount:    enrichedBatches.filter((b: any) => b.urgency === 'critical').length,
            },
            outOfStock: outOfStock.map(p => ({
                id: p.id, name: p.name,
                supplier: p.supplier?.name || '—',
                category: p.category?.name || '—',
                cost: Number(p.costPrice)
            })),
            lowStockItems: lowStock.map(p => ({
                id: p.id, name: p.name, stock: p.branchStock,
                cost: Number(p.costPrice),
                supplier: p.supplier?.name || '—',
                category: p.category?.name || '—'
            })),
            warningItems: warningStock.map(p => ({
                id: p.id, name: p.name, stock: p.branchStock,
                cost: Number(p.costPrice),
                supplier: p.supplier?.name || '—',
                category: p.category?.name || '—'
            })),
            expiringBatches: enrichedBatches,
            valuationDistribution: distribution
        });

    } catch (error) {
        console.error('Inventory report error:', error);
        return NextResponse.json({ error: 'Failed to fetch inventory report' }, { status: 500 });
    }
}
