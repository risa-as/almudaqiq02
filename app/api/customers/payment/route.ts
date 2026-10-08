import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/api-helpers';
import { pinnedBranchId, resolveWriteBranchId } from '@/lib/branch-scope';
import { logActionAs } from '@/lib/audit';
import { enqueueSync } from '@/lib/sync-enqueue';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId } = auth;

    try {
        const body = await request.json();
        const { customerId, amount } = body;

        if (!customerId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Verify customer belongs to tenant (and, for branch staff, to their branch or the org)
        const pinned = pinnedBranchId(auth);
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, tenantId, ...(pinned ? { OR: [{ branchId: pinned }, { branchId: null }] } : {}) }
        });

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Owners without a token branch (the web dashboard) used to get a 401 here.
        // The payment lands in: the caller's branch (staff), else the selected or
        // the customer's branch.
        const branchId = await resolveWriteBranchId(auth, body.branchId || auth.branchId || customer.branchId);
        if (!branchId) return NextResponse.json({ error: 'الرجاء اختيار فرع محدد' }, { status: 400 });

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
                    // Recorded against the user who took the money (audit trail).
                    ...(userId ? { user: { connect: { id: userId } } } : {}),
                    paymentMethod: 'CASH',
                    paidAmount: Number(amount),
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
            userId:        userId ?? null,
            paymentMethod: 'CASH',
            paidAmount:    Number(amount),
            discount:      0,
        });
        enqueueSync('customers', 'UPDATE', customerId, {
            id:      customerId,
            balance: Number(result.updatedCustomer.balance),
        });

        await logActionAs(auth, 'CUSTOMER_PAYMENT', 'Customer', customerId, `${customer.name} — amount: ${Number(amount)}`);

        return NextResponse.json({ success: true, transactionId: result.transaction.id });

    } catch (error) {
        console.error('Payment Error:', error);
        return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
    }
}
