import { api } from '../client'

/**
 * نداءات البحث عن المنتجات — مطابقة لـ app/api/products/search/route.ts:
 * GET /api/products/search?q=&branchId=
 * يعيد مصفوفة؛ عند تطابق الباركود تمامًا يعيد عنصرًا واحدًا وحدته المطابقة في units[0]
 * مع matchType = 'barcode'، وإلا بحث جزئي بالاسم (حتى 10 نتائج) مع matchType = 'name'.
 */

export interface ProductUnitDto {
  unitId: string
  unitName: string
  price: number
  barcode: string | null
  conversionFactor: number
}

export interface ProductSearchResult {
  id: string
  name: string
  /** مخزون الفرع المحدد (بالوحدة الأساسية) — أو baseStock العام عند عدم تحديد فرع */
  baseStock: number
  units: ProductUnitDto[]
  matchType: 'barcode' | 'name'
}

export function searchProducts(q: string, branchId?: string | null): Promise<ProductSearchResult[]> {
  return api<ProductSearchResult[]>('/api/products/search', {
    query: { q, branchId: branchId ?? undefined },
  })
}

export const productSearchKey = (q: string, branchId?: string | null) =>
  ['product-search', q, branchId ?? 'all'] as const
