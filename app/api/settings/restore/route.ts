import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-helpers';
import { isTenantAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/restore — restore a branch/tenant JSON backup (created by
 * POST /api/settings/backup).
 *
 * SAFETY MODEL — non-destructive "create-missing-only":
 *   • Verifies the file's tenantId matches the caller's tenant (no cross-tenant).
 *   • Only an owner/admin may restore.
 *   • Inserts records that are MISSING (by primary key / unique). Existing rows
 *     are never modified or deleted — so a restore can recover deleted data
 *     without clobbering newer data. FK references that don't exist are nulled
 *     or the row is skipped.
 *   • Whole thing runs in one transaction.
 */
const dt = (v: unknown) => (v ? new Date(v as string) : null);

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  if (!isTenantAdmin(auth.role)) {
    return NextResponse.json({ error: 'الاسترجاع متاح لمالك الحساب فقط' }, { status: 403 });
  }
  const { tenantId } = auth;

  let p: any;
  try { p = await request.json(); } catch { return NextResponse.json({ error: 'ملف غير صالح' }, { status: 400 }); }

  if (!p || typeof p !== 'object' || !p.exportedAt) {
    return NextResponse.json({ error: 'هذا ليس ملف نسخة احتياطية صالحاً' }, { status: 400 });
  }
  // Cross-tenant guard — never restore another tenant's backup into this account.
  if (p.tenantId && p.tenantId !== tenantId) {
    return NextResponse.json({ error: 'النسخة تخص حساباً آخر — لا يمكن استرجاعها هنا' }, { status: 403 });
  }

  const arr = (x: unknown): any[] => (Array.isArray(x) ? x : []);

  try {
    const counts = await prisma.$transaction(async (tx) => {
      const c: Record<string, number> = {};

      // Valid branches for this tenant (branch-scoped rows must target one).
      const branchIds = new Set((await tx.branch.findMany({ where: { tenantId }, select: { id: true } })).map(b => b.id));
      const userIds   = new Set((await tx.user.findMany({ where: { tenantId }, select: { id: true } })).map(u => u.id));

      // 1) Categories (parentId nulled to avoid ordering FK issues)
      if (arr(p.categories).length) {
        const r = await tx.category.createMany({
          data: arr(p.categories).map(x => ({
            id: x.id, tenantId, name: x.name,
            description: x.description ?? null, parentId: null,
            sortOrder: x.sortOrder ?? 0, createdAt: dt(x.createdAt) ?? new Date(),
          })),
          skipDuplicates: true,
        });
        c.categories = r.count;
      }

      // 2) Suppliers
      if (arr(p.suppliers).length) {
        const r = await tx.supplier.createMany({
          data: arr(p.suppliers).map(x => ({
            id: x.id, tenantId, name: x.name,
            phone: x.phone ?? null, email: x.email ?? null, address: x.address ?? null,
            balance: x.balance ?? 0, creditLimit: x.creditLimit ?? null, notes: x.notes ?? null,
            createdAt: dt(x.createdAt) ?? new Date(),
          })),
          skipDuplicates: true,
        });
        c.suppliers = r.count;
      }

      // Valid FK id sets (backup ∪ existing) for products
      const catIds = new Set((await tx.category.findMany({ where: { tenantId }, select: { id: true } })).map(x => x.id));
      const supIds = new Set((await tx.supplier.findMany({ where: { tenantId }, select: { id: true } })).map(x => x.id));

      // 3) Products (+ units) — create-if-missing per row to support nested units
      let createdProducts = 0;
      const backupProducts = arr(p.products);
      if (backupProducts.length) {
        const existing = new Set(
          (await tx.product.findMany({ where: { id: { in: backupProducts.map(x => x.id) } }, select: { id: true } })).map(x => x.id)
        );
        for (const x of backupProducts) {
          if (existing.has(x.id)) continue;
          await tx.product.create({
            data: {
              id: x.id, tenantId, name: x.name,
              description: x.description ?? null,
              categoryId: x.categoryId && catIds.has(x.categoryId) ? x.categoryId : null,
              supplierId: x.supplierId && supIds.has(x.supplierId) ? x.supplierId : null,
              costPrice: x.costPrice ?? 0, baseStock: x.baseStock ?? 0,
              minimumStock: x.minimumStock ?? 0, isQuickSale: x.isQuickSale ?? false,
              createdAt: dt(x.createdAt) ?? new Date(),
              units: Array.isArray(x.units) && x.units.length ? {
                create: x.units.map((u: any) => ({
                  id: u.id, tenantId, name: u.name,
                  conversionFactor: u.conversionFactor ?? 1,
                  barcode: u.barcode ?? null, price: u.price ?? 0,
                })),
              } : undefined,
            },
          });
          createdProducts++;
        }
        c.products = createdProducts;
      }

      const prodIds = new Set((await tx.product.findMany({ where: { tenantId }, select: { id: true } })).map(x => x.id));
      const unitIds = new Set((await tx.productUnit.findMany({ where: { tenantId }, select: { id: true } })).map(x => x.id));

      // 4) Customers
      if (arr(p.customers).length) {
        const r = await tx.customer.createMany({
          data: arr(p.customers).map(x => ({
            id: x.id, tenantId, name: x.name,
            phone: x.phone ?? null, email: x.email ?? null, address: x.address ?? null,
            balance: x.balance ?? 0, creditLimit: x.creditLimit ?? 0,
            branchId: x.branchId && branchIds.has(x.branchId) ? x.branchId : null,
            createdAt: dt(x.createdAt) ?? new Date(),
          })),
          skipDuplicates: true,
        });
        c.customers = r.count;
      }
      const custIds = new Set((await tx.customer.findMany({ where: { tenantId }, select: { id: true } })).map(x => x.id));

      // 5) Offers (FK-guarded)
      if (arr(p.offers).length) {
        const r = await tx.offer.createMany({
          data: arr(p.offers).map(x => ({
            id: x.id, tenantId, name: x.name, type: x.type, value: x.value ?? 0,
            buyQuantity: x.buyQuantity ?? null, getQuantity: x.getQuantity ?? null,
            productId: x.productId && prodIds.has(x.productId) ? x.productId : null,
            categoryId: x.categoryId && catIds.has(x.categoryId) ? x.categoryId : null,
            branchId: x.branchId && branchIds.has(x.branchId) ? x.branchId : null,
            startDate: dt(x.startDate) ?? new Date(), endDate: dt(x.endDate),
            isActive: x.isActive ?? true, createdAt: dt(x.createdAt) ?? new Date(),
          })),
          skipDuplicates: true,
        });
        c.offers = r.count;
      }

      // 6) Product batches (stock) — only for valid product + branch
      if (arr(p.productBatches).length) {
        const rows = arr(p.productBatches)
          .filter(x => prodIds.has(x.productId) && branchIds.has(x.branchId))
          .map(x => ({
            id: x.id, tenantId, productId: x.productId, branchId: x.branchId,
            batchNumber: x.batchNumber ?? null, expiryDate: dt(x.expiryDate),
            quantity: x.quantity ?? 0, costPrice: x.costPrice ?? 0,
            createdAt: dt(x.createdAt) ?? new Date(),
          }));
        if (rows.length) {
          const r = await tx.productBatch.createMany({ data: rows, skipDuplicates: true });
          c.productBatches = r.count;
        }
      }

      // 7) Expenses
      if (arr(p.expenses).length) {
        const rows = arr(p.expenses)
          .filter(x => branchIds.has(x.branchId))
          .map(x => ({
            id: x.id, tenantId, branchId: x.branchId, title: x.title,
            amount: x.amount ?? 0, category: x.category ?? null,
            description: x.description ?? null, date: dt(x.date) ?? new Date(),
          }));
        if (rows.length) {
          const r = await tx.expense.createMany({ data: rows, skipDuplicates: true });
          c.expenses = r.count;
        }
      }

      // 8) Store settings (branchId is unique → skipDuplicates protects it)
      if (arr(p.storeSettings ? [p.storeSettings] : []).length || (p.storeSettings && p.storeSettings.id)) {
        const s = p.storeSettings;
        if (s && s.branchId && branchIds.has(s.branchId)) {
          const r = await tx.storeSettings.createMany({
            data: [{
              id: s.id, tenantId, branchId: s.branchId,
              storeName: s.storeName ?? 'سوبر ماركت', storeAddress: s.storeAddress ?? null,
              storePhone: s.storePhone ?? null, taxNumber: s.taxNumber ?? null,
              taxRate: s.taxRate ?? 0, currency: s.currency ?? 'ريال',
              footerMessage: s.footerMessage ?? null, autoPrint: s.autoPrint ?? false,
            }],
            skipDuplicates: true,
          });
          c.storeSettings = r.count;
        }
      }

      // 9) Transactions (+ items) — create-if-missing per row
      let createdTx = 0;
      const backupTx = arr(p.transactions);
      if (backupTx.length) {
        const existing = new Set(
          (await tx.transaction.findMany({ where: { id: { in: backupTx.map(x => x.id) } }, select: { id: true } })).map(x => x.id)
        );
        for (const x of backupTx) {
          if (existing.has(x.id)) continue;
          if (!branchIds.has(x.branchId)) continue; // must target a real branch
          const items = Array.isArray(x.items)
            ? x.items.filter((i: any) => prodIds.has(i.productId) && unitIds.has(i.unitId))
            : [];
          await tx.transaction.create({
            data: {
              id: x.id, tenantId, branchId: x.branchId, type: x.type ?? 'SALE',
              totalAmount: x.totalAmount ?? 0, date: dt(x.date) ?? new Date(),
              userId: x.userId && userIds.has(x.userId) ? x.userId : null,
              customerId: x.customerId && custIds.has(x.customerId) ? x.customerId : null,
              notes: x.notes ?? null, discount: x.discount ?? 0,
              priceEdited: x.priceEdited ?? false, taxAmount: x.taxAmount ?? 0,
              paymentMethod: x.paymentMethod ?? 'CASH', paidAmount: x.paidAmount ?? null,
              receiptNumber: x.receiptNumber ?? null,
              items: items.length ? {
                create: items.map((i: any) => ({
                  id: i.id, productId: i.productId, unitId: i.unitId,
                  quantity: i.quantity ?? 1, price: i.price ?? 0, cost: i.cost ?? 0,
                })),
              } : undefined,
            },
          });
          createdTx++;
        }
        c.transactions = createdTx;
      }

      return c;
    }, { timeout: 120_000 });

    await logAction('RESTORE_BACKUP', 'Settings', tenantId,
      JSON.stringify({ scope: p.scope ?? 'tenant', branchId: p.branchId ?? null, counts }),
      undefined, tenantId, p.branchId ?? undefined,
    ).catch(() => {});

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ success: true, counts, total });
  } catch (err) {
    console.error('Restore error:', err);
    return NextResponse.json({ error: 'فشل الاسترجاع — لم يتم تغيير أي بيانات (تراجع تلقائي)' }, { status: 500 });
  }
}
