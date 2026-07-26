import { api } from '../client'
import { normalizeBranchId } from '@/stores/branch'

/**
 * نداءات إدارة الموردين للمدير (إنشاء/تعديل) — منفصلة عن suppliers.ts (قراءة أمين المخزن)
 * لتفادي التصادم في الأسماء.
 *
 * ملاحظة مهمة: عند التعديل (PUT) لا نُرسل `balance` إطلاقًا — تغييره مباشرةً يُباعد
 * رصيد المورد عن دفتر الحركات. الرصيد الافتتاحي يُرسَل عند الإنشاء فقط.
 */

/** المورد كما يعيده الخادم (Decimal قد يُسلسل كنص). */
export interface AdminSupplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  balance: number | string
  creditLimit: number | string | null
  notes: string | null
  createdAt?: string
}

/** حقول إنشاء مورد جديد — `balance` هو الرصيد الافتتاحي (يُنشئ حركة دفترية). */
export interface CreateSupplierInput {
  name: string
  phone?: string
  address?: string
  /** حد الائتمان (اختياري) — يُحوَّل رقميًا. */
  creditLimit?: number | string | null
  notes?: string
  /** الرصيد الافتتاحي (اختياري) — يُحوَّل رقميًا. */
  balance?: number | string | null
  /** الفرع المُسنَد إليه الرصيد الافتتاحي (اختياري). */
  branchId?: string | null
}

/** حقول تعديل مورد — لا يتضمن `balance` عمدًا. */
export interface UpdateSupplierInput {
  name: string
  phone?: string
  address?: string
  creditLimit?: number | string | null
  notes?: string
}

/** يحوّل قيمة نصية/رقمية إلى رقم، أو null عند الفراغ/عدم الصلاحية (يسمح بمسح القيمة). */
function numOrNull(v: number | string | null | undefined): number | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : v
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** POST /api/suppliers — إنشاء مورد جديد مع رصيد افتتاحي اختياري. */
export function createSupplier(input: CreateSupplierInput): Promise<AdminSupplier> {
  return api<AdminSupplier>('/api/suppliers', {
    method: 'POST',
    body: {
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      address: input.address?.trim() || undefined,
      creditLimit: numOrNull(input.creditLimit),
      notes: input.notes ?? '',
      // الرصيد الافتتاحي: الخادم يعمل Number(balance) || 0 (null → 0 = بدون حركة)
      balance: numOrNull(input.balance) ?? 0,
      branchId: input.branchId ?? undefined,
    },
  })
}

/** PUT /api/suppliers/[id] — تعديل مورد. لا يُرسل `balance` إطلاقًا. */
export function updateSupplier(id: string, input: UpdateSupplierInput): Promise<AdminSupplier> {
  return api<AdminSupplier>(`/api/suppliers/${id}`, {
    method: 'PUT',
    body: {
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      address: input.address?.trim() || undefined,
      creditLimit: numOrNull(input.creditLimit),
      notes: input.notes ?? '',
      // balance محذوف عمدًا — تعديله يُباعد الرصيد عن دفتر الحركات.
    },
  })
}

/** GET /api/suppliers/[id] — تفاصيل المورد لتعبئة نموذج التعديل مسبقًا. */
export function fetchSupplier(id: string): Promise<AdminSupplier> {
  return api<{ supplier: AdminSupplier }>(`/api/suppliers/${id}`).then(r => r.supplier)
}

/** صف في قائمة الموردين — `balance` رقم محسوب خادميًا (موجب = مستحق علينا). */
export interface SupplierListRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  balance: number
  creditLimit: number | string | null
  notes: string | null
  lastEntryDate?: string | null
}

/**
 * GET /api/suppliers — كل الموردين مع رصيدهم المحسوب (مطبّق عليه عزل الفرع عند
 * تحديد فرع). خلافًا لتقرير المستحقات، لا يُرشّح على الرصيد — فيظهر المورد الجديد فورًا.
 */
export function fetchAllSuppliers(selectedBranchId: string | null): Promise<SupplierListRow[]> {
  return api<SupplierListRow[]>('/api/suppliers', {
    query: { branchId: normalizeBranchId(selectedBranchId) },
  })
}

/** حقول تسجيل تسديد دفعة لمورد. */
export interface SupplierPaymentInput {
  /** المبلغ المُسدَّد (موجب، بعملة المتجر). */
  amount: number | string
  /** وصف اختياري للحركة الدفترية. */
  description?: string
  /** الفرع الذي تُسجَّل عليه الحركة (اختياري — يُطبَّع عبر normalizeBranchId). */
  branchId?: string | null
}

/**
 * POST /api/suppliers/[id]/payment — تسجيل تسديد دفعة للمورد المستحق.
 * يُنشئ حركة دفترية من نوع PAYMENT ويُنقص رصيد المورد بمقدار المبلغ.
 */
export function paySupplier(
  id: string,
  input: SupplierPaymentInput
): Promise<{ success: boolean; message?: string }> {
  return api<{ success: boolean; message?: string }>(`/api/suppliers/${id}/payment`, {
    method: 'POST',
    body: {
      amount: Number(input.amount),
      description: input.description?.trim() || undefined,
      type: 'PAYMENT',
      branchId: normalizeBranchId(input.branchId),
    },
  })
}
