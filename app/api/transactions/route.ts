import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { deductStock } from '@/lib/inventory-logic';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const branchId = searchParams.get('branchId');
    const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};

    try {
        const [transactions, allIds] = await withRetry(() => Promise.all([
            prisma.transaction.findMany({
                where: { tenantId, ...branchFilter },
                orderBy: { date: 'desc' },
                take: limit,
                include: {
                    user: { select: { username: true } },
                    customer: { select: { name: true } }
                }
            }),
            prisma.transaction.findMany({
                where: { tenantId },
                orderBy: { date: 'asc' },
                select: { id: true }
            })
        ]));
        const receiptMap = new Map(allIds.map((tx, idx) => [tx.id, String(idx + 1).padStart(8, '0')]));
        return NextResponse.json(transactions.map(tx => ({ ...tx, receiptNumber: receiptMap.get(tx.id) || tx.id })));
    } catch (error) {
        console.error('Fetch transactions failed:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId, branchId: authBranchId } = auth;

    try {
        const body = await request.json();
        const { items, totalAmount, shiftId, branchId: bodyBranchId } = body;
        const branchId = bodyBranchId || authBranchId;
        if (!branchId) return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' }, { status: 401 });
        // items: [{ productId, unitId, quantity, price }]

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'No items in cart' }, { status: 400 });
        }

        const currentUserId = userId;

        // Validate items before transaction
        for (const item of items) {
            if (!item.productId || !item.unitId) {
                return NextResponse.json({ error: `بيانات المنتج غير مكتملة (معرف المنتج أو الوحدة مفقود)` }, { status: 400 });
            }
        }

        // Validate Shift
        if (shiftId) {
            const shift = await prisma.cashierShift.findFirst({
                where: { id: shiftId, tenantId, closedAt: null }
            });
            if (!shift) {
                return NextResponse.json({ error: 'الوردية الحالية مغلقة أو غير صالحة. لا يمكن إتمام عملية البيع.' }, { status: 400 });
            }
        } else if (currentUserId) {
            const activeShift = await prisma.cashierShift.findFirst({
                where: { userId: currentUserId, tenantId, closedAt: null }
            });
            if (!activeShift) {
                return NextResponse.json({ error: 'لا توجد وردية نشطة. يرجى فتح وردية جديدة أولاً.' }, { status: 400 });
            }
        }

        // Use transaction for Data Integrity
        const transactionRecord = await withRetry(() => prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Generate 8-digit sequential receipt number per tenant
            const count = await (tx as any).transaction.count({ where: { tenantId } });
            const receiptNumber = String(count + 1).padStart(8, '0');

            // 1. Create Transaction Header
            const newTx = await (tx as any).transaction.create({
                data: {
                    type: 'SALE',
                    totalAmount: Number(totalAmount),
                    date: new Date(),
                    tenant: { connect: { id: tenantId } },
                    branch: { connect: { id: branchId } },
                    ...(currentUserId ? { user: { connect: { id: currentUserId } } } : {}),
                    ...(body.customerId ? { customer: { connect: { id: body.customerId } } } : {}),
                    notes: body.notes || null,
                    discount: body.discount ? Number(body.discount) : 0,
                    paymentMethod: body.paymentMethod || (body.isCredit ? 'CREDIT' : 'CASH'),
                    paidAmount: body.paidAmount ? Number(body.paidAmount) : (body.isCredit ? 0 : Number(totalAmount))
                } as any,
            });

            // 2. Process Items
            for (const item of items) {
                // Fetch product cost and unit conversion
                const productId = item.productId;
                const unitId = item.unitId;

                const product = await tx.product.findUnique({ where: { id: productId, tenantId } });
                const unit = await tx.productUnit.findUnique({ where: { id: unitId } });

                let lineCost = 0;
                if (product && unit) {
                    const baseCost = Number(product.costPrice);
                    const conversion = Number(unit.conversionFactor);
                    const qty = Number(item.quantity);
                    lineCost = baseCost * conversion * qty;
                }

                // A. Record Line Item
                await tx.transactionItem.create({
                    data: {
                        transactionId: newTx.id,
                        productId: productId,
                        unitId: unitId,
                        quantity: item.quantity,
                        price: Number(item.price),
                        cost: lineCost
                    },
                });
            }

            // 3. Update Customer Balance (If Credit Sale)
            const isCredit = body.isCredit || false;
            if (isCredit && body.customerId) {
                // Add to debt (Positive Balance = Debt)
                const paidAmt = Number(body.paidAmount || 0);
                const debtAmt = Number(totalAmount) - paidAmt;

                if (debtAmt > 0) {
                    await tx.customer.update({
                        where: { id: body.customerId, tenantId },
                        data: { balance: { increment: debtAmt } }
                    });
                }
            }

            // 4. Deduct Stock (Run inside transaction)
            for (const item of items) {
                await deductStock(item.productId, item.unitId, item.quantity, tx);
            }

            return { ...newTx, receiptNumber };
        }));

        return NextResponse.json({ success: true, transactionId: transactionRecord.id, receiptNumber: transactionRecord.receiptNumber });

    } catch (error: any) {
        console.error('Transaction failed:', error);
        return NextResponse.json({ error: error.message || 'Transaction processing failed' }, { status: 500 });
    }
}
