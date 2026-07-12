'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  PackagePlus, Plus, Trash2, Search, Loader2, ArrowRight,
  Send, PackageCheck, XCircle, ClipboardList,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useBranch } from '@/contexts/BranchContext'
import { usePageTitle } from '@/hooks/usePageTitle'

interface OrderSummary {
  id: string
  branchId: string
  supplierName: string
  status: string
  createdAt: string
  itemsCount: number
  totalCost: number
}

interface OrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  costPrice: number
  receivedQty: number | null
  total: number
}

interface OrderDetail {
  id: string
  status: string
  supplierName: string | null
  notes: string | null
  items: OrderItem[]
}

interface DraftItem {
  productId: string
  productName: string
  quantity: string
  costPrice: string
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: 'مسودة',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  ORDERED:   { label: 'مُرسل',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  RECEIVED:  { label: 'مستلَم',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'ملغى',    cls: 'bg-red-50 text-red-500 border-red-200' },
}

export default function PurchaseOrdersPage() {
  usePageTitle('أوامر الشراء')
  const { selectedBranch } = useBranch()

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')

  // ── Create form state ────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<{ id: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Detail state ─────────────────────────────────────────────────────
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [receiveMode, setReceiveMode] = useState(false)
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({})
  const [paidAmount, setPaidAmount] = useState('')
  const [acting, setActing] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const qs = selectedBranch?.id ? `?branchId=${selectedBranch.id}` : ''
      const res = await fetch(`/api/purchases/orders${qs}`)
      const data = await res.json()
      if (res.ok) setOrders(data.orders ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [selectedBranch?.id])

  useEffect(() => { loadOrders() }, [loadOrders])

  useEffect(() => {
    fetch('/api/suppliers')
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const list = Array.isArray(d) ? d : d.suppliers ?? []
        setSuppliers(list.map((s: any) => ({ id: s.id, name: s.name })))
      })
      .catch(() => {})
  }, [])

  // Debounced product search for the create form
  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ q: productQuery.trim() })
        if (selectedBranch?.id) params.set('branchId', selectedBranch.id)
        const res = await fetch(`/api/products/search?${params}`)
        const data = await res.json()
        setProductResults((Array.isArray(data) ? data : []).slice(0, 8).map((p: any) => ({ id: p.id, name: p.name })))
      } catch { /* ignore */ } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [productQuery, selectedBranch?.id])

  function addItem(p: { id: string; name: string }) {
    if (items.some(i => i.productId === p.id)) { toast('المنتج مضاف مسبقاً'); return }
    setItems(prev => [...prev, { productId: p.id, productName: p.name, quantity: '', costPrice: '' }])
    setProductQuery('')
    setProductResults([])
  }

  const draftTotal = useMemo(() =>
    items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.costPrice) || 0), 0)
  , [items])

  async function submitOrder() {
    if (!selectedBranch?.id) { toast.error('اختر فرعاً محدداً من الأعلى'); return }
    const clean = items
      .map(i => ({ productId: i.productId, quantity: Math.round(Number(i.quantity)), costPrice: Number(i.costPrice) }))
      .filter(i => i.quantity > 0 && Number.isFinite(i.costPrice) && i.costPrice >= 0)
    if (clean.length === 0) { toast.error('أضف صنفاً واحداً على الأقل بكمية وسعر صحيحين'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/purchases/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch.id,
          supplierId: supplierId || null,
          notes: notes || null,
          items: clean,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'فشل إنشاء أمر الشراء'); return }
      toast.success('أُنشئ أمر الشراء كمسودة')
      setItems([]); setSupplierId(''); setNotes('')
      setView('list')
      loadOrders()
    } finally {
      setSubmitting(false)
    }
  }

  async function openOrder(id: string) {
    setView('detail')
    setDetail(null)
    setReceiveMode(false)
    setPaidAmount('')
    const res = await fetch(`/api/purchases/orders/${id}`)
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'تعذر فتح الطلب'); setView('list'); return }
    setDetail(data)
    const init: Record<string, string> = {}
    for (const item of data.items as OrderItem[]) init[item.id] = String(item.quantity)
    setReceivedQtys(init)
  }

  async function orderAction(action: 'order' | 'cancel' | 'receive') {
    if (!detail) return
    if (action === 'cancel' && !window.confirm('سيتم إلغاء أمر الشراء. متابعة؟')) return
    if (action === 'receive' && !window.confirm('سيتم استلام الكميات وإضافتها للمخزون وتسجيلها في حساب المورد. متابعة؟')) return
    setActing(true)
    try {
      const body: any = { action }
      if (action === 'receive') {
        body.received = detail.items.map(i => ({ itemId: i.id, receivedQty: Number(receivedQtys[i.id]) || 0 }))
        if (paidAmount) body.paidAmount = Number(paidAmount)
      }
      const res = await fetch(`/api/purchases/orders/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'فشلت العملية'); return }
      toast.success(action === 'receive' ? `تم الاستلام — أُضيف ${data.receivedLines} صنف للمخزون` : 'تمت العملية')
      setView('list')
      loadOrders()
    } finally {
      setActing(false)
    }
  }

  const fmt = (n: number) => Math.round(n).toLocaleString()
  const inputStyle = {
    background: 'var(--bg-hover, rgba(148,163,184,0.08))',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
  } as const

  return (
    <div className="max-w-6xl mx-auto space-y-4" dir="rtl">
      <PageHeader
        title="أوامر الشراء"
        subtitle="دورة شراء رسمية: مسودة ← إرسال للمورد ← استلام ومطابقة"
        icon={PackagePlus}
        gradient="linear-gradient(135deg, #094B9F, #063A8A)"
        actions={
          view === 'list' ? (
            <button onClick={() => setView('create')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Plus className="w-3.5 h-3.5" />
              أمر شراء جديد
            </button>
          ) : (
            <button onClick={() => { setView('list'); loadOrders() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
              <ArrowRight className="w-3.5 h-3.5" />
              عودة للقائمة
            </button>
          )
        }
      />

      {/* ── List ─────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          {loading ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>جارٍ التحميل...</div>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>لا توجد أوامر شراء بعد</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>أنشئ أمر شراء لتتبع التوريد من المورد حتى الاستلام</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-right px-4 py-3 text-xs font-bold">رقم الأمر</th>
                  <th className="text-right px-4 py-3 text-xs font-bold">المورد</th>
                  <th className="text-right px-4 py-3 text-xs font-bold">التاريخ</th>
                  <th className="text-center px-4 py-3 text-xs font-bold">الأصناف</th>
                  <th className="text-center px-4 py-3 text-xs font-bold">الإجمالي</th>
                  <th className="text-center px-4 py-3 text-xs font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const meta = STATUS_META[o.status] ?? STATUS_META.DRAFT
                  return (
                    <tr key={o.id} onClick={() => openOrder(o.id)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40"
                      style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="px-4 py-3 font-black text-xs" style={{ color: 'var(--text-primary)' }}>
                        PO-{o.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{o.supplierName}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(o.createdAt).toLocaleDateString('ar')}
                      </td>
                      <td className="px-4 py-3 text-center">{o.itemsCount}</td>
                      <td className="px-4 py-3 text-center font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(o.totalCost)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${meta.cls}`}>{meta.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Create ───────────────────────────────────────────────────── */}
      {view === 'create' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--text-muted)' }}>المورد (اختياري)</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                <option value="">بدون مورد</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--text-muted)' }}>ملاحظات</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات للطلب..."
                className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
            </div>
          </div>

          {/* Product picker */}
          <div className="rounded-2xl p-4 relative" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--text-muted)' }}>إضافة أصناف</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input value={productQuery} onChange={e => setProductQuery(e.target.value)}
                placeholder="ابحث باسم المنتج أو الباركود..."
                className="w-full rounded-xl py-2.5 pr-10 pl-4 text-sm outline-none" style={inputStyle} />
              {searching && <Loader2 className="w-4 h-4 animate-spin absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />}
            </div>
            {productResults.length > 0 && (
              <div className="absolute right-4 left-4 mt-1 rounded-xl overflow-hidden z-10 shadow-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                {productResults.map(p => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full text-right px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-blue-50/50"
                    style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border-color)' }}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {/* Draft items */}
            {items.length > 0 && (
              <table className="w-full text-sm mt-4">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="text-right py-2 text-xs font-bold">المنتج</th>
                    <th className="text-center py-2 text-xs font-bold">الكمية (وحدة أساس)</th>
                    <th className="text-center py-2 text-xs font-bold">سعر الوحدة</th>
                    <th className="text-center py-2 text-xs font-bold">الإجمالي</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.productId} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{item.productName}</td>
                      <td className="py-2 text-center">
                        <input type="number" min={1} value={item.quantity}
                          onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                          className="w-24 text-center rounded-lg py-1.5 text-sm outline-none" style={inputStyle} />
                      </td>
                      <td className="py-2 text-center">
                        <input type="number" min={0} step="0.01" value={item.costPrice}
                          onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, costPrice: e.target.value } : it))}
                          className="w-28 text-center rounded-lg py-1.5 text-sm outline-none" style={inputStyle} />
                      </td>
                      <td className="py-2 text-center font-bold" style={{ color: 'var(--text-primary)' }}>
                        {fmt((Number(item.quantity) || 0) * (Number(item.costPrice) || 0))}
                      </td>
                      <td className="py-2 text-center">
                        <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
              الإجمالي: {fmt(draftTotal)}
            </p>
            <button onClick={submitOrder} disabled={submitting || items.length === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)' }}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              حفظ كمسودة
            </button>
          </div>
        </div>
      )}

      {/* ── Detail ───────────────────────────────────────────────────── */}
      {view === 'detail' && (
        !detail ? (
          <div className="p-10 text-center text-sm rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
            جارٍ التحميل...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${(STATUS_META[detail.status] ?? STATUS_META.DRAFT).cls}`}>
                {(STATUS_META[detail.status] ?? STATUS_META.DRAFT).label}
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {detail.supplierName ?? 'بدون مورد'}
              </span>
              <div className="flex-1" />
              {detail.status === 'DRAFT' && (
                <button onClick={() => orderAction('order')} disabled={acting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)' }}>
                  <Send className="w-3.5 h-3.5" />
                  تأكيد وإرسال للمورد
                </button>
              )}
              {['DRAFT', 'ORDERED'].includes(detail.status) && (
                <>
                  <button onClick={() => setReceiveMode(v => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <PackageCheck className="w-3.5 h-3.5" />
                    {receiveMode ? 'إخفاء الاستلام' : 'استلام البضاعة'}
                  </button>
                  <button onClick={() => orderAction('cancel')} disabled={acting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>
                    <XCircle className="w-3.5 h-3.5" />
                    إلغاء
                  </button>
                </>
              )}
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="text-right px-4 py-3 text-xs font-bold">المنتج</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">المطلوب</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">سعر الوحدة</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">الإجمالي</th>
                    {(receiveMode || detail.status === 'RECEIVED') && (
                      <th className="text-center px-4 py-3 text-xs font-bold">المستلَم</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{item.productName}</td>
                      <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-center">{item.costPrice.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(item.total)}</td>
                      {receiveMode && detail.status !== 'RECEIVED' && (
                        <td className="px-4 py-2.5 text-center">
                          <input type="number" min={0} value={receivedQtys[item.id] ?? ''}
                            onChange={e => setReceivedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-24 text-center rounded-lg py-1.5 text-sm outline-none" style={inputStyle} />
                        </td>
                      )}
                      {detail.status === 'RECEIVED' && (
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{item.receivedQty ?? '—'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {receiveMode && detail.status !== 'RECEIVED' && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <label className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                  دفعة مسددة الآن (اختياري)
                  <input type="number" min={0} value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                    placeholder="0"
                    className="w-32 text-center rounded-lg py-1.5 text-sm outline-none" style={inputStyle} />
                </label>
                <div className="flex-1" />
                <button onClick={() => orderAction('receive')} disabled={acting}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                  تأكيد الاستلام وإضافة المخزون
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
