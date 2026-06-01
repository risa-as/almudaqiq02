import { PrismaClient, Product, ProductBatch } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Deducts stock based on the Unit sold.
 * Logic: Convert Unit Quantity -> Base Quantity -> Deduct from batches (FIFO).
 */
export async function deductStock(
  productId: number,
  unitId: number,
  quantitySold: number, // In terms of Unit (e.g., 2 Boxes)
  txClient: any = prisma,
  branchId?: string
) {
  // 1. Get Unit details to find conversion factor
  const unit = await txClient.productUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) throw new Error('Unit not found');

  const totalBaseQuantity = quantitySold * unit.conversionFactor;

  // 2. Fetch Batches for this product scoped to the selling branch (FIFO)
  const batches = await txClient.productBatch.findMany({
    where: {
      productId,
      quantity: { gt: 0 },
      ...(branchId ? { branchId } : {}),
    },
    orderBy: [
      { expiryDate: 'asc' }, // Expires first = Out first
      { createdAt: 'asc' },
    ],
  });

  let remainingToDeduct = totalBaseQuantity;

  // 3. FIFO Deduction
  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;

    const deductAmount = Math.min(batch.quantity, remainingToDeduct);

    // Update Batch
    await txClient.productBatch.update({
      where: { id: batch.id },
      data: { quantity: { decrement: deductAmount } },
    });

    remainingToDeduct -= deductAmount;
  }

  // 4. Update Product Base Stock (Total)
  await txClient.product.update({
    where: { id: productId },
    data: { baseStock: { decrement: totalBaseQuantity } },
  });

  if (remainingToDeduct > 0) {
    console.warn(`Product ${productId} stock became negative by ${remainingToDeduct} base units.`);
    // OVERSOLD: You might want to handle negative stock logic here (e.g., create a negative batch)
  }
}

/**
 * Restores stock back to inventory based on the Unit returned (Refunds).
 * Logic: Convert Unit Quantity -> Base Quantity -> Add to the most recent batch.
 */
export async function restoreStock(
  productId: number,
  unitId: number,
  quantityRestored: number, // In terms of Unit (e.g., 2 Boxes)
  txClient: any = prisma,
  branchId?: string
) {
  // 1. Get Unit details to find conversion factor
  const unit = await txClient.productUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) throw new Error('Unit not found');

  const totalBaseQuantity = quantityRestored * unit.conversionFactor;

  // 2. Fetch the most recent batch for this product in the same branch
  const recentBatch = await txClient.productBatch.findFirst({
    where: { productId, ...(branchId ? { branchId } : {}) },
    orderBy: { createdAt: 'desc' },
  });

  if (recentBatch) {
    // Add to the existing most recent batch
    await txClient.productBatch.update({
      where: { id: recentBatch.id },
      data: { quantity: { increment: totalBaseQuantity } },
    });
  } else {
    // If no batch exists, get product cost and create a new batch
    const product = await txClient.product.findUnique({ where: { id: productId } });
    if (product) {
      await txClient.productBatch.create({
        data: {
          productId,
          quantity: totalBaseQuantity,
          costPrice: product.costPrice,
          batchNumber: `REFUND-${Date.now()}`
        }
      });
    }
  }

  // 3. Update Product Base Stock (Total)
  await prisma.product.update({
    where: { id: String(productId) },
    data: { baseStock: { increment: totalBaseQuantity } },
  });
}

/**
 * Calculates Weighted Average Cost (WAC) upon Purchase.
 * Formula: ((OldStock * OldCost) + (NewQty * NewCost)) / (OldStock + NewQty)
 */
export async function calculateWAC(
  productId: number,
  newBaseQuantity: number,
  newUnitCost: number, // Total Cost for the new batch / newBaseQuantity = Unit Cost per Base Item
) {
  const product = await prisma.product.findUnique({
    where: { id: String(productId) },
  });

  if (!product) throw new Error('Product not found');

  const oldTotalValue = Number(product.baseStock) * Number(product.costPrice);
  const newTotalValue = newBaseQuantity * newUnitCost;
  const totalStock = product.baseStock + newBaseQuantity;

  if (totalStock === 0) return 0;

  const newWAC = (oldTotalValue + newTotalValue) / totalStock;

  // Update Product Cost
  await prisma.product.update({
    where: { id: String(productId) },
    data: {
      costPrice: newWAC,
      baseStock: { increment: newBaseQuantity } // Add the new stock here
    },
  });

  return newWAC;
}

/**
 * Profit Calculation
 * Logic: Net Profit = Sales - (COGS + Expenses)
 * COGS is derived from the 'cost' field recorded at the time of TransactionItem creation using FIFO batch cost.
 */
export async function calculateProfit(startDate: Date, endDate: Date, branchId?: string, tenantId?: string) {
  // Scope by tenant (and branch when given) — never aggregate across tenants.
  const scope = {
    ...(tenantId ? { tenantId } : {}),
    ...(branchId && branchId !== 'all' ? { branchId } : {}),
    date: { gte: startDate, lte: endDate },
  };

  // Canonical model:
  //   grossSales  = Σ SALE.totalAmount
  //   returns     = Σ REFUND.totalAmount  (+ |Σ RETURN.totalAmount| for legacy records)
  //   cogs        = Σ SALE.item.cost − Σ (REFUND|RETURN).item.cost
  //   netRevenue  = grossSales − returns
  //   netProfit   = netRevenue − cogs − expenses
  const [saleAgg, saleCogs, refundAgg, returnAgg, refundCogs, expensesAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...scope, type: 'SALE' },   _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.transactionItem.aggregate({ where: { transaction: { ...scope, type: 'SALE' } }, _sum: { cost: true } }),
    prisma.transaction.aggregate({ where: { ...scope, type: 'REFUND' }, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.transaction.aggregate({ where: { ...scope, type: 'RETURN' }, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.transactionItem.aggregate({ where: { transaction: { ...scope, type: { in: ['REFUND', 'RETURN'] } } }, _sum: { cost: true } }),
    prisma.expense.aggregate({ where: scope, _sum: { amount: true } }),
  ]);

  const grossSales    = Number(saleAgg._sum.totalAmount) || 0;
  // REFUND stores +amount, legacy RETURN stores −amount → both count as positive returns
  const totalReturns  = (Number(refundAgg._sum.totalAmount) || 0) + Math.abs(Number(returnAgg._sum.totalAmount) || 0);
  const returnCount   = (refundAgg._count.id || 0) + (returnAgg._count.id || 0);
  const totalCOGS     = (Number(saleCogs._sum.cost) || 0) - (Number(refundCogs._sum.cost) || 0);
  const totalExpenses = Number(expensesAgg._sum.amount) || 0;

  const netRevenue = grossSales - totalReturns;
  const netProfit  = netRevenue - totalCOGS - totalExpenses;

  return {
    totalSales: grossSales,   // kept for backward compatibility (gross)
    grossSales,
    totalReturns,
    returnCount,
    netRevenue,
    totalCOGS,
    totalExpenses,
    netProfit,
  };
}
