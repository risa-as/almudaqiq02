import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId } = auth;

    try {
        const activeShift = await prisma.cashierShift.findFirst({
            where: { tenantId, userId, closedAt: null }
        });
        if (!activeShift) return NextResponse.json({ error: 'لا توجد وردية مفتوحة' }, { status: 404 });

        const transactions = await prisma.transaction.findMany({
            where: { tenantId, userId, date: { gte: activeShift.openedAt }, type: { in: ['SALE', 'REFUND', 'RETURN'] } },
            select: { type: true, paymentMethod: true, paidAmount: true, totalAmount: true }
        });

        let cashSales = 0, cardSales = 0, creditSales = 0, splitSales = 0;
        let cashRefunds = 0;

        for (const tx of transactions) {
            if (tx.type === 'SALE') {
                const amt = Number(tx.totalAmount);
                if (tx.paymentMethod === 'CASH')   cashSales   += amt;
                else if (tx.paymentMethod === 'CARD')   cardSales   += amt;
                else if (tx.paymentMethod === 'CREDIT') creditSales += amt;
                else if (tx.paymentMethod === 'SPLIT')  splitSales  += amt;
            } else if ((tx.type === 'REFUND' || tx.type === 'RETURN') && tx.paymentMethod === 'CASH') {
                cashRefunds += Number(tx.paidAmount ?? tx.totalAmount ?? 0);
            }
        }

        const expectedCash = Number(activeShift.openingAmount) + cashSales - cashRefunds;

        return NextResponse.json({
            openingAmount: Number(activeShift.openingAmount),
            cashSales,
            cardSales,
            creditSales,
            splitSales,
            cashRefunds,
            expectedCash,
            totalSales: cashSales + cardSales + creditSales + splitSales
        });
    } catch (error) {
        console.error('Error fetching shift summary:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId } = auth;

    try {
        const body = await request.json();
        const enteredAmount = Number(body.closingAmount || 0);
        const notes = body.notes || '';

        // Get the active shift for this user within this tenant
        const activeShift = await prisma.cashierShift.findFirst({
            where: {
                tenantId,
                userId,
                closedAt: null
            }
        });

        if (!activeShift) {
            return NextResponse.json({ error: 'لا توجد وردية مفتوحة لإغلاقها' }, { status: 400 });
        }

        // Calculate System Cash Expected
        // Cash = Opening Float + Sum of cash received from transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                tenantId,
                userId,
                date: {
                    gte: activeShift.openedAt
                },
                type: { in: ['SALE', 'REFUND'] }
            }
        });

        let totalCashCollected = 0;
        let totalCashRefunded = 0;

        transactions.forEach((tx: any) => {
            if (tx.type === 'SALE' && (tx.paymentMethod === 'CASH' || tx.paymentMethod === 'SPLIT')) {
                totalCashCollected += Number(tx.paidAmount || 0);
            } else if (tx.type === 'REFUND' && tx.paymentMethod === 'CASH') {
                totalCashRefunded += Number(tx.paidAmount || tx.totalAmount || 0);
            }
        });

        const expectedAmount = Number(activeShift.openingAmount) + totalCashCollected - totalCashRefunded;
        const difference = enteredAmount - expectedAmount;

        const closedShift = await prisma.cashierShift.update({
            where: { id: activeShift.id },
            data: {
                closingAmount: enteredAmount,
                expectedAmount: expectedAmount,
                difference: difference,
                closedAt: new Date(),
                notes: notes
            }
        });

        enqueueSync('cashierShifts', 'UPDATE', closedShift.id, {
            cloudId: closedShift.id,
            closingAmount: enteredAmount, expectedAmount, difference,
            closedAt: closedShift.closedAt, notes,
        });

        return NextResponse.json({ success: true, shift: closedShift, expectedAmount, totalCashCollected });
    } catch (error) {
        console.error('Error closing shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
