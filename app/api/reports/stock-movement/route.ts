import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';
import { guardFeature } from '@/lib/plan-features';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const blocked = await guardFeature('stock_movement'); if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const productId  = searchParams.get('productId');
    const branchId   = searchParams.get('branchId');
    const typeFilter = searchParams.get('type'); // 'IN' | 'OUT' | null
    const period     = searchParams.get('period') || 'month';
    const limit      = parseInt(searchParams.get('limit') || '200', 10);
    const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

    const now   = new Date();
    let dateFrom: Date | undefined;
    if (period === 'today') { dateFrom = new Date(now); dateFrom.setHours(0,0,0,0); }
    else if (period === 'week')  { dateFrom = new Date(now.getTime() - 7 * 86400000); }
    else if (period === 'month') { dateFrom = new Date(now.getTime() - 30 * 86400000); }

    try {
        const batchWhere: any = { tenantId, ...branchFilter };
        if (productId) batchWhere.productId = productId;
        if (dateFrom)  batchWhere.createdAt = { gte: dateFrom };

        const txItemWhere: any = { transaction: { tenantId, type: { in: ['SALE','RETURN','REFUND'] }, ...branchFilter } };
        if (productId) txItemWhere.productId = productId;
        if (dateFrom)  txItemWhere.transaction = { ...txItemWhere.transaction, date: { gte: dateFrom } };

        const transferWhere: any = { tenantId, status: 'COMPLETED' };
        if (branchId && branchId !== 'all') {
            transferWhere.OR = [{ fromBranchId: branchId }, { toBranchId: branchId }];
        }
        if (dateFrom) transferWhere.createdAt = { gte: dateFrom };

        const [batches, txItems, transfers] = await Promise.all([
            typeFilter === 'OUT' ? Promise.resolve([]) : prisma.productBatch.findMany({
                where: batchWhere,
                orderBy: { createdAt: 'desc' },
                take: limit,
                include: {
                    product: {
                        select: {
                            name: true,
                            category: { select: { name: true } },
                            supplier: { select: { name: true } },
                        }
                    }
                }
            }) as any,
            typeFilter === 'IN' ? Promise.resolve([]) : prisma.transactionItem.findMany({
                where: txItemWhere,
                orderBy: { transaction: { date: 'desc' } },
                take: limit,
                include: {
                    product: { select: { name: true, category: { select: { name: true } } } },
                    transaction: { select: { date: true, type: true, id: true, user: { select: { username: true } } } }
                }
            }) as any,
            prisma.stockTransfer.findMany({
                where: transferWhere,
                orderBy: { createdAt: 'desc' },
                take: 100,
                include: {
                    fromBranch: { select: { name: true } },
                    toBranch:   { select: { name: true } },
                }
            }) as any,
        ]);

        const movement: any[] = [];

        for (const b of batches) {
            movement.push({
                id:          `batch-${b.id}`,
                date:        b.createdAt.toISOString(),
                productName: b.product.name,
                category:    b.product.category?.name || '—',
                productId:   b.productId,
                type:        'IN',
                subtype:     'purchase',
                quantity:    Number(b.quantity),
                reference:   b.batchNumber || b.id.slice(-6),
                user:        'النظام/المدير',
                supplier:    b.product.supplier?.name || null,
            });
        }

        for (const t of txItems) {
            const isReturn = t.transaction.type === 'RETURN' || t.transaction.type === 'REFUND';
            movement.push({
                id:          `tx-${t.id}`,
                date:        t.transaction.date.toISOString(),
                productName: t.product.name,
                category:    t.product.category?.name || '—',
                productId:   t.productId,
                type:        isReturn ? 'IN' : 'OUT',
                subtype:     isReturn ? 'return' : 'sale',
                quantity:    Number(t.quantity),
                reference:   t.transaction.id.slice(-8).toUpperCase(),
                user:        t.transaction.user?.username || 'كاشير',
                supplier:    null,
            });
        }

        // Expand StockTransfer items
        const productIds = new Set<string>();
        for (const tr of transfers) {
            try {
                const items = JSON.parse(tr.items) as { productId: string; quantity: number }[];
                items.forEach(i => productIds.add(i.productId));
            } catch { /* skip malformed */ }
        }

        const productNames = productIds.size > 0
            ? await prisma.product.findMany({
                where: { id: { in: Array.from(productIds) } },
                select: { id: true, name: true, category: { select: { name: true } } }
            })
            : [];
        const prodMap = new Map(productNames.map(p => [p.id, p]));

        for (const tr of transfers) {
            let items: { productId: string; quantity: number }[] = [];
            try { items = JSON.parse(tr.items); } catch { continue; }
            for (const item of items) {
                const prod = prodMap.get(item.productId);
                const isIn  = !branchId || branchId === 'all' || tr.toBranchId   === branchId;
                const isOut = !branchId || branchId === 'all' || tr.fromBranchId === branchId;
                if (branchId && branchId !== 'all') {
                    if (tr.toBranchId === branchId && typeFilter !== 'OUT') {
                        movement.push({
                            id:          `tr-in-${tr.id}-${item.productId}`,
                            date:        tr.createdAt.toISOString(),
                            productName: prod?.name ?? item.productId,
                            category:    prod?.category?.name ?? '—',
                            productId:   item.productId,
                            type:        'IN',
                            subtype:     'transfer',
                            quantity:    item.quantity,
                            reference:   `تحويل من ${tr.fromBranch.name}`,
                            user:        '—',
                            supplier:    null,
                        });
                    } else if (tr.fromBranchId === branchId && typeFilter !== 'IN') {
                        movement.push({
                            id:          `tr-out-${tr.id}-${item.productId}`,
                            date:        tr.createdAt.toISOString(),
                            productName: prod?.name ?? item.productId,
                            category:    prod?.category?.name ?? '—',
                            productId:   item.productId,
                            type:        'OUT',
                            subtype:     'transfer',
                            quantity:    item.quantity,
                            reference:   `تحويل إلى ${tr.toBranch.name}`,
                            user:        '—',
                            supplier:    null,
                        });
                    }
                } else {
                    // All branches — show both IN and OUT entries
                    if (typeFilter !== 'OUT') {
                        movement.push({
                            id:          `tr-in-${tr.id}-${item.productId}`,
                            date:        tr.createdAt.toISOString(),
                            productName: prod?.name ?? item.productId,
                            category:    prod?.category?.name ?? '—',
                            productId:   item.productId,
                            type:        'IN',
                            subtype:     'transfer',
                            quantity:    item.quantity,
                            reference:   `${tr.fromBranch.name} ← ${tr.toBranch.name}`,
                            user:        '—',
                            supplier:    null,
                        });
                    }
                    if (typeFilter !== 'IN') {
                        movement.push({
                            id:          `tr-out-${tr.id}-${item.productId}`,
                            date:        tr.createdAt.toISOString(),
                            productName: prod?.name ?? item.productId,
                            category:    prod?.category?.name ?? '—',
                            productId:   item.productId,
                            type:        'OUT',
                            subtype:     'transfer',
                            quantity:    item.quantity,
                            reference:   `${tr.fromBranch.name} → ${tr.toBranch.name}`,
                            user:        '—',
                            supplier:    null,
                        });
                    }
                }
            }
        }

        movement.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const sliced = movement.slice(0, limit);

        const totalIn  = sliced.filter(m => m.type === 'IN').reduce((s, m) => s + m.quantity, 0);
        const totalOut = sliced.filter(m => m.type === 'OUT').reduce((s, m) => s + m.quantity, 0);

        const prodActivity = new Map<string, { name: string; category: string; in: number; out: number }>();
        for (const m of sliced) {
            if (!prodActivity.has(m.productId)) prodActivity.set(m.productId, { name: m.productName, category: m.category, in: 0, out: 0 });
            const p = prodActivity.get(m.productId)!;
            if (m.type === 'IN') p.in += m.quantity; else p.out += m.quantity;
        }
        const topProducts = [...prodActivity.values()]
            .sort((a, b) => (b.in + b.out) - (a.in + a.out))
            .slice(0, 5);

        return NextResponse.json({ movements: sliced, stats: { totalIn, totalOut, net: totalIn - totalOut, count: sliced.length }, topProducts });
    } catch (error) {
        console.error('Failed to fetch stock movement:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
