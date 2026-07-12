import { api } from '../client'

/**
 * العملاء (للبيع الآجل) — مطابقة لـ app/api/customers/route.ts:
 * GET /api/customers?search=&branchId= → مصفوفة عملاء (عملاء الفرع + عملاء المؤسسة branchId=null).
 * search يبحث في الاسم والهاتف معًا خادميًا.
 */

export interface CustomerDto {
  id: string
  name: string
  phone: string | null
  address: string | null
  /** الرصيد المدين الحالي (Decimal — قد يصل كنص) */
  balance: number | string
  /** حد الدين المسموح (0 = بلا حد) */
  creditLimit: number | string
  branchId: string | null
  _count?: { transactions: number }
}

export function fetchCustomers(search?: string, branchId?: string | null): Promise<CustomerDto[]> {
  return api<CustomerDto[]>('/api/customers', {
    query: { search: search || undefined, branchId: branchId ?? undefined },
  })
}

export const customersKey = (search: string, branchId?: string | null) =>
  ['customers', search, branchId ?? 'all'] as const
