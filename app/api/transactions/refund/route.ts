import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId, branchId: authBranchId } = auth;

    try {
        const body = await request.json();
        const { originalTxId, items, totalAmount, paymentMethod, paidAmount, notes } = body;

        if (!originalTxId) return NextResponse.json({ error: 'Original Transaction ID required' }, { status: 400 });
        if (!items || items.length === 0) return NextResponse.json({ error: 'No items to refund' }, { status: 400 });

        const currentUserId = userId;

        // Fetch original transaction (scoped to tenant)
        const originalTx = await prisma.transaction.findFirst({
            where: { id: originalTxId, tenantId }
        });

        if (!originalTx || originalTx.type !== 'SALE') {
            return NextResponse.json({ error: 'معرف الفاتورة الأصلية غير صحيح' }, { status: 400 });
        }

        // Use auth branchId, or fall back to the original transaction's branch
        const branchId = authBranchId || body.branchId || originalTx.branchId;
        if (!branchId) return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' }, { status: 401 });

        // Use transaction for Data Integrity
        const refundTx = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Create Refund Transaction
            const newTx = await (tx as any).transaction.create({
                data: {
                    type: 'REFUND',
                    totalAmount: Number(totalAmount),
                    date: new Date(),
                    tenant: { connect: { id: tenantId } },
                    branch: { connect: { id: branchId } },
                    ...(currentUserId ? { user: { connect: { id: currentUserId } } } : {}),
                    ...(originalTx.customerId ? { customer: { connect: { id: originalTx.customerId } } } : {}),
                    notes: notes || `إرجاع من فاتورة رقم ${originalTx.id}`,
                    paymentMethod: paymentMethod || 'CASH',
                    paidAmount: paidAmount ? Number(paidAmount) : Number(totalAmount),
                    originalTxId: originalTxId
                }
            });

            // 2. Process Items & Restore Stock
            for (const item of items) {
                const productId = item.productId;
                const unitId = item.unitId;
                const qtyToRefund = Number(item.quantity);

                // A. Record Line Item
                await tx.transactionItem.create({
                    data: {
                        transactionId: newTx.id,
                        productId: productId,
                        unitId: unitId,
                        quantity: qtyToRefund,
                        price: Number(item.price),
                        cost: Number(item.cost || 0)
                    }
                });

                // B. Restore Stock
                const unit = await tx.productUnit.findUnique({ where: { id: unitId } });
                if (!unit) throw new Error(`Unit not found for item ${productId}`);

                const totalBaseQuantity = qtyToRefund * unit.conversionFactor;

                const recentBatch = await tx.productBatch.findFirst({
                    where: { productId, tenantId },
                    orderBy: { createdAt: 'desc' },
                });

                if (recentBatch) {
                    await tx.productBatch.update({
                        where: { id: recentBatch.id },
                        data: { quantity: { increment: totalBaseQuantity } },
                    });
                } else {
                    const product = await tx.product.findUnique({ where: { id: productId, tenantId } });
                    if (product) {
                        await tx.productBatch.create({
                            data: {
                                tenant: { connect: { id: tenantId } },
                                product: { connect: { id: productId } },
                                branch: { connect: { id: branchId } },
                                quantity: totalBaseQuantity,
                                costPrice: product.costPrice,
                                batchNumber: `REFUND-${Date.now()}`
                            }
                        });
                    }
                }

                await tx.product.update({
                    where: { id: productId, tenantId },
                    data: { baseStock: { increment: totalBaseQuantity } },
                });
            }

            // 3. Update Customer Balance if the original sale was on credit
            // If the original sale was CREDIT or SPLIT, the customer has a debt.
            // Returning items reduces that debt by the refunded amount.
            if (originalTx.customerId && (originalTx.paymentMethod === 'CREDIT' || originalTx.paymentMethod === 'SPLIT')) {
                const refundAmt = Number(totalAmount);

                // For SPLIT: only the unpaid portion is a debt
                const originalDebtPortion = originalTx.paymentMethod === 'SPLIT'
                    ? Math.max(0, Number(originalTx.totalAmount) - Number(originalTx.paidAmount || 0))
                    : Number(originalTx.totalAmount);

                // Don't reduce debt more than what was actually owed from this transaction
                const debtReduction = Math.min(refundAmt, originalDebtPortion);

                if (debtReduction > 0) {
                    await (tx as any).customer.update({
                        where: { id: originalTx.customerId, tenantId },
                        data: { balance: { decrement: debtReduction } }
                    });
                }
            }

            return newTx;
        });

        return NextResponse.json({ success: true, transaction: refundTx });

    } catch (error: any) {
        console.error('Refund transaction failed:', error);
        return NextResponse.json({ error: error.message || 'Refund failed' }, { status: 500 });
    }
}
