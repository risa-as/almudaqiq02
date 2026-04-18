import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

        const { id } = await params;
        const productId = id;

        // Verify the product belongs to this tenant
        const product = await prisma.product.findFirst({
            where: { id: productId, tenantId },
            select: { id: true }
        });

        if (!product) {
            return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
        }

        // Fetch Sales History (TransactionItems)
        const sales = await prisma.transactionItem.findMany({
            where: {
                productId,
                transaction: { tenantId }
            },
            include: {
                transaction: {
                    include: { user: true }
                },
                unit: true
            },
            orderBy: { transaction: { date: 'desc' } }
        });

        // Fetch Stock In History (ProductBatch)
        // Note: Currently ProductBatch doesn't track "Who" added it or exact time beyond CreatedAt.
        const batches = await prisma.productBatch.findMany({
            where: { productId, tenantId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ sales, batches });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
