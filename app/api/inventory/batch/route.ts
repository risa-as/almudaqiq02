import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, branchId: authBranchId } = auth;

    try {
        const body = await request.json();
        const { productId, unitId, quantity, costPrice, expiryDate, batchNumber, supplierId, paidAmount, branchId: bodyBranchId } = body;

        // Admin users have null branchId in JWT; they must pass it from the frontend context
        const branchId = authBranchId || bodyBranchId;
        if (!branchId) return NextResponse.json({ error: 'غير مصرح - يجب تحديد الفرع' }, { status: 401 });

        // Validate
        if (!productId || !unitId || !quantity || quantity <= 0) {
            return NextResponse.json(
                { error: 'بيانات غير صالحة (المنتج، الوحدة، والكمية مطلوبة)' },
                { status: 400 }
            );
        }

        // 1. Get Product and Unit info
        const unit = await prisma.productUnit.findUnique({
            where: { id: unitId },
        });

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
        const baseQuantityToAdd = quantity * unit.conversionFactor;

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
            if (supplierId) {
                // Number(quantity) represents the quantity of the *selected* unit
                // costPrice represents the price of the *selected* unit
                const totalInvoiceAmount = Number(quantity) * parseFloat(costPrice);
                const paid = paidAmount ? parseFloat(paidAmount) : 0;
                const creditAmount = totalInvoiceAmount - paid;

                // 1. Record the Purchase Invoice (Debit to Supplier's perspective, or we owe them Credit)
                await tx.supplierLedger.create({
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
                    await tx.supplierLedger.create({
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

            return { batch, updatedProduct };
        });

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
