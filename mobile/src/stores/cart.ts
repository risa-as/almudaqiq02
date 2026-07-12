import { create } from 'zustand'
import type { OfferDto } from '@/api/endpoints/offers'

/**
 * سلة الكاشير (data-model.md — CartState):
 *  - فشل الدفع لا يمسّ البنود أبدًا؛ التفريغ يحدث فقط بعد نجاح مؤكد.
 *  - submitting حارس أحادي الإرسال: يمنع POST ثانيًا قبل انتهاء الأول (R9 / FR-015).
 *  - حساب الخصومات (العروض + الخصم اليدوي) منسوخ حرفيًا من POS الويب
 *    (app/pos/page.tsx) ليتطابق الإجمالي بين الويب والهاتف دائمًا (FR-013).
 */

export interface CartLine {
  productId: string
  unitId: string
  name: string
  unitName: string
  barcode: string | null
  /** سعر الوحدة لحظة الإضافة — الخادم يعيد التحقق عند الدفع */
  unitPrice: number
  qty: number
  /** مخزون المنتج لحظة الإضافة (فحص ناعم مطابق لسلوك الويب) */
  stock: number
}

export type CartPaymentMethod = 'CASH' | 'CARD' | 'CREDIT'

export type AddLineResult = 'added' | 'merged' | 'out-of-stock'

interface CartState {
  lines: CartLine[]
  /** خصم الفاتورة اليدوي (مبلغ ثابت) */
  discount: number
  customerId: string | null
  customerName: string | null
  paymentMethod: CartPaymentMethod
  submitting: boolean

  addLine: (line: Omit<CartLine, 'qty'>, qty?: number) => AddLineResult
  setQty: (productId: string, unitId: string, qty: number) => void
  changeQty: (productId: string, unitId: string, delta: number) => boolean
  removeLine: (productId: string, unitId: string) => void
  setDiscount: (value: number) => void
  setCustomer: (id: string | null, name: string | null) => void
  setPaymentMethod: (method: CartPaymentMethod) => void
  /** يبدأ الإرسال؛ يعيد false إن كان هناك إرسال جارٍ بالفعل (أحادي الإرسال) */
  beginSubmit: () => boolean
  endSubmit: () => void
  /** يُستدعى فقط بعد نجاح مؤكد من الخادم */
  clear: () => void
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  discount: 0,
  customerId: null,
  customerName: null,
  paymentMethod: 'CASH',
  submitting: false,

  addLine: (line, qty = 1) => {
    const { lines } = get()
    const existing = lines.find(l => l.productId === line.productId && l.unitId === line.unitId)
    if (existing) {
      const newQty = existing.qty + qty
      if (newQty > existing.stock) return 'out-of-stock'
      set({
        lines: lines.map(l =>
          l.productId === line.productId && l.unitId === line.unitId ? { ...l, qty: newQty } : l,
        ),
      })
      return 'merged'
    }
    if (qty > line.stock) return 'out-of-stock'
    set({ lines: [...lines, { ...line, qty }] })
    return 'added'
  },

  setQty: (productId, unitId, qty) => {
    set(state => ({
      lines: state.lines.map(l =>
        l.productId === productId && l.unitId === unitId
          ? { ...l, qty: Math.max(1, Math.min(qty, l.stock)) }
          : l,
      ),
    }))
  },

  changeQty: (productId, unitId, delta) => {
    const line = get().lines.find(l => l.productId === productId && l.unitId === unitId)
    if (!line) return false
    const newQty = line.qty + delta
    if (newQty < 1) return true
    if (newQty > line.stock) return false
    set(state => ({
      lines: state.lines.map(l =>
        l.productId === productId && l.unitId === unitId ? { ...l, qty: newQty } : l,
      ),
    }))
    return true
  },

  removeLine: (productId, unitId) => {
    set(state => ({
      lines: state.lines.filter(l => !(l.productId === productId && l.unitId === unitId)),
    }))
  },

  setDiscount: value => set({ discount: Math.max(0, Number.isFinite(value) ? value : 0) }),

  setCustomer: (id, name) =>
    set(state => ({
      customerId: id,
      customerName: name,
      // إلغاء اختيار العميل يعيد الدفع نقدًا (نفس سلوك الويب)
      paymentMethod: id === null && state.paymentMethod === 'CREDIT' ? 'CASH' : state.paymentMethod,
    })),

  setPaymentMethod: method => set({ paymentMethod: method }),

  beginSubmit: () => {
    if (get().submitting) return false
    set({ submitting: true })
    return true
  },

  endSubmit: () => set({ submitting: false }),

  clear: () =>
    set({
      lines: [],
      discount: 0,
      customerId: null,
      customerName: null,
      paymentMethod: 'CASH',
      submitting: false,
    }),
}))

// ── حساب الإجماليات — منسوخ من POS الويب (app/pos/page.tsx §Discount Calculation) ──

export interface CartTotals {
  subtotal: number
  /** الخصم النهائي (عروض + يدوي، بعد السقف والتقريب) — يُرسل كما هو في حقل discount */
  discount: number
  total: number
}

export function computeCartTotals(lines: CartLine[], offers: OfferDto[], manualDiscount: number): CartTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0)

  let discountAmount = 0
  let hasPercentageDiscount = false

  for (const offer of offers) {
    const applicableItems = offer.productId
      ? lines.filter(l => l.productId === offer.productId)
      : lines

    if (applicableItems.length === 0) continue

    const applicableSubtotal = applicableItems.reduce((sum, l) => sum + l.unitPrice * l.qty, 0)
    const applicableQty = applicableItems.reduce((sum, l) => sum + l.qty, 0)

    if (offer.type === 'FIXED_DISCOUNT') {
      discountAmount += Number(offer.value)
    } else if (offer.type === 'PERCENTAGE_DISCOUNT') {
      discountAmount += applicableSubtotal * (Number(offer.value) / 100)
      hasPercentageDiscount = true
    } else if (offer.type === 'BUY_X_GET_Y' && offer.buyQuantity && offer.getQuantity) {
      const bundles = Math.floor(applicableQty / (offer.buyQuantity + offer.getQuantity))
      if (bundles > 0) {
        const unitPrice = applicableItems[0].unitPrice
        discountAmount += unitPrice * offer.getQuantity * bundles
      }
    }
  }

  // الخصم اليدوي (مبلغ ثابت على مستوى الفاتورة)
  discountAmount += Math.max(0, manualDiscount)

  if (discountAmount > subtotal) discountAmount = subtotal

  // تقريب خصم النسبة المئوية لأقرب 250 — نفس قاعدة الويب حرفيًا
  if (hasPercentageDiscount && discountAmount > 0) {
    const remainder = discountAmount % 250
    if (remainder > 0 && remainder < 125) {
      discountAmount = discountAmount - remainder
    } else if (remainder >= 125) {
      discountAmount = discountAmount + (250 - remainder)
    }
    if (discountAmount > subtotal) discountAmount = subtotal
  }

  return { subtotal, discount: discountAmount, total: subtotal - discountAmount }
}
