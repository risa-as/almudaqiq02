
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export async function GET() {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const categories = await prisma.category.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
            include: {
                parent: { select: { name: true } },
                _count: { select: { products: true } }
            }
        });
        return NextResponse.json(categories);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const body = await req.json();
        const { name, description, parentId } = body;

        const category = await prisma.category.create({
            data: {
                name,
                description,
                tenant: { connect: { id: tenantId } },
                ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
            }
        });

        return NextResponse.json(category);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const body = await req.json();
        const { id, name, description, parentId } = body;

        // Verify the category belongs to this tenant before updating
        const existing = await prisma.category.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        const category = await prisma.category.update({
            where: { id },
            data: {
                name,
                description,
                ...(parentId ? { parent: { connect: { id: parentId } } } : { parentId: null }),
            }
        });

        return NextResponse.json(category);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        // Verify the category belongs to this tenant before deleting
        const existing = await prisma.category.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        await prisma.category.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
