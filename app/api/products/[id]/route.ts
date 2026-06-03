import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';
import { getAuthContext } from '@/lib/api-helpers';
import { canManageStock } from '@/lib/auth';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logCloudDelete } from '@/lib/sync-delete-log';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح لك بإدارة المنتجات' }, { status: 403 });
    const tenantId = auth.tenantId;

    try {
        const { id } = await params;
        const productId = id;

        if (!productId) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const product = await prisma.product.findFirst({
            where: { id: productId, tenantId },
            include: { units: true }
        });

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json(product);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح لك بإدارة المنتجات' }, { status: 403 });
    const tenantId = auth.tenantId;

    try {
        const { id } = await params;
        const productId = id;
        const body = await request.json();
        const { name, description, baseCost, minimumStock, units, supplierId, categoryId } = body;

        if (!productId) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        // Verify product belongs to this tenant
        const existing = await prisma.product.findFirst({
            where: { id: productId, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Transaction to update product and reconcile units.
        // We collect resolvedUnits so that newly-created units get their real
        // DB-assigned id before we hand them to enqueueSync.
        const { prod: updatedProduct, resolvedUnits } = await prisma.$transaction(async (tx) => {
            const prod = await tx.product.update({
                where: { id: productId },
                data: {
                    name,
                    description,
                    costPrice: Number(baseCost),
                    minimumStock: Number(minimumStock) || 0,
                    supplierId: supplierId ? String(supplierId) : null,
                    categoryId: categoryId ? String(categoryId) : null,
                }
            });

            const resolvedUnits: Array<{
                id: string; name: string; conversionFactor: number;
                barcode: string | null; price: number;
            }> = [];

            if (units && Array.isArray(units)) {
                for (const unit of units) {
                    if (unit.id) {
                        // Scope by productId so a caller cannot update another
                        // product's / tenant's unit by passing its id.
                        await tx.productUnit.updateMany({
                            where: { id: unit.id, productId },
                            data: {
                                name: unit.name,
                                conversionFactor: Number(unit.conversion),
                                barcode: unit.barcode || null,
                                price: Number(unit.price)
                            }
                        });
                        resolvedUnits.push({
                            id: unit.id, name: unit.name,
                            conversionFactor: Number(unit.conversion),
                            barcode: unit.barcode || null, price: Number(unit.price),
                        });
                    } else {
                        // New unit — capture the generated id for sync payload.
                        const created = await tx.productUnit.create({
                            data: {
                                productId: prod.id,
                                tenantId,
                                name: unit.name,
                                conversionFactor: Number(unit.conversion),
                                barcode: unit.barcode || null,
                                price: Number(unit.price)
                            }
                        });
                        resolvedUnits.push({
                            id: created.id, name: created.name,
                            conversionFactor: Number(created.conversionFactor),
                            barcode: created.barcode, price: Number(created.price),
                        });
                    }
                }
            }

            return { prod, resolvedUnits };
        });

        await logAction('UPDATE_PRODUCT', 'Product', String(updatedProduct.id), `Updated product: ${updatedProduct.name}`);

        enqueueSync('products', 'UPDATE', updatedProduct.id, {
            id:           updatedProduct.id,
            name:         updatedProduct.name,
            description:  updatedProduct.description,
            costPrice:    Number(updatedProduct.costPrice),
            minimumStock: Number(updatedProduct.minimumStock) || 0,
            categoryId:   updatedProduct.categoryId,
            supplierId:   updatedProduct.supplierId,
            units:        resolvedUnits,
        });

        return NextResponse.json(updatedProduct);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح لك بإدارة المنتجات' }, { status: 403 });
    const tenantId = auth.tenantId;

    try {
        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.product.findFirst({ where: { id, tenantId } });
        if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

        const updated = await prisma.product.update({
            where: { id },
            data: { isQuickSale: body.isQuickSale },
        });

        enqueueSync('products', 'UPDATE', id, {
            id, isQuickSale: updated.isQuickSale,
        });

        return NextResponse.json({ isQuickSale: updated.isQuickSale });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح لك بإدارة المنتجات' }, { status: 403 });
    const tenantId = auth.tenantId;

    try {
        const { id } = await params;
        const productId = id;

        if (!productId) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        // Verify product belongs to this tenant
        const existing = await prisma.product.findFirst({
            where: { id: productId, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Check for existing transactions
        const existingTransactions = await prisma.transactionItem.findFirst({
            where: { productId }
        });

        if (existingTransactions) {
            return NextResponse.json({
                error: 'لا يمكن حذف المنتج لأنه مرتبط بعمليات بيع سابقة. يفضل تعديل المخزون أو إيقافه بدلاً من الحذف للحفاظ على السجلات المالية.'
            }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.productUnit.deleteMany({ where: { productId } });
            await tx.product.delete({ where: { id: productId } });
        });

        enqueueSync('products', 'DELETE', productId, { id: productId });
        await logCloudDelete(tenantId, 'products', productId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Product Error:', error);
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }
}
