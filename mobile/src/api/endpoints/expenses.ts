import { api } from '../client'
import type { DateRange } from './reports'
import { normalizeBranchId } from '@/stores/branch'

/**
 * GET /api/expenses — قائمة المصروفات.
 * period: 'today' | 'month' | undefined (بدون period = الكل).
 * فترة مخصصة: period=custom&startDate&endDate (مدعومة خادميًا).
 */
export type ExpensePeriod = 'today' | 'month' | 'all'

export interface ExpenseRow {
  id: string
  title: string
  amount: number | string // Prisma Decimal
  category: string | null
  description: string | null
  date: string
  branchId: string | null
}

export function fetchExpenses(
  period: ExpensePeriod,
  selectedBranchId: string | null,
  range?: DateRange | null
): Promise<ExpenseRow[]> {
  return api<ExpenseRow[]>('/api/expenses', {
    query: range
      ? {
          period: 'custom',
          startDate: range.startDate,
          endDate: range.endDate,
          branchId: normalizeBranchId(selectedBranchId),
        }
      : {
          // الخادم يعيد "الكل" عند غياب period — لا قيمة 'all' مفهومة لديه
          period: period === 'all' ? undefined : period,
          branchId: normalizeBranchId(selectedBranchId),
        },
  })
}
