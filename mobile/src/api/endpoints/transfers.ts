import { api } from '../client'

/**
 * التحويلات بين الفروع — الشكل الخادمي الموثوق من app/api/transfers/route.ts و [id]/route.ts:
 * - GET يعيد مصفوفة خام (غير مغلّفة) و items نص JSON: [{productId, unitId, quantity}].
 * - الإنشاء يتطلب unitId لكل سطر (نستخدم الوحدة الأساسية conversionFactor=1).
 * - تأكيد الاستلام = PUT { status:'COMPLETED' } — ⚠️ نقل المخزون يحدث فقط إذا كانت
 *   الحالة الحالية APPROVED؛ لذلك لا نعرض زر التأكيد إلا للتحويلات المعتمدة.
 * - كل المسارات خلف بوابة الخطة stock_transfers (403 عربية عند تعطيلها).
 */

export type TransferStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED'

export interface TransferItem {
  productId: string
  unitId: string
  quantity: number
}

export interface Transfer {
  id: string
  fromBranchId: string
  toBranchId: string
  /** JSON نصي — استخدم parseTransferItems */
  items: string
  notes: string | null
  status: TransferStatus
  requestedBy: string | null
  approvedBy: string | null
  createdAt: string
  fromBranch?: { name: string } | null
  toBranch?: { name: string } | null
}

export function parseTransferItems(transfer: Pick<Transfer, 'items'>): TransferItem[] {
  try {
    const parsed = JSON.parse(transfer.items)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function fetchTransfers(params?: { status?: TransferStatus; branchId?: string }): Promise<Transfer[]> {
  return api<Transfer[]>('/api/transfers', { query: { status: params?.status, branchId: params?.branchId } })
}

export interface CreateTransferInput {
  fromBranchId: string
  toBranchId: string
  items: TransferItem[]
  notes?: string
}

export function createTransfer(input: CreateTransferInput): Promise<Transfer> {
  return api<Transfer>('/api/transfers', {
    method: 'POST',
    body: {
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      items: input.items,
      notes: input.notes || undefined,
    },
  })
}

export function updateTransferStatus(id: string, status: Exclude<TransferStatus, 'PENDING'>): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/transfers/${id}`, { method: 'PUT', body: { status } })
}

/** تأكيد استلام تحويل معتمد وارد إلى فرعي (ينقل الكميات فعليًا). */
export function confirmTransferReceipt(id: string): Promise<{ success: boolean }> {
  return updateTransferStatus(id, 'COMPLETED')
}

// ── خيارات الفروع لنموذج الإنشاء ─────────────────────────────────────────────

export interface BranchOption {
  id: string
  name: string
}

/**
 * أمين المخزن ممنوع من /api/branches في الـ middleware — نحاولها (قد تُفتح لاحقًا)
 * ونعيد [] عند الرفض؛ الشاشة تكمّل القائمة من فروع التحويلات السابقة.
 */
export async function fetchBranchOptions(): Promise<BranchOption[]> {
  try {
    const branches = await api<{ id: string; name: string }[]>('/api/branches')
    return branches.map(b => ({ id: b.id, name: b.name }))
  } catch {
    return []
  }
}

/** يشتق قائمة فروع معروفة من سجل التحويلات (بديل عند حجب /api/branches). */
export function deriveBranchOptions(transfers: Transfer[]): BranchOption[] {
  const map = new Map<string, string>()
  for (const t of transfers) {
    if (t.fromBranch?.name) map.set(t.fromBranchId, t.fromBranch.name)
    if (t.toBranch?.name) map.set(t.toBranchId, t.toBranch.name)
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
}
