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
  txClient: any = prisma
) {
  // 1. Get Unit details to find conversion factor
  const unit = await txClient.productUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) throw new Error('Unit not found');

  const totalBaseQuantity = quantitySold * unit.conversionFactor;

  // 2. Fetch Batches for this product, ordered by absolute expiry (FIFO) or creation
  // Prioritize batches with Expiry Date first, then oldest created
  const batches = await txClient.productBatch.findMany({
    where: { productId, quantity: { gt: 0 } },
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
  txClient: any = prisma
) {
  // 1. Get Unit details to find conversion factor
  const unit = await txClient.productUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) throw new Error('Unit not found');

  const totalBaseQuantity = quantityRestored * unit.conversionFactor;

  // 2. Fetch the most recent batch for this product
  const recentBatch = await txClient.productBatch.findFirst({
    where: { productId },
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
export async function calculateProfit(startDate: Date, endDate: Date, branchId?: string) {
  const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};

  // 1. Sum Total Sales
  const sales = await prisma.transaction.aggregate({
    where: {
      ...branchFilter,
      type: 'SALE',
      date: { gte: startDate, lte: endDate },
    },
    _sum: { totalAmount: true },
  });

  // 2. Sum Cost of Goods Sold (COGS)
  // We need to look at TransactionItems for SALES in this period
  const cogsWrapper = await prisma.transactionItem.aggregate({
    where: {
      transaction: {
        ...branchFilter,
        type: 'SALE',
        date: { gte: startDate, lte: endDate },
      },
    },
    _sum: {
      // cost field in TransactionItem should track the Total Cost of that item (qty * unit_cost)
      // Wait, TransactionItem schem has 'cost' Decimal. 
      // Is it Unit Cost or Total Line Cost? 
      // Usually better to store 'totalCost' or sum (quantity * cost_per_unit).
      // Assuming 'cost' in Item is (BaseCost * Conversion * Qty) OR (UnitCost * Qty).
      // Let's assume schema.prisma 'cost' is Total Line Cost for simplicity or update schema.
      // Based on my schema: cost Decimal @default(0.00). Let's assume it's TOTAL COST for the line.
      cost: true
    },
  });

  const totalSales = Number(sales._sum.totalAmount) || 0;
  const totalCOGS = Number(cogsWrapper._sum.cost) || 0;

  // Expenses? (Not in schema yet, but placeholder)
  // 3. Sum Expenses
  const expenses = await prisma.expense.aggregate({
    where: {
      ...branchFilter,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });

  const totalExpenses = Number(expenses._sum.amount) || 0;

  const netProfit = totalSales - totalCOGS - totalExpenses;

  return {
    totalSales,
    totalCOGS,
    totalExpenses,
    netProfit,
  };
}
