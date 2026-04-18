import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId, branchId: authBranchId } = auth;

    try {
        const body = await req.json();
        const { originalTransactionId, items, branchId: bodyBranchId } = body;
        const branchId = bodyBranchId || authBranchId;
        if (!branchId) return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' }, { status: 401 });
        // items: [{ itemId, quantity, price, productId, unitId }]

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'No items to return' }, { status: 400 });
        }

        // 1. Get Original Transaction (scoped to tenant)
        const originalTx = await prisma.transaction.findFirst({
            where: { id: originalTransactionId, tenantId },
            include: { user: true }
        });

        if (!originalTx) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // 2. Calculate Refund Amount
        let refundTotal = 0;

        // 3. Process Return in Transaction
        const result = await prisma.$transaction(async (tx) => {

            // Create Return Transaction
            const returnTx = await tx.transaction.create({
                data: {
                    type: 'RETURN',
                    totalAmount: 0, // Will update later
                    date: new Date(),
                    tenant: { connect: { id: tenantId } },
                    branch: { connect: { id: branchId } },
                    ...(originalTx.userId ? { user: { connect: { id: originalTx.userId } } } : {}),
                    ...(originalTx.customerId ? { customer: { connect: { id: originalTx.customerId } } } : {})
                }
            });

            for (const item of items) {
                const quantity = Number(item.quantity);
                const price = Number(item.price);
                const total = quantity * price;
                refundTotal += total;

                // A. Add Return Item
                await tx.transactionItem.create({
                    data: {
                        transactionId: returnTx.id,
                        productId: item.productId,
                        unitId: item.unitId,
                        quantity: quantity,
                        price: -price, // Negative price for return
                        cost: 0
                    }
                });

                // B. Restock Product
                // Need to find conversion factor if unit is not base unit.
                // For simplicity, assuming the passed unitId is correct and we just add to stock?
                // Actually, we should check the unit's conversion factor.

                const unit = await tx.productUnit.findUnique({ where: { id: item.unitId } });
                const conversionFactor = unit?.conversionFactor || 1;
                const stockToAdd = quantity * conversionFactor;

                await tx.product.update({
                    where: { id: item.productId, tenantId },
                    data: { baseStock: { increment: stockToAdd } }
                });
            }

            // Update Return Transaction Total (Negative)
            await tx.transaction.update({
                where: { id: returnTx.id },
                data: { totalAmount: -refundTotal }
            });

            // Reduce customer debt only if the original sale was on credit
            if (originalTx.customerId && (originalTx.paymentMethod === 'CREDIT' || originalTx.paymentMethod === 'SPLIT')) {
                const originalDebtPortion = originalTx.paymentMethod === 'SPLIT'
                    ? Math.max(0, Number(originalTx.totalAmount) - Number(originalTx.paidAmount || 0))
                    : Number(originalTx.totalAmount);

                const debtReduction = Math.min(refundTotal, originalDebtPortion);

                if (debtReduction > 0) {
                    await tx.customer.update({
                        where: { id: originalTx.customerId, tenantId },
                        data: { balance: { decrement: debtReduction } }
                    });
                }
            }

            return returnTx;
        });

        return NextResponse.json({ success: true, returnId: result.id });

    } catch (error) {
        console.error('Return Error:', error);
        return NextResponse.json({ error: 'Failed to process return' }, { status: 500 });
    }
}
