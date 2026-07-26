import type { Ionicons } from '@expo/vector-icons'
import { colors } from '@/theme'

/**
 * هرم الأدوار وقواعد الإدارة — انعكاس lib/roles.ts في الخادم حرفيًا.
 * تُستخدم للعرض فقط (إخفاء أزرار لا تنفع)؛ الخادم يفرض القاعدة نهائيًا.
 */

/** رقم أعلى = صلاحية أوسع. */
export const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  BRANCH_MANAGER: 3,
  STOCK_KEEPER: 2,
  CASHIER: 1,
}

export function roleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0
}

/** نفس قاعدة الخادم: تُدار فقط الأدوار الأدنى تمامًا من دور المنفّذ. */
export function canManage(callerRole: string | null | undefined, targetRole: string): boolean {
  if (!callerRole) return false
  return roleLevel(callerRole) > roleLevel(targetRole)
}

/** الأدوار التي يستطيع المنفّذ إسنادها عند الإضافة/التعديل (بدون سوبر أدمن). */
export function assignableRoles(callerRole: string | null | undefined): string[] {
  return ['BRANCH_MANAGER', 'CASHIER', 'STOCK_KEEPER'].filter(r => canManage(callerRole, r))
}

export interface RoleMeta {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
  tintSoft: string
}

export const ROLE_META: Record<string, RoleMeta> = {
  SUPER_ADMIN: { label: 'سوبر أدمن', icon: 'shield-checkmark', tint: colors.info, tintSoft: colors.infoSoft },
  ADMIN: { label: 'مدير المنظمة', icon: 'business', tint: colors.violet, tintSoft: colors.violetSoft },
  BRANCH_MANAGER: { label: 'مدير فرع', icon: 'storefront', tint: colors.primary, tintSoft: colors.primarySoft },
  CASHIER: { label: 'كاشير', icon: 'card', tint: colors.success, tintSoft: colors.successSoft },
  STOCK_KEEPER: { label: 'أمين مخزن', icon: 'cube', tint: colors.warning, tintSoft: colors.warningSoft },
}

export function roleMeta(role: string): RoleMeta {
  return ROLE_META[role] ?? { label: role, icon: 'person', tint: colors.textSecondary, tintSoft: colors.background }
}
