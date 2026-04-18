import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'الباركود مطلوب' }, { status: 400 });
    }

    try {
        // Look up the barcode in ProductUnit table, scoped to tenant via product
        const productUnit = await prisma.productUnit.findFirst({
            where: {
                barcode: code,
                product: { tenantId }
            },
            include: {
                product: {
                    include: {
                        units: true,
                        supplier: true,
                        category: true
                    }
                }
            }
        });

        if (!productUnit) {
            // Barcode not found - this is a new product
            return NextResponse.json({
                found: false,
                barcode: code,
                message: 'الباركود غير موجود في قاعدة البيانات'
            }, { status: 404 });
        }

        // Barcode found - return full product details
        return NextResponse.json({
            found: true,
            barcode: code,
            productUnit: {
                id: productUnit.id,
                name: productUnit.name,
                conversionFactor: productUnit.conversionFactor,
                barcode: productUnit.barcode
            },
            product: {
                id: productUnit.product.id,
                name: productUnit.product.name,
                baseStock: productUnit.product.baseStock,
                costPrice: productUnit.product.costPrice,
                categoryName: productUnit.product.category?.name,
                supplierName: productUnit.product.supplier?.name,
                units: productUnit.product.units.map(u => ({
                    id: u.id,
                    name: u.name,
                    conversionFactor: u.conversionFactor,
                    barcode: u.barcode,
                    price: u.price
                }))
            }
        });

    } catch (error) {
        console.error('Check Barcode Error:', error);
        return NextResponse.json({ error: 'فشل في التحقق من الباركود' }, { status: 500 });
    }
}
