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

/** حمولة إنشاء/تعديل مصروف — المبلغ رقمي، والحقول الاختيارية null عند تفريغها. */
export interface ExpenseInput {
  title: string
  amount: number
  category?: string | null
  description?: string | null
  /** YYYY-MM-DD — عند الغياب يستخدم الخادم تاريخ اليوم. */
  date?: string | null
  /** عند الغياب يستخدم الخادم فرع المستخدم الحالي. */
  branchId?: string | null
}

/** POST /api/expenses — إنشاء مصروف جديد ويعيد الصف المنشأ. */
export function createExpense(input: ExpenseInput): Promise<ExpenseRow> {
  return api<ExpenseRow>('/api/expenses', {
    method: 'POST',
    body: {
      title: input.title,
      amount: input.amount,
      category: input.category ?? null,
      description: input.description ?? null,
      date: input.date ?? undefined,
      branchId: normalizeBranchId(input.branchId),
    },
  })
}

/** PUT /api/expenses — تعديل مصروف قائم (يُشترط id) ويعيد الصف المحدّث. */
export function updateExpense(input: ExpenseInput & { id: string }): Promise<ExpenseRow> {
  return api<ExpenseRow>('/api/expenses', {
    method: 'PUT',
    body: {
      id: input.id,
      title: input.title,
      amount: input.amount,
      category: input.category ?? null,
      description: input.description ?? null,
      date: input.date ?? undefined,
    },
  })
}

/** DELETE /api/expenses?id=<id> — حذف مصروف. */
export function deleteExpense(id: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>('/api/expenses', {
    method: 'DELETE',
    query: { id },
  })
}
