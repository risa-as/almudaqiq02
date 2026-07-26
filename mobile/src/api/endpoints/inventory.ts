import { api } from '../client'

/**
 * نداءات المخزون لواجهة أمين المخزن.
 * ملاحظة معمارية: لا يوجد GET /api/inventory في الخادم — قائمة المنتجات تأتي من
 * /api/products (مصفوفة كاملة بدون ترقيم خادمي)، والبحث الخادمي من /api/products/search.
 */

// ── المنتجات ──────────────────────────────────────────────────────────────────

export interface ProductUnitInfo {
  unitId: string
  unitName: string
  /** Decimal يُسلسل أحيانًا كنص — استخدم formatMoney للعرض */
  price: number | string
  barcode: string | null
  conversionFactor: number
}

/** صف من GET /api/products — الحقول المستخدمة في التطبيق فقط */
export interface InventoryProduct {
  id: string
  name: string
  /** عند تمرير branchId: مجموع دفعات الفرع؛ وإلا الرصيد العام */
  baseStock: number
  minimumStock: number
  costPrice: number | string
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
  units: ProductUnitInfo[]
}

/** كل منتجات المستأجر مع رصيد الفرع (الخادم لا يرقّم — الترقيم عرضي في العميل). */
export function fetchInventoryProducts(branchId?: string | null): Promise<InventoryProduct[]> {
  return api<InventoryProduct[]>('/api/products', { query: { branchId: branchId ?? undefined } })
}

export interface ProductSearchResult {
  id: string
  name: string
  baseStock: number
  units: ProductUnitInfo[]
  matchType: 'barcode' | 'name'
}

/** بحث خادمي بالاسم أو الباركود (البديل الكامل للكاميرا — FR-012). */
export function searchProducts(q: string, branchId?: string | null): Promise<ProductSearchResult[]> {
  return api<ProductSearchResult[]>('/api/products/search', { query: { q, branchId: branchId ?? undefined } })
}

// ── التصنيفات وإنشاء منتج ─────────────────────────────────────────────────────

/** الحقول المستخدمة فقط من GET /api/categories (الخادم يعيد صفًا كاملًا أوسع). */
export interface CategoryOption {
  id: string
  name: string
}

export function fetchCategories(): Promise<CategoryOption[]> {
  return api<CategoryOption[]>('/api/categories')
}

/**
 * جسم POST /api/products — مطابق لما ترسله صفحة الويب «إضافة منتج».
 * الفرع يؤخذ من التوكن على الخادم (لا يُقرأ من الجسم)، فتُنشأ الدفعة الابتدائية
 * في فرع الموظف.
 *
 * تنبيه: اختيار مورّد مع كمية ابتدائية ينشئ قيد شراء في دفتر المورد؛ فإن لم يكن
 * isPrepaid صحيحًا يزيد رصيد المورد (دَين) بقيمة الفاتورة — تمامًا كصفحة الويب.
 */
export interface NewProductPayload {
  name: string
  description?: string
  baseCost: number
  minimumStock: number
  units: { name: string; conversion: number; barcode: string; price: number; initialQty: number }[]
  categoryId?: string | null
  supplierId?: string | null
  expiryDate?: string | null
  /** الكمية الابتدائية مدفوعة بالكامل مسبقًا ⇒ لا دين على المورد */
  isPrepaid?: boolean
}

export function createProduct(payload: NewProductPayload): Promise<{ id: string; name: string }> {
  return api('/api/products', {
    method: 'POST',
    body: {
      ...payload,
      description: payload.description ?? '',
      categoryId: payload.categoryId || null,
      supplierId: payload.supplierId || null,
      expiryDate: payload.expiryDate || null,
      isPrepaid: payload.supplierId ? !!payload.isPrepaid : false,
    },
  })
}

// ── حل الباركود ───────────────────────────────────────────────────────────────

