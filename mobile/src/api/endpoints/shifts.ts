import { api } from '../client'

/**
 * الورديات — مطابقة لملفات الخادم:
 *  - app/api/shifts/route.ts:
 *      GET  → { activeShift: CashierShift | null } (وردية المستخدم الحالي المفتوحة)
 *      POST { openingAmount, branchId } → { success, shift } — يرفض 400 إن وُجدت وردية مفتوحة
 *  - app/api/shifts/close/route.ts:
 *      GET  → ملخص الوردية المفتوحة (404 برسالة عربية إن لم توجد)
 *      POST { closingAmount, notes? } → { success, shift, expectedAmount, totalCashCollected }
 */

export interface ActiveShift {
  id: string
  tenantId: string
  branchId: string
  userId: string
  /** Decimal — قد يصل كنص */
  openingAmount: number | string
  openedAt: string
  closedAt: string | null
  user?: { username: string | null } | null
}

export interface ShiftSummary {
  openingAmount: number
  cashSales: number
  cardSales: number
  creditSales: number
  splitSales: number
  cashRefunds: number
  expectedCash: number
  totalSales: number
}

export interface ClosedShift extends Omit<ActiveShift, 'user'> {
  closingAmount: number | string | null
  expectedAmount: number | string | null
  difference: number | string | null
  notes: string | null
}

export function fetchActiveShift(): Promise<{ activeShift: ActiveShift | null }> {
  return api<{ activeShift: ActiveShift | null }>('/api/shifts')
}

export function openShift(openingAmount: number, branchId?: string | null): Promise<{ success: boolean; shift: ActiveShift }> {
  return api<{ success: boolean; shift: ActiveShift }>('/api/shifts', {
    method: 'POST',
    body: { openingAmount, branchId: branchId ?? undefined },
  })
}

export function fetchShiftSummary(): Promise<ShiftSummary> {
  return api<ShiftSummary>('/api/shifts/close')
}

export function closeShift(closingAmount: number, notes?: string): Promise<{
  success: boolean
  shift: ClosedShift
  expectedAmount: number
  totalCashCollected: number
}> {
  return api('/api/shifts/close', {
    method: 'POST',
    body: { closingAmount, notes: notes ?? '' },
  })
}

/** مفاتيح React Query المشتركة بين شاشات الكاشير (البيع/ورديتي/فواتيري). */
export const shiftKeys = {
  active: ['shift', 'active'] as const,
  summary: ['shift', 'summary'] as const,
}
