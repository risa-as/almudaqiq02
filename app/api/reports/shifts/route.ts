import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit    = parseInt(searchParams.get('limit') || '100', 10);
    const branchId = searchParams.get('branchId');
    const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

    try {
        const shifts = await (prisma as any).cashierShift.findMany({
            where: { tenantId, ...branchFilter },
            orderBy: { openedAt: 'desc' },
            take: limit,
            include: {
                user:   { select: { username: true } },
                branch: { select: { name: true } }
            }
        });

        // Transaction has no shiftId — match by userId + time window per shift
        // Fetch all relevant transactions in one query (within earliest openedAt to now)
        const userIds = [...new Set<string>(shifts.map((s: any) => s.userId).filter(Boolean))];
        const earliest = shifts.reduce((min: Date, s: any) => new Date(s.openedAt) < min ? new Date(s.openedAt) : min, new Date());

        const txs = await (prisma as any).transaction.findMany({
            where: {
                tenantId,
                userId: { in: userIds },
                date:   { gte: earliest },
                type:   { in: ['SALE', 'REFUND', 'RETURN'] }
            },
            select: { userId: true, date: true, type: true, paymentMethod: true, totalAmount: true, paidAmount: true }
        });

        // Aggregate: for each tx find its shift by userId + date inside [openedAt, closedAt)
        const agg = new Map<string, { cashSales: number; cardSales: number; creditSales: number; totalSales: number; txCount: number; refunds: number }>();
        for (const tx of txs) {
            const txDate = new Date(tx.date).getTime();
            const shift  = shifts.find((s: any) =>
                s.userId === tx.userId &&
                txDate >= new Date(s.openedAt).getTime() &&
                (!s.closedAt || txDate <= new Date(s.closedAt).getTime())
            );
            if (!shift) continue;
            if (!agg.has(shift.id)) agg.set(shift.id, { cashSales: 0, cardSales: 0, creditSales: 0, totalSales: 0, txCount: 0, refunds: 0 });
            const a = agg.get(shift.id)!;
            const amt = Number(tx.totalAmount ?? 0);
            if (tx.type === 'SALE') {
                a.totalSales += amt;
                a.txCount    += 1;
                if (tx.paymentMethod === 'CASH')        a.cashSales   += amt;
                else if (tx.paymentMethod === 'CARD')   a.cardSales   += amt;
                else if (tx.paymentMethod === 'CREDIT') a.creditSales += amt;
            } else {
                // REFUND stores +amount, legacy RETURN stores -amount — normalise to positive
                a.refunds += tx.type === 'REFUND' ? amt : -amt;
            }
        }

        const result = shifts.map((s: any) => ({
            ...s,
            branchName: s.branch?.name ?? '—',
            ...(agg.get(s.id) ?? { cashSales: 0, cardSales: 0, creditSales: 0, totalSales: 0, txCount: 0, refunds: 0 })
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to fetch shifts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
