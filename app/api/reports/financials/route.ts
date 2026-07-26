import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

export async function GET(request: Request) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchId = searchParams.get('branchId');
    const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

    // Default to this month
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    try {
        // الإيرادات والمصروفات استعلامان مستقلّان — كانا متتاليين فيكلّفان
        // رحلتين (~1.1 ثانية). نجلبهما معًا هنا ونستعمل المصروفات في مكانها أدناه.
        const [transactions, expenses] = await Promise.all([
            // 1. Revenue (Total Sales) - include SALE and RETURN types
            prisma.transaction.findMany({
                where: {
                    tenantId,
                    ...branchFilter,
                    type: { in: ['SALE', 'RETURN', 'REFUND'] },
                    date: {
                        gte: start,
                        lte: end
                    }
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            unit: true
                        }
                    }
                },
                ...RELATION_JOIN
            }),
            // 2. Operating Expenses
            prisma.expense.findMany({
                where: {
                    tenantId,
                    ...branchFilter,
                    date: {
                        gte: start,
                        lte: end
                    }
                }
            }),
        ]);

        let grossRevenue = 0; // SALE only
        let returns = 0;      // REFUND/RETURN (positive magnitude)
        let cogs = 0; // Cost of Goods Sold
        const salesList: any[] = []; // Collect items for the Sales Table (SALE only)

        transactions.forEach(tx => {
            // REFUND stores +amount, legacy RETURN stores −amount → normalise returns to positive
            if (tx.type === 'SALE') {
                grossRevenue += Number(tx.totalAmount);
            } else if (tx.type === 'REFUND' || tx.type === 'RETURN') {
                returns += tx.type === 'REFUND' ? Number(tx.totalAmount) : -Number(tx.totalAmount);
            }

            if (tx.type === 'SALE') {
                tx.items.forEach(item => {
                    cogs += Number(item.cost);

                    salesList.push({
                        id: item.id,
                        productName: item.product?.name || 'منتج محذوف',
                        quantity: Number(item.quantity),
                        unitName: item.unit?.name || 'وحدة',
                        price: Number(item.price),
                        cost: Number(item.cost),
                        transactionDate: tx.date
                    });
                });
            } else if (tx.type === 'RETURN' || tx.type === 'REFUND') {
                // Reduce COGS for returned items
                tx.items.forEach(item => {
                    cogs -= Number(item.cost);
                });
            }
        });

        // 2. Operating Expenses (تُجلب أعلاه بالتوازي مع الإيرادات)
        let totalExpenses = 0;
        expenses.forEach(exp => totalExpenses += Number(exp.amount));

        // 3. Calculations
        const revenue = grossRevenue - returns; // net revenue
        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - totalExpenses;
        const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        // 4. Chart Data Generation (Group by Date)
        const dailyData: Record<string, { revenue: number; profit: number; cogs: number; expenses: number }> = {};

        // Initialize days between start and end date
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dailyData[d.toISOString().split('T')[0]] = { revenue: 0, profit: 0, cogs: 0, expenses: 0 };
        }

        // Aggregate transactions and cogs
        transactions.forEach(tx => {
            const dateStr = tx.date.toISOString().split('T')[0];
            if (!dailyData[dateStr]) dailyData[dateStr] = { revenue: 0, profit: 0, cogs: 0, expenses: 0 };

            // RETURN has negative totalAmount; REFUND has positive totalAmount (from POS)
            if (tx.type === 'REFUND') {
                dailyData[dateStr].revenue -= Number(tx.totalAmount);
            } else {
                dailyData[dateStr].revenue += Number(tx.totalAmount); // SALE (+), RETURN (-)
            }

            if (tx.type === 'SALE') {
                tx.items.forEach(item => {
                    dailyData[dateStr].cogs += Number(item.cost);
                });
            } else if (tx.type === 'RETURN' || tx.type === 'REFUND') {
                tx.items.forEach(item => {
                    dailyData[dateStr].cogs -= Number(item.cost);
                });
            }
        });

        // Aggregate expenses
        expenses.forEach(exp => {
            const dateStr = exp.date.toISOString().split('T')[0];
            if (!dailyData[dateStr]) dailyData[dateStr] = { revenue: 0, profit: 0, cogs: 0, expenses: 0 };
            dailyData[dateStr].expenses += Number(exp.amount);
        });

        // Format to chart array
        const chartData = Object.keys(dailyData).sort().map(date => {
            const day = dailyData[date];
            const dayGross = day.revenue - day.cogs;
            return {
                date,
                revenue: day.revenue,
                profit: dayGross - day.expenses
            };
        });

        return NextResponse.json({
            range: { start, end },
            financials: {
                revenue,            // net revenue (gross − returns)
                grossRevenue,
                returns,
                cogs,
                grossProfit,
                operatingExpenses: totalExpenses,
                netProfit,
                margin
            },
            salesList,
            expensesList: expenses,
            chartData
        });

    } catch (error) {
        console.error('Financial report error:', error);
        return NextResponse.json({ error: 'Failed to generate financial report' }, { status: 500 });
    }
}
