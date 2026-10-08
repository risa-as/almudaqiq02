import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/api-helpers';
import { logAction } from '@/lib/audit';
import { enqueueSync } from '@/lib/sync-enqueue';
import { IS_ELECTRON, RELATION_JOIN } from '@/lib/prisma-runtime';
import { readBranchFilter, resolveWriteBranchId } from '@/lib/branch-scope';

/** Thrown inside the sale transaction when a batch no longer holds enough stock. */
class StockRaceError extends Error {}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const limit    = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 500);
    // Branch-bound roles (cashier, manager, stock keeper) only ever see their own branch.
    const branchFilter = readBranchFilter(auth, searchParams.get('branchId'));

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
        const { items, shiftId, branchId: bodyBranchId } = body;
        // Cashiers are pinned to their token branch; an owner's choice is checked
        // against the tenant before anything is connected to it.
        const branchId = await resolveWriteBranchId(auth, bodyBranchId || authBranchId);

        if (!branchId)              return NextResponse.json({ error: 'غير مصرح - لا يوجد فرع' },           { status: 401 });
        if (!Array.isArray(items) || !items.length)
                                    return NextResponse.json({ error: 'السلة فارغة' },                       { status: 400 });
        if (items.some((i: any) => !i.productId || !i.unitId))
                                    return NextResponse.json({ error: 'بيانات المنتج غير مكتملة' },          { status: 400 });
        // A sale only ever removes stock — returns go through /api/transactions/return.
        // A zero/negative quantity here would add stock and pay cash out of the drawer.
        if (items.some((i: any) => !(Number(i.quantity) > 0) || !Number.isFinite(Number(i.quantity))
                                 || !(Number(i.price) >= 0)  || !Number.isFinite(Number(i.price))))
                                    return NextResponse.json({ error: 'كمية أو سعر غير صالح في السلة' },     { status: 400 });

        // ── Pre-fetch everything in ONE parallel round-trip ────────────────────
        const productIds = [...new Set<string>(items.map((i: any) => i.productId))];
        const unitIds    = [...new Set<string>(items.map((i: any) => i.unitId))];

        const [products, units, batches, shiftRecord, saleCount, customer] = await Promise.all([
            prisma.product.findMany({
                where: { id: { in: productIds }, tenantId },
                select: { id: true, costPrice: true, name: true, baseStock: true }
            }),
            prisma.productUnit.findMany({
                where: { id: { in: unitIds }, product: { tenantId } },
                select: { id: true, productId: true, conversionFactor: true, price: true }
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
            // Receipt-number counter. On Postgres it is re-read under a lock inside
            // the write transaction (see below); this pre-fetch is only used on SQLite.
            IS_ELECTRON ? prisma.transaction.count({ where: { tenantId, type: 'SALE' } }) : Promise.resolve(0),
            body.customerId
                ? prisma.customer.findFirst({
                    where: { id: body.customerId, tenantId },
                    select: { id: true, name: true, balance: true, creditLimit: true },
                })
                : Promise.resolve(null),
        ]);

        // Every product and unit must exist in this tenant, and each unit must belong
        // to its line's product — otherwise a foreign unit's conversion factor would
        // decide how much stock is taken.
        const productMap = new Map(products.map(p => [p.id, p]));
        const unitMap    = new Map(units.map(u => [u.id, u]));
        for (const item of items) {
            const unit = unitMap.get(item.unitId);
            if (!productMap.has(item.productId) || !unit || unit.productId !== item.productId) {
                return NextResponse.json({ error: 'منتج أو وحدة غير موجودة' }, { status: 400 });
            }
        }
        if (body.customerId && !customer) {
            return NextResponse.json({ error: 'العميل غير موجود' }, { status: 400 });
        }

        // ── Totals are recomputed from the lines, never taken on trust ─────────
        // Both POS clients send totalAmount = Σ(qty × price) − discount (offers are
        // folded into the discount). A mismatch means a tampered or buggy client, so
        // the sale is refused rather than booked at an amount nobody can explain.
        const subTotal       = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.price), 0);
        const discountAmount = Math.min(Math.max(Number(body.discount) || 0, 0), subTotal);
        const totalAmount    = subTotal - discountAmount;
        if (body.totalAmount != null && Math.abs(Number(body.totalAmount) - totalAmount) > 1) {
            return NextResponse.json({ error: 'إجمالي الفاتورة لا يطابق الأصناف — أعد المحاولة' }, { status: 400 });
        }

        // ── Credit limit guard ─────────────────────────────────────────────────
        // For credit sales (unpaid portion > 0), block when the customer's new
        // outstanding balance would exceed their creditLimit (0 = no limit).
        const totalNum    = totalAmount;
        const rawPaid     = body.paidAmount != null ? Number(body.paidAmount) : (body.isCredit ? 0 : totalNum);
        const paidNum     = Math.min(Math.max(Number.isFinite(rawPaid) ? rawPaid : 0, 0), totalNum);
        const creditPortion = Math.max(0, totalNum - paidNum);
        // An unpaid portion is a debt, so it has to be booked against someone.
        if (creditPortion > 0 && !customer) {
            return NextResponse.json({ error: 'يجب اختيار عميل لتسجيل بيع آجل' }, { status: 400 });
        }
        if (creditPortion > 0 && customer) {
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
        const discountApplied  = discountAmount > 0;

        // ── FIFO plan: which batches each line consumes, and its real cost ──────
        // batchDeductions: batchId → qty to decrement
        // productDeductions: productId → total base qty to decrement from baseStock
        // itemFifoCost: index → total cost (from actual batches consumed, FIFO)
        type BatchRow = { id: string; productId: string; quantity: unknown; costPrice: unknown };
        const planFifo = (rows: BatchRow[]) => {
            const batchDeductions   = new Map<string, number>();
            const productDeductions = new Map<string, number>();
            const itemFifoCost      = new Map<number, number>();
            const batchRemaining    = new Map<string, number>(rows.map(b => [b.id, Number(b.quantity)]));
            const branchStock       = new Map<string, number>();
            for (const b of rows) branchStock.set(b.productId, (branchStock.get(b.productId) ?? 0) + Number(b.quantity));

            items.forEach((item: any, idx: number) => {
                const unit    = unitMap.get(item.unitId)!;
                const product = productMap.get(item.productId);
                const baseQty = Number(item.quantity) * Number(unit.conversionFactor);
                productDeductions.set(item.productId, (productDeductions.get(item.productId) ?? 0) + baseQty);

                let remaining = baseQty;
                let totalCost = 0;
                for (const batch of rows) {
                    if (remaining <= 0) break;
                    if (batch.productId !== item.productId) continue;
                    const available = batchRemaining.get(batch.id) ?? 0;
                    if (available <= 0) continue;
                    const deduct = Math.min(available, remaining);
                    batchDeductions.set(batch.id, (batchDeductions.get(batch.id) ?? 0) + deduct);
                    batchRemaining.set(batch.id, available - deduct);
                    totalCost += deduct * Number(batch.costPrice);
                    remaining -= deduct;
                }
                // Fallback to WAC for any qty not covered by batches (only reachable
                // if the shortage check below is bypassed — kept for cost safety).
                if (remaining > 0 && product) totalCost += remaining * Number(product.costPrice);
                itemFifoCost.set(idx, totalCost);
            });

            // Stock is per branch (ProductBatch.branchId). Product.baseStock is the
            // sum over ALL branches, so checking it let a branch sell stock it
            // doesn't hold. A shortage is reported as { product, available, needed }.
            let shortage: { name: string; available: number; needed: number } | null = null;
            for (const [pid, needed] of productDeductions.entries()) {
                const available = branchStock.get(pid) ?? 0;
                if (needed > available) { shortage = { name: productMap.get(pid)?.name ?? '', available, needed }; break; }
            }

            const itemsPayload = items.map((item: any, idx: number) => ({
                productId: item.productId,
                unitId:    item.unitId,
                quantity:  Number(item.quantity),
                price:     Number(item.price),
                cost:      itemFifoCost.get(idx) ?? 0,
            }));
            return { batchDeductions, productDeductions, itemsPayload, shortage };
        };

        // ── Stock guard — never allow a sale to drive stock negative ───────────
        // Fast rejection from the pre-fetched batches; on Postgres the plan is
        // redone below from locked rows, which is the authoritative check.
        let plan = planFifo(batches);
        if (plan.shortage) {
            return NextResponse.json(
                { error: `الكمية غير كافية للمنتج "${plan.shortage.name}" — المتوفر ${plan.shortage.available}، المطلوب ${plan.shortage.needed}` },
                { status: 400 }
            );
        }

        // ── Single transaction: create records + apply pre-computed updates ────
        const transactionRecord = await withRetry(() => prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Receipt number — tenant-scoped sequential counter (SALE only), stored
            // permanently. On Postgres two concurrent sales would read the same count
            // and print the same number, so the count is taken under a per-tenant
            // transaction lock (released at commit). SQLite already serialises writes.
            let saleNo = saleCount;
            if (!IS_ELECTRON) {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'receipt:' + tenantId}))`;
                saleNo = await tx.transaction.count({ where: { tenantId, type: 'SALE' } });

                // Re-plan from the branch's batches as they are NOW, row-locked until
                // commit. Planning from the pre-fetched read made concurrent sales
                // collide on the same batch and be refused although stock sufficed.
                const locked = await tx.$queryRaw<BatchRow[]>(Prisma.sql`
                    SELECT "id", "productId", "quantity", "costPrice"
                    FROM "ProductBatch"
                    WHERE "branchId" = ${branchId}
                      AND "productId" IN (${Prisma.join(productIds)})
                      AND "quantity" > 0
                    ORDER BY "expiryDate" ASC NULLS LAST, "createdAt" ASC
                    FOR UPDATE
                `);
                plan = planFifo(locked);
                if (plan.shortage) throw new StockRaceError();
            }
            const { batchDeductions, productDeductions, itemsPayload } = plan;
            const receiptNumber = String(saleNo + 1).padStart(8, '0');

            // 1. Create transaction header
            const newTx = await (tx as any).transaction.create({
                data: {
                    type: 'SALE',
                    totalAmount,
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
                    paidAmount:    paidNum
                } as any,
            });

            // 2. Bulk-insert all line items in one query
            await tx.transactionItem.createMany({
                data: itemsPayload.map((item: any) => ({ ...item, transactionId: newTx.id }))
            });

            // 3. Customer balance update (credit sale only)
            let customerBalance: number | null = null;
            if (creditPortion > 0 && customer) {
                const c = await tx.customer.update({
                    where: { id: customer.id, tenantId },
                    data:  { balance: { increment: creditPortion } }
                });
                customerBalance = Number(c.balance);
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
                    // The quantity guard makes the decrement atomic: if a concurrent
                    // sale already took the stock, fewer rows match and the whole sale
                    // rolls back instead of driving a batch negative.
                    const updated = await tx.$executeRaw(Prisma.sql`
                        UPDATE "ProductBatch" AS b
                        SET "quantity" = b."quantity" - v.deduct::numeric
                        FROM (VALUES ${Prisma.join(rows)}) AS v(id, deduct)
                        WHERE b."id" = v.id::text AND b."quantity" >= v.deduct::numeric
                    `);
                    if (updated !== batchDeductions.size) throw new StockRaceError();
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

            return { ...newTx, receiptNumber, customerBalance };
        }, { timeout: 30000 }));

        // Enqueue for cloud sync (only runs in Electron — no-op in web mode)
        const { itemsPayload } = plan;
        enqueueSync('transactions', 'INSERT', transactionRecord.id, {
            cloudId:       transactionRecord.id,
            type:          'SALE',
            totalAmount:   totalAmount,
            receiptNumber: transactionRecord.receiptNumber,
            date:          transactionRecord.date,
            userId,
            customerId:    body.customerId ?? null,
            notes:         body.notes ?? null,
            discount:      discountAmount,
            priceEdited,
            paymentMethod: body.paymentMethod || (body.isCredit ? 'CREDIT' : 'CASH'),
            paidAmount:    paidNum,
            items:         itemsPayload,
        })

        // The debt lives on the customer row; push its new balance too (same as
        // /api/customers/payment) so the cloud doesn't miss offline credit sales.
        if (transactionRecord.customerBalance != null && customer) {
            enqueueSync('customers', 'UPDATE', customer.id, { id: customer.id, balance: transactionRecord.customerBalance });
        }

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
                        total:         totalAmount,
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
                        JSON.stringify({ receipt: receiptNo, discount: discountAmount, total: totalAmount }),
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
        if (error instanceof StockRaceError) {
            return NextResponse.json({ error: 'الكمية المتوفرة لم تعد كافية — بيع آخر سبقك إليها. حدّث الصفحة وأعد المحاولة' }, { status: 409 });
        }
        console.error('Transaction failed:', error);
        return NextResponse.json({ error: 'فشل إتمام عملية البيع' }, { status: 500 });
    }
}
