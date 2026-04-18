import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json([]);
    }

    // Search logic:
    // 1. Exact Barcode Match on Unit (Highest Priority)
    // 2. Partial Name Match on Product

    try {
        // 1. Check if query matches a barcode exactly (scoped to tenant via product)
        const unitMatch = await prisma.productUnit.findFirst({
            where: {
                barcode: q,
                product: { tenantId }
            },
            include: { product: true },
        });

        if (unitMatch) {
            // Found a specific unit scan
            // Return consistent structure with 'units' array so frontend works uniformly
            return NextResponse.json([{
                id: unitMatch.product.id,
                name: unitMatch.product.name,
                baseStock: unitMatch.product.baseStock,
                units: [{
                    unitId: unitMatch.id,
                    unitName: unitMatch.name,
                    price: Number(unitMatch.price),
                    barcode: unitMatch.barcode
                }],
                matchType: 'barcode'
            }]);
        }

        // 2. If no barcode match, search by Name (Partial)
        // We fetch products that match the name, scoped to tenant
        const products = await prisma.product.findMany({
            where: {
                tenantId,
                name: { contains: q, mode: 'insensitive' },
            },
            include: {
                units: true // Include all units to let cashier choose
            },
            take: 10,
        });

        // Map to a simplified format for POS Search Grid
        const results = products.map(p => ({
            id: p.id,
            name: p.name,
            baseStock: p.baseStock,
            units: p.units.map((u: any) => ({
                unitId: u.id,
                unitName: u.name,
                price: Number(u.price),
                barcode: u.barcode,
                conversionFactor: u.conversionFactor
            })),
            matchType: 'name'
        }));

        return NextResponse.json(results);

    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
