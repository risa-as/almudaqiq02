import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = Number(searchParams.get('page')) || 1;
    const branchId = searchParams.get('branchId');
    const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};
    const limit = 20;
    const skip = (page - 1) * limit;

    try {
        const whereClause: any = {
            tenantId,
            ...branchFilter,
            type: { in: ['SALE', 'RETURN', 'REFUND'] },
        };

        if (search) {
            // Search by ID (if number)
            if (!isNaN(Number(search))) {
                whereClause.id = Number(search);
            }
        }

        const [orders, total, allIds, refundedIds] = await Promise.all([
            prisma.transaction.findMany({
                where: whereClause,
                orderBy: { date: 'desc' },
                take: limit,
                skip: skip,
                include: {
                    user: { select: { username: true } },
                    items: {
                        include: {
                            product: { select: { name: true } },
                            unit: { select: { name: true } }
                        }
                    }
                }
            }),
            prisma.transaction.count({ where: whereClause }),
            prisma.transaction.findMany({
                where: { tenantId, ...branchFilter },
                orderBy: { date: 'asc' },
                select: { id: true }
            }),
            // Get all originalTxIds that have refund/return transactions
            prisma.transaction.findMany({
                where: { tenantId, ...branchFilter, type: { in: ['REFUND', 'RETURN'] }, originalTxId: { not: null } },
                select: { originalTxId: true, totalAmount: true, date: true, type: true }
            })
        ]);

        const receiptMap = new Map(allIds.map((tx, idx) => [tx.id, String(idx + 1).padStart(8, '0')]));

        // Build a map: saleId -> list of refunds
        const refundMap = new Map<string, { totalAmount: number; date: string; type: string }[]>();
        for (const r of refundedIds) {
            if (!r.originalTxId) continue;
            if (!refundMap.has(r.originalTxId)) refundMap.set(r.originalTxId, []);
            refundMap.get(r.originalTxId)!.push({ totalAmount: Number(r.totalAmount), date: r.date.toISOString(), type: r.type });
        }

        const ordersWithReceipt = orders.map(o => ({
            ...o,
            receiptNumber: receiptMap.get(o.id) || o.id,
            refunds: refundMap.get(o.id) || []
        }));

        return NextResponse.json({
            orders: ordersWithReceipt,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Orders API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}
