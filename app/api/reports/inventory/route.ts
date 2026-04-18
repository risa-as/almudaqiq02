import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/multi-tenant/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = request.headers.get('x-tenant-id') ?? ''
    const userBranchId = request.headers.get('x-branch-id') ?? ''
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || userBranchId || undefined;
    const branchFilter = branchId ? { branchId } : {}

    try {
        const products = await prisma.product.findMany({
            where: { tenantId },
            include: {
                category: true,
                supplier: true
            }
        });

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const expiringBatches = await prisma.productBatch.findMany({
            where: {
                tenantId,
                ...branchFilter,
                expiryDate: { lte: thirtyDaysFromNow },
                quantity: { gt: 0 }
            },
            include: { product: true },
            orderBy: { expiryDate: 'asc' }
        });

        // Calculate Valuation
        let totalValuation = 0;
        let totalItems = 0;

        products.forEach(p => {
            totalValuation += Number(p.costPrice) * p.baseStock;
            totalItems += p.baseStock;
        });

        // Filter Low Stock
        const lowStockItems = products.filter(p => p.baseStock <= 10);

        // Group by Category (for valuation distribution)
        const valuationByCategory: any = {};
        products.forEach(p => {
            const catName = p.category?.name || 'Uncategorized';
            if (!valuationByCategory[catName]) valuationByCategory[catName] = 0;
            valuationByCategory[catName] += Number(p.costPrice) * p.baseStock;
        });

        const distribution = Object.keys(valuationByCategory).map(key => ({
            name: key,
            value: valuationByCategory[key]
        }));

        return NextResponse.json({
            stats: {
                totalValuation,
                totalProducts: products.length,
                totalItems,
                lowStockCount: lowStockItems.length,
                expiringCount: expiringBatches.length
            },
            lowStockItems: lowStockItems.map(p => ({
                id: p.id,
                name: p.name,
                stock: p.baseStock,
                cost: p.costPrice,
                supplier: p.supplier?.name || '-'
            })),
            expiringBatches: expiringBatches.map(b => ({
                id: b.id,
                batchNumber: b.batchNumber || '-',
                productName: b.product.name,
                expiryDate: b.expiryDate,
                quantity: b.quantity
            })),
            valuationDistribution: distribution
        });

    } catch (error) {
        console.error('Inventory report error:', error);
        return NextResponse.json({ error: 'Failed to fetch inventory report' }, { status: 500 });
    }
}
