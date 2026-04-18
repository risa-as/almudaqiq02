import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const branchId = searchParams.get('branchId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

    try {
        // Fetch Additions (ProductBatch)
        const batchWhere: any = { tenantId, ...branchFilter };
        if (productId) batchWhere.productId = productId;
        const batches = await prisma.productBatch.findMany({
            where: batchWhere,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { product: { select: { name: true } } }
        }) as any[];

        // Fetch Deductions (TransactionItems) scoped via transaction.tenantId + branchId
        const txItemWhere: any = {
            transaction: { tenantId, ...branchFilter }
        };
        if (productId) txItemWhere.productId = productId;
        const txItems = await prisma.transactionItem.findMany({
            where: txItemWhere,
            orderBy: { transaction: { date: 'desc' } },
            take: limit,
            include: {
                product: { select: { name: true } },
                transaction: { select: { date: true, type: true, id: true, user: { select: { username: true } } } }
            }
        }) as any[];

        // Unify them into a single timeline
        const movement: any[] = [];

        batches.forEach((b: any) => {
            movement.push({
                id: `batch-${b.id}`,
                date: b.createdAt.toISOString(),
                productName: b.product.name,
                productId: b.productId,
                type: 'IN',
                quantity: b.quantity,
                reference: `توريد / دفعة #${b.batchNumber || b.id}`,
                user: 'النظام/المدير'
            });
        });

        txItems.forEach((t: any) => {
            const isReturn = t.transaction.type === 'RETURN' || t.transaction.type === 'REFUND';
            movement.push({
                id: `tx-${t.id}`,
                date: t.transaction.date.toISOString(),
                productName: t.product.name,
                productId: t.productId,
                type: isReturn ? 'IN' : 'OUT',
                quantity: Number(t.quantity),
                reference: isReturn ? `مرتجع / فاتورة #${t.transaction.id}` : `مبيعات / فاتورة #${t.transaction.id}`,
                user: t.transaction.user?.username || 'كاشير'
            });
        });

        // Sort by date descending
        movement.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(movement.slice(0, limit));
    } catch (error) {
        console.error('Failed to fetch stock movement:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
