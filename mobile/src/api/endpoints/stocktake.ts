import { api } from '../client'

/**
 * جلسات الجرد — الشكل الخادمي الموثوق من app/api/stocktake/route.ts و [id]/route.ts:
 * - POST /api/stocktake ينشئ جلسة DRAFT ويلقط رصيد كل المنتجات كـ expectedQty.
 * - حفظ العدّات واعتماد الجلسة كلاهما PATCH على /api/stocktake/[id] (ليس PUT).
 * - 409 عند وجود جلسة مفتوحة لنفس الفرع (الرسالة العربية تأتي من الخادم).
 */

export type StocktakeStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'

export interface StocktakeSessionSummary {
  id: string
  branchId: string
  branchName: string
  status: StocktakeStatus
  notes: string | null
  createdAt: string
  completedAt: string | null
  totalItems: number
  countedItems: number
  diffItems: number
}

export function fetchStocktakeSessions(): Promise<{ sessions: StocktakeSessionSummary[] }> {
  return api<{ sessions: StocktakeSessionSummary[] }>('/api/stocktake')
}

/**
 * بدء جلسة جرد. أمين المخزن مقيّد خادميًا بفرعه (branchId المرسل يُتجاهل لغير المالك)،
 * لكن نمرره احتياطًا لحالة حساب بلا فرع.
 */
export function createStocktakeSession(branchId?: string | null, notes?: string): Promise<{ success: boolean; sessionId: string }> {
  return api<{ success: boolean; sessionId: string }>('/api/stocktake', {
    method: 'POST',
    body: { branchId: branchId ?? undefined, notes: notes || undefined },
  })
}

export interface StocktakeItem {
  id: string
  productId: string
  productName: string
  /** الرصيد المسجّل لحظة بدء الجلسة */
  expectedQty: number
  countedQty: number | null
  note: string | null
  difference: number | null
}

export interface StocktakeDetail {
  id: string
  branchId: string
  status: StocktakeStatus
  notes: string | null
  createdAt: string
  completedAt: string | null
  items: StocktakeItem[]
}

export function fetchStocktakeSession(id: string): Promise<StocktakeDetail> {
  return api<StocktakeDetail>(`/api/stocktake/${id}`)
}

export interface CountPayload {
  itemId: string
  /** null = مسح العدّة */
  countedQty: number | null
  note?: string
}

/** حفظ العدّات (لا يغيّر المخزون — فقط يسجّلها في الجلسة). */
export function saveStocktakeCounts(id: string, counts: CountPayload[]): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/stocktake/${id}`, { method: 'PATCH', body: { counts } })
}

/** اعتماد الجرد: يطبّق الفروقات على المخزون الفعلي ويغلق الجلسة. */
export function completeStocktake(id: string): Promise<{ success: boolean; adjustments: number; counted: number }> {
  return api<{ success: boolean; adjustments: number; counted: number }>(`/api/stocktake/${id}`, {
    method: 'PATCH',
    body: { action: 'complete' },
  })
}

/** إلغاء الجلسة بدون تطبيق أي فروقات. */
export function cancelStocktake(id: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/stocktake/${id}`, { method: 'PATCH', body: { action: 'cancel' } })
}
