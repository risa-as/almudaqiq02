import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logCloudDelete } from '@/lib/sync-delete-log';
import { logActionAs } from '@/lib/audit';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const tenantId = auth.tenantId;

    try {
        const body = await request.json();
        const {
            name, type, value, buyQuantity, getQuantity,
            productId, categoryId, startDate, endDate, isActive
        } = body;

        const { id: offerId } = await params;

        // Verify the offer belongs to this tenant before updating
        const existing = await prisma.offer.findFirst({
            where: { id: offerId, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        const updatedOffer = await prisma.offer.update({
            where: { id: offerId },
            data: {
                name,
                type,
                value: value !== undefined ? Number(value) : undefined,
                buyQuantity: buyQuantity ? Number(buyQuantity) : null,
                getQuantity: getQuantity ? Number(getQuantity) : null,
                // Use disconnect to clear, connect to set — avoids scalar FK null issue
                product:  productId  ? { connect: { id: String(productId)  } } : { disconnect: true },
                category: categoryId ? { connect: { id: String(categoryId) } } : { disconnect: true },
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : null,
                isActive
            }
        });

        enqueueSync('offers', 'UPDATE', updatedOffer.id, {
          id: updatedOffer.id, name: updatedOffer.name, type: updatedOffer.type,
          value: Number(updatedOffer.value),
          buyQuantity: updatedOffer.buyQuantity, getQuantity: updatedOffer.getQuantity,
          productId: updatedOffer.productId, categoryId: updatedOffer.categoryId,
          branchId: updatedOffer.branchId,
          startDate: updatedOffer.startDate, endDate: updatedOffer.endDate,
          isActive: updatedOffer.isActive,
        })

        await logActionAs(auth, 'UPDATE_OFFER', 'Offer', updatedOffer.id,
            `Updated offer: ${updatedOffer.name}`);

        return NextResponse.json(updatedOffer);
    } catch (error) {
        console.error('Failed to update offer:', error);
        return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const tenantId = auth.tenantId;

    try {
        const { id: offerId } = await params;

        // Verify the offer belongs to this tenant before deleting
        const existing = await prisma.offer.findFirst({
            where: { id: offerId, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        await prisma.offer.delete({
            where: { id: offerId }
        });

        enqueueSync('offers', 'DELETE', offerId, { id: offerId })
        await logCloudDelete(tenantId, 'offers', offerId)

        await logActionAs(auth, 'DELETE_OFFER', 'Offer', offerId,
            `Deleted offer: ${existing.name}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete offer:', error);
        return NextResponse.json({ error: 'Failed to delete offer' }, { status: 500 });
    }
}
