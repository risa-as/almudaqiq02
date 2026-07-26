import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logActionAs } from '@/lib/audit';

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

        // Validate each item carries the fields needed to create the return line.
        const invalid = items.some((it: any) =>
            !it.productId || !it.unitId || isNaN(Number(it.quantity)) || isNaN(Number(it.price))
        );
        if (invalid) {
            return NextResponse.json({ error: 'بيانات المواد المرتجعة غير مكتملة' }, { status: 400 });
        }

        // 1. Get Original Transaction (scoped to tenant)
        const originalTx = await prisma.transaction.findFirst({
            where: { id: originalTransactionId, tenantId },
            include: { user: true }
        });

        if (!originalTx) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        if (originalTx.type !== 'SALE') {
            return NextResponse.json({ error: 'معرف الفاتورة الأصلية غير صحيح' }, { status: 400 });
        }

        // ── Guard against over-returning ──────────────────────────────────────
        // Mirrors the refund route: sum what was sold per line and what was already
        // sent back (REFUND/RETURN linked to this sale), then reject a request that
        // exceeds the remainder. Without this the same line could be returned again
        // and again, restocking and refunding it every time.
        const [soldLines, priorReturns] = await Promise.all([
            prisma.transactionItem.findMany({
                where: { transactionId: originalTransactionId },
                select: { productId: true, unitId: true, quantity: true },
            }),
            prisma.transactionItem.findMany({
                where: { transaction: { originalTxId: originalTransactionId, type: { in: ['REFUND', 'RETURN'] } } },
                select: { productId: true, unitId: true, quantity: true },
            }),
        ]);
        const soldMap = new Map<string, number>();
        for (const l of soldLines) soldMap.set(`${l.productId}|${l.unitId}`, (soldMap.get(`${l.productId}|${l.unitId}`) ?? 0) + Number(l.quantity));
        const returnedMap = new Map<string, number>();
        for (const l of priorReturns) returnedMap.set(`${l.productId}|${l.unitId}`, (returnedMap.get(`${l.productId}|${l.unitId}`) ?? 0) + Math.abs(Number(l.quantity)));

        for (const it of items) {
            const key = `${it.productId}|${it.unitId}`;
            const remaining = (soldMap.get(key) ?? 0) - (returnedMap.get(key) ?? 0);
            if (Number(it.quantity) > remaining) {
                return NextResponse.json({
                    error: `الكمية المطلوب إرجاعها تتجاوز المتاح (المتبقّي: ${Math.max(0, remaining)})`,
                }, { status: 400 });
            }
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
                    // Links the return to the sale it came from. Without it the
                    // over-return guard above (and the refund route's) can never see
                    // a prior RETURN, so every line stayed returnable indefinitely.
                    originalTxId: originalTransactionId,
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

                const unit = await tx.productUnit.findFirst({ where: { id: item.unitId, product: { tenantId } } });
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

        enqueueSync('transactions', 'INSERT', result.id, {
            cloudId:       result.id,
            type:          'RETURN',
            totalAmount:   -refundTotal,
            date:          result.date ?? new Date(),
            userId:        originalTx.userId ?? null,
            customerId:    originalTx.customerId ?? null,
            notes:         `إرجاع من فاتورة ${originalTransactionId}`,
            discount:      0,
            paymentMethod: 'CASH',
            paidAmount:    0,
            originalTxId:  originalTransactionId,
            items:         items.map((item: any) => ({
                productId: item.productId,
                unitId:    item.unitId,
                quantity:  Number(item.quantity),
                price:     -Number(item.price),
                cost:      0,
            })),
        })

        await logActionAs(auth, 'RETURN', 'Transaction', result.id,
            `Return from invoice ${originalTransactionId} — amount: ${refundTotal}`);

        return NextResponse.json({ success: true, returnId: result.id });

    } catch (error) {
        console.error('Return Error:', error);
        return NextResponse.json({ error: 'Failed to process return' }, { status: 500 });
    }
}
