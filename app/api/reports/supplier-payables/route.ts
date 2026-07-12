import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-helpers';
import { getTenantPrisma } from '@/lib/multi-tenant/prisma';

export const dynamic = 'force-dynamic';

/**
 * Supplier payables report (مستحقات الموردين).
 *
 * Balance convention (same as app/api/suppliers/[id]/adjust-balance):
 *  - No branch selected → the global stored `supplier.balance` field.
 *  - Branch selected    → computed from that branch's SupplierLedger entries:
 *    PURCHASE adds to what we owe, PAYMENT / RETURN subtract.
 */
export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { tenantId } = auth;
    const db = getTenantPrisma(tenantId);

    const { searchParams } = request.nextUrl;
    const branchParam = searchParams.get('branchId');
    const branchId = branchParam && branchParam !== 'all' ? branchParam : null;

    // Validate the branch belongs to this tenant (tenant-scoped client injects tenantId).
    if (branchId) {
        const branch = await db.branch.findFirst({ where: { id: branchId }, select: { id: true } });
        if (!branch) return NextResponse.json({ error: 'الفرع غير موجود' }, { status: 400 });
    }

    // Suppliers are tenant-shared — auto-scoped by the tenant client.
    const suppliers = await db.supplier.findMany({
        select: { id: true, name: true, phone: true, balance: true },
    });
    const supplierIds = suppliers.map(s => s.id);

    // Branch-scoped balances from the ledger (SupplierLedger has no tenantId —
    // safety comes from restricting to this tenant's supplier ids).
    const balanceMap = new Map<string, number>();
    if (branchId && supplierIds.length > 0) {
        const grouped = await db.supplierLedger.groupBy({
            by: ['supplierId', 'type'],
            where: { supplierId: { in: supplierIds }, branchId },
            _sum: { amount: true },
        });
        for (const g of grouped) {
            const amt = Number(g._sum.amount ?? 0);
            const signed = g.type === 'PURCHASE' ? amt : -amt; // PAYMENT | RETURN subtract
            balanceMap.set(g.supplierId, (balanceMap.get(g.supplierId) ?? 0) + signed);
        }
    }

    // Last ledger entry date per supplier (branch-scoped when a branch is selected).
    const lastEntryMap = new Map<string, Date>();
    if (supplierIds.length > 0) {
        const lastEntries = await db.supplierLedger.groupBy({
            by: ['supplierId'],
            where: { supplierId: { in: supplierIds }, ...(branchId ? { branchId } : {}) },
            _max: { date: true },
        });
        for (const e of lastEntries) {
            if (e._max.date) lastEntryMap.set(e.supplierId, e._max.date);
        }
    }

    const rows = suppliers
        .map(s => ({
            id:            s.id,
            name:          s.name,
            phone:         s.phone,
            balance:       branchId ? (balanceMap.get(s.id) ?? 0) : Number(s.balance),
            lastEntryDate: lastEntryMap.get(s.id)?.toISOString() ?? null,
        }))
        .filter(r => r.balance > 0.004) // creditors only (we owe them)
        .sort((a, b) => b.balance - a.balance);

    const totalPayables = rows.reduce((s, r) => s + r.balance, 0);

    return NextResponse.json({
        summary: {
            totalPayables,
            supplierCount: rows.length,
            topSupplier:   rows.length > 0 ? { name: rows[0].name, balance: rows[0].balance } : null,
        },
        suppliers: rows,
    });
}
