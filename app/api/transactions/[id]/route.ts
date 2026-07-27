import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

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
                    // unit.price = catalog price — the invoice view compares it against the
                    // sold price to flag (and show) a manual price edit on that line, using
                    // the same rule the POS used to set Transaction.priceEdited.
                    unit: { select: { name: true, price: true } }
                }
            },
            customer: { select: { name: true, phone: true } },
            user: { select: { username: true } }
        };

        // Try direct cuid lookup first.
        // بنود + منتج + وحدة + عميل + مستخدم برحلة واحدة: قياسًا ~1097ms ← ~421ms.
        // سلسلة البدائل أدناه تسلسلية بطبيعتها (كلٌّ يعتمد على فشل سابقه).
        let transaction = await prisma.transaction.findFirst({ where: { id, tenantId, ...branchFilter }, include, ...RELATION_JOIN });

        // If not found and looks like a receipt number (numeric / padded), match the
        // stored receiptNumber (sequential, padded). Try the raw and zero-padded forms.
        if (!transaction && /^\d+$/.test(id)) {
            const padded = id.padStart(8, '0');
            transaction = await prisma.transaction.findFirst({
                where: { tenantId, ...branchFilter, receiptNumber: { in: [id, padded] } },
                include,
                ...RELATION_JOIN,
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
                    transaction = await prisma.transaction.findFirst({ where: { id: targetId, tenantId, ...branchFilter }, include, ...RELATION_JOIN });
                }
            }
        }

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // ── How much of each line has already been sent back ───────────────────
        // Lets the invoice view show a «returned» marker per product and cap the
        // return stepper at what is still returnable, instead of letting the cashier
        // pick a quantity the return/refund guard will only reject on submit.
        // Keyed by productId|unitId to match those guards exactly; a sale writes one
        // line per product+unit (the cart merges duplicates), so keys are unique.
        if (transaction.type === 'SALE') {
            const priorReturns = await prisma.transactionItem.findMany({
                where: { transaction: { originalTxId: transaction.id, type: { in: ['REFUND', 'RETURN'] } } },
                select: { productId: true, unitId: true, quantity: true },
            });
            const returnedMap = new Map<string, number>();
            for (const l of priorReturns) {
                const key = `${l.productId}|${l.unitId}`;
                returnedMap.set(key, (returnedMap.get(key) ?? 0) + Math.abs(Number(l.quantity)));
            }
            return NextResponse.json({
                ...transaction,
                items: transaction.items.map(item => ({
                    ...item,
                    returnedQuantity: returnedMap.get(`${item.productId}|${item.unitId}`) ?? 0,
                })),
            });
        }

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Failed to fetch transaction:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
