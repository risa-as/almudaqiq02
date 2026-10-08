import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logActionAs } from '@/lib/audit';
import { pinnedBranchId, resolveWriteBranchId } from '@/lib/branch-scope';
import { ReturnError, debtReductionFor, planReturn, restockReturnedLines } from '@/lib/returns';

export const dynamic = 'force-dynamic';

/**
 * REFUND — the POS «استرجاع» flow. Stores a POSITIVE totalAmount/price (RETURN,
 * the older flow, stores negatives; reports normalise both).
 *
 * Amounts and costs are computed from the original sale (lib/returns.ts); the
 * client's price/cost/totalAmount fields are ignored.
 */
export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId } = auth;

    try {
        const body = await request.json();
        const { originalTxId, items, notes } = body;

        if (!originalTxId) return NextResponse.json({ error: 'Original Transaction ID required' }, { status: 400 });
        if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'No items to refund' }, { status: 400 });

        // Branch-bound staff can only refund their own branch's sales.
        const pinned = pinnedBranchId(auth);
        const originalTx = await prisma.transaction.findFirst({
            where: { id: originalTxId, tenantId, ...(pinned ? { branchId: pinned } : {}) }
        });

        if (!originalTx || originalTx.type !== 'SALE') {
            return NextResponse.json({ error: 'معرف الفاتورة الأصلية غير صحيح' }, { status: 400 });
        }

        // Goods go back into the branch processing the refund (pinned for staff,
        // validated for owners), defaulting to the branch that made the sale.
        const branchId = await resolveWriteBranchId(auth, body.branchId || originalTx.branchId);
        if (!branchId) return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' }, { status: 401 });

        const { refundTx, plan, cashOut, customerBalance } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const plan = await planReturn(tx, tenantId, originalTx, items);
            if (plan.amount <= 0 && plan.lines.length === 0) throw new ReturnError('لا يوجد ما يمكن إرجاعه');

            // On a credit sale the refund first cancels the open debt; only the rest
            // is cash out of the drawer (previously both happened in full).
            const debtReduction = debtReductionFor(originalTx, plan.amount);
            const cashOut = plan.amount - debtReduction;

            const newTx = await (tx as any).transaction.create({
                data: {
                    type: 'REFUND',
                    totalAmount: plan.amount,
                    date: new Date(),
                    tenant: { connect: { id: tenantId } },
                    branch: { connect: { id: branchId } },
                    ...(userId ? { user: { connect: { id: userId } } } : {}),
                    ...(originalTx.customerId ? { customer: { connect: { id: originalTx.customerId } } } : {}),
                    notes: notes || `إرجاع من فاتورة رقم ${originalTx.receiptNumber ?? originalTx.id}`,
                    paymentMethod: 'CASH',
                    paidAmount: cashOut,
                    originalTxId: originalTxId
                }
            });

            await tx.transactionItem.createMany({
                data: plan.lines.map(l => ({
                    transactionId: newTx.id,
                    productId: l.productId,
                    unitId:    l.unitId,
                    quantity:  l.quantity,
                    price:     l.unitPrice,
                    cost:      l.cost,
                })),
            });

            await restockReturnedLines(tx, tenantId, branchId, plan.lines);

            let customerBalance: number | null = null;
            if (debtReduction > 0 && originalTx.customerId) {
                const c = await (tx as any).customer.update({
                    where: { id: originalTx.customerId, tenantId },
                    data: { balance: { decrement: debtReduction } }
                });
                customerBalance = Number(c.balance);
            }

            return { refundTx: newTx, plan, cashOut, customerBalance };
        }, { timeout: 30000 });

        enqueueSync('transactions', 'INSERT', refundTx.id, {
            cloudId:       refundTx.id,
            type:          'REFUND',
            totalAmount:   plan.amount,
            date:          refundTx.date ?? new Date(),
            userId:        userId ?? null,
            customerId:    originalTx.customerId ?? null,
            notes:         refundTx.notes ?? null,
            discount:      0,
            paymentMethod: 'CASH',
            paidAmount:    cashOut,
            originalTxId,
            items:         plan.lines.map(l => ({
                productId: l.productId,
                unitId:    l.unitId,
                quantity:  l.quantity,
                price:     l.unitPrice,
                cost:      l.cost,
            })),
        })

        if (customerBalance != null && originalTx.customerId) {
            enqueueSync('customers', 'UPDATE', originalTx.customerId, { id: originalTx.customerId, balance: customerBalance });
        }

        await logActionAs(auth, 'REFUND', 'Transaction', refundTx.id,
            `Refund from invoice ${originalTxId} — amount: ${plan.amount}`);

        return NextResponse.json({ success: true, transaction: refundTx, amount: plan.amount, cashOut });

    } catch (error: any) {
        if (error instanceof ReturnError) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error('Refund transaction failed:', error);
        return NextResponse.json({ error: 'فشل الإرجاع' }, { status: 500 });
    }
}
