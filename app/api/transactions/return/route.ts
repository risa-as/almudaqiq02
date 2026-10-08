import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logActionAs } from '@/lib/audit';
import { pinnedBranchId, resolveWriteBranchId } from '@/lib/branch-scope';
import { ReturnError, debtReductionFor, planReturn, restockReturnedLines } from '@/lib/returns';

/**
 * RETURN — the mobile «إرجاع أصناف» flow. Stores NEGATIVE totalAmount/price
 * (REFUND stores positives; reports normalise both).
 *
 * Amounts are computed from the original sale (lib/returns.ts); the client's
 * per-item price is ignored.
 */
export async function POST(req: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId } = auth;

    try {
        const body = await req.json();
        const { originalTransactionId, items, branchId: bodyBranchId } = body;
        // items: [{ productId, unitId, quantity }]

        if (!originalTransactionId) return NextResponse.json({ error: 'معرف الفاتورة الأصلية مطلوب' }, { status: 400 });
        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items to return' }, { status: 400 });
        }

        // Branch-bound staff can only return their own branch's sales.
        const pinned = pinnedBranchId(auth);
        const originalTx = await prisma.transaction.findFirst({
            where: { id: originalTransactionId, tenantId, ...(pinned ? { branchId: pinned } : {}) },
        });

        if (!originalTx) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        if (originalTx.type !== 'SALE') {
            return NextResponse.json({ error: 'معرف الفاتورة الأصلية غير صحيح' }, { status: 400 });
        }

        const branchId = await resolveWriteBranchId(auth, bodyBranchId || originalTx.branchId);
        if (!branchId) return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' }, { status: 401 });

        const { returnTx, plan, cashOut, customerBalance } = await prisma.$transaction(async (tx) => {
            const plan = await planReturn(tx, tenantId, originalTx, items);
            // Credit first cancels the open debt; the rest is cash handed back, and
            // is what the shift close deducts from the drawer.
            const debtReduction = debtReductionFor(originalTx, plan.amount);
            const cashOut = plan.amount - debtReduction;

            const returnTx = await tx.transaction.create({
                data: {
                    type: 'RETURN',
                    totalAmount: -plan.amount,
                    paymentMethod: 'CASH',
                    paidAmount: cashOut,
                    date: new Date(),
                    tenant: { connect: { id: tenantId } },
                    branch: { connect: { id: branchId } },
                    // Links the return to the sale it came from, so the over-return
                    // guard sees it next time.
                    originalTxId: originalTransactionId,
                    // Recorded against the user who processed it, so it lands in
                    // *their* shift, not the original cashier's.
                    ...(userId ? { user: { connect: { id: userId } } } : {}),
                    ...(originalTx.customerId ? { customer: { connect: { id: originalTx.customerId } } } : {})
                }
            });

            await tx.transactionItem.createMany({
                data: plan.lines.map(l => ({
                    transactionId: returnTx.id,
                    productId: l.productId,
                    unitId:    l.unitId,
                    quantity:  l.quantity,
                    price:     -l.unitPrice, // Negative price for return
                    cost:      l.cost,
                })),
            });

            await restockReturnedLines(tx, tenantId, branchId, plan.lines);

            let customerBalance: number | null = null;
            if (debtReduction > 0 && originalTx.customerId) {
                const c = await tx.customer.update({
                    where: { id: originalTx.customerId, tenantId },
                    data: { balance: { decrement: debtReduction } }
                });
                customerBalance = Number(c.balance);
            }

            return { returnTx, plan, cashOut, customerBalance };
        }, { timeout: 30000 });

        enqueueSync('transactions', 'INSERT', returnTx.id, {
            cloudId:       returnTx.id,
            type:          'RETURN',
            totalAmount:   -plan.amount,
            date:          returnTx.date ?? new Date(),
            userId:        userId ?? null,
            customerId:    originalTx.customerId ?? null,
            notes:         `إرجاع من فاتورة ${originalTransactionId}`,
            discount:      0,
            paymentMethod: 'CASH',
            paidAmount:    cashOut,
            originalTxId:  originalTransactionId,
            items:         plan.lines.map(l => ({
                productId: l.productId,
                unitId:    l.unitId,
                quantity:  l.quantity,
                price:     -l.unitPrice,
                cost:      l.cost,
            })),
        })

        if (customerBalance != null && originalTx.customerId) {
            enqueueSync('customers', 'UPDATE', originalTx.customerId, { id: originalTx.customerId, balance: customerBalance });
        }

        await logActionAs(auth, 'RETURN', 'Transaction', returnTx.id,
            `Return from invoice ${originalTransactionId} — amount: ${plan.amount}`);

        return NextResponse.json({ success: true, returnId: returnTx.id, amount: plan.amount, cashOut });

    } catch (error) {
        if (error instanceof ReturnError) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error('Return Error:', error);
        return NextResponse.json({ error: 'Failed to process return' }, { status: 500 });
    }
}
