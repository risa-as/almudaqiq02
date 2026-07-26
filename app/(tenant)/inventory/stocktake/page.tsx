'use client'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJson, fetchJsonOr } from '@/lib/query/fetcher'
import toast from 'react-hot-toast'
import {
  ClipboardList, Plus, Search, Save, CheckCircle2, XCircle,
  ArrowRight, Loader2, AlertTriangle, ChevronLeft, PackageSearch,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useBranch } from '@/contexts/BranchContext'
import { useConfirm } from '@/hooks/useConfirm'
import { usePageTitle } from '@/hooks/usePageTitle'

interface SessionSummary {
  id: string
  branchId: string
  branchName: string
  status: string
  notes: string | null
  createdAt: string
  completedAt: string | null
  totalItems: number
  countedItems: number
  diffItems: number
}

interface SessionItem {
  id: string
  productId: string
  productName: string
  expectedQty: number
  countedQty: number | null
  note: string | null
  difference: number | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: 'مفتوحة',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'مكتملة',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'ملغاة',   cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default function StocktakePage() {
  usePageTitle('جرد المخزون')
  const { selectedBranch, loading: branchLoading } = useBranch()
  const queryClient = useQueryClient()
  // حوار التأكيد الموحّد للنظام بدل window.confirm الأصلي للمتصفّح
  const { confirm, dialog } = useConfirm()

  const [creating, setCreating] = useState(false)

  // Detail view state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  /** فلتر «غير المعدود فقط» — الوسيلة العملية لمعرفة ما تبقّى في جلسة طويلة */
  const [onlyUncounted, setOnlyUncounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)

  const bId = selectedBranch?.id ?? 'all'
  const qs = selectedBranch?.id ? `?branchId=${selectedBranch.id}` : ''
  const sessionsQuery = useQuery({
    queryKey: ['stocktake', bId],
    queryFn: () => fetchJsonOr<{ sessions: SessionSummary[] }>(`/api/stocktake${qs}`, { sessions: [] }),
    enabled: !branchLoading,
  })
  const sessions = sessionsQuery.data?.sessions ?? []
  const loading = sessionsQuery.isPending

  const loadSessions = () => queryClient.invalidateQueries({ queryKey: ['stocktake'] })

  const detailQuery = useQuery({
    queryKey: ['stocktake-detail', activeId],
    queryFn: () => fetchJson<{ status: string; items: SessionItem[] }>(`/api/stocktake/${activeId}`),
    enabled: !!activeId,
  })
  const detailData = activeId ? detailQuery.data : undefined
  // مُذكَّر: كان كائنًا جديدًا في كل رسم، فتُعاد حسبة filteredItems و stats دائمًا
  const detail = useMemo(
    () => (detailData ? { status: detailData.status, items: detailData.items } : null),
    [detailData],
  )
  const detailLoading = detailQuery.isPending

  // Seed the editable counts whenever fresh detail data arrives
  useEffect(() => {
    if (!detailData) return
    const initial: Record<string, string> = {}
    for (const item of detailData.items) {
      initial[item.id] = item.countedQty === null ? '' : String(item.countedQty)
    }
    setCounts(initial)
  }, [detailData])

  // Preserve old openSession error handling: toast + back to the list
  useEffect(() => {
    if (!activeId || !detailQuery.isError || detailQuery.isFetching) return
    toast.error(detailQuery.error instanceof Error && detailQuery.error.message ? detailQuery.error.message : 'تعذر فتح الجلسة')
    setActiveId(null)
  }, [activeId, detailQuery.isError, detailQuery.isFetching, detailQuery.error])

  function openSession(id: string) {
    setSearch('')
    setActiveId(id)
  }

  async function createSession() {
    if (!selectedBranch?.id) { toast.error('اختر فرعاً محدداً من الأعلى لبدء الجرد'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/stocktake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: selectedBranch.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'فشل بدء الجرد')
        if (data.sessionId) openSession(data.sessionId)
        return
      }
      toast.success('بدأت جلسة الجرد — سجّل الكميات الفعلية')
      await loadSessions()
      openSession(data.sessionId)
    } finally {
      setCreating(false)
    }
  }

