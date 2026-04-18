
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';
import { getTenantId, getAuthContext } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const branchId = searchParams.get('branchId');

    const where: any = { tenantId };
    
    if (branchId && branchId !== 'all') {
        where.branchId = branchId;
    }

    if (search) {
        where.OR = [
            { name: { contains: search } },
            { phone: { contains: search } }
        ];
    }

    try {
        const customers = await prisma.customer.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { transactions: true } }
            }
        });
        return NextResponse.json(customers);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, branchId: authBranchId } = auth;

    try {
        const body = await req.json();
        const { name, phone, address, initialBalance, branchId: bodyBranchId } = body;
        
        const finalBranchId = bodyBranchId || authBranchId || null;

        const customer = await prisma.customer.create({
            data: {
                name,
                phone,
                address,
                balance: Number(initialBalance) || 0,
                tenant: { connect: { id: tenantId } },
                ...(finalBranchId ? { branch: { connect: { id: finalBranchId } } } : {})
            }
        });

        return NextResponse.json(customer);
    } catch (error) {
        console.error('Customer Creation Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const body = await req.json();
        const { id, name, phone, address } = body;

        // Verify the customer belongs to this tenant before updating
        const existing = await prisma.customer.findFirst({
            where: { id: id, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        const customer = await prisma.customer.update({
            where: { id: id },
            data: { name, phone, address }
        });

        await logAction('UPDATE_CUSTOMER', 'Customer', String(customer.id), `Updated customer Details: ${customer.name}`);

        return NextResponse.json(customer);
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

        const customerId = id;
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, tenantId }
        });

        if (customer) {
            await prisma.customer.delete({
                where: { id: customerId }
            });
            await logAction('DELETE_CUSTOMER', 'Customer', String(customerId), `Deleted customer: ${customer.name}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
