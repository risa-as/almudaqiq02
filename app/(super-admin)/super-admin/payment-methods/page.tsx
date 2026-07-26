'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJsonOr } from '@/lib/query/fetcher'
import {
  Plus, Pencil, Trash2, Check, X, Loader2, AlertTriangle,
  Wallet, Smartphone, CreditCard, HelpCircle, Eye, EyeOff,
} from 'lucide-react'

type MethodType = 'ZAINCASH' | 'SUPERKEY' | 'MASTERCARD' | 'OTHER'

interface PaymentMethod {
  id:            string
  type:          MethodType
  name:          string
  accountNumber: string | null
  accountName:   string | null
  instructions:  string | null
  isActive:      boolean
  sortOrder:     number
}

const TYPE_META: Record<MethodType, { label: string; icon: React.ReactNode; gradient: string; badge: string }> = {
  ZAINCASH:   { label: 'زين كاش',   icon: <Smartphone size={20} className="text-white" />, gradient: 'from-purple-500 to-violet-600', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  SUPERKEY:   { label: 'سوبر كي',  icon: <Wallet size={20} className="text-white" />,     gradient: 'from-sky-500 to-blue-600',      badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  MASTERCARD: { label: 'ماستر كارد', icon: <CreditCard size={20} className="text-white" />, gradient: 'from-rose-500 to-red-600',     badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  OTHER:      { label: 'أخرى',      icon: <HelpCircle size={20} className="text-white" />, gradient: 'from-slate-500 to-slate-600',   badge: 'bg-slate-50 text-slate-700 border-slate-200' },
}

const EMPTY_FORM = { type: 'ZAINCASH' as MethodType, name: '', accountNumber: '', accountName: '', instructions: '', sortOrder: 0 }

export default function PaymentMethodsPage() {
  usePageTitle('طرق الدفع');
  const queryClient = useQueryClient()

  // Create modal
  const [showCreate,   setShowCreate]   = useState(false)
  const [createForm,   setCreateForm]   = useState(EMPTY_FORM)
  const [creating,     setCreating]     = useState(false)
  const [createError,  setCreateError]  = useState('')

  // Edit modal
  const [editTarget,  setEditTarget]  = useState<PaymentMethod | null>(null)
  const [editForm,    setEditForm]    = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState('')

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState('')

  const methodsQuery = useQuery({
    queryKey: ['sa-payment-methods'],
    queryFn: async () => {
      const d = await fetchJsonOr<PaymentMethod[]>('/api/super-admin/payment-methods', [])
      return Array.isArray(d) ? d : []
    },
  })
  const methods = methodsQuery.data ?? []
  const loading = methodsQuery.isPending

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const res  = await fetch('/api/super-admin/payment-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, sortOrder: Number(createForm.sortOrder) }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error?.message ?? 'فشل الإنشاء'); return }
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
      await queryClient.invalidateQueries({ queryKey: ['sa-payment-methods'] })
    } catch { setCreateError('تعذر الاتصال بالخادم') }
    finally { setCreating(false) }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setSaveError('')
    setSaving(true)
    try {
      const res  = await fetch(`/api/super-admin/payment-methods/${editTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, sortOrder: Number(editForm.sortOrder) }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error?.message ?? 'فشل الحفظ'); return }
      setEditTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['sa-payment-methods'] })
    } catch { setSaveError('تعذر الاتصال بالخادم') }
    finally { setSaving(false) }
  }

  async function handleToggleActive(m: PaymentMethod) {
    await fetch(`/api/super-admin/payment-methods/${m.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !m.isActive }),
    })
    await queryClient.invalidateQueries({ queryKey: ['sa-payment-methods'] })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError('')
    setDeleting(true)
    try {
      const res = await fetch(`/api/super-admin/payment-methods/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setDeleteError(d.error ?? 'فشل الحذف'); return }
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['sa-payment-methods'] })
    } catch { setDeleteError('تعذر الاتصال بالخادم') }
    finally { setDeleting(false) }
  }

  function openEdit(m: PaymentMethod) {
    setEditTarget(m)
    setEditForm({ type: m.type, name: m.name, accountNumber: m.accountNumber ?? '', accountName: m.accountName ?? '', instructions: m.instructions ?? '', sortOrder: m.sortOrder })
    setSaveError('')
  }

  return (
    <div className="space-y-8 max-w-5xl" dir="rtl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)' }}>
            <div className="absolute inset-0 rounded-xl opacity-40"
              style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.3) 0%,transparent 60%)' }} />
            <Wallet size={20} className="text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight"
              style={{ background: 'linear-gradient(135deg,#0f172a 0%,#334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              طرق الدفع
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">معلومات الدفع التي يراها المشتركون ({methods.length} طريقة)</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError('') }}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)' }}
        >
          <Plus className="w-5 h-5" />
          إضافة طريقة دفع
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="glass-panel rounded-3xl p-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : methods.length === 0 ? (
        <div className="glass-panel rounded-3xl p-20 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-100">
            <Wallet size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-500 font-bold">لا توجد طرق دفع بعد</p>
          <p className="text-slate-400 text-sm">أضف طريقة دفع لتظهر للمشتركين في صفحة الإعدادات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {methods.map(m => {
            const meta = TYPE_META[m.type]
            return (
              <div key={m.id} className={`glass-panel rounded-3xl overflow-hidden transition-all hover:shadow-md ${!m.isActive ? 'opacity-55' : ''}`}>

                {/* Card header */}
                <div className={`bg-gradient-to-br ${meta.gradient} p-5 relative overflow-hidden`}>
                  <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-white/10" />
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        {meta.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold text-white leading-tight">{m.name}</h2>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border bg-white/90 ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(m)}
                      title={m.isActive ? 'إخفاء' : 'إظهار'}
                      className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    >
                      {m.isActive ? <Eye size={15} className="text-white" /> : <EyeOff size={15} className="text-white/60" />}
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5 space-y-3">
                  {m.accountNumber && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-400 mt-0.5 shrink-0">رقم الحساب</span>
                      <span className="text-sm font-extrabold text-slate-800 text-left" dir="ltr">{m.accountNumber}</span>
                    </div>
                  )}
                  {m.accountName && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-400 mt-0.5 shrink-0">اسم الحساب</span>
                      <span className="text-sm font-bold text-slate-700">{m.accountName}</span>
                    </div>
                  )}
                  {m.instructions && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                      <p className="text-xs text-slate-500 leading-relaxed">{m.instructions}</p>
                    </div>
                  )}

                  <div className="h-px bg-slate-100" />

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(m)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-all"
                    >
                      <Pencil size={14} /> تعديل
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(m); setDeleteError('') }}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !creating && setShowCreate(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-7 shadow-2xl" dir="rtl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent rounded-t-3xl" />
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">إضافة طريقة دفع</h2>
                <p className="text-sm text-slate-500 mt-0.5">ستظهر للمشتركين في صفحة الإعدادات</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <X size={18} className="text-slate-600" />
              </button>
            </div>

            {createError && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
                <AlertTriangle size={15} className="shrink-0" />{createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <ModalField label="النوع">
                <select
                  value={createForm.type}
                  onChange={e => setCreateForm(f => ({ ...f, type: e.target.value as MethodType, name: TYPE_META[e.target.value as MethodType].label }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                >
                  {(Object.keys(TYPE_META) as MethodType[]).map(t => (
                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                  ))}
                </select>
              </ModalField>

              <ModalField label="الاسم المعروض">
                <input required value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="زين كاش"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </ModalField>

              <ModalField label="رقم الحساب / الهاتف">
                <input value={createForm.accountNumber}
                  onChange={e => setCreateForm(f => ({ ...f, accountNumber: e.target.value }))}
                  placeholder="07XXXXXXXXX"
                  dir="ltr"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </ModalField>

              <ModalField label="اسم صاحب الحساب">
                <input value={createForm.accountName}
                  onChange={e => setCreateForm(f => ({ ...f, accountName: e.target.value }))}
                  placeholder="أحمد محمد"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </ModalField>

              <ModalField label="تعليمات إضافية" hint="اختياري — سيراها المشترك">
                <textarea value={createForm.instructions}
                  onChange={e => setCreateForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="يرجى إرسال إيصال الدفع على الواتساب..."
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 resize-none"
                />
              </ModalField>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                  إلغاء
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {creating ? 'جاري الإضافة...' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !saving && setEditTarget(null)} />
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-7 shadow-2xl" dir="rtl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent rounded-t-3xl" />
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">تعديل طريقة الدفع</h2>
                <p className="text-sm text-slate-500 mt-0.5">{editTarget.name}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <X size={18} className="text-slate-600" />
              </button>
            </div>

            {saveError && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
                <AlertTriangle size={15} className="shrink-0" />{saveError}
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-4">
              <ModalField label="النوع">
                <select value={editForm.type}
                  onChange={e => setEditForm(f => ({ ...f, type: e.target.value as MethodType }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500">
                  {(Object.keys(TYPE_META) as MethodType[]).map(t => (
                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                  ))}
                </select>
              </ModalField>

              <ModalField label="الاسم المعروض">
                <input required value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </ModalField>

              <ModalField label="رقم الحساب / الهاتف">
                <input value={editForm.accountNumber}
                  onChange={e => setEditForm(f => ({ ...f, accountNumber: e.target.value }))}
                  dir="ltr"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </ModalField>

              <ModalField label="اسم صاحب الحساب">
                <input value={editForm.accountName}
                  onChange={e => setEditForm(f => ({ ...f, accountName: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </ModalField>

              <ModalField label="تعليمات إضافية">
                <textarea value={editForm.instructions}
                  onChange={e => setEditForm(f => ({ ...f, instructions: e.target.value }))}
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 resize-none"
                />
              </ModalField>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                  إلغاء
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm glass-panel rounded-3xl p-7 shadow-2xl" dir="rtl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent rounded-t-3xl" />
            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">حذف طريقة الدفع</h2>
                <p className="text-sm text-slate-500 mt-1">
                  هل أنت متأكد من حذف <span className="font-bold text-slate-800">"{deleteTarget.name}"</span>؟
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
                <AlertTriangle size={15} className="shrink-0" />{deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                إلغاء
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-bold text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
