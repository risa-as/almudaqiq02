import { api } from '../client'

/**
 * أوامر الشراء — الشكل الخادمي الموثوق من app/api/purchases/orders/route.ts و [id]/route.ts:
 * - الاستلام PATCH واحد للأمر كاملًا: { action:'receive', received:[{itemId, receivedQty}], paidAmount? }.
 * - أي سطر غير مذكور في received يستلمه الخادم بكامل الكمية المطلوبة — لذلك نرسل كل السطور دائمًا.
 * - ⚠️ الخادم لا يقرأ تاريخ صلاحية للسطور (الدفعات تُنشأ بلا expiryDate) — نرسله
 *   forward-compatible لكن أثره يتطلب تعديلًا خادميًا.
 */

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderSummary {
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

export function fetchPurchaseOrders(): Promise<{ orders: PurchaseOrderSummary[] }> {
  return api<{ orders: PurchaseOrderSummary[] }>('/api/purchases/orders')
}

export interface PurchaseOrderLine {
  id: string
  productId: string
  productName: string
  /** الكمية المطلوبة بالوحدة الأساسية */
  quantity: number
  costPrice: number
  receivedQty: number | null
  total: number
}

export interface PurchaseOrderDetail {
  id: string
  branchId: string
  supplierId: string | null
  supplierName: string | null
  status: PurchaseOrderStatus
  notes: string | null
  createdAt: string
  orderedAt: string | null
  receivedAt: string | null
  items: PurchaseOrderLine[]
}

export function fetchPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  return api<PurchaseOrderDetail>(`/api/purchases/orders/${id}`)
}

export interface ReceiveLine {
  itemId: string
  receivedQty: number
  /** YYYY-MM-DD — يتجاهله الخادم حاليًا (انظر رأس الملف) */
  expiryDate?: string
}

export interface ReceiveResult {
  success: boolean
  receivedLines: number
  totalInvoice: number
}

/** استلام الأمر كاملًا (ينقل الحالة إلى RECEIVED ويضيف الدفعات للمخزون). */
export function receivePurchaseOrder(id: string, received: ReceiveLine[], paidAmount?: number): Promise<ReceiveResult> {
  return api<ReceiveResult>(`/api/purchases/orders/${id}`, {
    method: 'PATCH',
    body: {
      action: 'receive',
      received,
      ...(paidAmount && paidAmount > 0 ? { paidAmount } : {}),
    },
  })
}
