import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/api-helpers';
import { logAction } from '@/lib/audit';
import { enqueueSync } from '@/lib/sync-enqueue';
import { IS_ELECTRON, RELATION_JOIN } from '@/lib/prisma-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const limit    = parseInt(searchParams.get('limit') || '50', 10);
    const branchId = searchParams.get('branchId');
    const branchFilter = (branchId && branchId !== 'all') ? { branchId } : {};

    // ── Invoice lookup (mobile «فواتيري» search box) ──────────────────────────
    // q matches either the receipt number or the name of any product sold on the
    // invoice, newest first — so a cashier can find the invoice a product was sold
    // on without the receipt. The leading '#' users copy off the card is stripped.
    // OPENING rows are excluded while searching: their receiptNumber falls back to
    // the cuid below, which substring-matches arbitrary digits the user types.
    const q = (searchParams.get('q') || '').trim().replace(/^#/, '');
    const searchFilter: Prisma.TransactionWhereInput = q
        ? {
            type: { in: ['SALE', 'RETURN', 'REFUND'] },
            OR: [
                { receiptNumber: { contains: q, mode: 'insensitive' } },
                { items: { some: { product: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
        }
        : {};

    // mine=1 narrows to the caller's own transactions (never widens) — used by the
    // cashier app so «فواتيري» keeps meaning *my* invoices when searching.
    const mine = searchParams.get('mine') === '1';
    const userFilter = (mine && auth.userId) ? { userId: auth.userId } : {};

    try {
        const transactions = await withRetry(() =>
            prisma.transaction.findMany({
                where: { tenantId, ...branchFilter, ...searchFilter, ...userFilter },
                orderBy: { date: 'desc' },
                take: limit,
                include: {
                    user:     { select: { username: true } },
                    customer: { select: { name: true } },
                    // Only while searching: the line products, so the client can show
                    // *why* an invoice matched. Skipped otherwise to keep the list cheap.
                    items: q ? { select: { product: { select: { name: true } } } } : false,
                },
                // فواتير + مستخدم + عميل: قياسًا ~937ms ← ~527ms على 45 صفًا.
                ...RELATION_JOIN,
            })
        );
        // `items` is present only when searching (conditional include above), so the
        // row shape is widened here rather than fighting Prisma's inferred union.
        const rows = transactions as unknown as (Record<string, unknown> & {
            id: string;
            receiptNumber: string | null;
            items?: { product: { name: string } | null }[];
        })[];
        return NextResponse.json(
            rows.map(({ items, ...rest }) => ({
                ...rest,
                receiptNumber: rest.receiptNumber || String(rest.id),
                ...(q
                    ? {
                        productNames: [...new Set(
                            (items ?? []).map(i => i.product?.name).filter((n): n is string => !!n)
                        )],
                    }
                    : {}),
            }))
        );
    } catch (error) {
        console.error('Fetch transactions failed:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId, branchId: authBranchId } = auth;

    try {
        const body = await request.json();
        const { items, totalAmount, shiftId, branchId: bodyBranchId } = body;
        const branchId = bodyBranchId || authBranchId;

        if (!branchId)              return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' },           { status: 401 });
        if (!items?.length)         return NextResponse.json({ error: 'السلة فارغة' },                       { status: 400 });
        if (items.some((i: any) => !i.productId || !i.unitId))
                                    return NextResponse.json({ error: 'بيانات المنتج غير مكتملة' },          { status: 400 });

        // ── Pre-fetch everything in ONE parallel round-trip ────────────────────
        const productIds = [...new Set<string>(items.map((i: any) => i.productId))];
        const unitIds    = [...new Set<string>(items.map((i: any) => i.unitId))];

        const [products, units, batches, shiftRecord, saleCount] = await Promise.all([
            prisma.product.findMany({
                where: { id: { in: productIds }, tenantId },
                select: { id: true, costPrice: true, name: true, baseStock: true }
            }),
            prisma.productUnit.findMany({
                where: { id: { in: unitIds } },
                select: { id: true, conversionFactor: true, price: true }
            }),
            // Fetch all relevant batches for stock deduction (FIFO)
            prisma.productBatch.findMany({
                where: { productId: { in: productIds }, branchId, quantity: { gt: 0 } },
                orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
                select: { id: true, productId: true, quantity: true, costPrice: true }
            }),
            // Shift validation
            shiftId
                ? prisma.cashierShift.findFirst({ where: { id: shiftId, tenantId, closedAt: null }, select: { id: true } })
                : userId
                    ? prisma.cashierShift.findFirst({ where: { userId, tenantId, closedAt: null }, select: { id: true } })
                    : Promise.resolve(null),
            // Receipt-number counter — fetched here in parallel (instead of an extra
            // round-trip inside the write transaction) to keep the sale fast.
            prisma.transaction.count({ where: { tenantId, type: 'SALE' } }),
        ]);

        // ── Credit limit guard ─────────────────────────────────────────────────
        // For credit sales (unpaid portion > 0), block when the customer's new
        // outstanding balance would exceed their creditLimit (0 = no limit).
        const totalNum    = Number(totalAmount);
        const paidNum     = body.paidAmount != null ? Number(body.paidAmount) : (body.isCredit ? 0 : totalNum);
        const creditPortion = Math.max(0, totalNum - paidNum);
        if (creditPortion > 0 && body.customerId) {
            const customer = await prisma.customer.findFirst({
                where: { id: body.customerId, tenantId },
                select: { name: true, balance: true, creditLimit: true },
            });
            const limit = Number(customer?.creditLimit ?? 0);
            const newBalance = Number(customer?.balance ?? 0) + creditPortion;
            if (limit > 0 && newBalance > limit) {
                return NextResponse.json(
                    { error: `العميل "${customer?.name ?? ''}" سيتجاوز حدّ الدين المسموح (${limit}). الرصيد بعد البيع: ${newBalance}` },
                    { status: 400 }
                );
            }
        }

        // Shift guard
        if (shiftId && !shiftRecord) {
            return NextResponse.json({ error: 'الوردية الحالية مغلقة أو غير صالحة.' }, { status: 400 });
        }
        if (!shiftId && userId && !shiftRecord) {
            return NextResponse.json({ error: 'لا توجد وردية نشطة. يرجى فتح وردية جديدة أولاً.' }, { status: 400 });
        }

        // ── Build lookup maps ──────────────────────────────────────────────────
        const productMap = new Map(products.map(p => [p.id, p]));
        const unitMap    = new Map(units.map(u => [u.id, u]));

        // ── Detect manual price edits ──────────────────────────────────────────
        // A line is "price-edited" when its sold price differs from the unit's
        // catalog price. We record this on the transaction (for the invoices badge)
        // and in the audit log. A 0.01 tolerance avoids false positives from Decimal
        // rounding. Lines with a 0 catalog price are skipped (unit has no set price).
        const editedItems: { name: string; from: number; to: number }[] = [];
        for (const item of items) {
            const unit = unitMap.get(item.unitId);
            if (!unit) continue;
            const catalogPrice = Number(unit.price);
            const soldPrice    = Number(item.price);
            if (catalogPrice > 0 && Math.abs(soldPrice - catalogPrice) > 0.01) {
                editedItems.push({
                    name: productMap.get(item.productId)?.name ?? 'منتج',
                    from: catalogPrice,
                    to:   soldPrice,
                });
            }
        }
        const priceEdited      = editedItems.length > 0;
        const discountAmount   = body.discount ? Number(body.discount) : 0;
        const discountApplied  = discountAmount > 0;

        // ── Pre-compute FIFO batch deductions + line costs from actual batches ──
        // batchDeductions: batchId → qty to decrement
        // productDeductions: productId → total base qty to decrement from baseStock
        // itemFifoCost: index → total cost (from actual batches consumed, FIFO)
        const batchDeductions   = new Map<string, number>();
        const productDeductions = new Map<string, number>();
        const itemFifoCost      = new Map<number, number>(); // item index → cost

        // Track remaining batch quantities per product (mutable copy for multi-item iteration)
        const batchRemaining = new Map<string, number>(
            batches.map(b => [b.id, Number(b.quantity)])
        );

        items.forEach((item: any, idx: number) => {
            const unit    = unitMap.get(item.unitId);
            const product = productMap.get(item.productId);
            if (!unit) { itemFifoCost.set(idx, 0); return; }

            const baseQty = Number(item.quantity) * Number(unit.conversionFactor);
            productDeductions.set(item.productId, (productDeductions.get(item.productId) ?? 0) + baseQty);

            let remaining  = baseQty;
            let totalCost  = 0;

            for (const batch of batches.filter(b => b.productId === item.productId)) {
                if (remaining <= 0) break;
                const available = batchRemaining.get(batch.id) ?? 0;
                if (available <= 0) continue;
                const deduct = Math.min(available, remaining);
                batchDeductions.set(batch.id, (batchDeductions.get(batch.id) ?? 0) + deduct);
                batchRemaining.set(batch.id, available - deduct);
                totalCost += deduct * Number(batch.costPrice);
                remaining -= deduct;
            }

            // Fallback to WAC for any qty not covered by batches (shouldn't happen normally)
            if (remaining > 0 && product) {
                totalCost += remaining * Number(product.costPrice);
            }

            itemFifoCost.set(idx, totalCost);
        });

        // ── Stock guard — never allow a sale to drive stock negative ───────────
        // Returns (negative quantity) are exempt. We compare the total base qty
        // requested per product against its current baseStock.
        const isReturn = items.some((i: any) => Number(i.quantity) < 0);
        if (!isReturn) {
            for (const [pid, needed] of productDeductions.entries()) {
                const product = productMap.get(pid);
                const available = Number(product?.baseStock ?? 0);
                if (needed > available) {
                    return NextResponse.json(
                        { error: `الكمية غير كافية للمنتج "${product?.name ?? ''}" — المتوفر ${available}، المطلوب ${needed}` },
                        { status: 400 }
                    );
                }
            }
        }

        const itemsPayload = items.map((item: any, idx: number) => ({
            productId: item.productId,
            unitId:    item.unitId,
            quantity:  Number(item.quantity),
            price:     Number(item.price),
            cost:      itemFifoCost.get(idx) ?? 0,
        }));

        // ── Single transaction: create records + apply pre-computed updates ────
        const transactionRecord = await withRetry(() => prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Receipt number — tenant-scoped sequential counter (SALE only), stored
            // permanently. Count was pre-fetched in parallel above to save a round-trip.
            const receiptNumber = String(saleCount + 1).padStart(8, '0');

            // 1. Create transaction header
            const newTx = await (tx as any).transaction.create({
                data: {
                    type: 'SALE',
                    totalAmount: Number(totalAmount),
                    date: new Date(),
                    receiptNumber,
                    tenant:    { connect: { id: tenantId } },
                    branch:    { connect: { id: branchId } },
                    ...(userId          ? { user:     { connect: { id: userId } } }          : {}),
                    ...(body.customerId ? { customer: { connect: { id: body.customerId } } } : {}),
                    notes:         body.notes    || null,
                    discount:      discountAmount,
                    priceEdited,
                    paymentMethod: body.paymentMethod || (body.isCredit ? 'CREDIT' : 'CASH'),
                    paidAmount:    body.paidAmount ? Number(body.paidAmount) : (body.isCredit ? 0 : Number(totalAmount))
                } as any,
            });

            // 2. Bulk-insert all line items in one query
            await tx.transactionItem.createMany({
                data: itemsPayload.map((item: any) => ({ ...item, transactionId: newTx.id }))
            });

            // 3. Customer balance update (credit sale only)
            if (body.isCredit && body.customerId) {
                const debtAmt = Number(totalAmount) - Number(body.paidAmount || 0);
                if (debtAmt > 0) {
                    await tx.customer.update({
                        where: { id: body.customerId, tenantId },
                        data:  { balance: { increment: debtAmt } }
                    });
                }
            }

            // 4. Apply all stock updates (pre-computed FIFO).
            // On Postgres (web) collapse the per-row decrements into ONE statement
            // each via UPDATE … FROM (VALUES …) — inside an interactive transaction
            // Prisma serialises individual updates over a single connection, so for
            // a multi-item cart on a remote DB this saves many network round-trips.
            // On SQLite (desktop) the writes are local and cheap, so we keep the loop.
            if (!IS_ELECTRON) {
                if (batchDeductions.size > 0) {
                    const rows = [...batchDeductions.entries()].map(([id, d]) => Prisma.sql`(${id}, ${d})`);
                    await tx.$executeRaw(Prisma.sql`
                        UPDATE "ProductBatch" AS b
                        SET "quantity" = b."quantity" - v.deduct::numeric
                        FROM (VALUES ${Prisma.join(rows)}) AS v(id, deduct)
                        WHERE b."id" = v.id::text
                    `);
                }
                if (productDeductions.size > 0) {
                    const rows = [...productDeductions.entries()].map(([id, q]) => Prisma.sql`(${id}, ${q})`);
                    await tx.$executeRaw(Prisma.sql`
                        UPDATE "Product" AS p
                        SET "baseStock" = p."baseStock" - v.qty::int
                        FROM (VALUES ${Prisma.join(rows)}) AS v(id, qty)
                        WHERE p."id" = v.id::text
                    `);
                }
            } else {
                for (const [batchId, deduct] of batchDeductions.entries()) {
                    await tx.productBatch.update({ where: { id: batchId }, data: { quantity: { decrement: deduct } } });
                }
                for (const [productId, baseQty] of productDeductions.entries()) {
                    await tx.product.update({ where: { id: productId }, data: { baseStock: { decrement: baseQty } } });
                }
            }

            return { ...newTx, receiptNumber };
        }, { timeout: 30000 }));

        // Enqueue for cloud sync (only runs in Electron — no-op in web mode)
        enqueueSync('transactions', 'INSERT', transactionRecord.id, {
            cloudId:       transactionRecord.id,
            type:          'SALE',
            totalAmount:   Number(totalAmount),
            receiptNumber: transactionRecord.receiptNumber,
            date:          transactionRecord.date,
            userId,
            customerId:    body.customerId ?? null,
            notes:         body.notes ?? null,
            discount:      discountAmount,
            priceEdited,
            paymentMethod: body.paymentMethod || (body.isCredit ? 'CREDIT' : 'CASH'),
            paidAmount:    body.paidAmount ? Number(body.paidAmount) : (body.isCredit ? 0 : Number(totalAmount)),
            items:         itemsPayload,
        })

        // ── Audit logging — fire-and-forget so the receipt isn't delayed ───────
        // The user lookup + audit writes are extra DB round-trips that the cashier
        // shouldn't wait on. They run in the background after the response returns.
        const receiptNo = transactionRecord.receiptNumber;
        void (async () => {
            try {
                const userRecord = userId
                    ? await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
                    : null;
                const actorName = userRecord?.username ?? 'System';

                await logAction(
                    'SALE',
                    'Transaction',
                    transactionRecord.id,
                    JSON.stringify({
                        total:         Number(totalAmount),
                        items:         items.length,
                        paymentMethod: body.paymentMethod || 'CASH',
                        ...(discountApplied ? { discount: discountAmount } : {}),
                        ...(priceEdited     ? { priceEdited: true }        : {}),
                    }),
                    actorName,
                    tenantId,
                    branchId
                );

                // Dedicated audit entries so discount / price-edit operations are
                // independently filterable in the audit page — each tied to the user.
                if (discountApplied) {
                    await logAction(
                        'APPLY_DISCOUNT',
                        'Transaction',
                        transactionRecord.id,
                        JSON.stringify({ receipt: receiptNo, discount: discountAmount, total: Number(totalAmount) }),
                        actorName,
                        tenantId,
                        branchId
                    );
                }
                if (priceEdited) {
                    await logAction(
                        'EDIT_PRICE',
                        'Transaction',
                        transactionRecord.id,
                        JSON.stringify({
                            receipt: receiptNo,
                            count:   editedItems.length,
                            items:   editedItems.map(e => `${e.name}: ${e.from} ← ${e.to}`).join(' | '),
                        }),
                        actorName,
                        tenantId,
                        branchId
                    );
                }
            } catch (e) {
                console.error('Background audit logging failed:', e);
            }
        })();

        return NextResponse.json({
            success: true,
            transactionId:  transactionRecord.id,
            receiptNumber:  transactionRecord.receiptNumber
        });

    } catch (error: any) {
        console.error('Transaction failed:', error);
        return NextResponse.json({ error: error.message || 'Transaction processing failed' }, { status: 500 });
    }
}
