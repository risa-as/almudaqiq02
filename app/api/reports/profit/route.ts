import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || 'daily'; // daily, monthly, yearly
        const branchId = searchParams.get('branchId');
        const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};

        let startDate: Date;
        let endDate: Date;
        const now = new Date();

        if (period === 'monthly') {
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
        } else if (period === 'yearly') {
            startDate = startOfYear(now);
            endDate = endOfYear(now);
        } else {
            startDate = startOfDay(now);
            endDate = endOfDay(now);
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                tenantId,
                ...branchFilter,
                date: { gte: startDate, lte: endDate },
                type: { in: ['SALE', 'REFUND'] }
            },
            include: {
                items: true
            }
        });

        const expensesList = await prisma.expense.findMany({
            where: {
                tenantId,
                ...branchFilter,
                date: { gte: startDate, lte: endDate }
            }
        });

        let revenue = 0;
        let cogs = 0;
        let refunds = 0;

        for (const tx of transactions) {
            if (tx.type === 'SALE') {
                revenue += Number(tx.totalAmount);
                for (const item of tx.items) {
                    cogs += Number(item.cost || 0);
                }
            } else if (tx.type === 'REFUND') {
                // REFUND totalAmount is positive (from POS)
                refunds += Number(tx.totalAmount);
                for (const item of tx.items) {
                    cogs -= Number(item.cost || 0);
                }
            }
        }

        const expenses = expensesList.reduce((sum, e) => sum + Number(e.amount), 0);

        const netRevenue = revenue - refunds;
        const grossProfit = netRevenue - cogs;
        const netProfit = grossProfit - expenses;

        return NextResponse.json({
            revenue: netRevenue,
            cogs,
            expenses,
            netProfit,
            grossProfit,
            refunds,
            grossRevenue: revenue
        });

    } catch (error) {
        console.error('Profit API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch profit stats' }, { status: 500 });
    }
}
