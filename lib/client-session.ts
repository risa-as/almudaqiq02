'use client'

/**
 * تنظيف كل ما يُخزَّنه العميل عن الجلسة الحالية.
 *
 * يجب أن يُنادى مع كل تسجيل خروج. الأسباب:
 *  - كاش React Query المحفوظ (rqCache) يحوي منتجات وموردين وعملاء المستأجر.
 *  - branchCache_* يحوي قائمة فروع المستأجر وصلاحية "مالك".
 *  - planFeaturesCache يحوي ميزات الخطة، وهي التي تفتح الصفحات المقيَّدة.
 *
 * بلا هذا التنظيف يرى المستخدم التالي على نفس المتصفح بيانات وواجهة
 * المستخدم السابق حتى تردّ الشبكة.
 */

import { clearPersistedQueryCache } from '@/lib/query/persist'

const SESSION_KEYS = [
  'branchCache_branches',
  'branchCache_isOwner',
  'selectedBranchId',
  'planFeaturesCache',
]

export function clearClientSession(): void {
  clearPersistedQueryCache()
  if (typeof window === 'undefined') return
  for (const key of SESSION_KEYS) {
    try { window.localStorage.removeItem(key) } catch { /* ignore */ }
  }
}
