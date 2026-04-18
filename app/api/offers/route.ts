import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') === 'true';

        const whereClause: any = { tenantId };

        if (activeOnly) {
            whereClause.isActive = true;
            whereClause.startDate = { lte: new Date() };
            // Either no endDate, or endDate is in the future
            whereClause.OR = [
                { endDate: null },
                { endDate: { gt: new Date() } }
            ];
        }

        const offers = await prisma.offer.findMany({
            where: whereClause,
            include: {
                product: { select: { id: true, name: true } },
                category: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(offers);
    } catch (error) {
        console.error('Failed to fetch offers:', error);
        return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const body = await request.json();
        const {
            name, type, value, buyQuantity, getQuantity,
            productId, categoryId, startDate, endDate, isActive
        } = body;

        if (!name || !type || value === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newOffer = await prisma.offer.create({
            data: {
                name,
                type,
                value: Number(value),
                buyQuantity: buyQuantity ? Number(buyQuantity) : null,
                getQuantity: getQuantity ? Number(getQuantity) : null,
                ...(productId  ? { product:  { connect: { id: String(productId)  } } } : {}),
                ...(categoryId ? { category: { connect: { id: String(categoryId) } } } : {}),
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                isActive: isActive ?? true,
                tenant: { connect: { id: tenantId } }
            }
        });

        return NextResponse.json(newOffer, { status: 201 });
    } catch (error) {
        console.error('Failed to create offer:', error);
        return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 });
    }
}
