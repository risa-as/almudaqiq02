import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        // Branch isolation: when a specific branch is selected, only transactions of
        // that branch are visible — a cashier cannot fetch/refund another branch's invoice.
        const branchId = request.nextUrl.searchParams.get('branchId');
        const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

        const include = {
            items: {
                include: {
                    product: { select: { name: true } },
                    unit: { select: { name: true } }
                }
            },
            customer: { select: { name: true, phone: true } },
            user: { select: { username: true } }
        };

        // Try direct cuid lookup first
        let transaction = await prisma.transaction.findFirst({ where: { id, tenantId, ...branchFilter }, include });

        // If not found and looks like a receipt number (numeric / padded), match the
        // stored receiptNumber (sequential, padded). Try the raw and zero-padded forms.
        if (!transaction && /^\d+$/.test(id)) {
            const padded = id.padStart(8, '0');
            transaction = await prisma.transaction.findFirst({
                where: { tenantId, ...branchFilter, receiptNumber: { in: [id, padded] } },
                include,
            });

            // Legacy fallback: older rows without a stored receiptNumber → ordinal position
            if (!transaction) {
                const ordinal = parseInt(id, 10);
                const allIds = await prisma.transaction.findMany({
                    where: { tenantId, ...branchFilter },
                    orderBy: { date: 'asc' },
                    select: { id: true }
                });
                const targetId = allIds[ordinal - 1]?.id;
                if (targetId) {
                    transaction = await prisma.transaction.findFirst({ where: { id: targetId, tenantId, ...branchFilter }, include });
                }
            }
        }

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Failed to fetch transaction:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
