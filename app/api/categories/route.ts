
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId, getAuthContext } from '@/lib/api-helpers';
import { canManageStock } from '@/lib/auth';

/** Category writes: stock roles only (middleware already blocks cashiers — defence in depth). */
async function stockTenant(): Promise<string | NextResponse> {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (!canManageStock(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return auth.tenantId;
}

/** A parent must be a category of the same tenant (Prisma's connect doesn't check). */
async function foreignParent(tenantId: string, parentId: unknown): Promise<boolean> {
    if (!parentId) return false;
    const p = await prisma.category.findFirst({ where: { id: String(parentId), tenantId }, select: { id: true } });
    return !p;
}
import { enqueueSync } from '@/lib/sync-enqueue';
import { logCloudDelete } from '@/lib/sync-delete-log';

export async function GET() {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const categories = await prisma.category.findMany({
            where: { tenantId },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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
    const tenantId = await stockTenant();
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        const body = await req.json();
        const { name, description, parentId } = body;
        if (!name || typeof name !== 'string') return NextResponse.json({ error: 'اسم القسم مطلوب' }, { status: 400 });
        if (await foreignParent(tenantId, parentId)) return NextResponse.json({ error: 'القسم الأب غير موجود' }, { status: 400 });

        const category = await prisma.category.create({
            data: {
                name,
                description,
                tenant: { connect: { id: tenantId } },
                ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
            }
        });

        enqueueSync('categories', 'INSERT', category.id, {
            id: category.id, name: category.name,
            description: category.description, parentId: category.parentId,
        });
        return NextResponse.json(category);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const tenantId = await stockTenant();
    if (tenantId instanceof NextResponse) return tenantId;

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
        if (parentId === id || await foreignParent(tenantId, parentId)) {
            return NextResponse.json({ error: 'القسم الأب غير صالح' }, { status: 400 });
        }

        const category = await prisma.category.update({
            where: { id },
            data: {
                name,
                description,
                ...(parentId ? { parent: { connect: { id: parentId } } } : { parentId: null }),
            }
        });

        enqueueSync('categories', 'UPDATE', category.id, {
            id: category.id, name: category.name,
            description: category.description, parentId: category.parentId,
        });
        return NextResponse.json(category);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// PATCH /api/categories — bulk update sortOrder
export async function PATCH(req: NextRequest) {
    const tenantId = await stockTenant();
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        const body = await req.json();
        const items: { id: string; sortOrder: number }[] = body.items;
        if (!Array.isArray(items)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

        await prisma.$transaction(
            items.map(({ id, sortOrder }) =>
                prisma.category.updateMany({
                    where: { id, tenantId },
                    data: { sortOrder },
                })
            )
        );

        // Enqueue each reordered category so the sync worker pushes sortOrder to the cloud
        for (const { id, sortOrder } of items) {
            enqueueSync('categories', 'UPDATE', id, { id, sortOrder });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const tenantId = await stockTenant();
    if (tenantId instanceof NextResponse) return tenantId;

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

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

        enqueueSync('categories', 'DELETE', id, { id });
        await logCloudDelete(tenantId, 'categories', id)
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
