'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Check, X, Crown, Loader2, Users, GitBranch, AlertTriangle, Sparkles } from 'lucide-react'
import { PulseLoader } from '@/components/loading/PulseLoader'

interface Plan {
  id: string
  name: string
  maxBranches: number
  monthlyPrice: number
  yearlyPrice: number
  isActive: boolean
  _count: { subscriptions: number }
}

// Format number with commas: 4500 → 4,500 (handles string inputs from API)
const fmt = (n: number | string) => Number(n).toLocaleString('en-US')

// Color palette per plan index
const PLAN_COLORS = [
  { bg: 'from-blue-500 to-indigo-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'text-blue-500' },
  { bg: 'from-violet-500 to-purple-600', badge: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'text-violet-500' },
  { bg: 'from-amber-500 to-orange-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'text-amber-500' },
  { bg: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'text-emerald-500' },
]

export default function PlansPage() {
  const [plans, setPlans]         = useState<Plan[]>([])
  const [editing, setEditing]     = useState<string | null>(null)
  const [form, setForm]           = useState<Partial<Plan>>({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState('')
  const [newPlan, setNewPlan] = useState({
    name: '',
    maxBranches: 5,
    monthlyPrice: 0,
    yearlyPrice: 0,
  })

  const load = () => {
    setLoading(true)
    fetch('/api/super-admin/plans')
      .then(r => r.json())
      .then(setPlans)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function save(id: string) {
    setSaving(true)
    await fetch(`/api/super-admin/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setEditing(null)
    setSaving(false)
    load()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const res = await fetch('/api/super-admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ? 'يرجى التحقق من صحة البيانات' : data.error)
      } else {
        setShowCreate(false)
        setNewPlan({ name: '', maxBranches: 5, monthlyPrice: 0, yearlyPrice: 0 })
        load()
      }
    } catch {
      setCreateError('تعذر الاتصال بالخادم')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl" dir="rtl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
                <div className="absolute inset-0 rounded-xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>خطط الاشتراك</h1>
              <p className="text-sm text-slate-500 mt-0.5">إدارة الباقات والأسعار للمشتركين ({plans.length} خطط)</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}
        >
          <Plus className="w-5 h-5" />
          خطة جديدة
        </button>
      </div>

      {/* Loading */}
      {loading && plans.length === 0 ? (
        <div className="glass-panel rounded-3xl p-20 flex justify-center"><PulseLoader /></div>
      ) : (
        /* Plans Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((p, idx) => {
            const color = PLAN_COLORS[idx % PLAN_COLORS.length]
            const isEditing = editing === p.id
            return (
              <div key={p.id} className={`glass-panel rounded-3xl overflow-hidden transition-all hover:shadow-md ${!p.isActive ? 'opacity-60' : ''}`}>
                
                {/* Card Header */}
                <div className={`bg-gradient-to-br ${color.bg} p-6 relative overflow-hidden`}>
                  <div className="absolute -top-4 -left-6 w-24 h-24 rounded-full bg-white/10" />
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
                  <div className="relative z-10 flex items-start justify-between">
                    <div>
                      {isEditing ? (
                        <input
                          className="bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-lg px-3 py-1.5 text-lg font-bold outline-none focus:ring-2 focus:ring-white/50 w-full"
                          value={form.name ?? p.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                      ) : (
                        <h2 className="text-2xl font-extrabold text-white tracking-tight">{p.name}</h2>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${color.badge} bg-white/90`}>
                          {p.isActive ? 'نشطة' : 'معطّلة'}
                        </span>
                        <span className="text-white/70 text-xs font-medium flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {p._count.subscriptions} مشترك
                        </span>
                      </div>
                    </div>
                    <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-5">

                  {/* Branches */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                      <GitBranch className="w-4 h-4" />
                      حد الفروع
                    </div>
                    {isEditing ? (
                      <input
                        type="number"
                        value={form.maxBranches ?? p.maxBranches}
                        onChange={e => setForm(f => ({ ...f, maxBranches: +e.target.value }))}
                        className="w-24 text-left border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                      />
                    ) : (
                      <span className="font-extrabold text-slate-800 text-lg">
                        {p.maxBranches === -1 ? <span className="text-emerald-600">∞ غير محدود</span> : p.maxBranches}
                      </span>
                    )}
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Prices */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm font-semibold">السعر الشهري</span>
                      {isEditing ? (
                        <input
                          type="number"
                          value={form.monthlyPrice ?? p.monthlyPrice}
                          onChange={e => setForm(f => ({ ...f, monthlyPrice: +e.target.value }))}
                          className="w-32 text-left border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                        />
                      ) : (
                        <span className="font-extrabold text-slate-800 text-lg tabular-nums">
                          {fmt(p.monthlyPrice)} <span className="text-sm text-slate-400 font-semibold">د.ع</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm font-semibold">السعر السنوي</span>
                      {isEditing ? (
                        <input
                          type="number"
                          value={form.yearlyPrice ?? p.yearlyPrice}
                          onChange={e => setForm(f => ({ ...f, yearlyPrice: +e.target.value }))}
                          className="w-32 text-left border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                        />
                      ) : (
                        <span className="font-extrabold text-slate-800 text-lg tabular-nums">
                          {fmt(p.yearlyPrice)} <span className="text-sm text-slate-400 font-semibold">د.ع</span>
                        </span>
                      )}
                    </div>
                    {/* Savings badge */}
                    {!isEditing && p.monthlyPrice > 0 && p.yearlyPrice > 0 && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        توفير {fmt(p.monthlyPrice * 12 - p.yearlyPrice)} د.ع سنوياً عند الدفع السنوي
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Actions */}
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => save(p.id)}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        حفظ
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditing(p.id); setForm({}) }}
                      className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-sm py-2.5 rounded-xl transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                      تعديل الخطة
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />

          {/* Modal Card */}
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-7 shadow-2xl" dir="rtl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent rounded-t-3xl" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">إنشاء خطة جديدة</h2>
                <p className="text-sm text-slate-500 mt-0.5">أضف باقة اشتراك جديدة للنظام</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {createError && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">اسم الخطة</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  placeholder="مثال: Pro, Enterprise"
                  value={newPlan.name}
                  onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">الحد الأقصى للفروع</label>
                <input
                  type="number"
                  min="-1"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-left"
                  placeholder="-1 = غير محدود"
                  value={newPlan.maxBranches}
                  onChange={e => setNewPlan(p => ({ ...p, maxBranches: +e.target.value }))}
                />
                <p className="text-xs text-slate-400 mt-1.5">ضع -1 لمنح فروع غير محدودة</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">السعر الشهري (د.ع)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-left"
                    value={newPlan.monthlyPrice}
                    onChange={e => setNewPlan(p => ({ ...p, monthlyPrice: +e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">السعر السنوي (د.ع)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-left"
                    value={newPlan.yearlyPrice}
                    onChange={e => setNewPlan(p => ({ ...p, yearlyPrice: +e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  إنشاء الخطة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
