import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const batchBranchFilter = branchId && branchId !== 'all' ? { branchId } : {};

    try {
        // Fetch all products with their purchase transactions and supplier (scoped to tenant)
        const products = await prisma.product.findMany({
            where: { tenantId },
            include: {
                supplier: true,
                units: true,
                batches: {
                    where: { tenantId, ...batchBranchFilter },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        const restockList = [];
        const priceHikes = [];
        const supplierDealsMap = new Map();

        for (const p of products) {
            // Purchases are historically saved in ProductBatch, not TransactionItem
            if (p.batches.length === 0) continue;

            const latestBatch = p.batches[0];

            // Helper to deduce the true piece cost.
            // Since ProductBatch lacks a `unitId`, we deduce the used conversionFactor
            // by finding the one that calculates a piece cost closest to the product's known base costPrice.
            const getTruePieceCost = (rawBatchCost: number) => {
                let trueCost = rawBatchCost; // fallback to 1
                if (rawBatchCost <= 0) return 0;

                const baseWacCost = Number(p.costPrice);

                if (p.units && p.units.length > 0 && baseWacCost > 0) {
                    let minDiff = Infinity;
                    for (const u of p.units) {
                        const factor = u.conversionFactor || 1;
                        if (factor === 0) continue; // Null safety / zero prevention

                        const calculatedCost = rawBatchCost / factor;
                        const diff = Math.abs(calculatedCost - baseWacCost);

                        if (diff < minDiff) {
                            minDiff = diff;
                            trueCost = calculatedCost;
                        }
                    }
                } else if (p.units && p.units.length > 0) {
                    // Fallback: If no baseWacCost exists, assume largest factor if rawCost is suspiciously high
                    // Or default to factor 1 if we can't be sure.
                    const defaultUnit = p.units.find(u => u.conversionFactor === 1) || p.units[0];
                    const factor = defaultUnit.conversionFactor || 1;
                    trueCost = factor > 0 ? (rawBatchCost / factor) : rawBatchCost;
                }
                return trueCost;
            };

            const lastPurchasePrice = getTruePieceCost(Number(latestBatch.costPrice));

            // Find lowest historical price
            let lowestHistoricalPrice = lastPurchasePrice;
            for (const b of p.batches) {
                const truePieceCost = getTruePieceCost(Number(b.costPrice));

                if (truePieceCost < lowestHistoricalPrice) {
                    lowestHistoricalPrice = truePieceCost;
                }
            }

            const supplierName = p.supplier?.name || 'غير محدد';
            // Use the supplier attached to the product itself, or try to get it from transaction?
            // Our schema links Product to Supplier.
            const supplierId = p.supplierId;

            // 1. Restock List logic (baseStock <= 10)
            if (p.baseStock <= 10) {
                restockList.push({
                    productId: p.id,
                    name: p.name,
                    currentStock: p.baseStock,
                    lastPrice: lastPurchasePrice,
                    lowestPrice: lowestHistoricalPrice,
                    supplierName: supplierName,
                    supplierId: supplierId
                });
            }

            // 2. Price Hikes Logic: If lastPurchasePrice is > 5% higher than lowestHistoricalPrice
            if (lowestHistoricalPrice > 0 && lastPurchasePrice > lowestHistoricalPrice * 1.05) {
                priceHikes.push({
                    productId: p.id,
                    name: p.name,
                    lastPrice: lastPurchasePrice,
                    lowestPrice: lowestHistoricalPrice,
                    supplierName: supplierName,
                    difference: lastPurchasePrice - lowestHistoricalPrice
                });
            }

            // 3. Supplier Deals
            // If the latest price from this supplier is within 2% of the historical lowest,
            // we consider it a "Best Deal" from this supplier.
            if (supplierId && lowestHistoricalPrice > 0 && lastPurchasePrice <= lowestHistoricalPrice * 1.02) {
                if (!supplierDealsMap.has(supplierId)) {
                    supplierDealsMap.set(supplierId, {
                        supplierId: supplierId,
                        supplierName: supplierName,
                        products: []
                    });
                }
                supplierDealsMap.get(supplierId).products.push({
                    productId: p.id,
                    name: p.name,
                    price: lastPurchasePrice
                });
            }
        }

        const supplierDeals = Array.from(supplierDealsMap.values());

        return NextResponse.json({
            success: true,
            data: {
                restockList,
                priceHikes,
                supplierDeals
            }
        });

    } catch (error) {
        console.error('Smart Buy API Error:', error);
        return NextResponse.json({ error: 'فشل جلب بيانات المشتريات الذكية' }, { status: 500 });
    }
}
