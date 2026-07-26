import { api } from '../client'
import { normalizeBranchId } from '@/stores/branch'

/**
 * GET /api/users — قائمة الموظفين.
 * ADMIN يرى الجميع (عدا SUPER_ADMIN) ويستطيع الترشيح بفرع؛ مدير الفرع يقفله
 * الخادم على فرعه (+ حسابات الإدارة) مهما أرسل.
 */
export interface StaffUser {
  id: string
  username: string | null
  email: string | null
  role: string
  branchId: string | null
  createdAt: string
}

export function fetchUsers(selectedBranchId: string | null): Promise<StaffUser[]> {
  return api<StaffUser[]>('/api/users', {
    query: { branchId: normalizeBranchId(selectedBranchId) },
  })
}

/**
 * POST /api/users — إنشاء مستخدم. الخادم يرفض الأدوار المساوية/الأعلى من دور
 * المنفّذ (canManage)، ويفرض حد المستخدمين حسب الخطة. branchId يُحترم فقط من
 * منشئ مالك؛ المنشئ المقيّد بفرع يُجبر على فرعه خادميًا.
 */
export interface CreateUserPayload {
  username?: string
  email: string
  password: string
  role: string
  branchId?: string
}

export function createUser(payload: CreateUserPayload): Promise<{ success: boolean }> {
  return api<{ success: boolean }>('/api/users', { method: 'POST', body: payload })
}

/**
 * PATCH /api/users — تعديل جزئي: تُرسل الحقول المتغيّرة فقط (الحقول الفارغة
 * يتجاهلها الخادم). لا يدعم نقل المستخدم بين الفروع.
 */
export interface UpdateUserPayload {
  id: string
  username?: string
  email?: string
  password?: string
  role?: string
}

export function updateUser(payload: UpdateUserPayload): Promise<{ success: boolean }> {
  return api<{ success: boolean }>('/api/users', { method: 'PATCH', body: payload })
}

/** DELETE /api/users?id= — الخادم يمنع حذف آخر مدير ويشترط دورًا أعلى من المستهدف. */
export function deleteUser(id: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>('/api/users', { method: 'DELETE', query: { id } })
}
