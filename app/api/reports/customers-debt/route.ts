import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-helpers';
import { getTenantPrisma } from '@/lib/multi-tenant/prisma';

export const dynamic = 'force-dynamic';

function agingBucket(days: number): '0-30' | '31-60' | '61-90' | '90+' {
    if (days <= 30) return '0-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
}

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { tenantId } = auth;
    const db = getTenantPrisma(tenantId);

    const { searchParams } = request.nextUrl;
    const branchId = searchParams.get('branchId');
    const now      = new Date();

    const customerWhere: any = { tenantId, balance: { gt: 0 } };
    if (branchId && branchId !== 'all') customerWhere.branchId = branchId;

    const customers = await db.customer.findMany({
        where: customerWhere,
        orderBy: { balance: 'desc' },
        include: {
            branch: { select: { name: true } },
            transactions: {
                where: { paymentMethod: 'CREDIT', type: 'SALE' },
                orderBy: { date: 'asc' },
                select: { id: true, date: true, totalAmount: true, paidAmount: true, receiptNumber: true },
            },
        },
    });

    const rows = customers.map(c => {
        const creditTxs = c.transactions;
        // Use the oldest CREDIT transaction date as the aging reference
        const oldestDate = creditTxs.length > 0 ? new Date(creditTxs[0].date) : new Date(c.createdAt);
        const daysOld    = Math.floor((now.getTime() - oldestDate.getTime()) / 86400000);
        const bucket     = agingBucket(daysOld);

        // Compute unpaid amount per transaction (paidAmount may be null for fully credit)
        const recent = creditTxs.slice(-5).reverse().map(tx => ({
            id:           tx.id,
            receiptNumber: tx.receiptNumber,
            date:         tx.date.toISOString(),
            totalAmount:  Number(tx.totalAmount),
            paidAmount:   Number(tx.paidAmount ?? 0),
            unpaid:       Number(tx.totalAmount) - Number(tx.paidAmount ?? 0),
        }));

        return {
            id:          c.id,
            name:        c.name,
            phone:       c.phone,
            branchName:  c.branch?.name ?? '—',
            balance:     Number(c.balance),
            daysOld,
            bucket,
            oldestDate:  oldestDate.toISOString(),
            txCount:     creditTxs.length,
            recentTxs:   recent,
        };
    });

    const totalDebt  = rows.reduce((s, r) => s + r.balance, 0);
    const byBucket   = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const cntBucket  = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const r of rows) {
        byBucket[r.bucket]  += r.balance;
        cntBucket[r.bucket] += 1;
    }

    return NextResponse.json({
        summary: { totalDebt, customerCount: rows.length, byBucket, cntBucket },
        customers: rows,
    });
}
