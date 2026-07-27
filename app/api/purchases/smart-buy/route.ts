import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';
import { guardFeature } from '@/lib/plan-features';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const blocked = await guardFeature('ai_smart_buy'); if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const specificBranch = branchId && branchId !== 'all' ? branchId : null;
    const batchBranchFilter = specificBranch ? { branchId: specificBranch } : {};

    // ── Coverage window (days of stock to hold) ──
    // The suggested purchase quantity targets this many days of sales. Default 15
    // (typical for supermarkets, 10–15 days); user-adjustable from the UI.
    let coverageDays = parseInt(searchParams.get('coverageDays') ?? '', 10);
    if (!Number.isFinite(coverageDays) || coverageDays < 1) coverageDays = 15;
    if (coverageDays > 365) coverageDays = 365;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 86400000);

    try {
        // الاستعلامات الثلاثة مستقلّة تمامًا — كانت ثلاث رحلات متتالية (~1.1 ثانية).
        // expiryBatches يُجلب هنا أيضًا رغم استعماله لاحقًا.
        const [products, salesItems, expiryBatches] = await Promise.all([
            // ── 1. Products + batches + units + supplier + category ──
            // أربع علاقات: قياسًا ~1233ms ← ~504ms برحلة واحدة.
            prisma.product.findMany({
                where: { tenantId },
                include: {
                    supplier: true,
                    units: true,
                    category: { select: { name: true } },
                    batches: {
                        where: { tenantId, ...batchBranchFilter },
                        orderBy: { createdAt: 'desc' },
                    },
                },
                ...RELATION_JOIN,
            }),
            // ── 2. Sales velocity: last 30 days ──
            // quantity in TransactionItem is in the *sold unit* (e.g. carton=12 pcs).
            // We must multiply by conversionFactor to get base-unit qty so it matches baseStock.
            // قياسًا: ~764ms ← ~426ms.
            prisma.transactionItem.findMany({
                where: {
                    transaction: {
                        tenantId,
                        type: 'SALE',
                        date: { gte: thirtyDaysAgo },
                        ...(branchId && branchId !== 'all' ? { branchId } : {}),
                    },
                },
                select: {
                    productId: true,
                    quantity: true,
                    unit: { select: { conversionFactor: true } },
                    transaction: { select: { date: true } },
                },
                ...RELATION_JOIN,
            }),
            // ── 3. Expiry alerts (selected branch — or all branches in global view, next 90 days) ──
            // لا صفوف اليوم فلا يظهر فرق في القياس؛ الشكل مطابق لـ /api/offers
            // (علاقتان إلى-واحد) الذي وفّر ~196ms.
            prisma.productBatch.findMany({
                where: {
                    tenantId,
                    ...batchBranchFilter,
                    expiryDate: { lte: ninetyDaysFromNow, gte: new Date() },
                    quantity: { gt: 0 },
                },
                include: {
                    product: { select: { name: true, costPrice: true } },
                    branch: { select: { name: true } },
                },
                orderBy: { expiryDate: 'asc' },
                ...RELATION_JOIN,
            }),
        ]);

        // velocityMap: productId → { totalQty (in base units), lastSaleDate }
        const velocityMap = new Map<string, { totalQty: number; lastSaleDate: Date }>();
        for (const si of salesItems) {
            const prev = velocityMap.get(si.productId);
            // Convert sold qty to base units using the unit's conversionFactor
            const factor = si.unit?.conversionFactor ?? 1;
            const qty = Number(si.quantity) * factor;
            const date = si.transaction.date;
            if (!prev) {
                velocityMap.set(si.productId, { totalQty: qty, lastSaleDate: date });
            } else {
                prev.totalQty += qty;
                if (date > prev.lastSaleDate) prev.lastSaleDate = date;
            }
        }

        // ── 3. Expiry alerts — تُجلب أعلاه بالتوازي ──

        // ── Helper: deduce true piece cost from raw batch cost ──
        const getTruePieceCost = (rawCost: number, p: typeof products[0]): number => {
            if (rawCost <= 0) return 0;
            const baseWac = Number(p.costPrice);
            if (p.units.length === 0) return rawCost;
            if (baseWac > 0) {
                let best = rawCost;
                let minDiff = Infinity;
                for (const u of p.units) {
                    const factor = u.conversionFactor || 1;
                    if (factor === 0) continue;
                    const calc = rawCost / factor;
                    const diff = Math.abs(calc - baseWac);
                    if (diff < minDiff) { minDiff = diff; best = calc; }
                }
                return best;
            }
            const def = p.units.find(u => u.conversionFactor === 1) || p.units[0];
            const f = def?.conversionFactor || 1;
            return f > 0 ? rawCost / f : rawCost;
        };

        // ── Process products ──
        const restockList: any[]       = [];
        const priceHikes: any[]        = [];
        const supplierDealsMap         = new Map<string, any>();
        const deadStockList: any[]     = [];
        const supplierDataMap          = new Map<string, any>();

        for (const p of products) {
            if (p.batches.length === 0) continue;

            const latestBatch = p.batches[0];
            const lastPrice   = getTruePieceCost(Number(latestBatch.costPrice), p);

            // Historical price analysis (batches sorted desc = latest first)
            let lowestPrice  = lastPrice;
            const batchPrices: number[] = [];
            for (const b of p.batches) {
                const c = getTruePieceCost(Number(b.costPrice), p);
                batchPrices.push(c);
                if (c > 0 && c < lowestPrice) lowestPrice = c;
            }

            const supplierName = p.supplier?.name || 'غير محدد';
            const supplierId   = p.supplierId || null;

            // Branch-scoped on-hand stock: when a specific branch is selected, use the
            // sum of THIS branch's batches (already branch-filtered above) instead of
            // the product's global baseStock, so restock / dead-stock / coverage maths
            // reflect only the selected branch. Global view falls back to baseStock.
            const branchStock = specificBranch
                ? p.batches.reduce((sum, b) => sum + Number(b.quantity), 0)
                : Number(p.baseStock);

            // Sales velocity
            const vel     = velocityMap.get(p.id);
            const sold30  = vel?.totalQty ?? 0;
            const daily   = sold30 / 30;                       // units/day
            const daysRem = daily > 0 ? Math.floor(branchStock / daily) : (branchStock > 0 ? 999 : 0);

            // Suggested qty: enough to cover `coverageDays` of sales, with a floor
            // of "refill back up to the minimum". The coverage need is the PRIMARY
            // driver so changing coverageDays visibly changes the suggestion; the
            // min-refill floor only kicks in for slow/non-moving products.
            const restockMin   = p.minimumStock > 0 ? p.minimumStock : 10;
            const target       = Math.ceil(daily * coverageDays);   // demand for the window
            const coverageNeed = Math.max(0, target - branchStock); // units to reach the target
            const minRefill    = Math.max(0, restockMin - branchStock); // units to reach the minimum
            const suggestedQty = Math.max(coverageNeed, minRefill);
            const estimatedCost = suggestedQty * lowestPrice;

            // ── 1. Restock (below minimumStock or 10) ──
            if (branchStock <= restockMin) {
                restockList.push({
                    productId:    p.id,
                    name:         p.name,
                    categoryName: p.category?.name || 'غير مصنف',
                    currentStock: branchStock,
                    minimumStock: restockMin,
                    lastPrice,
                    lowestPrice,
                    supplierName,
                    supplierId,
                    salesVelocity:  +daily.toFixed(2),
                    daysRemaining:  daysRem,
                    suggestedQty,
                    estimatedCost:  +estimatedCost.toFixed(2),
                });
            }

            // ── 2. Price hikes (last price > lowest + 5%) ──
            if (lowestPrice > 0 && lastPrice > lowestPrice * 1.05) {
                priceHikes.push({
                    productId:   p.id,
                    name:        p.name,
                    lastPrice,
                    lowestPrice,
                    supplierName,
                    difference:  +(lastPrice - lowestPrice).toFixed(2),
                    pctIncrease: Math.round(((lastPrice - lowestPrice) / lowestPrice) * 100),
                });
            }

            // ── 3. Supplier deals (last price ≤ lowest + 2%) ──
            if (supplierId && lowestPrice > 0 && lastPrice <= lowestPrice * 1.02) {
                if (!supplierDealsMap.has(supplierId)) {
                    supplierDealsMap.set(supplierId, { supplierId, supplierName, products: [] });
                }
                supplierDealsMap.get(supplierId).products.push({
                    productId: p.id, name: p.name, price: lastPrice,
                });
            }

            // ── 4. Dead stock (has stock, 0 sales in 30 days) ──
            if (branchStock > 0 && sold30 === 0) {
                deadStockList.push({
                    productId:       p.id,
                    name:            p.name,
                    categoryName:    p.category?.name || 'غير مصنف',
                    currentStock:    branchStock,
                    lastSaleDate:    vel?.lastSaleDate?.toISOString() ?? null,
                    stockValue:      +(branchStock * Number(p.costPrice)).toFixed(2),
                    supplierName,
                    supplierId,
                });
            }

            // ── 5. Supplier scoring data ──
            if (supplierId && batchPrices.length >= 2) {
                if (!supplierDataMap.has(supplierId)) {
                    supplierDataMap.set(supplierId, {
                        supplierId, supplierName,
                        productCount: 0, allPrices: [],
                        priceIncreases: 0, priceDecreases: 0,
                        totalPurchaseValue: 0,
                    });
                }
                const sd = supplierDataMap.get(supplierId);
                sd.productCount++;
                sd.allPrices.push(...batchPrices);
                sd.totalPurchaseValue += batchPrices.reduce((s: number, c: number) => s + c, 0);
                // prices in desc order (latest first) → compare adjacent
                for (let i = 0; i < batchPrices.length - 1; i++) {
                    if (batchPrices[i] > batchPrices[i + 1]) sd.priceIncreases++;
                    else if (batchPrices[i] < batchPrices[i + 1]) sd.priceDecreases++;
                }
            }
        }

        // ── Supplier Orders: group restock by supplier ──
        const supplierOrderMap = new Map<string, any>();
        for (const item of restockList) {
            const key = item.supplierId || '__unknown__';
            if (!supplierOrderMap.has(key)) {
                supplierOrderMap.set(key, {
                    supplierId:   item.supplierId,
                    supplierName: item.supplierName,
                    phone:        products.find(p => p.supplierId === item.supplierId)?.supplier?.phone || null,
                    items: [], totalCost: 0,
                });
            }
            const order = supplierOrderMap.get(key);
            order.items.push({
                productId:    item.productId,
                name:         item.name,
                categoryName: item.categoryName,
                currentStock: item.currentStock,
                suggestedQty: item.suggestedQty,
                bestPrice:    item.lowestPrice,
                totalCost:    +(item.suggestedQty * item.lowestPrice).toFixed(2),
            });
            order.totalCost = +(order.totalCost + item.suggestedQty * item.lowestPrice).toFixed(2);
        }
        const supplierOrders = Array.from(supplierOrderMap.values())
            .sort((a, b) => b.totalCost - a.totalCost);

        // ── Supplier Scores ──
        const supplierScores = Array.from(supplierDataMap.values()).map((sd: any) => {
            const prices: number[] = sd.allPrices.filter((c: number) => c > 0);
            const mean  = prices.reduce((s: number, c: number) => s + c, 0) / (prices.length || 1);
            const variance = prices.reduce((s: number, c: number) => s + (c - mean) ** 2, 0) / (prices.length || 1);
            const stability = mean > 0 ? Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / mean) * 100)) : 50;

            const totalChanges = sd.priceIncreases + sd.priceDecreases;
            const increaseRate = totalChanges > 0 ? sd.priceIncreases / totalChanges : 0;
            const score = Math.round(stability * 0.6 + (1 - increaseRate) * 100 * 0.4);

            return {
                supplierId:         sd.supplierId,
                supplierName:       sd.supplierName,
                productCount:       sd.productCount,
                avgPriceStability:  Math.round(stability),
                priceIncreaseCount: sd.priceIncreases,
                priceDecreaseCount: sd.priceDecreases,
                score,
                badge: score >= 80 ? 'EXCELLENT' : score >= 60 ? 'GOOD' : score >= 40 ? 'FAIR' : 'POOR',
            };
        }).sort((a: any, b: any) => b.score - a.score);

        // ── Expiry Alerts ──
        const now = Date.now();
        const expiryAlerts = expiryBatches.map(b => {
            const days = Math.ceil((new Date(b.expiryDate!).getTime() - now) / 86400000);
            return {
                batchId:         b.id,
                productId:       b.productId,
                productName:     b.product.name,
                branchName:      b.branch.name,
                quantity:        b.quantity,
                expiryDate:      b.expiryDate!.toISOString(),
                daysUntilExpiry: days,
                stockValue:      +(b.quantity * Number(b.product.costPrice)).toFixed(2),
                urgency:         days <= 30 ? 'CRITICAL' : days <= 60 ? 'WARNING' : 'NOTICE',
            };
        });

        // ── Summary ──
        const totalRestockBudget    = +restockList.reduce((s, i) => s + i.estimatedCost, 0).toFixed(2);
        const totalDeadStockValue   = +deadStockList.reduce((s, i) => s + i.stockValue, 0).toFixed(2);
        const criticalExpiryItems   = expiryAlerts.filter(a => a.urgency === 'CRITICAL').length;
        const avgSupplierScore      = supplierScores.length
            ? Math.round(supplierScores.reduce((s: number, sc: any) => s + sc.score, 0) / supplierScores.length)
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                restockList:   restockList.sort((a, b) => a.daysRemaining - b.daysRemaining),
                priceHikes:    priceHikes.sort((a, b) => b.pctIncrease - a.pctIncrease),
                supplierDeals: Array.from(supplierDealsMap.values()),
                supplierOrders,
                deadStock:     deadStockList.sort((a, b) => b.stockValue - a.stockValue),
                supplierScores,
                expiryAlerts,
                coverageDays,
                summary: {
                    totalRestockBudget,
                    totalRestockItems:  restockList.length,
                    totalDeadStockValue,
                    criticalExpiryItems,
                    avgSupplierScore,
                },
            },
        });

    } catch (error) {
        console.error('Smart Buy API Error:', error);
        return NextResponse.json({ error: 'فشل جلب بيانات المشتريات الذكية' }, { status: 500 });
    }
}
