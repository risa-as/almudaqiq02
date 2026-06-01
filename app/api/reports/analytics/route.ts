import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/multi-tenant/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthContext()
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const tenantId = auth.tenantId
        const userBranchId = auth.branchId ?? ''
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get('branchId') || userBranchId || undefined;
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        let start = startDateParam ? new Date(startDateParam) : new Date();
        let end = endDateParam ? new Date(endDateParam) : new Date();

        if (!startDateParam) {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }

        // Calculate Previous Period (Same duration)
        const duration = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - duration);
        const prevEnd = new Date(end.getTime() - duration);

        const branchFilter = branchId ? { branchId } : {}

        // Fetch Current Period Data
        const currentTransactions = await prisma.transaction.findMany({
            where: { tenantId, ...branchFilter, date: { gte: start, lte: end }, type: { in: ['SALE', 'RETURN', 'REFUND'] } },
            include: {
                items: {
                    include: {
                        product: { include: { category: true } }
                    }
                }
            }
        });

        const currentExpenses = await prisma.expense.findMany({
            where: { tenantId, ...branchFilter, date: { gte: start, lte: end } }
        });

        // Fetch Previous Period Data (Minimal info needed for KPI calculations)
        const prevTransactions = await prisma.transaction.findMany({
            where: { tenantId, ...branchFilter, date: { gte: prevStart, lte: prevEnd }, type: { in: ['SALE', 'RETURN', 'REFUND'] } },
            include: { items: true }
        });

        const prevExpenses = await prisma.expense.findMany({
            where: { tenantId, ...branchFilter, date: { gte: prevStart, lte: prevEnd } }
        });

        // --- 1. KPI Calculations ---
        const calcNetProfit = (txs: any[], exps: any[]) => {
            let gross = 0;       // SALE only
            let returns = 0;     // REFUND/RETURN (positive magnitude)
            let cogs = 0;
            txs.forEach(tx => {
                if (tx.type === 'SALE') {
                    gross += Number(tx.totalAmount);
                    tx.items.forEach((item: any) => { cogs += Number(item.cost); });
                } else if (tx.type === 'REFUND' || tx.type === 'RETURN') {
                    // REFUND stores +amount, legacy RETURN stores −amount → normalise to positive
                    returns += tx.type === 'REFUND' ? Number(tx.totalAmount) : -Number(tx.totalAmount);
                    tx.items.forEach((item: any) => { cogs -= Number(item.cost); });
                }
            });
            const totalExp = exps.reduce((sum, exp) => sum + Number(exp.amount), 0);
            const revenue = gross - returns; // net revenue
            return { revenue, gross, returns, profit: revenue - cogs - totalExp };
        };

        const currentKpis = calcNetProfit(currentTransactions, currentExpenses);
        const prevKpis = calcNetProfit(prevTransactions, prevExpenses);

        const currentAov = currentTransactions.length ? currentKpis.revenue / currentTransactions.length : 0;
        const prevAov = prevTransactions.length ? prevKpis.revenue / prevTransactions.length : 0;

        const kpis = {
            revenue: currentKpis.revenue,          // net revenue
            grossRevenue: currentKpis.gross,
            returns: currentKpis.returns,
            profit: currentKpis.profit,
            aov: currentAov,
            transactions: currentTransactions.length,
            prevRevenue: prevKpis.revenue,
            prevProfit: prevKpis.profit,
            prevAov: prevAov,
            prevTransactions: prevTransactions.length
        };

        // --- 2. Javascript Grouping for Charts (Avoiding SQLite Limitations) ---
        const dailyData: Record<string, { revenue: number, profit: number, cogs: number, expenses: number }> = {};
        const hourlyDataMap: Record<string, number> = {};
        const categoryDataMap: Record<string, number> = {};
        const productDataMap: Record<string, { name: string, quantity: number, profit: number }> = {};

        // Initialize days
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dailyData[d.toISOString().split('T')[0]] = { revenue: 0, profit: 0, cogs: 0, expenses: 0 };
        }

        // Initialize hours
        for (let i = 0; i < 24; i++) {
            hourlyDataMap[i.toString().padStart(2, '0') + ':00'] = 0;
        }

        currentTransactions.forEach(tx => {
            const isReturn = tx.type === 'RETURN' || tx.type === 'REFUND';

            const dateStr = tx.date.toISOString().split('T')[0];
            const hourStr = tx.date.getHours().toString().padStart(2, '0') + ':00';
            // RETURN has negative totalAmount; REFUND has positive totalAmount (from POS)
            const txRevenue = tx.type === 'REFUND' ? -Number(tx.totalAmount) : Number(tx.totalAmount);

            // Trend
            if (!dailyData[dateStr]) dailyData[dateStr] = { revenue: 0, profit: 0, cogs: 0, expenses: 0 };
            dailyData[dateStr].revenue += txRevenue;

            // Hourly
            hourlyDataMap[hourStr] += txRevenue;

            // Items breakdown
            tx.items.forEach(item => {
                const itemQty = isReturn ? -Number(item.quantity) : Number(item.quantity);
                const itemRevenue = Number(item.price) * itemQty;
                const itemCogs = isReturn ? -Number(item.cost) : Number(item.cost);

                dailyData[dateStr].cogs += itemCogs;

                // Category
                const catName = item.product?.category?.name || 'غير مصنف';
                categoryDataMap[catName] = (categoryDataMap[catName] || 0) + itemRevenue;

                // Products
                if (!productDataMap[item.productId]) {
                    productDataMap[item.productId] = {
                        name: item.product?.name || `Product ${item.productId}`,
                        quantity: 0,
                        profit: 0
                    };
                }
                productDataMap[item.productId].quantity += itemQty;
                productDataMap[item.productId].profit += (itemRevenue - itemCogs);
            });
        });

        currentExpenses.forEach(exp => {
            const dateStr = exp.date.toISOString().split('T')[0];
            if (!dailyData[dateStr]) dailyData[dateStr] = { revenue: 0, profit: 0, cogs: 0, expenses: 0 };
            dailyData[dateStr].expenses += Number(exp.amount);
        });

        // Formatting Arrays for Recharts
        const trendData = Object.keys(dailyData).sort().map(date => {
            const day = dailyData[date];
            return {
                date,
                revenue: day.revenue,
                profit: day.revenue - day.cogs - day.expenses
            };
        });

        const hourlyData = Object.keys(hourlyDataMap).sort().map(hour => ({
            hour,
            sales: hourlyDataMap[hour]
        }));

        const categoryData = Object.keys(categoryDataMap)
            .filter(cat => categoryDataMap[cat] > 0)
            .map(name => ({
                name,
                value: categoryDataMap[name]
            }));

        // Top 5 Products
        const topProducts = Object.values(productDataMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        // --- 3. Dead Stock ---
        // Products with stock > 0 but not in current transaction items
        const soldProductIds = Object.keys(productDataMap);

        const deadStockRaw = await prisma.product.findMany({
            where: {
                tenantId,
                baseStock: { gt: 0 },
                id: { notIn: soldProductIds }
            },
            take: 10,
            orderBy: { baseStock: 'desc' },
            select: { name: true, baseStock: true, updatedAt: true }
        });

        const deadStock = deadStockRaw.map(p => ({
            name: p.name,
            baseStock: p.baseStock,
            lastUpdated: p.updatedAt.toISOString().split('T')[0]
        }));

        return NextResponse.json({
            kpis,
            trendData,
            categoryData,
            hourlyData,
            insights: { topProducts, deadStock }
        });

    } catch (error) {
        console.error('Analytics API error:', error);
        return NextResponse.json({ error: 'Failed to generate analytics' }, { status: 500 });
    }
}
