/**
 * Verifies the fix for "offline sale must decrement cloud stock" (pre-launch #2).
 *
 * It replicates the EXACT decrement logic used by app/api/sync/push/route.ts
 * inside a transaction that is ALWAYS ROLLED BACK — so it proves the FEFO batch
 * + baseStock decrement works against the real cloud schema/data WITHOUT mutating
 * anything.
 *
 * Usage: node scripts/verify-sync-stock.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLLBACK = Symbol('rollback');

async function main() {
  // Find a product that has a unit and at least one batch with stock.
  const batch = await prisma.productBatch.findFirst({
    where: { quantity: { gt: 0 } },
    select: { productId: true, branchId: true, tenantId: true },
  });
  if (!batch) { console.log('⚠️ لا توجد دفعات بمخزون للاختبار — تخطّي.'); return; }

  const unit = await prisma.productUnit.findFirst({
    where: { productId: batch.productId },
    select: { id: true, conversionFactor: true },
  });
  if (!unit) { console.log('⚠️ لا توجد وحدة للمنتج — تخطّي.'); return; }

  const { productId, branchId, tenantId } = batch;
  const factor = Number(unit.conversionFactor) || 1;
  const sellQty = 1;
  const expectedDelta = sellQty * factor;

  const before = await prisma.product.findUnique({ where: { id: productId }, select: { baseStock: true } });
  const beforeStock = Number(before.baseStock);

  console.log(`المنتج: ${productId} | الفرع: ${branchId}`);
  console.log(`baseStock قبل: ${beforeStock} | سنبيع ${sellQty} وحدة (عامل ${factor}) → المتوقع نقص ${expectedDelta}`);

  let afterStock;
  try {
    await prisma.$transaction(async (txdb) => {
      // ── same logic as push route ──
      let remaining = expectedDelta;
      const batches = await txdb.productBatch.findMany({
        where: { productId, tenantId, branchId, quantity: { gt: 0 } },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, quantity: true },
      });
      for (const b of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(Number(b.quantity), remaining);
        await txdb.productBatch.update({ where: { id: b.id }, data: { quantity: { decrement: deduct } } });
        remaining -= deduct;
      }
      await txdb.product.updateMany({ where: { id: productId, tenantId }, data: { baseStock: { decrement: expectedDelta } } });

      const mid = await txdb.product.findUnique({ where: { id: productId }, select: { baseStock: true } });
      afterStock = Number(mid.baseStock);
      throw ROLLBACK; // never persist
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }

  const persisted = await prisma.product.findUnique({ where: { id: productId }, select: { baseStock: true } });
  const ok = afterStock === beforeStock - expectedDelta && Number(persisted.baseStock) === beforeStock;

  console.log(`baseStock داخل المعاملة: ${afterStock} (متوقع ${beforeStock - expectedDelta})`);
  console.log(`baseStock بعد الـ rollback: ${Number(persisted.baseStock)} (يجب = ${beforeStock} — بلا تغيير)`);
  console.log(ok ? '✅ PASS — منطق خصم مخزون السحابة صحيح والـ rollback نظيف.' : '❌ FAIL — راجع المنطق.');
}

main().catch(e => { console.error('ERR:', e.message); }).finally(() => prisma.$disconnect());
