import { api } from '../client'
import { normalizeBranchId } from '@/stores/branch'

/**
 * نداءات مراقبة وتقارير المدير. حقول المبالغ من نوع Prisma Decimal تصل عبر
 * JSON كسلاسل نصية أحيانًا — لذلك تُكتب number | string وتُعرض عبر formatMoney.
 */
export type Money = number | string

/** فترة مخصصة (من → إلى) بصيغة YYYY-MM-DD — تُمرَّر للمسارات الداعمة لها فقط. */
export interface DateRange {
  startDate: string
  endDate: string
}

// ── GET /api/reports/dashboard ────────────────────────────────────────────────
export interface DashboardReport {
  today: { sales: number; returns: number; netSales: number; txCount: number }
  thisWeek: { sales: number; txCount: number }
  prevWeek: { sales: number; txCount: number }
  weekGrowth: number | null
  avgTxValue: number
  refundRate: number
  refundCount: number
  paymentBreakdown: Record<string, number>
  topProducts: { name: string; qty: number }[]
  sparkline: { label: string; total: number }[]
  dayOfWeek: { label: string; total: number }[]
  debtTotal: number
  debtors: number
  totalCustomers: number
}

export function fetchDashboard(selectedBranchId: string | null): Promise<DashboardReport> {
  return api<DashboardReport>('/api/reports/dashboard', {
    query: { branchId: normalizeBranchId(selectedBranchId) },
  })
}

// ── GET /api/reports/profit (مصدر ربح اليوم في لوحة تحكم الويب) ──────────────
export interface ProfitReport {
  revenue: number
  cogs: number
  expenses: number
  netProfit: number
  grossProfit: number
  refunds: number
  grossRevenue: number
}

export function fetchProfit(
  period: 'daily' | 'monthly' | 'yearly',
  selectedBranchId: string | null
): Promise<ProfitReport> {
  return api<ProfitReport>('/api/reports/profit', {
    query: { period, branchId: normalizeBranchId(selectedBranchId) },
  })
}

// ── GET /api/reports/sales — ملاحظة: هذا المسار لا يفهم branchId='all' فيُحذف ─
export type SalesPeriod = 'daily' | 'weekly' | 'monthly'

export interface SalesReportTransaction {
  id: string
  receiptNumber?: string | null
  totalAmount: Money
  date: string
  paymentMethod?: string | null
  user?: { username: string | null } | null
  /** الخادم يعيد كل حقول الفاتورة (بلا select) — تُستخدم لشارات «خصم»/«تعديل سعر». */
  discount?: Money | null
  priceEdited?: boolean | null
}

export interface SalesReport {
  period: string
  totalSales: Money
  transactionCount: number
  netProfit: number
  totalReturns: number
  returnCount: number
  netRevenue: number
  transactions: SalesReportTransaction[]
  chartData: { name: string; value: number }[]
  salesByCategory: { name: string; value: number }[]
}

export function fetchSalesReport(
  period: SalesPeriod,
  selectedBranchId: string | null,
  range?: DateRange | null
): Promise<SalesReport> {
  // الخادم: period=custom&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  return api<SalesReport>('/api/reports/sales', {
    query: range
      ? { period: 'custom', startDate: range.startDate, endDate: range.endDate, branchId: normalizeBranchId(selectedBranchId) }
      : { period, branchId: normalizeBranchId(selectedBranchId) },
  })
}

// ── GET /api/transactions/[id] — تفاصيل فاتورة (للنقر من تقرير المبيعات) ───────
export interface TransactionDetailItem {
  id: string
  productId: string
  unitId: string
  quantity: Money
  price: Money
  cost: Money
  product: { name: string } | null
  /** price = سعر الكتالوج للوحدة — يُقارن بسعر البيع لكشف تعديل السعر على السطر. */
  unit: { name: string; price?: Money | null } | null
}

export interface TransactionDetail {
  id: string
  type: string // SALE | RETURN | REFUND
  totalAmount: Money
  date: string
  notes: string | null
  discount: Money
  /** true إذا عُدّل سعر أي صنف عن سعر الكتالوج وقت البيع. */
  priceEdited?: boolean | null
  taxAmount: Money
  paymentMethod: string // CASH | CREDIT | SPLIT
  paidAmount: Money | null
  receiptNumber: string | null
  items: TransactionDetailItem[]
  customer: { name: string; phone: string | null } | null
  user: { username: string | null } | null
}

/** تفاصيل فاتورة واحدة — يمرَّر branchId لعزل الفروع (المدير قد يشاهد فرعًا محددًا). */
export function fetchTransaction(
  id: string,
  selectedBranchId: string | null
): Promise<TransactionDetail> {
  return api<TransactionDetail>(`/api/transactions/${id}`, {
    query: { branchId: normalizeBranchId(selectedBranchId) },
  })
}

// ── GET /api/reports/abc-analysis ─────────────────────────────────────────────
export type AbcClass = 'A' | 'B' | 'C'

export interface AbcProductRow {
  rank: number
  productId: string
  name: string
  category: string
  quantity: number
  revenue: number
  profit: number
  sharePct: number
  cumulativePct: number
  class: AbcClass
}

export interface AbcReport {
  summary: {
    totalRevenue: number
    productCount: number
    classes: Record<AbcClass, { count: number; revenue: number; profit: number; revenueShare: number }>
  }
  products: AbcProductRow[]
}

