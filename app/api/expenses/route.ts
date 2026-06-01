import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId, getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logCloudDelete } from '@/lib/sync-delete-log';

export async function GET(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const branchId = searchParams.get('branchId');

        let where: any = { tenantId };
        if (branchId && branchId !== 'all') {
            where.branchId = branchId;
        }

        const now = new Date();

        if (period === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.date = { gte: start, lte: end };
        } else if (period === 'today') {
            const start = new Date(now.setHours(0, 0, 0, 0));
            where.date = { gte: start };
        } else if (period === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            where.date = { gte: start };
        }
        // Default (or 'all') returns all, or we could default to month if needed.

        const expenses = await prisma.expense.findMany({
            where,
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(expenses);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, branchId: authBranchId } = auth;

    try {
        const body = await req.json();
        const { title, amount, category, description, date, branchId } = body;
        
        const finalBranchId = branchId || authBranchId;
        if (!finalBranchId) return NextResponse.json({ error: 'معرف الفرع مطلوب' }, { status: 400 });

        const expense = await prisma.expense.create({
            data: {
                title,
                amount: Number(amount),
                category,
                description,
                date: date ? new Date(date) : new Date(),
                tenant: { connect: { id: tenantId } },
                branch: { connect: { id: finalBranchId } }
            }
        });

        enqueueSync('expenses', 'INSERT', expense.id, {
            cloudId: expense.id, title, amount: Number(amount),
            category, description, date: expense.date, tenantId, branchId: finalBranchId,
        });

        return NextResponse.json(expense);
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

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Verify the expense belongs to this tenant before deleting
        const existing = await prisma.expense.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        await prisma.expense.delete({
            where: { id }
        });

        enqueueSync('expenses', 'DELETE', id, { id });
        await logCloudDelete(tenantId, 'expenses', id)

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const body = await req.json();
        const { id, title, amount, category, description, date } = body;

        // Verify the expense belongs to this tenant before updating
        const existing = await prisma.expense.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        const expense = await prisma.expense.update({
            where: { id },
            data: {
                title,
                amount: Number(amount),
                category,
                description,
                date: date ? new Date(date) : undefined
            }
        });

        enqueueSync('expenses', 'UPDATE', expense.id, {
            id: expense.id, title, amount: Number(amount),
            category, description, date: expense.date,
        });

        return NextResponse.json(expense);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
