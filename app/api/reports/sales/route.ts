import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/multi-tenant/prisma';
import { calculateProfit } from '@/lib/inventory-logic';
import { getAuthContext } from '@/lib/api-helpers';

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
        // 1. Get Transaction Stats
        const salesStats = await prisma.transaction.aggregate({
            where: whereClause,
            _sum: { totalAmount: true },
            _count: { id: true },
        });

        // 2. Get Transactions list
        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            orderBy: { date: 'desc' },
            take: 50, // Limit for performance, mostly for "Recent" table
            include: {
                user: { select: { username: true } }
            }
        });

        // 3. Chart Data: Sales per Day (or Hour if daily)
        // Grouping is complex in Prisma+SQLite without raw queries, so we do it in JS
        const allTransactionsForChart = await prisma.transaction.findMany({
            where: whereClause,
            select: { date: true, totalAmount: true }
        });

        const chartData: any[] = [];
        const dateMap = new Map();

        allTransactionsForChart.forEach(tx => {
            const d = new Date(tx.date);
            let key = '';

            if (period === 'daily') {
                key = d.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true });
            } else {
                key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }

            if (!dateMap.has(key)) dateMap.set(key, 0);
            dateMap.set(key, dateMap.get(key) + Number(tx.totalAmount));
        });

        dateMap.forEach((value, key) => {
            chartData.push({ name: key, value });
        });

        // 4. Profit Calc (Global for range)
        // Ensure profit calculation respects the branch filter
        const profitStats = await calculateProfit(startDate, endDate, branchId);

        // 5. Sales By Category
        const allItems = await prisma.transactionItem.findMany({
            where: { transaction: whereClause },
            include: { product: { include: { category: true } } }
        });

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
