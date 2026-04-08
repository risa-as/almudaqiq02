'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Search, Building2, CheckCircle, XCircle, Clock,
  SearchX, AlertTriangle, DollarSign, Edit2, X, Save,
  Loader2, TrendingUp, Users, ShieldAlert, Ban, Trash2
} from 'lucide-react'
import { PulseLoader } from '@/components/loading/PulseLoader'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan { id: string; name: string }

interface Tenant {
  id: string; name: string; orgCode: string; status: string; createdAt: string
  subscription?: {
    plan: { id: string; name: string }
    endDate?: string
    trialEndDate?: string
    gracePeriodEndsAt?: string
  }
  _count: { branches: number; users: number }
}

interface Stats {
  counts: { total: number; active: number; trial: number; expiringSoon: number; grace: number; suspended: number; cancelled: number }
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  ACTIVE:    { label: 'نشط',        cls: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20', icon: CheckCircle },
  TRIAL:     { label: 'تجربة',      cls: 'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20',         icon: Clock },
  GRACE:     { label: 'فترة مهلة',  cls: 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-500/20',   icon: AlertTriangle },
  SUSPENDED: { label: 'معلق',       cls: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',      icon: XCircle },
  CANCELLED: { label: 'ملغى',       cls: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20',         icon: Ban },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })
}

function rowHighlight(t: Tenant) {
  if (t.status === 'GRACE') return 'bg-orange-50/60'
  if (t.status === 'SUSPENDED' || t.status === 'CANCELLED') return 'bg-slate-50/80'
  if (t.subscription?.endDate) {
    const diff = new Date(t.subscription.endDate).getTime() - Date.now()
    if (diff > 0 && diff < 7 * 86400_000) return 'bg-amber-50/50'
  }
  return ''
}

function endDateDisplay(t: Tenant) {
  if (t.status === 'TRIAL')  return t.subscription?.trialEndDate      ? formatDate(t.subscription.trialEndDate)       : '—'
  if (t.status === 'GRACE')  return t.subscription?.gracePeriodEndsAt ? formatDate(t.subscription.gracePeriodEndsAt)  : '—'
  return t.subscription?.endDate ? formatDate(t.subscription.endDate) : '—'
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [total,   setTotal]   = useState(0)
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState('')
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [plans,   setPlans]   = useState<Plan[]>([])

  // Edit modal
  const [editOpen,   setEditOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<Tenant | null>(null)
  const [editForm,   setEditForm]   = useState({ name: '', planId: '', endDate: '', status: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState('')

  // Delete modal
  const [delOpen,       setDelOpen]       = useState(false)
  const [delTarget,     setDelTarget]     = useState<Tenant | null>(null)
  const [delOrgCode,    setDelOrgCode]    = useState('')
  const [delUsername,   setDelUsername]   = useState('')
  const [delPassword,   setDelPassword]   = useState('')
  const [delSaving,     setDelSaving]     = useState(false)
  const [delError,      setDelError]      = useState('')

  // Payment modal
  const [payOpen,   setPayOpen]   = useState(false)
  const [payTarget, setPayTarget] = useState<Tenant | null>(null)
  const [payForm,   setPayForm]   = useState({ months: 1, amount: '', notes: '' })
  const [paySaving, setPaySaving] = useState(false)
  const [payError,  setPayError]  = useState('')

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadTenants = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ page: String(page), limit: '20', search, ...(status ? { status } : {}) })
    fetch(`/api/super-admin/tenants?${p}`)
      .then(r => r.json())
      .then(d => { setTenants(d.tenants); setTotal(d.total) })
      .finally(() => setLoading(false))
  }, [page, search, status])

  useEffect(() => { loadTenants() }, [loadTenants])

  useEffect(() => {
    fetch('/api/super-admin/subscriptions/stats').then(r => r.json()).then(setStats).catch(() => {})
    fetch('/api/super-admin/plans').then(r => r.json()).then(setPlans).catch(() => {})
  }, [])

  // ── Delete Modal ────────────────────────────────────────────────────────────
  function openDelete(t: Tenant) {
    setDelTarget(t)
    setDelOrgCode('')
    setDelUsername('')
    setDelPassword('')
    setDelError('')
    setDelOpen(true)
  }

  async function submitDelete() {
    if (!delTarget) return
    if (delOrgCode.trim().toUpperCase() !== delTarget.orgCode) {
      setDelError('كود المنظمة غير صحيح')
      return
    }
    if (!delUsername || !delPassword) { setDelError('يرجى إدخال اسم المستخدم وكلمة المرور'); return }
    setDelSaving(true); setDelError('')
    try {
      const res = await fetch(`/api/super-admin/tenants/${delTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: delUsername, password: delPassword }),
      })
      let data: { error?: unknown; success?: boolean } = {}
      try { data = await res.json() } catch { /* non-json response */ }
      if (!res.ok) {
        setDelError(data.error?.toString() ?? `فشل الحذف (${res.status})`)
        return
      }
      setDelOpen(false)
      loadTenants()
      fetch('/api/super-admin/subscriptions/stats').then(r => r.json()).then(setStats).catch(() => {})
    } catch { setDelError('تعذر الاتصال بالخادم — تحقق من الاتصال بالإنترنت') }
    finally  { setDelSaving(false) }
  }

  // ── Edit Modal ──────────────────────────────────────────────────────────────
  function openEdit(t: Tenant) {
    setEditTarget(t)
    setEditForm({
      name:    t.name,
      planId:  t.subscription?.plan?.id ?? '',
      endDate: t.subscription?.endDate ? t.subscription.endDate.slice(0, 10) : '',
      status:  t.status,
    })
    setEditError('')
    setEditOpen(true)
  }

  async function submitEdit() {
    if (!editTarget) return
    setEditSaving(true); setEditError('')
    try {
      const res = await fetch(`/api/super-admin/tenants/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    editForm.name,
          status:  editForm.status,
          planId:  editForm.planId || undefined,
          endDate: editForm.endDate ? new Date(editForm.endDate).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setEditError(d.error?.toString() ?? 'حدث خطأ')
        return
      }
      setEditOpen(false)
      loadTenants()
      fetch('/api/super-admin/subscriptions/stats').then(r => r.json()).then(setStats).catch(() => {})
    } catch { setEditError('تعذر الاتصال بالخادم') }
    finally  { setEditSaving(false) }
  }

  // ── Payment Modal ───────────────────────────────────────────────────────────
  function openPay(t: Tenant) {
    setPayTarget(t)
    setPayForm({ months: 1, amount: '', notes: '' })
    setPayError('')
    setPayOpen(true)
  }

  async function submitPay() {
    if (!payTarget) return
    if (!payForm.amount || isNaN(Number(payForm.amount))) { setPayError('يرجى إدخال المبلغ'); return }
    setPaySaving(true); setPayError('')
    try {
      const res = await fetch(`/api/super-admin/tenants/${payTarget.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: payForm.months, amount: Number(payForm.amount), notes: payForm.notes || undefined }),
      })
      if (!res.ok) {
        const d = await res.json()
        setPayError(d.error?.toString() ?? 'حدث خطأ')
        return
      }
      setPayOpen(false)
      loadTenants()
      fetch('/api/super-admin/subscriptions/stats').then(r => r.json()).then(setStats).catch(() => {})
    } catch { setPayError('تعذر الاتصال بالخادم') }
    finally  { setPaySaving(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const c = stats?.counts

  return (
    <><div className="space-y-6 animate-fade-in-up" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', boxShadow: '0 8px 24px rgba(6,182,212,0.3)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
            <Building2 size={22} className="text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">المستأجرون</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">إجمالي: {c?.total ?? '…'} مستأجر</p>
          </div>
        </div>
        <a href="/super-admin/tenants/new" className="btn-primary w-full sm:w-auto">
          <Plus className="w-5 h-5" /> إضافة مستأجر جديد
        </a>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: 'نشط',               val: c?.active,       gradient: 'linear-gradient(135deg,#10b981,#059669)', glow: 'rgba(16,185,129,0.2)' },
          { label: 'تجربة',             val: c?.trial,        gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', glow: 'rgba(99,102,241,0.2)' },
          { label: 'ينتهي خلال 7 أيام', val: c?.expiringSoon, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', glow: 'rgba(245,158,11,0.2)' },
          { label: 'فترة المهلة',       val: c?.grace,        gradient: 'linear-gradient(135deg,#f97316,#ea580c)', glow: 'rgba(249,115,22,0.2)' },
          { label: 'معلق / منتهٍ',      val: (c?.suspended ?? 0) + (c?.cancelled ?? 0), gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', glow: 'rgba(239,68,68,0.2)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden"
            style={{ background: 'white', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none opacity-10 blur-2xl"
              style={{ background: s.gradient, transform: 'translate(30%,-30%)' }} />
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
              style={{ background: s.gradient, boxShadow: `0 4px 12px ${s.glow}` }}>
              <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <p className="text-2xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>{s.val ?? '…'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="p-4 rounded-2xl flex gap-3 flex-wrap items-center"
        style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="البحث باسم المتجر..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl text-[13px] font-medium outline-none transition-all"
            style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a' }}
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="rounded-xl text-[13px] font-medium px-4 py-2.5 outline-none min-w-[140px] appearance-none cursor-pointer"
          style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a' }}
        >
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="TRIAL">تجربة</option>
          <option value="GRACE">فترة مهلة</option>
          <option value="SUSPENDED">معلق</option>
          <option value="CANCELLED">ملغى</option>
        </select>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="rounded-3xl p-20 flex justify-center" style={{ background: 'white', border: '1px solid var(--border-color)' }}>
          <PulseLoader />
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-3xl p-12 text-center flex flex-col items-center" style={{ background: 'white', border: '1px solid var(--border-color)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)' }}>
            <SearchX className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-700">لا يوجد مستأجرين</p>
          <p className="text-sm text-slate-500 mt-2">لم يتم العثور على أي نتائج مطابقة.</p>
        </div>
      ) : (
        <div className="rounded-[20px] overflow-hidden" style={{ background: 'white', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-right">المتجر</th>
                  <th className="text-center">كود المنظمة</th>
                  <th className="text-right">الخطة</th>
                  <th className="text-center">الفروع / المستخدمون</th>
                  <th className="text-center">تاريخ الانتهاء</th>
                  <th className="text-center">الحالة</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => {
                  const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.SUSPENDED
                  const Icon  = badge.icon
                  return (
                    <tr key={t.id} className={rowHighlight(t)}>

                      {/* Name */}
                      <td className="min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block text-[13px]">{t.name}</span>
                            <span className="text-[11px] text-slate-400">{new Date(t.createdAt).toLocaleDateString('ar-IQ')}</span>
                          </div>
                        </div>
                      </td>

                      {/* Org Code */}
                      <td className="text-center">
                        <span className="inline-flex px-3 py-1 rounded-lg text-sm font-black bg-blue-50 text-blue-700 border border-blue-100 tracking-widest">
                          {t.orgCode}
                        </span>
                      </td>

                      {/* Plan */}
                      <td>
                        <span className="text-[13px] font-bold text-slate-700">{t.subscription?.plan?.name ?? '—'}</span>
                      </td>

                      {/* Branches / Users */}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-3 text-[13px] font-bold text-slate-600">
                          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" />{t._count.branches}</span>
                          <span className="text-slate-200">|</span>
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" />{t._count.users}</span>
                        </div>
                      </td>

                      {/* End Date */}
                      <td className="text-center">
                        <span className={`text-[12px] font-bold ${
                          t.status === 'GRACE' ? 'text-orange-600' :
                          t.subscription?.endDate && new Date(t.subscription.endDate).getTime() - Date.now() < 7 * 86400_000 && new Date(t.subscription.endDate) > new Date()
                            ? 'text-amber-600' : 'text-slate-500'
                        }`}>
                          {endDateDisplay(t)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${badge.cls}`}>
                          <Icon className="w-3 h-3" />{badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          <a href={`/super-admin/tenants/${t.id}`}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
                            تفاصيل
                          </a>
                          <button onClick={() => openPay(t)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />تسديد
                          </button>
                          <button onClick={() => openEdit(t)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1">
                            <Edit2 className="w-3 h-3" />تعديل
                          </button>
                          <button onClick={() => openDelete(t)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center items-center gap-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm">
            السابق
          </button>
          <span className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600">
            {page} / {Math.ceil(total / 20)}
          </span>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm">
            التالي
          </button>
        </div>
      )}

    </div>{/* end animate-fade-in-up */}

      {/* ══ Delete Confirmation Modal ════════════════════════════════════════ */}
      {delOpen && delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !delSaving && setDelOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg leading-tight">حذف المستأجر نهائياً</h3>
                  <p className="text-xs text-slate-400 mt-0.5">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
              </div>
              {!delSaving && (
                <button onClick={() => setDelOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>

            {/* Tenant info card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-sm font-extrabold text-slate-800">{delTarget.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">كود المنظمة: <span className="font-black text-blue-700 tracking-widest">{delTarget.orgCode}</span></p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Step 1: orgCode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الخطوة 1 — اكتب كود المنظمة للتأكيد
                </label>
                <input
                  value={delOrgCode}
                  onChange={e => setDelOrgCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder={delTarget.orgCode}
                  maxLength={6}
                  autoComplete="off"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-black tracking-widest text-center focus:outline-none focus:ring-2 transition-all ${
                    delOrgCode.length === 6
                      ? delOrgCode === delTarget.orgCode
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 focus:ring-emerald-400/30'
                        : 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-400/30'
                      : 'border-slate-200 text-slate-800 focus:ring-blue-500/30'
                  }`}
                  dir="ltr"
                />
              </div>

              {/* Step 2: credentials */}
              <div className={`space-y-3 transition-opacity ${delOrgCode === delTarget.orgCode ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <p className="text-xs font-bold text-slate-700">الخطوة 2 — بيانات تسجيل دخول السوبر أدمن</p>
                <input
                  value={delUsername}
                  onChange={e => setDelUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  autoComplete="off"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  dir="ltr"
                />
                <input
                  type="password"
                  value={delPassword}
                  onChange={e => setDelPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  autoComplete="new-password"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  dir="ltr"
                />
              </div>
            </div>

            {delError && (
              <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {delError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setDelOpen(false)} disabled={delSaving}
                className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all disabled:opacity-40">
                إلغاء
              </button>
              <button
                onClick={submitDelete}
                disabled={delSaving || delOrgCode !== delTarget.orgCode || !delUsername || !delPassword}
                className="flex-1 py-2.5 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {delSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Edit Modal — outside animated div to fix fixed positioning ══════ */}
      {editOpen && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setEditOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-lg">تعديل بيانات المستأجر</h3>
              <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الاسم التجاري</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>

              {/* Plan */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">خطة الاشتراك</label>
                <select value={editForm.planId} onChange={e => setEditForm(f => ({ ...f, planId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none">
                  <option value="">— بدون تغيير —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ انتهاء الاشتراك</label>
                <input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">حالة الحساب</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none">
                  <option value="ACTIVE">نشط</option>
                  <option value="TRIAL">تجربة</option>
                  <option value="GRACE">فترة مهلة</option>
                  <option value="SUSPENDED">معلق</option>
                  <option value="CANCELLED">ملغى</option>
                </select>
              </div>
            </div>

            {editError && <p className="text-xs text-red-600 font-bold bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditOpen(false)} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all">
                إلغاء
              </button>
              <button onClick={submitEdit} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Payment Modal ════════════════════════════════════════════════════ */}
      {payOpen && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setPayOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">تسديد / تجديد الاشتراك</h3>
                <p className="text-xs text-slate-500 mt-0.5">{payTarget.name} — {payTarget.orgCode}</p>
              </div>
              <button onClick={() => setPayOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Months */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">مدة التجديد</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map(m => (
                    <button key={m} type="button"
                      onClick={() => setPayForm(f => ({ ...f, months: m }))}
                      className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                        payForm.months === m
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      }`}>
                      {m === 12 ? 'سنة' : `${m} شهر`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ المدفوع (د.ع)</label>
                <input
                  type="number" min="0" placeholder="مثال: 50000"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  dir="ltr"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات <span className="font-normal text-slate-400">(اختياري)</span></label>
                <input
                  placeholder="مثال: تم الدفع نقداً"
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Summary */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-800 font-bold">
                سيتم تمديد الاشتراك لمدة{' '}
                <span className="text-emerald-600">{payForm.months === 12 ? 'سنة كاملة' : `${payForm.months} شهر`}</span>
                {' '}وتفعيل الحساب تلقائياً
              </div>
            </div>

            {payError && <p className="text-xs text-red-600 font-bold bg-red-50 px-3 py-2 rounded-lg">{payError}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setPayOpen(false)} disabled={paySaving}
                className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all">
                إلغاء
              </button>
              <button onClick={submitPay} disabled={paySaving}
                className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                تأكيد التسديد
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
