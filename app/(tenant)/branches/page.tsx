'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useEffect, useState } from 'react'
import { useConfirm } from '@/hooks/useConfirm'
import { useUser } from '@/hooks/useUser'
import {
  Plus, Building2, Copy, Check, Phone, MapPin, Users, Receipt,
  Edit2, PowerOff, Power, X, Save, Loader2, Key, AlertTriangle, CheckCircle,
  TrendingUp, ToggleLeft, ToggleRight, Globe, MonitorSmartphone
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Branch {
  id: string; name: string; address?: string; phone?: string
  isActive: boolean; activationCode: string; createdAt: string
  _count: { transactions: number; users: number }
}

const CARD_GRADIENTS = [
  'from-blue-500 to-violet-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-600',
  'from-blue-500 to-orange-600',
  'from-purple-500 to-fuchsia-600',
]

export default function BranchesPage() {
  usePageTitle('الفروع');
  const { confirm, dialog } = useConfirm()
  const { isElectron } = useUser()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading]   = useState(true)
  const [copied, setCopied]     = useState<string | null>(null)
  // Plan branch cap (-1 / null = unlimited). Used to block creating over the limit.
  const [maxBranches, setMaxBranches] = useState<number | null>(null)

  // Create modal
  const [createOpen,    setCreateOpen]    = useState(false)
  const [createForm,    setCreateForm]    = useState({ name: '', address: '', phone: '' })
  const [createSaving,  setCreateSaving]  = useState(false)
  const [createdResult, setCreatedResult] = useState<{ activationCode: string; branchToken?: string } | null>(null)

  // Edit modal
  const [editTarget,  setEditTarget]  = useState<Branch | null>(null)
  const [editForm,    setEditForm]    = useState({ name: '', address: '', phone: '' })
  const [editSaving,  setEditSaving]  = useState(false)

  // Deactivate / activate
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [activatingId,   setActivatingId]   = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/branches').then(r => r.json()).then(setBranches).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    // Read the current plan's branch cap so we can disable creation at the limit.
    fetch('/api/billing', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const mb = d?.subscription?.plan?.maxBranches
        if (typeof mb === 'number') setMaxBranches(mb)
      })
      .catch(() => {})
  }, [])

  // ── Create ──────────────────────────────────────────────────────────────────
  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setCreateSaving(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'حدث خطأ'); return }
      setCreatedResult({ activationCode: d.activationCode, branchToken: d.branchToken })
      load()
    } catch { toast.error('تعذر الاتصال بالخادم') }
    finally { setCreateSaving(false) }
  }

  function closeCreate() {
    setCreateOpen(false)
    setCreatedResult(null)
    setCreateForm({ name: '', address: '', phone: '' })
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function openEdit(b: Branch) {
    setEditTarget(b)
    setEditForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '' })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/branches/${editTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'حدث خطأ'); return }
      toast.success('تم تحديث الفرع')
      setEditTarget(null)
      load()
    } catch { toast.error('تعذر الاتصال بالخادم') }
    finally { setEditSaving(false) }
  }

  // ── Deactivate ──────────────────────────────────────────────────────────────
  async function deactivateBranch(b: Branch) {
    if (!await confirm({ title: 'إيقاف الفرع', message: `هل تريد إيقاف تشغيل فرع "${b.name}"؟`, variant: 'warning', confirmLabel: 'إيقاف' })) return
    setDeactivatingId(b.id)
    try {
      const res = await fetch(`/api/branches/${b.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'حدث خطأ'); return }
      toast.success('تم إيقاف الفرع')
      load()
    } catch { toast.error('تعذر الاتصال بالخادم') }
    finally { setDeactivatingId(null) }
  }

  // ── Activate ────────────────────────────────────────────────────────────────
  async function activateBranch(b: Branch) {
    setActivatingId(b.id)
    try {
      const res = await fetch(`/api/branches/${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'تعذّر تفعيل الفرع'); return }
      toast.success('تم تفعيل الفرع')
      load()
    } catch { toast.error('تعذر الاتصال بالخادم') }
    finally { setActivatingId(null) }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalActive  = branches.filter(b => b.isActive).length
  const totalUsers   = branches.reduce((s, b) => s + b._count.users, 0)
  const totalTx      = branches.reduce((s, b) => s + b._count.transactions, 0)

  // Plan enforcement: -1 (or null) = unlimited. Block creating when active branches reach the cap.
  const hasLimit = maxBranches !== null && maxBranches > 0
  const atLimit  = hasLimit && totalActive >= (maxBranches as number)

  if (isElectron) return (
    <div className="flex items-center justify-center min-h-[70vh] animate-fade-in-up" dir="rtl">
      <div className="relative w-full max-w-lg text-center">

        {/* Background glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full opacity-10 blur-3xl -translate-x-1/2 -translate-y-1/2"
            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)' }} />
        </div>

        {/* Card */}
        <div className="relative rounded-3xl p-10 flex flex-col items-center gap-6"
          style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 8px 40px rgba(9,75,159,0.1)' }}>

          {/* Icon */}
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 36px rgba(9,75,159,0.4)' }}>
              <div className="absolute inset-0 opacity-25"
                style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
              <Globe size={44} className="text-white relative z-10" />
            </div>
            {/* Badge */}
            <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.4)' }}>
              <Building2 size={14} className="text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">إدارة الفروع</h2>
            <p className="text-slate-400 text-sm font-medium">متاحة عبر لوحة التحكم على الويب</p>
          </div>

          {/* Divider */}
          <div className="w-full h-px" style={{ background: 'linear-gradient(90deg,transparent,#e2e8f0,transparent)' }} />

          {/* Description */}
          <p className="text-slate-600 text-sm font-medium leading-7 max-w-sm">
            لإضافة فروع جديدة، تعديلها، أو إدارة رموز التفعيل،
            يرجى الدخول إلى{' '}
            <span className="font-black text-blue-600">لوحة التحكم على الموقع</span>{' '}
            حيث تتوفر جميع الصلاحيات والأدوات اللازمة.
          </p>

          {/* Features list */}
          <div className="w-full space-y-2.5">
            {[
              { text: 'إضافة وتعديل الفروع', color: '#094B9F', bg: 'rgba(9,75,159,0.08)' },
              { text: 'إدارة رموز التفعيل', color: '#8b5cf6', bg: 'rgba(14,99,212,0.08)' },
              { text: 'تفعيل وإيقاف الفروع', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ background: f.bg, color: f.color }}>
                <CheckCircle size={15} style={{ color: f.color }} />
                {f.text}
              </div>
            ))}
          </div>

          {/* Web badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(9,75,159,0.06)', border: '1px solid rgba(9,75,159,0.15)' }}>
            <MonitorSmartphone size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-blue-500">متاح عبر الموقع فقط</span>
          </div>
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div className="space-y-6 animate-fade-in-up" dir="rtl">
      {/* Hero loader */}
      <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
            <Building2 size={36} className="text-white relative z-10 sk-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#094B9F)', boxShadow: '0 2px 8px rgba(9,75,159,0.5)' }} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-xl font-black text-slate-800">جاري تحميل الفروع</p>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
          <p className="text-sm text-slate-400 font-medium">يتم استرجاع بيانات الفروع ورموز التفعيل</p>
        </div>
      </div>

      {/* KPI skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton w-9 h-9 rounded-xl" />
            </div>
            <div className="skeleton h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Branch card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="skeleton h-24 w-full" />
            <div className="p-5 space-y-3">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="skeleton h-14 rounded-xl" />
                <div className="skeleton h-14 rounded-xl" />
              </div>
              <div className="skeleton h-11 rounded-xl" />
              <div className="flex gap-2">
                <div className="skeleton h-9 flex-1 rounded-xl" />
                <div className="skeleton h-9 flex-1 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>{dialog}<div className="space-y-6 animate-fade-in-up" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 8px 24px rgba(9,75,159,0.3)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
            <Building2 size={22} className="text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">الفروع</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">
              {loading ? '…' : `${branches.length} فرع — ${totalActive} نشط`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          disabled={atLimit}
          title={atLimit ? `وصلت للحد الأقصى من الفروع (${maxBranches}) في خطتك الحالية` : undefined}
          className="flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 16px rgba(9,75,159,0.35)' }}
        >
          <Plus className="w-4 h-4" />
          إضافة فرع جديد
        </button>
      </div>

      {/* ── Plan limit notice ── */}
      {atLimit && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-3.5"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-700">
            وصلت للحد الأقصى من الفروع ({maxBranches}) في خطتك الحالية. للترقية وإضافة فروع أخرى، راجع صفحة الاشتراك.
          </p>
        </div>
      )}

      {/* ── Stat cards ── */}
      {(
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الفروع',    value: branches.length,                   iconBg: '#eef2ff', iconColor: '#094B9F', icon: Building2 },
            { label: 'الفروع النشطة',    value: totalActive,                        iconBg: '#ecfdf5', iconColor: '#10b981', icon: CheckCircle },
            { label: 'الموظفون',         value: totalUsers,                         iconBg: '#fffbeb', iconColor: '#f59e0b', icon: Users },
            { label: 'إجمالي المعاملات', value: totalTx.toLocaleString('ar-IQ'),   iconBg: '#ecfeff', iconColor: '#06b6d4', icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="kpi-card">
              <div className="kpi-icon" style={{ background: s.iconBg }}>
                <s.icon size={18} style={{ color: s.iconColor }} />
              </div>
              <div className="min-w-0">
                <p className="kpi-label">{s.label}</p>
                <p className="kpi-value">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && branches.length === 0 && (
        <div className="rounded-3xl py-20 flex flex-col items-center gap-4 text-center"
          style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)' }}>
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-700">لا توجد فروع بعد</p>
            <p className="text-sm text-slate-400 mt-1">أنشئ فرعك الأول للبدء</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-2 flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)' }}
          >
            <Plus className="w-4 h-4" /> إضافة فرع
          </button>
        </div>
      )}

      {/* ── Branches grid ── */}
      {!loading && branches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b, idx) => {
            const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length]
            return (
              <div key={b.id} className="rounded-2xl overflow-hidden transition-all hover:shadow-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>

                {/* Card header — gradient stays the same in both modes */}
                <div className={`relative bg-gradient-to-br ${gradient} p-5 flex items-start justify-between overflow-hidden`}>
                  <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.5), transparent 60%)' }} />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <Building2 size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base leading-tight">{b.name}</h3>
                      <p className="text-white/70 text-xs mt-0.5">
                        {new Date(b.createdAt).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`relative z-10 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                    b.isActive
                      ? 'bg-white/20 text-white border-white/30'
                      : 'bg-black/20 text-white/60 border-white/10'
                  }`}>
                    {b.isActive ? '● نشط' : '○ موقوف'}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5 space-y-4">

                  {/* Address / Phone */}
                  {(b.address || b.phone) && (
                    <div className="space-y-1.5">
                      {b.address && (
                        <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                          <MapPin size={13} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs font-medium truncate">{b.address}</span>
                        </div>
                      )}
                      {b.phone && (
                        <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                          <Phone size={13} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs font-medium" dir="ltr">{b.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-color)' }}>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Receipt size={12} className="text-blue-500" />
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>المعاملات</span>
                      </div>
                      <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{b._count.transactions.toLocaleString('ar-IQ')}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-color)' }}>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Users size={12} className="text-violet-500" />
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>الموظفون</span>
                      </div>
                      <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{b._count.users}</p>
                    </div>
                  </div>

                  {/* Activation code */}
                  <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                    style={{ background: 'rgba(9,75,159,0.06)', border: '1px solid rgba(9,75,159,0.15)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Key size={13} className="text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-blue-500">رمز التفعيل</p>
                        <p className="font-mono text-[11px] font-bold truncate" style={{ color: 'var(--color-primary)' }}>{b.activationCode}</p>
                      </div>
                    </div>
                    <button onClick={() => copyText(b.activationCode, b.id)}
                      className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                      style={{ color: 'var(--color-primary)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(9,75,159,0.12)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}>
                      {copied === b.id
                        ? <Check size={14} className="text-emerald-500" />
                        : <Copy size={14} />}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openEdit(b)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(9,75,159,0.08)', border: '1px solid rgba(9,75,159,0.15)', color: 'var(--color-primary)' }}
                    >
                      <Edit2 size={13} /> تعديل
                    </button>
                    {b.isActive && (
                      <button
                        onClick={() => deactivateBranch(b)}
                        disabled={deactivatingId === b.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: 'var(--color-danger)' }}
                      >
                        {deactivatingId === b.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <PowerOff size={13} />}
                        إيقاف
                      </button>
                    )}
                    {!b.isActive && (
                      <button
                        onClick={() => activateBranch(b)}
                        disabled={activatingId === b.id || atLimit}
                        title={atLimit ? `وصلت للحد الأقصى من الفروع (${maxBranches}) — لا يمكن تفعيل فرع آخر في خطتك الحالية` : undefined}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', color: '#059669' }}
                      >
                        {activatingId === b.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Power size={13} />}
                        تفعيل
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      </div>{/* end animate-fade-in-up */}

      {/* ══ Create Modal ═══════════════════════════════════════════════════════ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !createSaving && !createdResult && closeCreate()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,0.3)' }}>
                  <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
                  <Building2 size={16} className="text-white relative z-10" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">إضافة فرع جديد</h3>
                  <p className="text-[11px] text-slate-400">أدخل بيانات الفرع</p>
                </div>
              </div>
              {!createSaving && (
                <button onClick={closeCreate} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X size={16} className="text-slate-400" />
                </button>
              )}
            </div>

            {/* Success state */}
            {createdResult ? (
              <div className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <CheckCircle size={28} className="text-emerald-500" />
                  </div>
                  <p className="font-extrabold text-slate-800 text-lg">تم إنشاء الفرع بنجاح!</p>
                </div>

                {/* Activation code */}
                <div className="rounded-xl p-4 space-y-1"
                  style={{ background: 'linear-gradient(135deg, rgba(9,75,159,0.06), rgba(14,99,212,0.04))', border: '1px solid rgba(9,75,159,0.2)' }}>
                  <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                    <Key size={12} /> رمز التفعيل (للكاشير)
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm font-bold text-blue-800 break-all">{createdResult.activationCode}</p>
                    <button onClick={() => copyText(createdResult!.activationCode, 'code')}
                      className="p-1.5 rounded-lg hover:bg-blue-100 flex-shrink-0">
                      {copied === 'code' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-blue-500" />}
                    </button>
                  </div>
                </div>

                {/* Branch token */}
                {createdResult.branchToken && (
                  <div className="rounded-xl p-4 space-y-1"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                      <Key size={12} /> توكن الفرع (لتطبيق سطح المكتب)
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-bold text-blue-800 break-all line-clamp-2">{createdResult.branchToken}</p>
                      <button onClick={() => copyText(createdResult!.branchToken!, 'token')}
                        className="p-1.5 rounded-lg hover:bg-blue-100 flex-shrink-0">
                        {copied === 'token' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-blue-500" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 font-medium">احتفظ بهذه البيانات — لن تظهر مجدداً</p>
                </div>

                <button onClick={closeCreate}
                  className="w-full py-2.5 rounded-xl font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)' }}>
                  تم، إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={submitCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">اسم الفرع *</label>
                  <input
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    required minLength={2} placeholder="مثال: الفرع الرئيسي"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                    onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                    العنوان <span className="font-normal text-slate-400 normal-case">(اختياري)</span>
                  </label>
                  <input
                    value={createForm.address}
                    onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="مثال: شارع النصر، بغداد"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                    onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                    رقم الهاتف <span className="font-normal text-slate-400 normal-case">(اختياري)</span>
                  </label>
                  <input
                    value={createForm.phone}
                    onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="07xxxxxxxxx" dir="ltr"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                    onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeCreate} disabled={createSaving}
                    className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                    إلغاء
                  </button>
                  <button type="submit" disabled={createSaving || !createForm.name.trim()}
                    className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                    style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 16px rgba(9,75,159,0.3)' }}>
                    {createSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {createSaving ? 'جاري الإنشاء...' : 'إنشاء الفرع'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══ Edit Modal ══════════════════════════════════════════════════════════ */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !editSaving && setEditTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}>

            <div className="px-6 pt-5 pb-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,0.3)' }}>
                  <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
                  <Edit2 size={16} className="text-white relative z-10" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">تعديل الفرع</h3>
                  <p className="text-[11px] text-slate-400">{editTarget.name}</p>
                </div>
              </div>
              {!editSaving && (
                <button onClick={() => setEditTarget(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X size={16} className="text-slate-400" />
                </button>
              )}
            </div>

            <form onSubmit={submitEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">اسم الفرع *</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required minLength={2}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                  onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  العنوان <span className="font-normal text-slate-400 normal-case">(اختياري)</span>
                </label>
                <input
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                  onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  رقم الهاتف <span className="font-normal text-slate-400 normal-case">(اختياري)</span>
                </label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  dir="ltr"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all"
                  onFocus={e => { e.currentTarget.style.borderColor = '#094B9F'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(9,75,159,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  إلغاء
                </button>
                <button type="submit" disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                  style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 16px rgba(9,75,159,0.3)' }}>
                  {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  )
}
