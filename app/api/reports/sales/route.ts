import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/multi-tenant/prisma';
import { calculateProfit } from '@/lib/inventory-logic';
import { getAuthContext } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { tenantId, branchId: authBranchId } = auth;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly, custom
    const customStart = searchParams.get('startDate');
    const customEnd = searchParams.get('endDate');
    const userId = searchParams.get('userId'); // Filter by cashier
    const branchId = searchParams.get('branchId') || authBranchId || undefined;

    let startDate = new Date();
    let endDate = new Date();

    if (period === 'custom' && customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999); // End of the day
    } else if (period === 'weekly') {
        startDate.setDate(new Date().getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
        startDate.setDate(1); // Start of month
        startDate.setHours(0, 0, 0, 0);
    } else {
        // Daily: Start of today
        startDate.setHours(0, 0, 0, 0);
    }

    // Build Where Clause
    const whereClause: any = {
        tenantId,
        type: 'SALE',
        date: { gte: startDate, lte: endDate },
    };

    if (branchId) whereClause.branchId = branchId;
    if (userId && userId !== 'ALL') {
        whereClause.userId = userId;
    }

    try {
        // الاستعلامات الأربعة تشترك في whereClause نفسه ولا يعتمد أيٌّ منها على
        // نتيجة الآخر — كانت أربع رحلات متتالية (~2.1 ثانية) بلا سبب.
        const [salesStats, transactions, allTransactionsForChart, allItems, profitStats] = await Promise.all([
            // 1. Transaction stats
            prisma.transaction.aggregate({
                where: whereClause,
                _sum: { totalAmount: true },
                _count: { id: true },
            }),
            // 2. Transactions list
            prisma.transaction.findMany({
                where: whereClause,
                orderBy: { date: 'desc' },
                take: 50, // Limit for performance, mostly for "Recent" table
                include: {
                    user: { select: { username: true } }
                },
                ...RELATION_JOIN
            }),
            // 3. Chart data
            prisma.transaction.findMany({
                where: whereClause,
                select: { date: true, totalAmount: true }
            }),
            // 5. Sales by category
            prisma.transactionItem.findMany({
                where: { transaction: whereClause },
                include: { product: { include: { category: true } } },
                ...RELATION_JOIN
            }),
            // 4. Profit calc — مستقلّ أيضًا (يأخذ التواريخ والفرع فقط)، وداخليًا
            // يجمع ستة تجميعات بـ Promise.all، فإدخاله هنا يوفّر رحلة أخرى.
            calculateProfit(startDate, endDate, branchId, tenantId),
        ]);

        let chartData: any[] = [];

        if (period === 'daily') {
            // Full 24-hour array, always complete
            const hourly = Array.from({ length: 24 }, (_, h) => ({ name: `${String(h).padStart(2, '0')}:00`, value: 0 }));
            allTransactionsForChart.forEach(tx => {
                const h = new Date(tx.date).getHours();
                hourly[h].value += Number(tx.totalAmount);
            });
            chartData = hourly;
        } else {
            const dateMap = new Map<string, number>();
            allTransactionsForChart.forEach(tx => {
                const key = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                dateMap.set(key, (dateMap.get(key) ?? 0) + Number(tx.totalAmount));
            });
            dateMap.forEach((value, key) => chartData.push({ name: key, value }));
        }

        // 4. Profit Calc + 5. Sales By Category — كلاهما يُجلب أعلاه بالتوازي

        const categorySalesMap = new Map();
        allItems.forEach(item => {
            const catName = item.product.category?.name || 'بدون تصنيف';
            const itemTotal = Number(item.price) * Number(item.quantity);
            if (!categorySalesMap.has(catName)) categorySalesMap.set(catName, 0);
            categorySalesMap.set(catName, categorySalesMap.get(catName) + itemTotal);
        });

        const salesByCategory: any[] = [];
        categorySalesMap.forEach((value, name) => salesByCategory.push({ name, value }));
        salesByCategory.sort((a, b) => b.value - a.value);

        return NextResponse.json({
            period,
            totalSales: salesStats._sum.totalAmount || 0,
            transactionCount: salesStats._count.id || 0,
            netProfit: profitStats.netProfit || 0,
            totalReturns: profitStats.totalReturns || 0,
            returnCount: profitStats.returnCount || 0,
            netRevenue: profitStats.netRevenue || 0,
            transactions,
            chartData: chartData.reverse(), // Chronological (roughly, map iteration order varies but mostly insert order in recent nodes)
            // Ideally sort chartData by date key
            salesByCategory
        });

    } catch (error) {
        console.error('Reports API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}