export interface BarcodeProduct {
  id: string
  name: string
  /** رصيد المنتج العام (غير مقيّد بالفرع في هذا المسار) */
  baseStock: number
  costPrice: number | string
  categoryName?: string | null
  supplierName?: string | null
  units: {
    id: string
    name: string
    conversionFactor: number
    barcode: string | null
    price: number | string
  }[]
}

export interface BarcodeCheckResponse {
  found: boolean
  barcode: string
  productUnit?: { id: string; name: string; conversionFactor: number; barcode: string | null }
  product?: BarcodeProduct
}

/**
 * GET /api/inventory/check-barcode?code=…
 * عند عدم وجود الباركود يعيد الخادم 404 → يُرمى ApiError(404) — عالجها كـ"منتج غير موجود".
 */
export function checkBarcode(code: string): Promise<BarcodeCheckResponse> {
  return api<BarcodeCheckResponse>('/api/inventory/check-barcode', { query: { code } })
}

// ── الدفعات ───────────────────────────────────────────────────────────────────

export interface BatchRow {
  id: string
  batchNumber: string
  productId: string
  productName: string
  categoryName: string
  supplierName: string
  branchId: string
  branchName: string
  expiryDate: string | null
  quantity: number
  costPrice: number
  createdAt: string
}

/**
 * GET /api/inventory/batches — كل دفعات الفرع (بدون branchId يتقيّد الخادم بفرع
 * المستخدم تلقائيًا). لا يوجد فلتر productId خادمي — الفلترة في العميل.
 */
export function fetchBatches(branchId?: string | null): Promise<BatchRow[]> {
  return api<BatchRow[]>('/api/inventory/batches', { query: { branchId: branchId ?? undefined } })
}

// ── التنبيهات ─────────────────────────────────────────────────────────────────

export interface LowStockAlert {
  id: string
  name: string
  minimumStock: number
  baseStock: number
}

export interface ExpiringBatchAlert {
  id: string
  productId: string
  quantity: number
  expiryDate: string | null
  product: { name: string }
}

export interface InventoryAlerts {
  lowStock: LowStockAlert[]
  expiringBatches: ExpiringBatchAlert[]
  /** الأعداد الحقيقية غير المقطوعة — لعرض عدّاد صادق فوق قائمة مختصرة */
  counts?: { lowStock: number }
}

/**
 * GET /api/inventory/alerts — افتراضيًا أدنى 10 منتجات رصيدًا (معاينة اللوحة).
 * full=true يعيد قائمة «تحت الحد الأدنى» كاملة بلا اقتطاع.
 */
export function fetchInventoryAlerts(branchId?: string | null, full = false): Promise<InventoryAlerts> {
  return api<InventoryAlerts>('/api/inventory/alerts', {
    query: { branchId: branchId ?? undefined, full: full ? '1' : undefined },
  })
}

// ── تقرير الصلاحية ────────────────────────────────────────────────────────────

export type ExpiryUrgency = 'none' | 'expired' | 'critical' | 'warning' | 'ok'

export interface ExpiryRow {
  id: string
  batchNumber: string
  productId: string
  productName: string
  category: string
  supplier: string | null
  branchName: string
  expiryDate: string | null
  daysLeft: number | null
  urgency: ExpiryUrgency
  quantity: number
  costPrice: number
  totalValue: number
}

export interface ExpiryReport {
  batches: ExpiryRow[]
  stats: {
    total: number
    expiredCount: number
    criticalCount: number
    warningCount: number
    okCount: number
    totalValueAtRisk: number
  }
}

/**
 * GET /api/inventory/expiry — days: 'expired' | '7' | '14' | '30' | '60' | '90' | 'all'.
 * بدون branchId يتقيّد الخادم بفرع المستخدم تلقائيًا.
 */
export function fetchExpiryReport(days: string = '30', branchId?: string | null): Promise<ExpiryReport> {
  return api<ExpiryReport>('/api/inventory/expiry', { query: { days, branchId: branchId ?? undefined } })
}
