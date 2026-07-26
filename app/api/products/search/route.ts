import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q        = searchParams.get('q')?.trim() || '';
    const branchId = searchParams.get('branchId');
    const specificBranch = branchId && branchId !== 'all' ? branchId : null;

    // Helper: compute actual batch stock for a list of product IDs
    const getBatchStock = async (productIds: string[]): Promise<Map<string, number>> => {
        if (productIds.length === 0) return new Map();
        const batches = await prisma.productBatch.groupBy({
            by: ['productId'],
            where: {
                tenantId,
                productId: { in: productIds },
                ...(specificBranch ? { branchId: specificBranch } : {}),
            },
            _sum: { quantity: true },
        });
        return new Map(batches.map(b => [b.productId, b._sum.quantity ?? 0]));
    };

    try {
        // 1. Exact barcode match (highest priority)
        const unitMatch = q
            ? await prisma.productUnit.findFirst({
                where: { barcode: q, product: { tenantId } },
                include: {
                    product: { include: { units: true } },
                },
            })
            : null;

        if (unitMatch) {
            const stockMap = await getBatchStock([unitMatch.product.id]);
            // Branch selected → use this branch's batch stock (0 if none); never leak
            // the global/other-branch baseStock. Global view → fall back to baseStock.
            const stock = specificBranch
                ? (stockMap.get(unitMatch.product.id) ?? 0)
                : (stockMap.has(unitMatch.product.id) ? (stockMap.get(unitMatch.product.id) ?? 0) : unitMatch.product.baseStock);

            return NextResponse.json([{
                id:        unitMatch.product.id,
                name:      unitMatch.product.name,
                baseStock: stock,
                units: [{
                    unitId:           unitMatch.id,
                    unitName:         unitMatch.name,
                    price:            Number(unitMatch.price),
                    barcode:          unitMatch.barcode,
                    conversionFactor: unitMatch.conversionFactor,
                }],
                matchType: 'barcode',
            }]);
        }

        // 2. Partial name match
        const products = await prisma.product.findMany({
            where: {
                tenantId,
                ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
            },
            include: { units: true },
            // نقطة البيع تعرض قائمة أولية محدودة؛ البحث يظل مقيّدًا إلى 10 نتائج.
            orderBy: [{ isQuickSale: 'desc' }, { name: 'asc' }],
            take: q ? 10 : 20,
        });

        const stockMap = await getBatchStock(products.map(p => p.id));

        const results = products.map(p => ({
            id:        p.id,
            name:      p.name,
            // Branch selected → this branch's batch stock only (0 if none); never leak
            // global/other-branch stock. Global view → fall back to legacy baseStock.
            baseStock: specificBranch
                ? (stockMap.get(p.id) ?? 0)
                : (stockMap.has(p.id) ? (stockMap.get(p.id) ?? 0) : p.baseStock),
            units: p.units.map(u => ({
                unitId:           u.id,
                unitName:         u.name,
                price:            Number(u.price),
                barcode:          u.barcode,
                conversionFactor: u.conversionFactor,
            })),
            matchType: 'name',
        }));

        return NextResponse.json(results);

    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
