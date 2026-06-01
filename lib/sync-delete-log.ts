/**
 * sync-delete-log.ts
 *
 * Helper لتسجيل الحذوفات في CloudDeleteLog على السيرفر.
 *
 * الترابط:
 *   ← يُستدعى من كل DELETE route على الويب (products, categories, customers, suppliers, offers, expenses)
 *   ← يُستدعى من push/route.ts عند معالجة DELETE operations قادمة من سطح المكتب
 *   → pull/route.ts يجلب هذه السجلات ويرسلها لسطح المكتب
 *   → offline-queue.js applyPull() يطبق الحذوفات على SQLite المحلي
 *
 * لا تنسَ استدعاء هذه الدالة في كل DELETE على الويب وفي push handler.
 */

import { prisma } from '@/lib/multi-tenant/prisma'

/**
 * يكتب سجل حذف في CloudDeleteLog حتى يستطيع سطح المكتب مزامنة الحذف.
 * @param tenantId  - معرّف المنظمة (لضمان العزل بين المنظمات)
 * @param table     - اسم الجدول ('products' | 'categories' | 'customers' | ...)
 * @param recordId  - معرّف السجل المحذوف
 */
export async function logCloudDelete(
  tenantId: string,
  table: string,
  recordId: string,
): Promise<void> {
  // على سطح المكتب الحذوفات تُزامن عبر SyncQueue (enqueueSync) لا عبر CloudDeleteLog.
  // CloudDeleteLog مخصص فقط لتتبع حذوفات الويب حتى تعرف الفروع الأخرى بها عند السحب.
  if (process.env.IS_ELECTRON === '1') return

  await prisma.cloudDeleteLog.create({
    data: { tenantId, table, recordId },
  }).catch((err) => {
    // لا نوقف العملية إذا فشل تسجيل الحذف — الحذف الفعلي أهم
    console.error(`[CloudDeleteLog] Failed to log delete for ${table}/${recordId}:`, err?.message)
  })
}
