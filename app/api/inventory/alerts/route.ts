import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const branchId = searchParams.get('branchId');
        const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        // 1. Low Stock Products
        const lowStock = await prisma.product.findMany({
            where: {
                tenantId,
                baseStock: { lte: 10 }
            },
            select: {
                id: true,
                name: true,
                baseStock: true
            },
            take: 10
        });

        // 2. Expiring or Expired Batches
        const expiringBatches = await prisma.productBatch.findMany({
            where: {
                tenantId,
                ...branchFilter,
                quantity: { gt: 0 },
                expiryDate: { lte: thirtyDaysFromNow }
            },
            include: {
                product: { select: { name: true } }
            },
            take: 10
        });

        return NextResponse.json({
            lowStock,
            expiringBatches
        });

    } catch (error) {
        console.error('Failed to fetch inventory alerts:', error);
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}
