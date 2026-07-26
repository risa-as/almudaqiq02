import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/multi-tenant/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { tenantId, branchId: authBranchId } = auth;

    const { searchParams } = request.nextUrl;
    const branchId   = searchParams.get('branchId') || authBranchId || undefined;
    const daysAhead  = searchParams.get('days') ?? '30'; // 'expired' | '7'|'14'|'30'|'60'|'90'|'all'
    const categoryId = searchParams.get('categoryId');
    const fromDate   = searchParams.get('fromDate');
    const toDate     = searchParams.get('toDate');
    const useBranchFilter = branchId && branchId !== 'all';

    const now = new Date();

    // Build date filter — custom range takes priority over days preset
    let expiryFilter: any = { not: null };
    if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to   = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        expiryFilter = { gte: from, lte: to };
    } else if (daysAhead === 'expired') {
        expiryFilter = { lt: now };
    } else if (daysAhead !== 'all') {
        const days = parseInt(daysAhead, 10);
        if (!isNaN(days)) {
            expiryFilter = { lte: new Date(now.getTime() + days * 86400000) };
        }
    }

    const batchWhere: any = {
        tenantId,
        expiryDate: expiryFilter,
        quantity: { gt: 0 },
    };
    if (useBranchFilter) batchWhere.branchId = branchId;
    if (categoryId)      batchWhere.product = { categoryId };

    const batches = await prisma.productBatch.findMany({
        where: batchWhere,
        include: {
            product: {
                include: {
                    category: { select: { id: true, name: true } },
                    supplier: { select: { name: true } },
                },
            },
            branch: { select: { name: true } },
        },
        orderBy: { expiryDate: 'asc' },
        // دفعات + منتج + قسم + مورد + فرع: قياسًا ~1371ms ← ~524ms.
        ...RELATION_JOIN,
    });

    // Enrich each batch
    const rows = batches.map(b => {
        const expiry   = b.expiryDate ? new Date(b.expiryDate) : null;
        const daysLeft = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;
        const urgency  = daysLeft === null ? 'none'
            : daysLeft < 0   ? 'expired'
            : daysLeft <= 7  ? 'critical'
            : daysLeft <= 30 ? 'warning'
            : 'ok';

        const qty       = Number(b.quantity);
        const costPrice = Number(b.costPrice);

        return {
            id:          b.id,
            batchNumber: b.batchNumber ?? '—',
            productId:   b.productId,
            productName: b.product.name,
            categoryId:  b.product.category?.id ?? null,
            category:    b.product.category?.name ?? '—',
            supplier:    b.product.supplier?.name ?? null,
            branchName:  b.branch?.name ?? '—',
            expiryDate:  b.expiryDate?.toISOString() ?? null,
            daysLeft,
            urgency,
            quantity:    qty,
            costPrice,
            totalValue:  qty * costPrice,
        };
    });

    // Always compute full summary stats (across all horizons)
    const allExpiry = await prisma.productBatch.findMany({
        where: {
            tenantId,
            expiryDate: { not: null },
            quantity: { gt: 0 },
            ...(useBranchFilter ? { branchId } : {}),
        },
        select: { expiryDate: true, quantity: true, costPrice: true },
    });

    let expiredCount = 0, criticalCount = 0, warningCount = 0, okCount = 0;
    let totalValueAtRisk = 0;

    for (const b of allExpiry) {
        const dl = b.expiryDate
            ? Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / 86400000)
            : null;
        const val = Number(b.quantity) * Number(b.costPrice);
        if (dl === null) continue;
        if (dl < 0)   { expiredCount++;  totalValueAtRisk += val; }
        else if (dl <= 7)  { criticalCount++; totalValueAtRisk += val; }
        else if (dl <= 30) { warningCount++; }
        else               { okCount++; }
    }

    // Extract unique categories from returned rows for client-side filter
    const categories = Array.from(
        new Map(rows.filter(r => r.categoryId).map(r => [r.categoryId, r.category])).entries()
    ).map(([id, name]) => ({ id, name }));

    return NextResponse.json({
        batches: rows,
        stats: {
            total:       rows.length,
            expiredCount,
            criticalCount,
            warningCount,
            okCount,
            totalValueAtRisk,
        },
        categories,
    });
}
