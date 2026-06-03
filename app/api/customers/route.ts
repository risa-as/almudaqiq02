
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';
import { getTenantId, getAuthContext } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logCloudDelete } from '@/lib/sync-delete-log';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const branchId = searchParams.get('branchId');

    // Build with AND so the branch scope and the search filter never overwrite
    // each other — branch isolation must hold even while searching.
    const and: any[] = [];

    if (branchId && branchId !== 'all') {
        // Branch customers of this branch + org-level customers (branchId = null).
        // Never leak customers from other branches.
        and.push({ OR: [{ branchId }, { branchId: null }] });
    }

    if (search) {
        and.push({
            OR: [
                { name: { contains: search } },
                { phone: { contains: search } },
            ],
        });
    }

    const where: any = { tenantId, ...(and.length > 0 ? { AND: and } : {}) };

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
        const { name, phone, address, initialBalance, creditLimit, branchId: bodyBranchId } = body;

        const finalBranchId = bodyBranchId || authBranchId || null;
        const openingBalance = Number(initialBalance) || 0;
        const creditLimitNum = Math.max(0, Number(creditLimit) || 0);

        // Transaction.branchId is required, so resolve a branch for the opening
        // entry (fall back to the tenant's first branch when none is selected).
        let txBranchId: string | null = finalBranchId;
        if (openingBalance !== 0 && !txBranchId) {
            const firstBranch = await prisma.branch.findFirst({ where: { tenantId }, select: { id: true } });
            txBranchId = firstBranch?.id ?? null;
        }

        const { customer, openingTx } = await prisma.$transaction(async (tx) => {
            const customer = await tx.customer.create({
                data: {
                    name,
                    phone,
                    address,
                    balance: openingBalance,
                    creditLimit: creditLimitNum,
                    tenant: { connect: { id: tenantId } },
                    ...(finalBranchId ? { branch: { connect: { id: finalBranchId } } } : {})
                }
            });

            // Mirror the opening debt as a transaction so it shows in the account
            // statement (كشف الحساب). The balance is already set above, so this
            // entry is purely for history — it does NOT change the balance again.
            let openingTx = null;
            if (openingBalance !== 0 && txBranchId) {
                openingTx = await tx.transaction.create({
                    data: {
                        type: 'OPENING',
                        totalAmount: openingBalance,
                        paymentMethod: 'CREDIT',
                        notes: 'رصيد افتتاحي',
                        tenant:   { connect: { id: tenantId } },
                        branch:   { connect: { id: txBranchId } },
                        customer: { connect: { id: customer.id } },
                    }
                });
            }

            return { customer, openingTx };
        });

        enqueueSync('customers', 'INSERT', customer.id, {
            cloudId: customer.id, name, phone, address,
            balance: customer.balance, creditLimit: creditLimitNum, tenantId, branchId: finalBranchId,
        });

        if (openingTx) {
            enqueueSync('transactions', 'INSERT', openingTx.id, {
                cloudId:       openingTx.id,
                type:          'OPENING',
                totalAmount:   openingBalance,
                date:          openingTx.date,
                customerId:    customer.id,
                userId:        null,
                paymentMethod: 'CREDIT',
                discount:      0,
                notes:         'رصيد افتتاحي',
            });
        }

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
        const { id, name, phone, address, creditLimit } = body;

        // Verify the customer belongs to this tenant before updating
        const existing = await prisma.customer.findFirst({
            where: { id: id, tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        const hasCreditLimit = creditLimit !== undefined && creditLimit !== null;
        const creditLimitNum = hasCreditLimit ? Math.max(0, Number(creditLimit) || 0) : undefined;

        const customer = await prisma.customer.update({
            where: { id: id },
            data: { name, phone, address, ...(creditLimitNum !== undefined ? { creditLimit: creditLimitNum } : {}) }
        });

        await logAction('UPDATE_CUSTOMER', 'Customer', String(customer.id), `Updated customer Details: ${customer.name}`);

        enqueueSync('customers', 'UPDATE', customer.id, {
            id: customer.id, name, phone, address,
            ...(creditLimitNum !== undefined ? { creditLimit: creditLimitNum } : {}),
        });

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
            enqueueSync('customers', 'DELETE', customerId, { id: customerId })
            await logCloudDelete(tenantId, 'customers', customerId)
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
