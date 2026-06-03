import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const branchId  = searchParams.get('branchId');
    const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};
    // Customers carry their own branchId (org-level customers have branchId = null).
    // A branch view counts its own customers + the shared org-level ones — never
    // another branch's customers. Mirrors the customers list / POS scoping.
    const customerWhere: any = branchId && branchId !== 'all'
        ? { tenantId, OR: [{ branchId }, { branchId: null }] }
        : { tenantId };

    const now       = new Date();
    const todayStart = startOfDay(now);
    const weekStart  = startOfDay(addDays(now, -6));   // last 7 days
    const prevWeekStart = startOfDay(addDays(now, -13));
    const prevWeekEnd   = startOfDay(addDays(now, -7));
    const monthStart = startOfDay(addDays(now, -29));

    try {
        const baseWhere = { tenantId, ...branchFilter, type: 'SALE' };

        const [
            todayAgg, todayRefunds, weekAgg, prevWeekAgg,
            last7daysTxs, paymentMethodTxs,
            topItemsRaw, refundAgg,
            customerDebt, totalCustomers,
            last30daysTxs
        ] = await Promise.all([
            // Today totals
            prisma.transaction.aggregate({
                where: { ...baseWhere, date: { gte: todayStart } },
                _sum: { totalAmount: true }, _count: { id: true }
            }),
            // Today's returns (for net-revenue display)
            prisma.transaction.findMany({
                where: { tenantId, ...branchFilter, type: { in: ['REFUND', 'RETURN'] }, date: { gte: todayStart } },
                select: { type: true, totalAmount: true }
            }),
            // This week totals
            prisma.transaction.aggregate({
                where: { ...baseWhere, date: { gte: weekStart } },
                _sum: { totalAmount: true }, _count: { id: true }
            }),
            // Previous week totals
            prisma.transaction.aggregate({
                where: { ...baseWhere, date: { gte: prevWeekStart, lt: prevWeekEnd } },
                _sum: { totalAmount: true }, _count: { id: true }
            }),
            // Last 7 days by day (for sparkline)
            prisma.transaction.findMany({
                where: { ...baseWhere, date: { gte: weekStart } },
                select: { date: true, totalAmount: true }
            }),
            // Payment method breakdown (last 30 days)
            prisma.transaction.findMany({
                where: { ...baseWhere, date: { gte: monthStart } },
                select: { paymentMethod: true, totalAmount: true }
            }),
            // Top products by revenue (last 30 days)
            prisma.transactionItem.groupBy({
                by: ['productId'],
                where: { transaction: { ...baseWhere, date: { gte: monthStart } } },
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 5
            }),
            // Refunds (last 30 days) — fetched (not aggregated) so we can normalise
            // the sign: REFUND stores +amount, legacy RETURN stores -amount; both
            // represent money returned, so we treat the magnitude as a positive refund.
            prisma.transaction.findMany({
                where: { tenantId, ...branchFilter, type: { in: ['REFUND', 'RETURN'] }, date: { gte: monthStart } },
                select: { type: true, totalAmount: true }
            }),
            // Outstanding customer debt — scoped to this branch's customers + org-level
            prisma.customer.aggregate({
                where: { ...customerWhere, balance: { gt: 0 } },
                _sum: { balance: true }, _count: { id: true }
            }),
            // Total customers — same branch scope
            prisma.customer.count({ where: customerWhere }),
            // Last 30 days txs for avg + day-of-week
            prisma.transaction.findMany({
                where: { ...baseWhere, date: { gte: monthStart } },
                select: { date: true, totalAmount: true }
            })
        ]);

        // Top product names
        const productIds = topItemsRaw.map((i: any) => i.productId);
        const products   = await prisma.product.findMany({
            where: { tenantId, id: { in: productIds } },
            select: { id: true, name: true }
        });
        const topProducts = topItemsRaw.map((i: any) => ({
            name: products.find((p: any) => p.id === i.productId)?.name ?? '—',
            qty:  Number(i._sum.quantity ?? 0)
        }));

        // Sparkline: group last 7 days by date
        const sparkline: { label: string; total: number }[] = [];
        for (let d = 0; d < 7; d++) {
            const day   = startOfDay(addDays(now, d - 6));
            const dayEnd = addDays(day, 1);
            const label  = day.toLocaleDateString('ar-IQ', { weekday: 'short' });
            const total  = last7daysTxs
                .filter((t: any) => new Date(t.date) >= day && new Date(t.date) < dayEnd)
                .reduce((s: number, t: any) => s + Number(t.totalAmount), 0);
            sparkline.push({ label, total });
        }

        // Payment breakdown
        const paymentMap: Record<string, number> = { CASH: 0, CARD: 0, CREDIT: 0, SPLIT: 0 };
        for (const tx of paymentMethodTxs) {
            const m = tx.paymentMethod ?? 'CASH';
            paymentMap[m] = (paymentMap[m] ?? 0) + Number(tx.totalAmount);
        }

        // Day-of-week distribution (0=Sun … 6=Sat)
        const DOW_LABELS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        const dowMap = Array(7).fill(0);
        for (const tx of last30daysTxs) {
            dowMap[new Date(tx.date).getDay()] += Number(tx.totalAmount);
        }
        const dayOfWeek = DOW_LABELS.map((label, i) => ({ label, total: dowMap[i] }));

        // Averages
        const avgTxValue = last30daysTxs.length
            ? last30daysTxs.reduce((s: number, t: any) => s + Number(t.totalAmount), 0) / last30daysTxs.length
            : 0;

        const weekSales     = Number(weekAgg._sum.totalAmount ?? 0);
        const prevWeekSales = Number(prevWeekAgg._sum.totalAmount ?? 0);
        const weekGrowth    = prevWeekSales > 0 ? ((weekSales - prevWeekSales) / prevWeekSales) * 100 : null;

        const refundTotal   = refundAgg.reduce((s: number, t: any) =>
            s + (t.type === 'REFUND' ? Number(t.totalAmount) : -Number(t.totalAmount)), 0);
        const monthSales    = paymentMethodTxs.reduce((s: number, t: any) => s + Number(t.totalAmount), 0);
        const refundRate    = monthSales > 0 ? (refundTotal / monthSales) * 100 : 0;

        return NextResponse.json({
            today:         (() => {
                const gross = Number(todayAgg._sum.totalAmount ?? 0);
                const returns = todayRefunds.reduce((s: number, t: any) =>
                    s + (t.type === 'REFUND' ? Number(t.totalAmount) : -Number(t.totalAmount)), 0);
                return { sales: gross, returns, netSales: gross - returns, txCount: todayAgg._count.id };
            })(),
            thisWeek:      { sales: weekSales, txCount: weekAgg._count.id },
            prevWeek:      { sales: prevWeekSales, txCount: prevWeekAgg._count.id },
            weekGrowth,
            avgTxValue,
            refundRate,
            refundCount:   refundAgg.length,
            paymentBreakdown: paymentMap,
            topProducts,
            sparkline,
            dayOfWeek,
            debtTotal:     Number(customerDebt._sum.balance ?? 0),
            debtors:       customerDebt._count.id,
            totalCustomers
        });

    } catch (error) {
        console.error('Dashboard API error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
