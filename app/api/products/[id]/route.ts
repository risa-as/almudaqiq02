import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logAction } from '@/lib/audit';
import { getTenantId } from '@/lib/api-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

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
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { id } = await params;
        const productId = id;
        const body = await request.json();
        const { name, description, baseCost, units, supplierId } = body;

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

        // Transaction to update product and reconcile units
        const updatedProduct = await prisma.$transaction(async (tx) => {
            // 1. Update Product Basic Info
            const prod = await tx.product.update({
                where: { id: productId },
                data: {
                    name,
                    description,
                    costPrice: Number(baseCost),
                    supplierId: supplierId ? String(supplierId) : null,
                }
            });

            if (units && Array.isArray(units)) {
                for (const unit of units) {
                    if (unit.id) {
                        await tx.productUnit.update({
                            where: { id: unit.id },
                            data: {
                                name: unit.name,
                                conversionFactor: Number(unit.conversion),
                                barcode: unit.barcode,
                                price: Number(unit.price)
                            }
                        });
                    } else {
                        await tx.productUnit.create({
                            data: {
                                productId: prod.id,
                                name: unit.name,
                                conversionFactor: Number(unit.conversion),
                                barcode: unit.barcode,
                                price: Number(unit.price)
                            }
                        });
                    }
                }
            }

            return prod;
        });

        // Audit Log
        await logAction('UPDATE_PRODUCT', 'Product', String(updatedProduct.id), `Updated product: ${updatedProduct.name}`);

        return NextResponse.json(updatedProduct);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

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

        // Delete product and related units
        // Since we checked for transaction items, it should be safe to delete if no other relations exist.
        await prisma.$transaction(async (tx) => {
            await tx.productUnit.deleteMany({ where: { productId } });
            await tx.product.delete({ where: { id: productId } });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Product Error:', error);
        return NextResponse.json({ error: 'Failed to delete product.' }, { status: 500 });
    }
}
