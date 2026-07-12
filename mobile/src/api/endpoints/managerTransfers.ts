import { api } from '../client'
import { normalizeBranchId } from '@/stores/branch'

/**
 * نداءات التحويلات من جانب المدير (الموافقات) — ميزة stock_transfers مبوّبة
 * خادميًا (403 برسالة عربية عند القفل).
 *
 * عقد الخادم:
 *  - GET  /api/transfers?status=PENDING&branchId=…  (branchId يطابق from أو to؛
 *    لا يفهم 'all' → يُحذف عبر normalizeBranchId)
 *  - PUT  /api/transfers/[id]  { status: 'APPROVED' | 'COMPLETED' | 'CANCELLED' }
 *    ملاحظة: التنفيذ الفعلي لنقل الكميات يحدث عند COMPLETED انطلاقًا من APPROVED.
 */
export type TransferStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED'

export interface TransferRow {
  id: string
  fromBranchId: string
  toBranchId: string
  /** JSON نصي لعناصر التحويل [{ productId, unitId, quantity }] */
  items: string
  notes: string | null
  status: TransferStatus
  requestedBy: string | null
  approvedBy: string | null
  createdAt: string
  fromBranch: { name: string }
  toBranch: { name: string }
}

export function fetchTransfers(params: {
  status?: TransferStatus
  selectedBranchId: string | null
}): Promise<TransferRow[]> {
  return api<TransferRow[]>('/api/transfers', {
    query: {
      status: params.status,
      branchId: normalizeBranchId(params.selectedBranchId),
    },
  })
}

export function updateTransferStatus(
  id: string,
  status: 'APPROVED' | 'COMPLETED' | 'CANCELLED'
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/transfers/${id}`, {
    method: 'PUT',
    body: { status },
  })
}

/** عدد أصناف التحويل من حقل items النصي (بأمان). */
export function transferItemsCount(itemsJson: string): number {
  try {
    const parsed = JSON.parse(itemsJson)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}
