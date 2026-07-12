'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ClipboardList, Plus, Search, Save, CheckCircle2, XCircle,
  ArrowRight, Loader2, AlertTriangle,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useBranch } from '@/contexts/BranchContext'
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
  const { selectedBranch } = useBranch()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Detail view state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ status: string; items: SessionItem[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const qs = selectedBranch?.id ? `?branchId=${selectedBranch.id}` : ''
      const res = await fetch(`/api/stocktake${qs}`)
      const data = await res.json()
      if (res.ok) setSessions(data.sessions ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [selectedBranch?.id])

  useEffect(() => { loadSessions() }, [loadSessions])

  async function openSession(id: string) {
    setActiveId(id)
    setDetailLoading(true)
    setSearch('')
    try {
      const res = await fetch(`/api/stocktake/${id}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'تعذر فتح الجلسة'); setActiveId(null); return }
      setDetail({ status: data.status, items: data.items })
      const initial: Record<string, string> = {}
      for (const item of data.items as SessionItem[]) {
        initial[item.id] = item.countedQty === null ? '' : String(item.countedQty)
      }
      setCounts(initial)
    } finally {
      setDetailLoading(false)
    }
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
      setDetail(d => d ? {
        ...d,
        items: d.items.map(i => {
          const raw = counts[i.id] ?? ''
          const counted = raw === '' ? null : Math.max(0, Math.round(Number(raw)))
          return { ...i, countedQty: counted, difference: counted === null ? null : counted - i.expectedQty }
        }),
      } : d)
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
    if (!window.confirm(`سيتم اعتماد الجرد وتعديل المخزون الفعلي (${diffCount} صنف بفروقات). هل أنت متأكد؟`)) return
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
      setActiveId(null); setDetail(null)
      loadSessions()
    } finally {
      setCompleting(false)
    }
  }

  async function cancelSession() {
    if (!activeId) return
    if (!window.confirm('سيتم إلغاء جلسة الجرد دون أي تعديل على المخزون. متابعة؟')) return
    const res = await fetch(`/api/stocktake/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) {
      toast.success('أُلغيت جلسة الجرد')
      setActiveId(null); setDetail(null)
      loadSessions()
    } else toast.error('فشل الإلغاء')
  }

  const filteredItems = useMemo(() => {
    if (!detail) return []
    const q = search.trim()
    return q ? detail.items.filter(i => i.productName.includes(q)) : detail.items
  }, [detail, search])

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
      <PageHeader
        title="جرد المخزون"
        subtitle="عدّ فعلي للمخزون ومطابقته مع المسجّل واعتماد الفروقات"
        icon={ClipboardList}
        gradient="linear-gradient(135deg, #094B9F, #063A8A)"
        actions={
          activeId ? (
            <button onClick={() => { setActiveId(null); setDetail(null); loadSessions() }}
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
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-hover, rgba(148,163,184,0.06))', color: 'var(--text-muted)' }}>
                  <th className="text-right px-4 py-3 text-xs font-bold">الفرع</th>
                  <th className="text-right px-4 py-3 text-xs font-bold">التاريخ</th>
                  <th className="text-center px-4 py-3 text-xs font-bold">الأصناف</th>
                  <th className="text-center px-4 py-3 text-xs font-bold">المعدود</th>
                  <th className="text-center px-4 py-3 text-xs font-bold">فروقات</th>
                  <th className="text-center px-4 py-3 text-xs font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const meta = STATUS_META[s.status] ?? STATUS_META.DRAFT
                  return (
                    <tr key={s.id} onClick={() => openSession(s.id)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40"
                      style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{s.branchName}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(s.createdAt).toLocaleDateString('ar')}
                      </td>
                      <td className="px-4 py-3 text-center">{s.totalItems}</td>
                      <td className="px-4 py-3 text-center">{s.countedItems}</td>
                      <td className="px-4 py-3 text-center">
                        {s.diffItems > 0
                          ? <span className="font-bold text-amber-600">{s.diffItems}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                      </td>
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
                { label: 'إجمالي الأصناف', value: stats.total },
                { label: 'تم عدّه', value: stats.counted },
                { label: 'فروقات', value: stats.diffs, warn: stats.diffs > 0 },
              ].map(s => (
                <div key={s.label} className="rounded-2xl px-4 py-2.5"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  <p className={`text-lg font-black ${s.warn ? 'text-amber-500' : ''}`}
                    style={s.warn ? {} : { color: 'var(--text-primary)' }}>{s.value}</p>
                </div>
              ))}
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

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="w-full rounded-2xl py-2.5 pr-10 pl-4 text-sm outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Items table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th className="text-right px-4 py-3 text-xs font-bold">المنتج</th>
                      <th className="text-center px-4 py-3 text-xs font-bold">المسجّل</th>
                      <th className="text-center px-4 py-3 text-xs font-bold">المعدود فعلياً</th>
                      <th className="text-center px-4 py-3 text-xs font-bold">الفرق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => {
                      const raw = counts[item.id] ?? ''
                      const diff = raw === '' ? null : Number(raw) - item.expectedQty
                      return (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{item.productName}</td>
                          <td className="px-4 py-2.5 text-center" style={{ color: 'var(--text-muted)' }}>{item.expectedQty}</td>
                          <td className="px-4 py-2.5 text-center">
                            {isDraft ? (
                              <input
                                type="number"
                                min={0}
                                value={raw}
                                onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-24 text-center rounded-lg py-1.5 text-sm outline-none"
                                style={{ background: 'var(--bg-hover, rgba(148,163,184,0.08))', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                placeholder="—"
                              />
                            ) : (
                              <span style={{ color: 'var(--text-primary)' }}>{item.countedQty ?? '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold">
                            {diff === null ? (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            ) : diff === 0 ? (
                              <span className="text-emerald-500">مطابق</span>
                            ) : (
                              <span className={diff > 0 ? 'text-blue-500' : 'text-red-500'}>
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
