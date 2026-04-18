import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export async function GET(request: Request) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const callerRole = request.headers.get('x-user-role') || 'CASHIER';
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(callerRole);

    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // We will fetch the last 30 days of sales data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 1. Top Selling Products
        // Group transaction items by productId and sum quantities
        const topProductsRaw = await prisma.transactionItem.groupBy({
            by: ['productId'],
            _sum: {
                quantity: true,
            },
            where: {
                transaction: {
                    tenantId,
                    type: 'SALE',
                    date: {
                        gte: thirtyDaysAgo
                    }
                }
            },
            orderBy: {
                _sum: {
                    quantity: 'desc'
                }
            },
            take: 10
        });

        // We need the names Since groupBy doesn't allow fetching relations directly
        const productIds = topProductsRaw.map((item: any) => item.productId);
        const productsInfo = await prisma.product.findMany({
            where: { tenantId, id: { in: productIds } },
            select: { id: true, name: true }
        });

        const topProducts = topProductsRaw.map((item: any) => {
            const pInfo = productsInfo.find(p => p.id === item.productId);
            return {
                name: pInfo ? pInfo.name : `Product #${item.productId}`,
                sales: item._sum.quantity || 0
            };
        });

        // 2. Peak Hours Analysis
        // We fetch all transactions for the last 30 days and extract the hour
        const transactions = await prisma.transaction.findMany({
            where: {
                tenantId,
                type: 'SALE',
                date: {
                    gte: thirtyDaysAgo
                }
            },
            select: {
                date: true
            }
        });

        const hourlyCounts: Record<number, number> = {};
        for (let i = 0; i < 24; i++) hourlyCounts[i] = 0;

        transactions.forEach((tx: any) => {
            const hour = new Date(tx.date).getHours();
            hourlyCounts[hour]++;
        });

        const peakHours = Object.keys(hourlyCounts).map(hour => ({
            hour: `${hour.padStart(2, '0')}:00`,
            orders: hourlyCounts[Number(hour)]
        })).sort((a, b) => Number(a.hour.split(':')[0]) - Number(b.hour.split(':')[0]));

        // 3. Demand Forecasting (Simple moving average / logic)
        // Products that sold more than 20 units in the last 30 days are "High Demand"
        const highDemandProductIds = topProductsRaw.filter((p: any) => (p._sum.quantity || 0) > 20).map((p: any) => p.productId);

        // Fetch current low stock to cross reference with high demand
        const lowStockProducts = await prisma.product.findMany({
            where: {
                tenantId,
                baseStock: { lte: 10 }
            },
            select: {
                id: true,
                name: true,
                baseStock: true
            }
        });

        const restockRecommendations = lowStockProducts
            .filter((p: any) => highDemandProductIds.includes(p.id))
            .map((p: any) => ({
                name: p.name,
                currentStock: p.baseStock,
                reason: 'طلب عالي ومخزون منخفض'
            }));


        return NextResponse.json({
            topProducts,
            peakHours,
            restockRecommendations
        });

    } catch (error) {
        console.error('BI Error:', error);
        return NextResponse.json({ error: 'Failed to fetch BI data' }, { status: 500 });
    }
}
