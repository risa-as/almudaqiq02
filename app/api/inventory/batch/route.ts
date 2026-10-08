import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { logAction } from '@/lib/audit';
import { enqueueSync } from '@/lib/sync-enqueue';
import { canManageStock } from '@/lib/auth';
import { resolveWriteBranchId } from '@/lib/branch-scope';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const { tenantId, branchId: authBranchId } = auth;

    try {
        const body = await request.json();
        const { productId, unitId, quantity, costPrice, expiryDate, batchNumber, supplierId, paidAmount, branchId: bodyBranchId } = body;

        // Staff are pinned to their own branch; owners book into the branch the UI
        // selected (validated against the tenant). Previously the token branch won
        // even for owners, so an admin's stock-in could land in the wrong branch.
        const branchId = await resolveWriteBranchId(auth, bodyBranchId || authBranchId);
        if (!branchId) return NextResponse.json({ error: 'غير مصرح - يجب تحديد الفرع' }, { status: 401 });

        const qtyNum  = Number(quantity);
        const costNum = parseFloat(costPrice) || 0;
        const paidNum = paidAmount ? parseFloat(paidAmount) : 0;
        if (!productId || !unitId || !Number.isFinite(qtyNum) || qtyNum <= 0 || costNum < 0 || !Number.isFinite(paidNum) || paidNum < 0) {
            return NextResponse.json(
                { error: 'بيانات غير صالحة (المنتج، الوحدة، والكمية مطلوبة)' },
                { status: 400 }
            );
        }

        // 1. Get Product and Unit info
        const [unit, supplier] = await Promise.all([
            prisma.productUnit.findFirst({ where: { id: unitId, productId, product: { tenantId } } }),
            supplierId
                ? prisma.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { id: true } })
                : Promise.resolve(null),
        ]);

        if (supplierId && !supplier) {
            return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
        }
        if (!unit) {
            return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 404 });
        }

        const product = await prisma.product.findUnique({
            where: { id: productId, tenantId }
        });

        if (!product) {
            return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
        }

        // 2. Calculate Base Quantity
        const baseQuantityToAdd = qtyNum * unit.conversionFactor;
        // Batches count whole base units (ProductBatch.quantity is an Int).
        if (!Number.isInteger(baseQuantityToAdd)) {
            return NextResponse.json({ error: 'الكمية يجب أن تكون عددًا صحيحًا من الوحدة الأساسية' }, { status: 400 });
        }

        // 3. Transaction to update stock and create batch
        const result = await prisma.$transaction(async (tx) => {
            // A. Create Batch Record
            // costPrice from frontend is per selected unit (e.g., carton price).
            // We store it per BASE unit so the Batches page shows the correct unit cost.
            const baseUnitCostPrice = (parseFloat(costPrice) || 0) / unit.conversionFactor;
            const batch = await tx.productBatch.create({
                data: {
                    tenant: { connect: { id: tenantId } },
                    product: { connect: { id: productId } },
                    branch: { connect: { id: branchId } },
                    batchNumber: batchNumber || null,
                    expiryDate: expiryDate ? new Date(expiryDate) : null,
                    quantity: baseQuantityToAdd,
                    costPrice: baseUnitCostPrice,
                }
            });

            // B. Calculate WAC (Weighted Average Cost)
            const currentStock = product.baseStock; // Existing stock
            const currentCost = Number(product.costPrice); // Existing base cost
            const newQuantity = baseQuantityToAdd;

            // The frontend passes `costPrice` as the cost PER SELECTED UNIT.
            // We need to find the cost PER BASE UNIT.
            // Example: Carton (x15) cost is $15. Base cost should be $15 / 15 = $1
            const newBaseUnitCost = (parseFloat(costPrice) || 0) / unit.conversionFactor;

            let finalCostPrice = newBaseUnitCost;

            if (currentStock > 0) {
                // Formula: ((OldStock * OldCost) + (NewQty * NewBaseCost)) / (OldStock + NewQty)
                const totalOldValue = currentStock * currentCost;
                const totalNewValue = newQuantity * newBaseUnitCost;
                const totalStock = currentStock + newQuantity;
                finalCostPrice = (totalOldValue + totalNewValue) / totalStock;
            }

            // C. Update Product
            const updatedProduct = await tx.product.update({
                where: { id: productId, tenantId },
                data: {
                    baseStock: { increment: baseQuantityToAdd },
                    costPrice: finalCostPrice,
                    ...(supplierId ? { supplierId } : {}),
                }
            });

            // D. Handle Supplier Ledger (Enterprise Feature)
            // We capture the ledger row ids returned by Prisma so we can enqueue
            // them with the SAME ids after the transaction — that way the cloud
            // upserts them idempotently instead of creating duplicates.
            let purchaseLedger: any = null;
            let paymentLedger: any = null;
            if (supplierId) {
                // Number(quantity) represents the quantity of the *selected* unit
                // costPrice represents the price of the *selected* unit
                const totalInvoiceAmount = qtyNum * costNum;
                const paid = paidNum;
                const creditAmount = totalInvoiceAmount - paid;

                // 1. Record the Purchase Invoice (Debit to Supplier's perspective, or we owe them Credit)
                purchaseLedger = await tx.supplierLedger.create({
                    data: {
                        supplierId: supplierId,
                        branchId: branchId,
                        type: 'PURCHASE',
                        amount: totalInvoiceAmount,
                        description: `فاتورة شراء مبدئية - توريد منتج: ${product.name} كمية ${baseQuantityToAdd}`
                    }
                });

                // 2. Record the Payment if any
                if (paid > 0) {
                    paymentLedger = await tx.supplierLedger.create({
                        data: {
                            supplierId: supplierId,
                            branchId: branchId,
                            type: 'PAYMENT',
                            amount: paid,
                            description: `تسديد دفعة نقدية لفاتورة الشراء`
                        }
                    });
                }

                // 3. Update Supplier Balance (We owe them the credit amount)
                if (creditAmount > 0) {
                    await tx.supplier.update({
                        where: { id: supplierId, tenantId },
                        data: {
                            balance: { increment: creditAmount }
                        }
                    });
                } else if (creditAmount < 0) { // Overpaid
                    await tx.supplier.update({
                        where: { id: supplierId, tenantId },
                        data: {
                            balance: { decrement: Math.abs(creditAmount) }
                        }
                    });
                }
            }

            return { batch, updatedProduct, purchaseLedger, paymentLedger };
        });

        const { batch, updatedProduct, purchaseLedger, paymentLedger } = result;

        // Sync ONLY the batch + WAC change.  Supplier ledger entries are synced
        // separately below with their real ids so cloud doesn't double-create them.
        enqueueSync('productBatches', 'INSERT', batch.id, {
            id:               batch.id,
            productId:        batch.productId,
            branchId:         branchId,
            quantity:         baseQuantityToAdd,
            costPrice:        Number(batch.costPrice),
            batchNumber:      batchNumber || null,
            expiryDate:       expiryDate || null,
            newBaseStock:     Number(updatedProduct.baseStock),
            newCostPrice:     Number(updatedProduct.costPrice),
        });

        // Sync ledger entries with their local ids (push handler derives the
        // supplier.balance delta from each entry's type — no separate balance sync needed).
        if (purchaseLedger) {
            enqueueSync('supplierLedger', 'INSERT', purchaseLedger.id, {
                id:          purchaseLedger.id,
                supplierId:  purchaseLedger.supplierId,
                branchId:    purchaseLedger.branchId,
                type:        purchaseLedger.type,
                amount:      Number(purchaseLedger.amount),
                description: purchaseLedger.description,
                date:        purchaseLedger.date,
            });
        }
        if (paymentLedger) {
            enqueueSync('supplierLedger', 'INSERT', paymentLedger.id, {
                id:          paymentLedger.id,
                supplierId:  paymentLedger.supplierId,
                branchId:    paymentLedger.branchId,
                type:        paymentLedger.type,
                amount:      Number(paymentLedger.amount),
                description: paymentLedger.description,
                date:        paymentLedger.date,
            });
        }

        const userRecord = auth.userId
            ? await prisma.user.findUnique({ where: { id: auth.userId }, select: { username: true } })
            : null;
        await logAction(
            'PURCHASE',
            'ProductBatch',
            batch.id,
            JSON.stringify({ product: updatedProduct.name, qty: baseQuantityToAdd, costPrice: Number(costPrice) }),
            userRecord?.username ?? 'System',
            tenantId,
            branchId
        );

        return NextResponse.json({
            success: true,
            message: 'تم إضافة المخزون بنجاح',
            data: result
        });

    } catch (error) {
        console.error('Stock In Error:', error);
        return NextResponse.json(
            { error: 'فشل في إضافة المخزون' },
            { status: 500 }
        );
    }
}
