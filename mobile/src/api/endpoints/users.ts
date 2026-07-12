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
