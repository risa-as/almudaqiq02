import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-helpers';
import { getTenantPrisma } from '@/lib/multi-tenant/prisma';

export const dynamic = 'force-dynamic';

type AbcClass = 'A' | 'B' | 'C';

/**
 * ABC analysis report (تحليل ABC).
 * From SALE TransactionItems in a date range (default last 90 days) compute
 * per-product revenue and gross profit, rank by revenue, then classify:
 *   A = products making up the first 80% of cumulative revenue
 *   B = the next 15% (80–95%)
 *   C = the last 5%  (95–100%)
 * A product's class is decided by where its revenue window STARTS on the
 * cumulative curve (so the top product is always A, even if it alone exceeds 80%).
 *
 * TransactionItem semantics: `price` is per-unit → revenue = price × quantity;
 * `cost` is the line-total FIFO cost → profit = revenue − cost (no multiplication).
 */
export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { tenantId } = auth;
    const db = getTenantPrisma(tenantId);

    const { searchParams } = request.nextUrl;
    const branchParam = searchParams.get('branchId');
    const branchId = branchParam && branchParam !== 'all' ? branchParam : null;

    if (branchId) {
        const branch = await db.branch.findFirst({ where: { id: branchId }, select: { id: true } });
        if (!branch) return NextResponse.json({ error: 'الفرع غير موجود' }, { status: 400 });
    }

    // Date range — default: last 90 days.
    const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date(Date.now() - 90 * 86400000);
    const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : new Date();
    endDate.setHours(23, 59, 59, 999);

    // TransactionItem has no tenantId — scope through the parent transaction.
    const items = await db.transactionItem.findMany({
        where: {
            transaction: {
                tenantId,
                type: 'SALE',
                date: { gte: startDate, lte: endDate },
                ...(branchId ? { branchId } : {}),
            },
        },
        select: { productId: true, quantity: true, price: true, cost: true },
    });

    // Aggregate per product. price = per-unit → × quantity; cost = line total.
    const agg = new Map<string, { revenue: number; cost: number; quantity: number }>();
    for (const it of items) {
        const qty  = Number(it.quantity);
        const line = agg.get(it.productId) ?? { revenue: 0, cost: 0, quantity: 0 };
        line.revenue  += Number(it.price) * qty;
        line.cost     += Number(it.cost);
        line.quantity += qty;
        agg.set(it.productId, line);
    }

    const productIds = [...agg.keys()];
    const products = productIds.length > 0
        ? await db.product.findMany({
            where:  { id: { in: productIds } }, // tenant-scoped client injects tenantId
            select: { id: true, name: true, category: { select: { name: true } } },
        })
        : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    const totalRevenue = [...agg.values()].reduce((s, v) => s + v.revenue, 0);

    // Rank by revenue desc, then classify by cumulative revenue share.
    const ranked = [...agg.entries()]
        .map(([productId, v]) => ({
            productId,
            name:     productMap.get(productId)?.name ?? 'منتج محذوف',
            category: productMap.get(productId)?.category?.name ?? '—',
            quantity: v.quantity,
            revenue:  v.revenue,
            profit:   v.revenue - v.cost,
        }))
        .sort((a, b) => b.revenue - a.revenue);

    let cumulative = 0;
    const rows = ranked.map((r, idx) => {
        const startShare = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
        cumulative += r.revenue;
        const cumulativePct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
        const abcClass: AbcClass = startShare < 80 ? 'A' : startShare < 95 ? 'B' : 'C';
        return {
            rank: idx + 1,
            ...r,
            sharePct:      totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
            cumulativePct,
            class: abcClass,
        };
    });

    const classes: Record<AbcClass, { count: number; revenue: number; profit: number; revenueShare: number }> = {
        A: { count: 0, revenue: 0, profit: 0, revenueShare: 0 },
        B: { count: 0, revenue: 0, profit: 0, revenueShare: 0 },
        C: { count: 0, revenue: 0, profit: 0, revenueShare: 0 },
    };
    for (const r of rows) {
        classes[r.class].count   += 1;
        classes[r.class].revenue += r.revenue;
        classes[r.class].profit  += r.profit;
    }
    for (const k of ['A', 'B', 'C'] as AbcClass[]) {
        classes[k].revenueShare = totalRevenue > 0 ? (classes[k].revenue / totalRevenue) * 100 : 0;
    }

    return NextResponse.json({
        summary: { totalRevenue, productCount: rows.length, classes },
        products: rows,
    });
}
