import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search  = searchParams.get('search')?.trim() || '';
    const page    = Number(searchParams.get('page')) || 1;
    const branchId = searchParams.get('branchId');
    const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};
    const startDate = searchParams.get('startDate');
    const endDate   = searchParams.get('endDate');
    const limit = 20;
    const skip  = (page - 1) * limit;

    // Date range filter (YYYY-MM-DD) — startDate at 00:00, endDate at 23:59:59.999
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000`);
    if (endDate)   dateFilter.lte = new Date(`${endDate}T23:59:59.999`);

    try {
        // Build main where clause
        const whereClause: any = {
            tenantId,
            ...branchFilter,
            type: { in: ['SALE', 'RETURN', 'REFUND'] },
            ...(dateFilter.gte || dateFilter.lte ? { date: dateFilter } : {}),
        };

        // Search by stored receiptNumber (exact match on SALE records)
        if (search) {
            const padded = search.replace(/^0+/, '').padStart(8, '0');
            const matchingSale = await prisma.transaction.findFirst({
                where: { tenantId, type: 'SALE', receiptNumber: padded },
                select: { id: true }
            });
            if (matchingSale) {
                whereClause.id = matchingSale.id;
            } else {
                return NextResponse.json({
                    orders: [],
                    pagination: { total: 0, page, pages: 0 }
                });
            }
        }

        const [orders, total, refundedIds] = await Promise.all([
            prisma.transaction.findMany({
                where: whereClause,
                orderBy: { date: 'desc' },
                take: limit,
                skip,
                include: {
                    user: { select: { username: true } },
                    items: {
                        include: {
                            product: { select: { name: true } },
                            unit:    { select: { name: true } }
                        }
                    }
                },
                // فواتير + مستخدم + بنود + منتج + وحدة: قياسًا ~1377ms ← ~556ms على 45 فاتورة.
                ...RELATION_JOIN
            }),
            prisma.transaction.count({ where: whereClause }),
            prisma.transaction.findMany({
                where: {
                    tenantId,
                    ...branchFilter,
                    type: { in: ['REFUND', 'RETURN'] },
                    originalTxId: { not: null }
                },
                select: {
                    originalTxId: true, totalAmount: true, date: true, type: true,
                    items: { select: { productId: true, unitId: true, quantity: true } }
                }
            })
        ]);

        // Build refund map: saleId → list of refunds
        const refundMap = new Map<string, { totalAmount: number; date: string; type: string }[]>();
        // Per-item returned quantities: saleId → ("productId|unitId" → total returned qty)
        const returnedQtyMap = new Map<string, Map<string, number>>();
        for (const r of refundedIds) {
            if (!r.originalTxId) continue;
            if (!refundMap.has(r.originalTxId)) refundMap.set(r.originalTxId, []);
            refundMap.get(r.originalTxId)!.push({
                totalAmount: Number(r.totalAmount),
                date: r.date.toISOString(),
                type: r.type
            });
            if (!returnedQtyMap.has(r.originalTxId)) returnedQtyMap.set(r.originalTxId, new Map());
            const m = returnedQtyMap.get(r.originalTxId)!;
            for (const it of r.items) {
                const key = `${it.productId}|${it.unitId}`;
                m.set(key, (m.get(key) ?? 0) + Math.abs(Number(it.quantity)));
            }
        }

        const ordersWithReceipt = orders.map(o => {
            const rqMap = returnedQtyMap.get(o.id);
            return {
                ...o,
                // Use stored receiptNumber (permanent) — fallback to id for legacy records
                receiptNumber: o.receiptNumber ?? String(o.id),
                refunds: refundMap.get(o.id) ?? [],
                // Attach how much of each line was already returned so the UI can cap it
                items: o.items.map(it => ({
                    ...it,
                    returnedQuantity: rqMap?.get(`${it.productId}|${it.unitId}`) ?? 0,
                })),
            };
        });

        return NextResponse.json({
            orders: ordersWithReceipt,
            pagination: { total, page, pages: Math.ceil(total / limit) }
        });

    } catch (error) {
        console.error('Orders API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}
