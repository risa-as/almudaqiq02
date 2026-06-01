import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getTenantId, getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';

export const dynamic = 'force-dynamic'; // Prevent static generation


// GET /api/products - List all products with their units and current stock
export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const branchId = request.nextUrl.searchParams.get('branchId');
    const specificBranch = branchId && branchId !== 'all' ? branchId : null;

    try {
        const [products, batches] = await Promise.all([
            prisma.product.findMany({
                where: { tenantId },
                include: {
                    units: true,
                    category: true,
                    supplier: true,
                },
                orderBy: { id: 'desc' },
            }),
            // Aggregate stock from ProductBatch per product (branch-scoped or global)
            prisma.productBatch.groupBy({
                by: ['productId'],
                where: {
                    tenantId,
                    ...(specificBranch ? { branchId: specificBranch } : {}),
                },
                _sum: { quantity: true },
            }),
        ]);

        const batchStockMap = new Map(
            batches.map(b => [b.productId, b._sum.quantity ?? 0])
        );

        const results = products.map(p => ({
            ...p,
            // Branch selected → use batch stock for that branch (0 if no batches in this branch).
            // Global view → prefer batch sum, fallback to legacy baseStock.
            baseStock: specificBranch
                ? (batchStockMap.get(p.id) ?? 0)
                : (batchStockMap.has(p.id) ? (batchStockMap.get(p.id) ?? 0) : p.baseStock),
            matchType: 'name',
            units: p.units.map((u: any) => ({
                ...u,
                unitId: u.id,
                unitName: u.name,
                price: Number(u.price),
                barcode: u.barcode,
                conversionFactor: u.conversionFactor,
            })),
        }));

        return NextResponse.json(results);
    } catch (error) {
        console.error('Failed to fetch products:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}

// POST /api/products - Create a new product with multiple units
export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, branchId } = auth;

    try {
        const body = await request.json();
        const {
            name,
            description,
            baseCost,
            minimumStock,
            units,
            categoryId,
            supplierId,
            expiryDate,   // optional — applied to the INITIAL stock batch(es)
            isPrepaid,    // optional — if true + supplier, creates full-payment ledger entry
        } = body;

        // Normalise the expiry once so both the batch row and its sync payload agree.
        const initialExpiry = expiryDate ? new Date(expiryDate) : null;

        if (!name || !units || units.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Use transaction to ensure Product and Units are created together
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Create Product
            const product = await tx.product.create({
                data: {
                    name,
                    description,
                    costPrice: Number(baseCost) || 0,
                    baseStock: 0,
                    minimumStock: Number(minimumStock) || 0,
                    categoryId: categoryId ? String(categoryId) : null,
                    supplierId: supplierId ? String(supplierId) : null,
                    tenantId
                },
            });

            // 2. Create Units
            const createdUnits = [];
            for (const unit of units) {
                const createdUnit = await tx.productUnit.create({
                    data: {
                        productId: product.id,
                        tenantId,
                        name: unit.name,
                        conversionFactor: Number(unit.conversion),
                        barcode: unit.barcode || null,
                        price: Number(unit.price),
                    },
                });
                createdUnits.push(createdUnit);
            }

            // 3. Create initial stock batches per unit (quantity * conversionFactor)
            const firstBranch = await tx.branch.findFirst({ where: { tenantId } });
            const targetBranchId = branchId && branchId !== 'all' ? branchId : firstBranch?.id;

            let totalBaseStock = 0;
            const initialBatches: { id: string; productId: string; branchId: string; quantity: number; costPrice: number }[] = [];
            if (targetBranchId) {
                for (let idx = 0; idx < createdUnits.length; idx++) {
                    const createdUnit = createdUnits[idx];
                    const sourceUnit  = units[idx];
                    const qty = Number(sourceUnit?.initialQty) || 0;
                    if (qty <= 0) continue;

                    const baseQty = qty * createdUnit.conversionFactor;
                    totalBaseStock += baseQty;

                    const batch = await tx.productBatch.create({
                        data: {
                            productId:   product.id,
                            quantity:    baseQty,
                            costPrice:   Number(baseCost) || 0,
                            batchNumber: 'INITIAL',
                            expiryDate:  initialExpiry,
                            tenantId,
                            branchId:    targetBranchId,
                        },
                    });
                    initialBatches.push({
                        id: batch.id, productId: product.id,
                        branchId: targetBranchId, quantity: baseQty,
                        costPrice: Number(baseCost) || 0,
                    });
                }
            }

            if (totalBaseStock > 0) {
                await tx.product.update({
                    where: { id: product.id },
                    data:  { baseStock: totalBaseStock },
                });
            }

            // 4. Supplier ledger — only when supplier + initial stock exists
            let purchaseLedger: any = null;
            let paymentLedger:  any = null;
            if (supplierId && totalBaseStock > 0 && targetBranchId) {
                const totalInvoiceAmount = totalBaseStock * (Number(baseCost) || 0);
                if (totalInvoiceAmount > 0) {
                    purchaseLedger = await tx.supplierLedger.create({
                        data: {
                            supplierId,
                            branchId: targetBranchId,
                            type: 'PURCHASE',
                            amount: totalInvoiceAmount,
                            description: `فاتورة شراء ابتدائية — منتج جديد: ${name}`,
                        },
                    });

                    if (isPrepaid) {
                        paymentLedger = await tx.supplierLedger.create({
                            data: {
                                supplierId,
                                branchId: targetBranchId,
                                type: 'PAYMENT',
                                amount: totalInvoiceAmount,
                                description: `دفع مسبق كامل — منتج جديد: ${name}`,
                            },
                        });
                        // Fully paid → no balance change
                    } else {
                        // All on credit → increment supplier balance
                        await tx.supplier.update({
                            where: { id: supplierId, tenantId },
                            data: { balance: { increment: totalInvoiceAmount } },
                        });
                    }
                }
            }

            return { product, createdUnits, totalBaseStock, initialBatches, targetBranchId, purchaseLedger, paymentLedger };
        });

        // Sync product (with minimumStock and final baseStock)
        enqueueSync('products', 'INSERT', result.product.id, {
            id:           result.product.id,
            name:         result.product.name,
            description:  result.product.description,
            costPrice:    Number(result.product.costPrice),
            baseStock:    result.totalBaseStock,
            minimumStock: Number(minimumStock) || 0,
            categoryId:   result.product.categoryId,
            supplierId:   result.product.supplierId,
            tenantId:     result.product.tenantId,
            units: result.createdUnits.map((u: any) => ({
                id: u.id, name: u.name, conversionFactor: u.conversionFactor,
                barcode: u.barcode, price: Number(u.price),
            })),
        });

        // Sync each initial batch separately so cloud has real batch records
        const totalInvoice = result.totalBaseStock * (Number(baseCost) || 0);
        const syncPaid = supplierId && isPrepaid ? totalInvoice : 0;
        for (const batch of result.initialBatches) {
            enqueueSync('productBatches', 'INSERT', batch.id, {
                id:          batch.id,
                productId:   batch.productId,
                branchId:    batch.branchId,
                quantity:    batch.quantity,
                costPrice:   batch.costPrice,
                batchNumber: 'INITIAL',
                expiryDate:  initialExpiry,
                supplierId:  supplierId || null,
                paidAmount:  syncPaid,
                totalInvoiceAmount: totalInvoice,
                newBaseStock: result.totalBaseStock,
                newCostPrice: Number(baseCost) || 0,
            });
        }

        return NextResponse.json(result.product, { status: 201 });
    } catch (error) {
        console.error('Failed to create product:', error);
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }
}
