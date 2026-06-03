'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Building2, CheckCircle, XCircle, Clock,
  SearchX, AlertTriangle, DollarSign, Edit2, X, Save,
  Loader2, TrendingUp, Users, Ban, Trash2, Bot, Sparkles
} from 'lucide-react'
import { PulseLoader } from '@/components/loading/PulseLoader'
import { FEATURES, TIER_META, parseFeatures, parseFeatureOverrides, type FeatureMap } from '@/lib/features'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan { id: string; name: string; features: FeatureMap }

interface Tenant {
  id: string; name: string; status: string; createdAt: string
  aiDailyLimit: number
  users: { email: string | null }[]
  subscription?: {
    plan: { id: string; name: string; features?: string }
    endDate?: string
    trialEndDate?: string
    gracePeriodEndsAt?: string
    featureOverrides?: string
  }
  _count: { branches: number; users: number }
}

interface Stats {
  counts: { total: number; active: number; trial: number; expiringSoon: number; grace: number; suspended: number; cancelled: number }
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  ACTIVE:    { label: 'نشط',        cls: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25', icon: CheckCircle },
  TRIAL:     { label: 'تجربة',      cls: 'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/25',   icon: Clock },
  GRACE:     { label: 'فترة مهلة',  cls: 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-500/25',   icon: AlertTriangle },
  SUSPENDED: { label: 'معلق',       cls: 'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/25',      icon: XCircle },
  CANCELLED: { label: 'ملغى',       cls: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/25',         icon: Ban },
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
    if (diff > 0 && diff < 7 * 86400_000) return 'bg-blue-50/50'
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
  usePageTitle('المستأجرون');
  const router = useRouter()
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
  const [editForm,   setEditForm]   = useState<{ name: string; planId: string; endDate: string; status: string; aiDailyLimit: number; featureOverrides: FeatureMap }>({ name: '', planId: '', endDate: '', status: '', aiDailyLimit: 50, featureOverrides: {} })
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState('')

  // Delete modal
  const [delOpen,     setDelOpen]     = useState(false)
  const [delTarget,   setDelTarget]   = useState<Tenant | null>(null)
  const [delName,     setDelName]     = useState('')
  const [delEmail,    setDelEmail]    = useState('')
  const [delPassword, setDelPassword] = useState('')
  const [delSaving,   setDelSaving]   = useState(false)
  const [delError,    setDelError]    = useState('')

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
    fetch('/api/super-admin/plans')
      .then(r => r.json())
      .then((rows: Array<{ id: string; name: string; features: string }>) =>
        setPlans(rows.map(p => ({ id: p.id, name: p.name, features: parseFeatures(p.features) }))))
      .catch(() => {})
  }, [])

  // ── Delete Modal ────────────────────────────────────────────────────────────
  function openDelete(t: Tenant) {
    setDelTarget(t)
    setDelName('')
    setDelEmail('')
    setDelPassword('')
    setDelError('')
    setDelOpen(true)
  }

  async function submitDelete() {
    if (!delTarget) return
    if (delName.trim() !== delTarget.name.trim()) {
      setDelError('اسم المتجر غير مطابق')
      return
    }
    if (!delEmail || !delPassword) { setDelError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return }
    setDelSaving(true); setDelError('')
    try {
      const res = await fetch(`/api/super-admin/tenants/${delTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: delEmail, password: delPassword }),
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
      name:             t.name,
      planId:           t.subscription?.plan?.id ?? '',
      endDate:          t.subscription?.endDate ? t.subscription.endDate.slice(0, 10) : '',
      status:           t.status,
      aiDailyLimit:     t.aiDailyLimit ?? 50,
      featureOverrides: parseFeatureOverrides(t.subscription?.featureOverrides),
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
          name:             editForm.name,
          status:           editForm.status,
          planId:           editForm.planId || undefined,
          endDate:          editForm.endDate ? new Date(editForm.endDate).toISOString() : null,
          aiDailyLimit:     Number(editForm.aiDailyLimit),
          featureOverrides: editForm.featureOverrides,
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
      router.refresh()
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
            <h1 className="text-2xl font-black text-slate-900">المنظمات</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">إجمالي: {c?.total ?? '…'} منظمة</p>
          </div>
        </div>
        <a href="/super-admin/tenants/new" className="btn-primary w-full sm:w-auto">
          <Plus className="w-5 h-5" /> إضافة منظمة جديدة
        </a>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: 'نشط',               val: c?.active,       gradient: 'linear-gradient(135deg,#10b981,#059669)', glow: 'rgba(16,185,129,0.2)' },
          { label: 'تجربة',             val: c?.trial,        gradient: 'linear-gradient(135deg,#094B9F,#063A8A)', glow: 'rgba(9,75,159,0.2)' },
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
        <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المتجر</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">البريد الإلكتروني</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الخطة</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">الفروع / المستخدمون</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">حد الذكاء الاصطناعي</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">تاريخ الانتهاء</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">الحالة</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenants.map(t => {
                  const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.SUSPENDED
                  const Icon  = badge.icon
                  const isExpiringSoon = t.subscription?.endDate
                    && new Date(t.subscription.endDate).getTime() - Date.now() < 7 * 86400_000
                    && new Date(t.subscription.endDate) > new Date()
                  return (
                    <tr key={t.id}
                      className={`hover:bg-blue-50/50 transition-colors group ${
                        t.status === 'GRACE' ? 'bg-orange-50/30' :
                        (t.status === 'SUSPENDED' || t.status === 'CANCELLED') ? 'bg-slate-50/80' :
                        isExpiringSoon ? 'bg-blue-50/40' : ''
                      }`}>

                      {/* Name */}
                      <td className="px-6 py-4 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 2px 8px rgba(9,75,159,0.25)' }}>
                            <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
                            <Building2 className="w-4 h-4 text-white relative z-10" />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 block text-[13px] leading-tight">{t.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{new Date(t.createdAt).toLocaleDateString('ar-IQ')}</span>
                          </div>
                        </div>
                      </td>

                      {/* Admin Email */}
                      <td className="px-6 py-4">
                        {t.users[0]?.email ? (
                          <span className="text-[12px] font-medium text-slate-600 dir-ltr" dir="ltr">
                            {t.users[0].email}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-300">—</span>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="px-6 py-4">
                        {t.subscription?.plan?.name ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {t.subscription.plan.name}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-300 font-medium">—</span>
                        )}
                      </td>

                      {/* Branches / Users */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            <Building2 className="w-3 h-3" />{t._count.branches}
                          </span>
                          <span className="text-slate-200 text-xs">|</span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                            <Users className="w-3 h-3" />{t._count.users}
                          </span>
                        </div>
                      </td>

                      {/* AI Daily Limit */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          <Bot className="w-3 h-3" />
                          {t.aiDailyLimit === 0 ? '∞ بلا حد' : `${t.aiDailyLimit}/يوم`}
                        </span>
                      </td>

                      {/* End Date */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-lg ${
                          t.status === 'GRACE'
                            ? 'bg-orange-50 text-orange-600 border border-orange-100'
                            : isExpiringSoon
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'text-slate-500'
                        }`}>
                          {(t.status === 'GRACE' || isExpiringSoon) && <AlertTriangle className="w-3 h-3" />}
                          {endDateDisplay(t)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold ${badge.cls}`}>
                          <Icon className="w-3 h-3" />{badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <a href={`/super-admin/tenants/${t.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all"
                            title="التفاصيل">
                            <TrendingUp className="w-3.5 h-3.5" />
                          </a>
                          <button onClick={() => openPay(t)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-all"
                            title="تسديد / تجديد">
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(t)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all"
                            title="تعديل">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openDelete(t)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
                            title="حذف">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Mobile labels */}
                        <div className="flex items-center justify-center gap-1 mt-1.5 md:hidden">
                          <a href={`/super-admin/tenants/${t.id}`}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">تفاصيل</a>
                          <button onClick={() => openPay(t)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">تسديد</button>
                          <button onClick={() => openEdit(t)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">تعديل</button>
                          <button onClick={() => openDelete(t)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">حذف</button>
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
                  <h3 className="font-extrabold text-slate-800 text-lg leading-tight">حذف المنظمة نهائياً</h3>
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
              <p className="text-sm font-extrabold text-slate-800">{delTarget.name}</p>
            </div>

            <div className="space-y-4">
              {/* Step 1: tenant name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الخطوة 1 — اكتب اسم المتجر للتأكيد
                </label>
                <input
                  value={delName}
                  onChange={e => setDelName(e.target.value)}
                  placeholder={delTarget.name}
                  autoComplete="off"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 transition-all ${
                    delName.length > 0
                      ? delName.trim() === delTarget.name.trim()
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 focus:ring-emerald-400/30'
                        : 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-400/30'
                      : 'border-slate-200 text-slate-800 focus:ring-blue-500/30'
                  }`}
                />
              </div>

              {/* Step 2: super admin credentials */}
              <div className={`space-y-3 transition-opacity ${delName.trim() === delTarget.name.trim() ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <p className="text-xs font-bold text-slate-700">الخطوة 2 — بريد وكلمة مرور حساب السوبر أدمن</p>
                <input
                  type="email"
                  value={delEmail}
                  onChange={e => setDelEmail(e.target.value)}
                  placeholder="البريد الإلكتروني"
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
                className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                إلغاء
              </button>
              <button
                onClick={submitDelete}
                disabled={delSaving || delName.trim() !== delTarget.name.trim() || !delEmail || !delPassword}
                className="flex-1 py-2.5 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {delSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {delSaving ? 'جاري الحذف...' : 'حذف نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Edit Modal — outside animated div to fix fixed positioning ══════ */}
      {editOpen && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setEditOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
            style={{ maxWidth: '552px', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 shrink-0"
              style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 4px 12px rgba(9,75,159,0.3)' }}>
                  <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
                  <Edit2 className="w-4 h-4 text-white relative z-10" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base leading-tight">تعديل بيانات المنظمة</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{editTarget.name}</p>
                </div>
              </div>
              <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0 mt-0.5">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">الاسم التجاري</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                  style={{ boxShadow: 'none' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }} />
              </div>

              {/* Plan */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">خطة الاشتراك</label>
                <select value={editForm.planId} onChange={e => setEditForm(f => ({ ...f, planId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none appearance-none cursor-pointer transition-all"
                  onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}>
                  <option value="">— بدون تغيير —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                {/* Features granted by the selected (or current) plan */}
                {(() => {
                  const pid = editForm.planId || editTarget?.subscription?.plan?.id
                  const plan = plans.find(p => p.id === pid)
                  if (!plan) return null
                  const enabled = FEATURES.filter(f => plan.features?.[f.key])
                  return (
                    <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[11px] font-bold text-slate-400 mb-1.5">مميزات هذه الخطة</p>
                      <div className="flex flex-wrap gap-1.5">
                        {enabled.length === 0
                          ? <span className="text-xs text-slate-400">لا مميزات إضافية (حدود الفروع والمستخدمين فقط)</span>
                          : enabled.map(f => (
                              <span key={f.key} className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                {f.label}
                              </span>
                            ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">تاريخ انتهاء الاشتراك</label>
                <input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                  onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }} />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">حالة الحساب</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none appearance-none cursor-pointer transition-all"
                  onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}>
                  <option value="ACTIVE">✅ نشط</option>
                  <option value="TRIAL">🔵 تجربة</option>
                  <option value="GRACE">🟠 فترة مهلة</option>
                  <option value="SUSPENDED">🟡 معلق</option>
                  <option value="CANCELLED">🔴 ملغى</option>
                </select>
              </div>

              {/* AI Daily Limit */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                  حد استخدام المساعد الذكي يومياً
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="0" max="10000" dir="ltr"
                    value={editForm.aiDailyLimit}
                    onChange={e => setEditForm(f => ({ ...f, aiDailyLimit: parseInt(e.target.value) || 0 }))}
                    className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none transition-all text-center"
                    onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <div className="flex gap-1.5">
                    {[20, 50, 100, 200].map(n => (
                      <button key={n} type="button"
                        onClick={() => setEditForm(f => ({ ...f, aiDailyLimit: n }))}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all"
                        style={editForm.aiDailyLimit === n
                          ? { background: 'linear-gradient(135deg,#094B9F,#063A8A)', color: 'white', border: '1px solid #094B9F' }
                          : { background: 'white', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">0 = بدون حد | القيمة الافتراضية: 50 استفسار/يوم</p>
              </div>

              {/* Per-tenant feature overrides */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  مميزات خاصة بهذه المؤسسة
                </label>
                <p className="text-[10px] text-slate-400 mb-2">
                  فعّل/عطّل ميزة لهذه المؤسسة فقط بغضّ النظر عن خطتها. وسم «مخصّص» يعني أن الإعداد مختلف عن الخطة.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(() => {
                    const planFeatures = parseFeatures(editTarget?.subscription?.plan?.features)
                    return FEATURES.map(f => {
                      const planVal    = planFeatures[f.key] === true
                      const overridden = editForm.featureOverrides[f.key] !== undefined
                      const on         = overridden ? editForm.featureOverrides[f.key] === true : planVal
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setEditForm(prev => {
                            const next = { ...prev.featureOverrides }
                            const newVal = !on
                            if (newVal === planVal) delete next[f.key]
                            else next[f.key] = newVal
                            return { ...prev, featureOverrides: next }
                          })}
                          className={`text-right flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                            on
                              ? 'border-emerald-300 bg-emerald-50/60'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${f.tier === 'enterprise' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                              {TIER_META[f.tier].label}
                            </span>
                            <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                              <span
                                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                                style={{ left: '2px', transform: on ? 'translateX(16px)' : 'translateX(0)' }}
                              />
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-700 leading-snug">{f.label}</span>
                          {overridden && (
                            <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> مخصّص لهذه المؤسسة
                            </span>
                          )}
                        </button>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>

            {editError && (
              <div className="mx-6 mb-4 text-xs text-red-600 font-bold bg-red-50 border border-red-100 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{editError}
              </div>
            )}

            <div className="flex gap-3 px-6 py-4 shrink-0 border-t border-slate-100 bg-white">
              <button onClick={() => setEditOpen(false)} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                إلغاء
              </button>
              <button onClick={submitEdit} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 4px 16px rgba(9,75,159,0.3)' }}>
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Payment Modal ════════════════════════════════════════════════════ */}
      {payOpen && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setPayOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3"
              style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                  <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
                  <DollarSign className="w-4 h-4 text-white relative z-10" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base leading-tight">تسديد / تجديد الاشتراك</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono tracking-wider">{payTarget.name}</p>
                </div>
              </div>
              <button onClick={() => setPayOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0 mt-0.5">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Months */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">مدة التجديد</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map(m => (
                    <button key={m} type="button"
                      onClick={() => setPayForm(f => ({ ...f, months: m }))}
                      className="py-2.5 rounded-xl text-sm font-bold border transition-all"
                      style={payForm.months === m ? {
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white', border: '1px solid #10b981',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                      } : { background: 'white', color: '#475569', border: '1px solid #e2e8f0' }}>
                      {m === 12 ? 'سنة' : `${m} شهر`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">المبلغ المدفوع (د.ع)</label>
                <input
                  type="number" min="0" placeholder="مثال: 50000"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none transition-all"
                  dir="ltr"
                  onFocus={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  ملاحظات <span className="font-normal text-slate-400 normal-case">(اختياري)</span>
                </label>
                <input
                  placeholder="مثال: تم الدفع نقداً"
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                  onFocus={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              {/* Summary */}
              <div className="rounded-xl px-4 py-3.5 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.04))', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-sm text-emerald-800 font-bold">
                  سيتم تمديد الاشتراك لمدة{' '}
                  <span className="text-emerald-600">{payForm.months === 12 ? 'سنة كاملة' : `${payForm.months} شهر`}</span>
                  {' '}وتفعيل الحساب تلقائياً
                </p>
              </div>
            </div>

            {payError && (
              <div className="mx-6 mb-4 text-xs text-red-600 font-bold bg-red-50 border border-red-100 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{payError}
              </div>
            )}

            <div className="flex gap-3 px-6 pb-5 pt-1">
              <button onClick={() => setPayOpen(false)} disabled={paySaving}
                className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                إلغاء
              </button>
              <button onClick={submitPay} disabled={paySaving}
                className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
                {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                {paySaving ? 'جاري التسديد...' : 'تأكيد التسديد'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
