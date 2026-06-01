import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';

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
                    // Use relation-connect (not the scalar customerId) since tenant/branch
                    // already use connect — Prisma's checked input requires it. userId is
                    // optional and defaults to null, so it's omitted.
                    customer: { connect: { id: customerId } },
                }
            });

            // 2. Update Customer Balance (Decrease Debt)
            // Balance is Debt, so payment decreases it.
            const updatedCustomer = await tx.customer.update({
                where: { id: customerId, tenantId },
                data: { balance: { decrement: Number(amount) } }
            });

            return { transaction, updatedCustomer };
        });

        // Sync: the payment transaction itself + the new customer balance
        enqueueSync('transactions', 'INSERT', result.transaction.id, {
            cloudId:       result.transaction.id,
            type:          'PAYMENT',
            totalAmount:   Number(amount),
            date:          result.transaction.date,
            customerId:    customerId,
            userId:        null,
            paymentMethod: 'CASH',
            paidAmount:    Number(amount),
            discount:      0,
        });
        enqueueSync('customers', 'UPDATE', customerId, {
            id:      customerId,
            balance: Number(result.updatedCustomer.balance),
        });

        return NextResponse.json({ success: true, transactionId: result.transaction.id });

    } catch (error) {
        console.error('Payment Error:', error);
        return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
    }
}
