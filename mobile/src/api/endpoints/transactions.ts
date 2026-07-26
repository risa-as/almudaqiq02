import { api } from '../client'

/**
 * الفواتير (بيع/إرجاع/استرداد) — مطابقة لملفات الخادم:
 *  - app/api/transactions/route.ts:
 *      GET  ?limit=&branchId= → مصفوفة معاملات (كل الأنواع، الأحدث أولاً) مع user/customer
 *      POST جسم البيع مطابق تمامًا لما يرسله POS الويب (app/pos/page.tsx handlePay):
 *        { items:[{productId,unitId,quantity,price}], shiftId, totalAmount, customerId,
 *          isCredit, discount, notes, branchId, paidAmount, paymentMethod }
 *        → { success, transactionId, receiptNumber }
 *  - app/api/transactions/[id]/route.ts: GET ?branchId= → فاتورة كاملة مع البنود
 *  - app/api/transactions/return/route.ts:
 *      POST { originalTransactionId, items:[{productId,unitId,quantity,price}], branchId? }
 *        → { success, returnId } (الكمية والسعر موجبان — الخادم يسجّلهما كإرجاع)
 *  - app/api/transactions/refund/route.ts (مطابق لـ handleSubmitRefund في POS الويب):
 *      POST { originalTxId, items:[{productId,unitId,quantity,price,cost}],
 *             totalAmount, paymentMethod:'CASH', paidAmount }
 *        → { success, transaction } — الخادم يمنع تجاوز الكميات المرتجعة سابقًا
 */

export type TransactionType = 'SALE' | 'RETURN' | 'REFUND' | 'OPENING'
export type PaymentMethod = 'CASH' | 'CARD' | 'CREDIT' | 'SPLIT'

export interface TransactionListItem {
  id: string
  type: TransactionType
  date: string
  totalAmount: number | string
  paidAmount: number | string | null
  discount: number | string | null
  paymentMethod: PaymentMethod | null
  receiptNumber: string
  userId: string | null
  branchId: string | null
  customerId: string | null
  notes: string | null
  priceEdited?: boolean
  user?: { username: string | null } | null
  customer?: { name: string } | null
  /** أسماء أصناف الفاتورة — يرسلها الخادم عند البحث فقط (ليظهر سبب المطابقة) */
  productNames?: string[]
}

export interface TransactionItemDto {
  id: string
  productId: string
  unitId: string
  quantity: number | string
  price: number | string
  cost: number | string
  product?: { name: string } | null
  unit?: { name: string } | null
  /** ما أُرجع من هذا البند سابقًا (يرسله الخادم لفواتير البيع فقط) */
  returnedQuantity?: number
}

export interface TransactionDetail extends Omit<TransactionListItem, 'customer'> {
  items: TransactionItemDto[]
  customer?: { name: string; phone: string | null } | null
}

export interface SaleItemPayload {
  productId: string
  unitId: string
  quantity: number
  price: number
}

/** جسم إنشاء البيع — نفس حقول POS الويب حرفيًا (الخادم يقرأ هذه الحقول فقط). */
export interface SalePayload {
  items: SaleItemPayload[]
  shiftId: string
  totalAmount: number
  customerId: string | null
  isCredit: boolean
  discount: number
  notes: string
  branchId?: string
  paidAmount: number
  paymentMethod: 'CASH' | 'CARD' | 'CREDIT'
}

export function fetchTransactions(params?: {
  limit?: number
  branchId?: string | null
  /** بحث برقم الفاتورة أو باسم صنف مبيع داخلها (الأحدث أولاً) */
  q?: string
  /** قصر النتائج على فواتير المستخدم الحالي */
  mine?: boolean
}): Promise<TransactionListItem[]> {
  return api<TransactionListItem[]>('/api/transactions', {
    query: {
      limit: params?.limit ?? 100,
      branchId: params?.branchId ?? undefined,
      q: params?.q || undefined,
      mine: params?.mine ? '1' : undefined,
    },
  })
}

export function fetchTransaction(id: string, branchId?: string | null): Promise<TransactionDetail> {
  return api<TransactionDetail>(`/api/transactions/${id}`, {
    query: { branchId: branchId ?? undefined },
  })
}

export function createSale(payload: SalePayload): Promise<{ success: boolean; transactionId: string; receiptNumber: string }> {
  return api('/api/transactions', { method: 'POST', body: payload })
}

export interface ReturnItemPayload {
  productId: string
  unitId: string
  quantity: number
  price: number
}

export function returnItems(params: {
  originalTransactionId: string
  items: ReturnItemPayload[]
  branchId?: string | null
}): Promise<{ success: boolean; returnId: string }> {
  return api('/api/transactions/return', {
    method: 'POST',
    body: {
      originalTransactionId: params.originalTransactionId,
      items: params.items,
      ...(params.branchId ? { branchId: params.branchId } : {}),
    },
  })
}

export interface RefundItemPayload extends ReturnItemPayload {
  cost: number
}

export function refundTransaction(params: {
  originalTxId: string
  items: RefundItemPayload[]
  totalAmount: number
  notes?: string
}): Promise<{ success: boolean; transaction: TransactionListItem }> {
  return api('/api/transactions/refund', {
    method: 'POST',
    body: {
      originalTxId: params.originalTxId,
      items: params.items,
      totalAmount: params.totalAmount,
      paymentMethod: 'CASH',
      paidAmount: params.totalAmount,
      ...(params.notes ? { notes: params.notes } : {}),
    },
  })
}

/** مفتاح قائمة فواتير الوردية — مشترك بين «البيع» (إعادة التحقق بعد فشل غامض) و«فواتيري». */
export const shiftInvoicesKey = (branchId?: string | null) =>
  ['shift-invoices', branchId ?? 'all'] as const

export const invoiceDetailKey = (id: string) => ['invoice', id] as const

/** مفتاح بحث الفواتير — يشترك في البادئة مع shiftInvoicesKey ليبطلهما إبطال واحد. */
export const invoiceSearchKey = (q: string, branchId?: string | null) =>
  ['shift-invoices', branchId ?? 'all', 'search', q] as const
