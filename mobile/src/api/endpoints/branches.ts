import { api } from '../client'

/**
 * GET /api/branches — يعيد مصفوفة فروع المستأجر (تشمل حقولًا إضافية لا نحتاجها
 * في الهاتف مثل _count و storeSettings؛ نلتقط ما يلزم فقط).
 */
export interface BranchApiRow {
  id: string
  name: string
  isActive?: boolean
}

export async function fetchBranches(): Promise<BranchApiRow[]> {
  const rows = await api<BranchApiRow[]>('/api/branches')
  return Array.isArray(rows) ? rows : []
}
