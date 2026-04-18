import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, branchId } = auth;
    if (!branchId) return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' }, { status: 401 });

    try {
        const body = await request.json();
        const { customerId, amount } = body;

        if (!customerId || !amount || Number(amount) <= 0) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Verify customer belongs to tenant
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, tenantId }
        });

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Create Payment Transaction
            const transaction = await tx.transaction.create({
                data: {
                    type: 'PAYMENT', // Payment from customer
                    totalAmount: Number(amount),
                    date: new Date(),
                    tenant: { connect: { id: tenantId } },
                    branch: { connect: { id: branchId } },
                    customerId: customerId,
                    userId: null,
                }
            });

            // 2. Update Customer Balance (Decrease Debt)
            // Balance is Debt, so payment decreases it.
            await tx.customer.update({
                where: { id: customerId, tenantId },
                data: { balance: { decrement: Number(amount) } }
            });

            return transaction;
        });

        return NextResponse.json({ success: true, transactionId: result.id });

    } catch (error) {
        console.error('Payment Error:', error);
        return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
    }
}
