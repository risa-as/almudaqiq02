import { api } from '../client'

/**
 * الموردون (قراءة فقط لأمين المخزن) — GET /api/suppliers يعيد مصفوفة خام.
 * مع branchId: الرصيد محسوب من دفتر الفرع؛ بدونه: الرصيد العام المخزّن.
 */

export interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  /** موجب = مستحق للمورد (علينا)، سالب = رصيد لنا عنده */
  balance: number
  /** Decimal قد يُسلسل كنص */
  creditLimit: number | string | null
  notes: string | null
  createdAt: string
  _count?: { products: number; ledger: number }
}

export function fetchSuppliers(branchId?: string | null): Promise<Supplier[]> {
  return api<Supplier[]>('/api/suppliers', { query: { branchId: branchId ?? undefined } })
}