export function fetchAbcReport(selectedBranchId: string | null, range?: DateRange | null): Promise<AbcReport> {
  // الخادم يقبل startDate/endDate اختياريًا (الافتراضي: آخر 90 يومًا)
  return api<AbcReport>('/api/reports/abc-analysis', {
    query: {
      branchId: normalizeBranchId(selectedBranchId),
      startDate: range?.startDate,
      endDate: range?.endDate,
    },
  })
}

// ── GET /api/reports/offers-performance ──────────────────────────────────────
export type OfferStatus = 'ACTIVE' | 'EXPIRED' | 'SCHEDULED' | 'DISABLED'

export interface OfferPerformanceRow {
  id: string
  name: string
  type: string
  value: number
  branchName: string | null // null = عرض مشترك على مستوى المنظمة
  status: OfferStatus
  startDate: string
  endDate: string | null
  usageCount: number
  revenue: number
  discount: number
}

export interface OffersPerformanceReport {
  summary: {
    totalUsage: number
    totalRevenue: number
    totalDiscount: number
    activeCount: number
    offerCount: number
  }
  offers: OfferPerformanceRow[]
}

export function fetchOffersReport(
  selectedBranchId: string | null,
  range?: DateRange | null
): Promise<OffersPerformanceReport> {
  // الخادم يقبل startDate/endDate اختياريًا (الافتراضي: آخر 30 يومًا)
  return api<OffersPerformanceReport>('/api/reports/offers-performance', {
    query: {
      branchId: normalizeBranchId(selectedBranchId),
      startDate: range?.startDate,
      endDate: range?.endDate,
    },
  })
}

// ملاحظة: مستحقات الموردين لم تعد تعتمد على /api/reports/supplier-payables (أُزيل
// من الويب)؛ شاشة الموردين (reports/payables.tsx) تجلب من /api/suppliers عبر
// fetchAllSuppliers في suppliersAdmin.ts — نفس مصدر صفحة «الموردون» في الويب.

// ── GET /api/reports/shifts — مراقبة الورديات للمدير ─────────────────────────
// ملاحظة: GET /api/shifts يعيد وردية "المستدعي" النشطة فقط، لذا مراقبة الورديات
// المفتوحة تتم عبر تقرير الورديات هذا (يشمل المفتوحة والمغلقة؛ نرشّح محليًا).
export interface ShiftReportRow {
  id: string
  userId: string
  branchId: string
  openingAmount: Money
  closingAmount?: Money | null
  openedAt: string
  closedAt: string | null
  user?: { username: string | null } | null
  branchName: string
  cashSales: number
  cardSales: number
  creditSales: number
  totalSales: number
  txCount: number
  refunds: number
}

export function fetchShiftsReport(
  selectedBranchId: string | null,
  limit = 50
): Promise<ShiftReportRow[]> {
  return api<ShiftReportRow[]>('/api/reports/shifts', {
    query: { limit, branchId: normalizeBranchId(selectedBranchId) },
  })
}

// ── GET /api/transactions — بث الفواتير الحية ────────────────────────────────
export interface LiveTransaction {
  id: string
  receiptNumber: string
  type: 'SALE' | 'REFUND' | 'RETURN' | string
  totalAmount: Money
  discount?: Money | null
  /** true إذا عُدّل سعر أي صنف عن سعر الكتالوج وقت البيع. */
  priceEdited?: boolean | null
  paidAmount?: Money | null
  paymentMethod?: string | null
  date: string
  user?: { username: string | null } | null
  customer?: { name: string | null } | null
}

export function fetchLiveTransactions(
  selectedBranchId: string | null,
  limit = 30
): Promise<LiveTransaction[]> {
  return api<LiveTransaction[]>('/api/transactions', {
    query: { limit, branchId: normalizeBranchId(selectedBranchId) },
  })
}

// ── GET /api/inventory/alerts — بطاقات التنبيه ───────────────────────────────
export interface LowStockAlert {
  id: string
  name: string
  minimumStock: number
  baseStock: number
}

export interface ExpiringBatchAlert {
  id: string
  quantity: Money
  expiryDate: string | null
  product: { name: string }
}

export interface InventoryAlerts {
  lowStock: LowStockAlert[]
  expiringBatches: ExpiringBatchAlert[]
}

export function fetchInventoryAlerts(selectedBranchId: string | null): Promise<InventoryAlerts> {
  return api<InventoryAlerts>('/api/inventory/alerts', {
    query: { branchId: normalizeBranchId(selectedBranchId) },
  })
}

// ── GET /api/inventory/expiry — الدفعات قريبة الانتهاء ───────────────────────
export type ExpiryUrgency = 'expired' | 'critical' | 'warning' | 'ok' | 'none'

export interface ExpiryBatchRow {
  id: string
  batchNumber: string
  productId: string
  productName: string
  category: string
  branchName: string
  expiryDate: string | null
  daysLeft: number | null
  urgency: ExpiryUrgency
  quantity: number
  costPrice: number
  totalValue: number
}

export interface ExpiryReport {
  batches: ExpiryBatchRow[]
  stats: {
    total: number
    expiredCount: number
    criticalCount: number
    warningCount: number
    okCount: number
    totalValueAtRisk: number
  }
  categories: { id: string; name: string }[]
}

export function fetchExpiryReport(
  selectedBranchId: string | null,
  days: string = '30'
): Promise<ExpiryReport> {
  return api<ExpiryReport>('/api/inventory/expiry', {
    query: { days, branchId: normalizeBranchId(selectedBranchId) },
  })
}