  async function saveCounts(silent = false) {
    if (!activeId || !detail) return false
    setSaving(true)
    try {
      const payload = detail.items
        .filter(i => (counts[i.id] ?? '') !== (i.countedQty === null ? '' : String(i.countedQty)))
        .map(i => ({ itemId: i.id, countedQty: counts[i.id] === '' ? null : Number(counts[i.id]) }))
      if (payload.length === 0) { if (!silent) toast('لا توجد تغييرات للحفظ'); return true }
      const res = await fetch(`/api/stocktake/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts: payload }),
      })
      if (!res.ok) { toast.error('فشل حفظ الكميات'); return false }
      if (!silent) toast.success('تم حفظ الكميات')
      queryClient.invalidateQueries({ queryKey: ['stocktake-detail', activeId] })
      queryClient.invalidateQueries({ queryKey: ['stocktake'] })
      return true
    } finally {
      setSaving(false)
    }
  }

  async function completeSession() {
    if (!activeId) return
    const diffCount = detail?.items.filter(i => {
      const raw = counts[i.id] ?? ''
      if (raw === '') return false
      return Number(raw) !== i.expectedQty
    }).length ?? 0
    const ok = await confirm({
      title: 'اعتماد الجرد',
      message: `سيتم تعديل المخزون الفعلي حسب الكميات المعدودة (${diffCount} صنف بفروقات)، وتُوثَّق العملية في سجل التدقيق. لا يمكن التراجع.`,
      variant: 'warning',
      confirmLabel: 'اعتماد وتطبيق الفروقات',
      cancelLabel: 'تراجع',
    })
    if (!ok) return
    setCompleting(true)
    try {
      const saved = await saveCounts(true)
      if (!saved) return
      const res = await fetch(`/api/stocktake/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'فشل اعتماد الجرد'); return }
      toast.success(`تم اعتماد الجرد — عُدّل ${data.adjustments} صنف`)
      setActiveId(null)
      loadSessions()
      queryClient.invalidateQueries({ queryKey: ['stocktake-detail'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-expiry'] })
      queryClient.invalidateQueries({ queryKey: ['product-history'] })
    } finally {
      setCompleting(false)
    }
  }

  async function cancelSession() {
    if (!activeId) return
    const ok = await confirm({
      title: 'إلغاء جلسة الجرد',
      message: 'ستُهمل كل الكميات المسجّلة في هذه الجلسة ولن يتغيّر المخزون. لا يمكن التراجع عن الإلغاء.',
      variant: 'danger',
      confirmLabel: 'إلغاء الجلسة',
      cancelLabel: 'تراجع',
    })
    if (!ok) return
    const res = await fetch(`/api/stocktake/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) {
      toast.success('أُلغيت جلسة الجرد')
      setActiveId(null)
      loadSessions()
      queryClient.invalidateQueries({ queryKey: ['stocktake-detail'] })
    } else toast.error('فشل الإلغاء')
  }

  const filteredItems = useMemo(() => {
    if (!detail) return []
    const q = search.trim()
    let list = q ? detail.items.filter(i => i.productName.includes(q)) : detail.items
    if (onlyUncounted) list = list.filter(i => (counts[i.id] ?? '') === '')
    return list
  }, [detail, search, onlyUncounted, counts])

  const stats = useMemo(() => {
    if (!detail) return { counted: 0, diffs: 0, total: 0 }
    let counted = 0, diffs = 0
    for (const i of detail.items) {
      const raw = counts[i.id] ?? ''
      if (raw === '') continue
      counted++
      if (Number(raw) !== i.expectedQty) diffs++
    }
    return { counted, diffs, total: detail.items.length }
  }, [detail, counts])

  const isDraft = detail?.status === 'DRAFT'

  return (
    <div className="max-w-6xl mx-auto space-y-4" dir="rtl">
      {/* بدونه لا يُعرض حوار التأكيد إطلاقًا (useConfirm يعيد العنصر ليُركَّب هنا) */}
      {dialog}
      <PageHeader
        title="جرد المخزون"
        subtitle="عدّ فعلي للمخزون ومطابقته مع المسجّل واعتماد الفروقات"
        icon={ClipboardList}
        gradient="linear-gradient(135deg, #094B9F, #063A8A)"
        actions={
          activeId ? (
            <button onClick={() => { setActiveId(null); loadSessions() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
              <ArrowRight className="w-3.5 h-3.5" />
              عودة للقائمة
            </button>
          ) : (
            <button onClick={createSession} disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              بدء جرد جديد
            </button>
          )
        }
      />

      {/* ── Sessions list ─────────────────────────────────────────────── */}
      {!activeId && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          {loading ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>جارٍ التحميل...</div>
          ) : sessions.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>لا توجد جلسات جرد بعد</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>ابدأ جرداً جديداً لمطابقة المخزون الفعلي مع المسجّل</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-hover, rgba(148,163,184,0.06))', color: 'var(--text-muted)' }}>
                    <th className="text-right px-4 py-3 text-xs font-bold">الفرع والتاريخ</th>
                    <th className="text-right px-4 py-3 text-xs font-bold w-52">التقدّم</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">فروقات</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">الحالة</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => {
                    const meta = STATUS_META[s.status] ?? STATUS_META.DRAFT
                    // شريط تقدّم بدل رقمين منفصلين — نسبة الإنجاز تُقرأ بلمحة
                    const pct = s.totalItems > 0
                      ? Math.round((s.countedItems / s.totalItems) * 100)
                      : 0
                    const done = pct === 100
                    return (
                      <tr key={s.id} onClick={() => openSession(s.id)}
                        className="group cursor-pointer transition-colors hover:bg-blue-50/40"
                        style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td className="px-4 py-3">
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{s.branchName}</p>
                          {/* الوقت مع التاريخ: جلسات اليوم نفسه كانت تبدو متطابقة */}
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {new Date(s.createdAt).toLocaleString('ar', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                              style={{ background: 'var(--bg-hover, rgba(148,163,184,0.18))' }}>
                              <div className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums shrink-0"
                              style={{ color: 'var(--text-muted)' }}>
                              {s.countedItems}/{s.totalItems}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.diffItems > 0
                            ? <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-600 border border-amber-200">{s.diffItems}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${meta.cls}`}>{meta.label}</span>
                        </td>
                        {/* إشارة أن الصفّ قابل للفتح — لم يكن هناك ما يدلّ على ذلك */}
                        <td className="px-2 py-3 text-center">
                          <ChevronLeft className="w-4 h-4 opacity-30 transition-opacity group-hover:opacity-70"
                            style={{ color: 'var(--text-muted)' }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Session detail ────────────────────────────────────────────── */}
      {activeId && (
        detailLoading || !detail ? (
          <div className="p-10 text-center text-sm rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
            جارٍ التحميل...
          </div>
        ) : (
          <>
            {/* Stats + actions */}
            <div className="flex flex-wrap items-center gap-3">
              {[
                { label: 'إجمالي الأصناف', value: stats.total, Icon: ClipboardList, tone: 'text-slate-400', warn: false },
                { label: 'تم عدّه', value: stats.counted, Icon: CheckCircle2, tone: 'text-emerald-500', warn: false },
                { label: 'فروقات', value: stats.diffs, Icon: AlertTriangle, tone: stats.diffs > 0 ? 'text-amber-500' : 'text-slate-300', warn: stats.diffs > 0 },
              ].map(({ label, value, Icon, tone, warn }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-2xl px-4 py-2.5"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
                  <div>
                    <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className={`text-lg font-black leading-tight ${warn ? 'text-amber-500' : ''}`}
                      style={warn ? {} : { color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                </div>
              ))}

              {/* شريط الإنجاز — «تم عدّه من الإجمالي» كنسبة بدل رقمين متجاورين */}
              <div className="flex items-center gap-2 rounded-2xl px-4 py-3 min-w-[180px] flex-1 sm:flex-none sm:w-56"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--bg-hover, rgba(148,163,184,0.18))' }}>
                  <div
                    className={`h-full rounded-full transition-all ${stats.total > 0 && stats.counted === stats.total ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0}%
                </span>
              </div>

              <div className="flex-1" />
              {isDraft && (
                <div className="flex items-center gap-2">
                  <button onClick={() => saveCounts()} disabled={saving}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ background: 'rgba(9,75,159,0.1)', color: '#094B9F', border: '1px solid rgba(9,75,159,0.25)' }}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    حفظ الكميات
                  </button>
                  <button onClick={completeSession} disabled={completing || stats.counted === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    اعتماد الجرد
                  </button>
                  <button onClick={cancelSession}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                    style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>
                    <XCircle className="w-3.5 h-3.5" />
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            {isDraft && stats.diffs > 0 && (
              <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#b45309' }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                عند اعتماد الجرد ستُعدَّل كميات المخزون الفعلية حسب الفروقات المسجّلة — العملية تُوثَّق في سجل التدقيق.
              </div>
            )}

            {/* Search + filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ابحث عن منتج..."
                  className="w-full rounded-2xl py-2.5 pr-10 pl-4 text-sm outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              {/* في جلسة بمئات الأصناف، معرفة ما تبقّى كانت تتطلّب تمريرًا يدويًا */}
              {isDraft && (
                <button
                  onClick={() => setOnlyUncounted(v => !v)}
                  aria-pressed={onlyUncounted}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
                    onlyUncounted
                      ? 'bg-blue-600 text-white border border-blue-600'
                      : 'hover:opacity-80'
                  }`}
                  style={onlyUncounted ? {} : { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
                >
                  <PackageSearch className="w-3.5 h-3.5" />
                  غير المعدود فقط
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${onlyUncounted ? 'bg-white/20' : 'bg-slate-500/10'}`}>
                    {stats.total - stats.counted}
                  </span>
                </button>
              )}
            </div>

            {/* Items table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full text-sm">
                  {/* حدّ سفلي للرأس اللاصق — كانت الصفوف تمرّ تحته بلا فاصل */}
                  <thead className="sticky top-0 z-10"
                    style={{ background: 'var(--bg-card)', boxShadow: '0 1px 0 var(--border-color)' }}>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th className="text-right px-4 py-3 text-xs font-bold">المنتج</th>
                      <th className="text-center px-4 py-3 text-xs font-bold">المسجّل</th>
                      <th className="text-center px-4 py-3 text-xs font-bold">المعدود فعلياً</th>
                      <th className="text-center px-4 py-3 text-xs font-bold">الفرق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center">
                          <PackageSearch className="w-9 h-9 mx-auto mb-2 opacity-25" style={{ color: 'var(--text-muted)' }} />
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                            {onlyUncounted ? 'تم عدّ كل الأصناف المطابقة' : 'لا توجد أصناف مطابقة للبحث'}
                          </p>
                        </td>
                      </tr>
                    ) : filteredItems.map(item => {
                      const raw = counts[item.id] ?? ''
                      const diff = raw === '' ? null : Number(raw) - item.expectedQty
                      const counted = raw !== ''
                      return (
                        <tr key={item.id}
                          // الصفّ غير المعدود يبقى محايدًا، والمعدود يخفت قليلًا،
                          // وذو الفرق يُوسَم بشريط جانبي ملوّن ⇒ الفروقات تُلتقط بالمسح البصري
                          className={`transition-colors ${counted ? 'bg-slate-500/[0.03]' : ''} ${diff !== null && diff !== 0 ? 'shadow-[inset_3px_0_0_0_currentColor] text-amber-400' : ''}`}
                          style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{item.productName}</td>
                          <td className="px-4 py-2.5 text-center tabular-nums" style={{ color: 'var(--text-muted)' }}>{item.expectedQty}</td>
                          <td className="px-4 py-2.5 text-center">
                            {isDraft ? (
                              <input
                                type="number"
                                min={0}
                                value={raw}
                                onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className={`w-24 text-center rounded-lg py-1.5 text-sm font-bold outline-none transition-colors focus:border-blue-400 ${counted ? '' : 'border-dashed'}`}
                                style={{
                                  background: 'var(--bg-hover, rgba(148,163,184,0.08))',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-primary)',
                                }}
                                placeholder="—"
                              />
                            ) : (
                              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{item.countedQty ?? '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {diff === null ? (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            ) : diff === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                مطابق
                              </span>
                            ) : (
                              <span className={`inline-block text-[11px] font-black px-2 py-0.5 rounded-full border tabular-nums ${
                                diff > 0
                                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                                  : 'bg-red-50 text-red-600 border-red-200'
                              }`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  )
}
