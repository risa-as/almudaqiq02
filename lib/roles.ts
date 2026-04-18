// ─── مصدر الحقيقة الوحيد للأدوار في النظام ───────────────────────────────────
// استورد من هنا في أي مكان يحتاج تعريف الأدوار أو عرضها

export const ROLES = {
  SUPER_ADMIN:    'SUPER_ADMIN',
  ADMIN:          'ADMIN',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  CASHIER:        'CASHIER',
  STOCK_KEEPER:   'STOCK_KEEPER',
} as const

export type UserRole = keyof typeof ROLES

export const ROLE_LABELS: Record<UserRole, { label: string; color: string; bg: string; icon: string }> = {
  SUPER_ADMIN:    { label: 'سوبر أدمن',  color: 'text-yellow-700', bg: 'bg-yellow-100',  icon: '👑' },
  ADMIN:          { label: 'مدير',        color: 'text-purple-700', bg: 'bg-purple-100',  icon: '🏢' },
  BRANCH_MANAGER: { label: 'مدير فرع',   color: 'text-indigo-700', bg: 'bg-indigo-100',  icon: '🏪' },
  CASHIER:        { label: 'كاشير',       color: 'text-blue-700',   bg: 'bg-blue-100',    icon: '🖥️' },
  STOCK_KEEPER:   { label: 'أمين مخزن',  color: 'text-green-700',  bg: 'bg-green-100',   icon: '📦' },
}

/** هرم الصلاحيات — رقم أعلى = صلاحية أوسع */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN:    5,
  ADMIN:          4,
  BRANCH_MANAGER: 3,
  STOCK_KEEPER:   2,
  CASHIER:        1,
}

/**
 * هل يستطيع callerRole إنشاء/حذف/تعديل مستخدم بدور targetRole؟
 * القاعدة: لا يمكنك إدارة من هو مساوٍ لك أو أعلى.
 */
export function canManage(callerRole: string, targetRole: string): boolean {
  const callerLevel = ROLE_HIERARCHY[callerRole as UserRole] ?? 0
  const targetLevel = ROLE_HIERARCHY[targetRole as UserRole] ?? 0
  return callerLevel > targetLevel
}

/** أدوار يُسمح لها بعرض Dashboard الإدارة الكامل */
export const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER']

/** أدوار يُسمح لها بإدارة المخزون والموردين */
export const STOCK_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'STOCK_KEEPER']

/** أدوار يُسمح لها بالوصول لنقطة البيع */
export const POS_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER']

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole]?.label ?? role
}
