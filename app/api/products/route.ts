import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getTenantId, getAuthContext } from '@/lib/api-helpers';

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
            // When a specific branch is requested: use its batch stock (0 if no batches there).
            // When no branch filter: fall back to legacy baseStock for global view.
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
            units,
            categoryId,
            supplierId,
            initialQuantity,
            initialUnitIndex
        } = body;

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
                    categoryId: categoryId ? String(categoryId) : null, // Link Category
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
                        name: unit.name,
                        conversionFactor: Number(unit.conversion),
                        barcode: unit.barcode,
                        price: Number(unit.price),
                    },
                });
                createdUnits.push(createdUnit);
            }

            // 3. Handle Initial Stock if provided
            if (initialQuantity && Number(initialQuantity) > 0 && initialUnitIndex !== undefined) {
                const selectedUnit = createdUnits[initialUnitIndex];
                const qty = Number(initialQuantity);

                if (selectedUnit) {
                    const totalBaseQty = qty * selectedUnit.conversionFactor;

                    // Handle branch selection for initial stock
                    const firstBranch = await tx.branch.findFirst({ where: { tenantId } });
                    const targetBranchId = branchId && branchId !== 'all' ? branchId : firstBranch?.id;

                    if (targetBranchId) {
                        // Create Batch
                        await tx.productBatch.create({
                            data: {
                                productId: product.id,
                                quantity: totalBaseQty,
                                costPrice: Number(baseCost) || 0, // Assuming base cost for simplified initial stock
                                batchNumber: 'INITIAL',
                                expiryDate: null,
                                tenantId,
                                branchId: targetBranchId
                            }
                        });
                    }

                    // Update Product Stock
                    await tx.product.update({
                        where: { id: product.id },
                        data: { baseStock: totalBaseQty }
                    });
                }
            }

            return product;
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error('Failed to create product:', error);
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }
}
