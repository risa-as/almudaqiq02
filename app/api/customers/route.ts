
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActionAs } from '@/lib/audit';
import { getAuthContext } from '@/lib/api-helpers';
import { canAccessAdmin } from '@/lib/auth';
import { pinnedBranchId, readBranchId, resolveWriteBranchId } from '@/lib/branch-scope';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logCloudDelete } from '@/lib/sync-delete-log';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    // Branch-bound users only ever see their branch's customers + org-level ones.
    const branchId = readBranchId(auth, searchParams.get('branchId'));

    // Build with AND so the branch scope and the search filter never overwrite
    // each other — branch isolation must hold even while searching.
    const and: any[] = [];

    if (branchId) {
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

        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 });
        }
        // An explicit branch is validated against the tenant (and pinned for
        // branch-bound roles); no branch at all means an org-level customer.
        const requestedBranch = bodyBranchId || authBranchId || null;
        const finalBranchId = requestedBranch ? await resolveWriteBranchId(auth, requestedBranch) : null;
        if (requestedBranch && !finalBranchId) {
            return NextResponse.json({ error: 'الفرع غير صالح' }, { status: 400 });
        }
        // Opening debt and credit limits are financial decisions — a cashier can add
        // a customer from the POS, but only managers can open them with a balance.
        const isManager = canAccessAdmin(auth.role);
        const openingBalance = isManager ? (Number(initialBalance) || 0) : 0;
        const creditLimitNum = isManager ? Math.max(0, Number(creditLimit) || 0) : 0;

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
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;
    const pinned = pinnedBranchId(auth);

    try {
        const body = await req.json();
        const { id, name, phone, address, creditLimit } = body;

        // Verify the customer belongs to this tenant before updating
        const existing = await prisma.customer.findFirst({
            where: { id: id, tenantId, ...(pinned ? { OR: [{ branchId: pinned }, { branchId: null }] } : {}) }
        });
        if (!existing) {
            return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
        }

        // Only managers may change how much credit a customer gets.
        const hasCreditLimit = canAccessAdmin(auth.role) && creditLimit !== undefined && creditLimit !== null;
        const creditLimitNum = hasCreditLimit ? Math.max(0, Number(creditLimit) || 0) : undefined;

        const customer = await prisma.customer.update({
            where: { id: id },
            data: { name, phone, address, ...(creditLimitNum !== undefined ? { creditLimit: creditLimitNum } : {}) }
        });

        await logActionAs(auth, 'UPDATE_CUSTOMER', 'Customer', String(customer.id), `Updated customer Details: ${customer.name}`);

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
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    // Deleting a customer wipes their receivable — managers only, never the POS.
    if (!canAccessAdmin(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const { tenantId } = auth;
    const pinned = pinnedBranchId(auth);

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const customerId = id;
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, tenantId, ...(pinned ? { OR: [{ branchId: pinned }, { branchId: null }] } : {}) }
        });

        if (customer) {
            await prisma.customer.delete({
                where: { id: customerId }
            });
            await logActionAs(auth, 'DELETE_CUSTOMER', 'Customer', String(customerId), `Deleted customer: ${customer.name}`);
            enqueueSync('customers', 'DELETE', customerId, { id: customerId })
            await logCloudDelete(tenantId, 'customers', customerId)
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
