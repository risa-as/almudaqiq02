import type { PaymentMethod, TransactionType } from '@/api/endpoints/transactions'

/** تسميات عربية مشتركة بين شاشات الكاشير (البيع/فواتيري/الإيصال). */

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'نقدي',
  CARD: 'شبكة',
  CREDIT: 'آجل',
  SPLIT: 'مختلط',
}

export function paymentLabel(method: string | null | undefined): string {
  if (!method) return '—'
  return PAYMENT_LABELS[method as PaymentMethod] ?? method
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  SALE: 'بيع',
  RETURN: 'إرجاع',
  REFUND: 'استرداد',
  OPENING: 'رصيد افتتاحي',
}

export function typeLabel(type: string | null | undefined): string {
  if (!type) return '—'
  return TYPE_LABELS[type as TransactionType] ?? type
}
