import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { summariseShiftCash } from '@/lib/shift-cash';

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

        const sum = summariseShiftCash(Number(activeShift.openingAmount), transactions);

        return NextResponse.json({
            openingAmount: Number(activeShift.openingAmount),
            cashSales:   sum.cashSales,
            cardSales:   sum.cardSales,
            creditSales: sum.creditSales,
            splitSales:  sum.splitSales,
            cashRefunds: sum.cashRefunds,
            expectedCash: sum.expectedCash,
            totalSales:  sum.totalSales
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
        if (!Number.isFinite(enteredAmount) || enteredAmount < 0) {
            return NextResponse.json({ error: 'المبلغ المُدخل غير صالح' }, { status: 400 });
        }
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

        // Calculate System Cash Expected — same formula as the live summary above.
        const transactions = await prisma.transaction.findMany({
            where: {
                tenantId,
                userId,
                date: { gte: activeShift.openedAt },
                type: { in: ['SALE', 'REFUND', 'RETURN'] }
            },
            select: { type: true, paymentMethod: true, paidAmount: true, totalAmount: true }
        });

        const sum = summariseShiftCash(Number(activeShift.openingAmount), transactions);
        const expectedAmount = sum.expectedCash;
        const totalCashCollected = sum.cashCollected;
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
