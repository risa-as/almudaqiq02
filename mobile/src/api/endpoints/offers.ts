import { api } from '../client'

/**
 * العروض النشطة — مطابقة لـ app/api/offers/route.ts:
 * GET /api/offers?active=true&branchId= → مصفوفة عروض (عروض الفرع + العروض العامة branchId=null).
 * القيم الرقمية Decimal قد تصل كنص، لذا الأنواع number | string وتُحوَّل بـ Number().
 */

export type OfferType = 'FIXED_DISCOUNT' | 'PERCENTAGE_DISCOUNT' | 'BUY_X_GET_Y'

export interface OfferDto {
  id: string
  name: string
  type: OfferType
  value: number | string
  buyQuantity: number | null
  getQuantity: number | null
  productId: string | null
  categoryId: string | null
  branchId: string | null
  startDate: string
  endDate: string | null
  isActive: boolean
  product?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  branch?: { id: string; name: string } | null
}

export function fetchActiveOffers(branchId?: string | null): Promise<OfferDto[]> {
  return api<OfferDto[]>('/api/offers', {
    query: { active: 'true', branchId: branchId ?? undefined },
  })
}

export const activeOffersKey = (branchId?: string | null) =>
  ['offers', 'active', branchId ?? 'all'] as const
