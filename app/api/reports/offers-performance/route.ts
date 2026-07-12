import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-helpers';
import { getTenantPrisma } from '@/lib/multi-tenant/prisma';

export const dynamic = 'force-dynamic';

type OfferStatus = 'ACTIVE' | 'EXPIRED' | 'SCHEDULED' | 'DISABLED';

function offerStatus(o: { isActive: boolean; startDate: Date; endDate: Date | null }, now: Date): OfferStatus {
    if (!o.isActive) return 'DISABLED';
    if (o.endDate && o.endDate.getTime() < now.getTime()) return 'EXPIRED';
    if (o.startDate.getTime() > now.getTime()) return 'SCHEDULED';
    return 'ACTIVE';
}

/**
 * Offers performance report (أداء العروض).
 * Joins offers with SALE transactions that reference them (offerId) inside a
 * date range → usage count, revenue and total discount given per offer.
 * Offers with branchId=null are org-level shared; when a branch is selected we
 * show that branch's offers + shared ones, and count only that branch's sales.
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

    // Date range — default: last 30 days.
    const now = new Date();
    const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date(now.getTime() - 30 * 86400000);
    const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Offers are tenant-scoped automatically; branchId=null = org-level shared.
    const offers = await db.offer.findMany({
        where: branchId ? { OR: [{ branchId: null }, { branchId }] } : {},
        select: {
            id: true, name: true, type: true, value: true,
            startDate: true, endDate: true, isActive: true, branchId: true,
            branch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // groupBy is not intercepted by the tenant extension → scope tenantId explicitly.
    const usage = await db.transaction.groupBy({
        by: ['offerId'],
        where: {
            tenantId,
            type:    'SALE',
            offerId: { not: null },
            date:    { gte: startDate, lte: endDate },
            ...(branchId ? { branchId } : {}),
        },
        _count: { id: true },
        _sum:   { totalAmount: true, discount: true },
    });
    const usageMap = new Map(usage.map(u => [u.offerId as string, u]));

    const rows = offers.map(o => {
        const u = usageMap.get(o.id);
        return {
            id:         o.id,
            name:       o.name,
            type:       o.type,
            value:      Number(o.value),
            branchName: o.branchId ? (o.branch?.name ?? '—') : null, // null = shared org-level
            status:     offerStatus(o, now),
            startDate:  o.startDate.toISOString(),
            endDate:    o.endDate?.toISOString() ?? null,
            usageCount: u?._count.id ?? 0,
            revenue:    Number(u?._sum.totalAmount ?? 0),
            discount:   Number(u?._sum.discount ?? 0),
        };
    }).sort((a, b) => b.usageCount - a.usageCount || b.revenue - a.revenue);

    const summary = {
        totalUsage:    rows.reduce((s, r) => s + r.usageCount, 0),
        totalRevenue:  rows.reduce((s, r) => s + r.revenue, 0),
        totalDiscount: rows.reduce((s, r) => s + r.discount, 0),
        activeCount:   rows.filter(r => r.status === 'ACTIVE').length,
        offerCount:    rows.length,
    };

    return NextResponse.json({ summary, offers: rows });
}
