import { api } from '../client'
import { normalizeBranchId } from '@/stores/branch'

/**
 * نداءات أوامر الشراء من جانب المدير (مراجعة/اعتماد).
 *
 * عقد الخادم:
 *  - GET   /api/purchases/orders?branchId=…  → { orders: [...] }
 *    (المالك يرشّح بالفرع؛ مدير الفرع يقفله الخادم على فرعه؛ 'all' مفهومة لكنها
 *     تُحذف توحيدًا للاصطلاح)
 *  - PATCH /api/purchases/orders/[id]:
 *      { action: 'order' }   مسودة → ORDERED (الاعتماد والإرسال للمورد)
 *      { action: 'cancel' }  DRAFT/ORDERED → CANCELLED
 *    (الاستلام action: 'receive' يخص واجهة أمين المخزن)
 */
export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderRow {
  id: string
  branchId: string
  supplierName: string
  status: PurchaseOrderStatus
  notes: string | null
  createdAt: string
  orderedAt: string | null
  receivedAt: string | null
  itemsCount: number
  totalCost: number
}

export async function fetchPurchaseOrders(
  selectedBranchId: string | null
): Promise<PurchaseOrderRow[]> {
  const data = await api<{ orders: PurchaseOrderRow[] }>('/api/purchases/orders', {
    query: { branchId: normalizeBranchId(selectedBranchId) },
  })
  return data.orders ?? []
}

/** اعتماد مسودة أمر شراء وإرساله للمورد (DRAFT → ORDERED). */
export function approvePurchaseOrder(id: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/purchases/orders/${id}`, {
    method: 'PATCH',
    body: { action: 'order' },
  })
}

/** إلغاء أمر شراء (DRAFT أو ORDERED). */
export function cancelPurchaseOrder(id: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/purchases/orders/${id}`, {
    method: 'PATCH',
    body: { action: 'cancel' },
  })
}
