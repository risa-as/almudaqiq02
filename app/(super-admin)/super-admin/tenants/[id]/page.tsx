'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight, Building2, Users, Receipt,
  AlertTriangle, DollarSign, X, Loader2, CheckCircle
} from 'lucide-react'
import { PulseLoader } from '@/components/loading/PulseLoader'

// ── Types ─────────────────────────────────────────────────────────────────────
interface PaymentRecord {
  id: string; amount: string; months: number
  planName?: string; notes?: string; paidAt: string; recordedBy?: string
}

interface TenantDetail {
  id: string; name: string; slug: string; status: string; createdAt: string
  subscription?: {
    plan: { name: string; maxBranches: number }
    status: string
    endDate?: string
    trialEndDate?: string
    gracePeriodEndsAt?: string
  }
  branches: { id: string; name: string; isActive: boolean; createdAt: string }[]
  paymentRecords: PaymentRecord[]
  _count: { users: number; transactions: number }
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200',
  TRIAL:     'text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200',
  GRACE:     'text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200',
  SUSPENDED: 'text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200',
  CANCELLED: 'text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TenantDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const [tenant,     setTenant]     = useState<TenantDetail | null>(null)
  const [fetchError, setFetchError] = useState('')

  // Payment modal
  const [payOpen,   setPayOpen]   = useState(false)
  const [payForm,   setPayForm]   = useState({ months: 1, amount: '', notes: '' })
  const [paySaving, setPaySaving] = useState(false)
  const [payError,  setPayError]  = useState('')
  const [payDone,   setPayDone]   = useState(false)

  function loadTenant() {
    fetch(`/api/super-admin/tenants/${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setFetchError(d.error); else setTenant(d) })
      .catch(() => setFetchError('تعذر تحميل بيانات المنظمة'))
  }

  useEffect(() => { loadTenant() }, [id]) // eslint-disable-line

  async function changeStatus(status: string) {
    if (!confirm(`هل أنت متأكد من تغيير حالة الحساب إلى "${status}"؟`)) return
    await fetch(`/api/super-admin/tenants/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadTenant()
  }

  async function submitPay() {
    if (!payForm.amount || isNaN(Number(payForm.amount))) { setPayError('يرجى إدخال المبلغ'); return }
    setPaySaving(true); setPayError('')
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}/renew`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: payForm.months, amount: Number(payForm.amount), notes: payForm.notes || undefined }),
      })
      if (!res.ok) { const d = await res.json(); setPayError(d.error ?? 'حدث خطأ'); return }
      setPayDone(true)
      setTimeout(() => { setPayOpen(false); setPayDone(false); loadTenant() }, 1200)
    } catch { setPayError('تعذر الاتصال') }
    finally  { setPaySaving(false) }
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (fetchError) return (
    <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-3">
      <AlertTriangle className="w-8 h-8" />
      <p className="font-bold">{fetchError}</p>
      <button onClick={() => router.back()} className="mt-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-bold">
        العودة للقائمة
      </button>
    </div>
  )

  if (!tenant) return <div className="py-20 flex justify-center"><PulseLoader /></div>

  const sub = tenant.subscription

  return (
    <div className="space-y-6 max-w-5xl" dir="rtl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{tenant.name}</h1>
            <p className="text-slate-400 text-xs mt-0.5">أُنشئ في {new Date(tenant.createdAt).toLocaleDateString('ar-IQ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold shadow-sm ${STATUS_COLORS[tenant.status] ?? 'text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg'}`}>
            {tenant.status}
          </span>
          <button onClick={() => { setPayForm({ months: 1, amount: '', notes: '' }); setPayError(''); setPayDone(false); setPayOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm">
            <DollarSign className="w-4 h-4" /> تسديد / تجديد
          </button>
        </div>
      </div>

      {/* Grace period banner */}
      {tenant.status === 'GRACE' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-orange-800 text-sm">الحساب في فترة المهلة</p>
            <p className="text-orange-700 text-xs mt-1">
              {sub?.gracePeriodEndsAt
                ? `تنتهي فترة المهلة في ${new Date(sub.gracePeriodEndsAt).toLocaleDateString('ar-IQ')}. بعدها سيتم تعليق الحساب تلقائياً.`
                : 'انتهى الاشتراك. يرجى التجديد لتجنب تعليق الحساب.'}
            </p>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">خطة الاشتراك</p>
          <p className="text-xl font-extrabold text-slate-800">{sub?.plan?.name ?? '—'}</p>
          <p className="text-sm text-slate-400 mt-1">
            حد الفروع: {sub?.plan?.maxBranches === 0 ? 'غير محدود' : (sub?.plan?.maxBranches ?? '—')}
          </p>
        </div>
        <div className="glass-panel p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">تاريخ الانتهاء</p>
          <p className="text-xl font-extrabold text-slate-800">
            {sub?.endDate ? new Date(sub.endDate).toLocaleDateString('ar-IQ') : (sub?.trialEndDate ? new Date(sub.trialEndDate).toLocaleDateString('ar-IQ') : '—')}
          </p>
          <p className="text-xs text-slate-400 mt-1">{sub?.status}</p>
        </div>
        <div className="glass-panel p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">الإحصائيات</p>
          <div className="flex items-center gap-5 mt-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="font-extrabold text-slate-800">{tenant.branches?.length ?? 0}</span>
              <span className="text-xs text-slate-400">فرع</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-extrabold text-slate-800">{tenant._count?.users ?? 0}</span>
              <span className="text-xs text-slate-400">مستخدم</span>
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              <span className="font-extrabold text-slate-800">{(tenant._count?.transactions ?? 0).toLocaleString('ar-IQ')}</span>
              <span className="text-xs text-slate-400">معاملة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account management */}
      <div className="glass-panel p-6">
        <h2 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">إدارة الحساب</h2>
        <div className="flex flex-wrap gap-3">
          {tenant.status !== 'ACTIVE' && (
            <button onClick={() => changeStatus('ACTIVE')}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-all shadow-sm">
              تفعيل الحساب
            </button>
          )}
          {tenant.status === 'ACTIVE' && (
            <button onClick={() => changeStatus('SUSPENDED')}
              className="px-5 py-2.5 bg-amber-500 text-white font-bold rounded-xl text-sm hover:bg-amber-600 transition-all shadow-sm">
              تعليق الحساب
            </button>
          )}
          {tenant.status !== 'CANCELLED' && (
            <button onClick={() => changeStatus('CANCELLED')}
              className="px-5 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-sm hover:bg-rose-700 transition-all shadow-sm">
              إلغاء الاشتراك
            </button>
          )}
        </div>
      </div>

      {/* Branches */}
      <div className="glass-panel overflow-hidden">
        <div className="p-5 bg-slate-50/50 border-b border-white/40 flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-slate-500" />
          <h2 className="font-bold text-slate-800">قائمة الفروع ({tenant.branches?.length ?? 0})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {(tenant.branches ?? []).map(b => (
            <div key={b.id} className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors">
              <div>
                <p className="font-bold text-slate-800">{b.name}</p>
                <p className="text-xs text-slate-400 mt-1">أضيف في {new Date(b.createdAt).toLocaleDateString('ar-IQ')}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${b.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {b.isActive ? 'فرع نشط' : 'غير نشط'}
              </span>
            </div>
          ))}
          {(tenant.branches ?? []).length === 0 && (
            <p className="text-center text-slate-400 py-12 text-sm font-medium">لا توجد فروع مسجلة</p>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="glass-panel overflow-hidden">
        <div className="p-5 bg-slate-50/50 border-b border-white/40 flex items-center gap-2.5">
          <Receipt className="w-5 h-5 text-slate-500" />
          <h2 className="font-bold text-slate-800">سجل المدفوعات ({tenant.paymentRecords?.length ?? 0})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {(tenant.paymentRecords ?? []).map(p => (
            <div key={p.id} className="flex items-center justify-between p-5 hover:bg-slate-50/30 transition-colors">
              <div>
                <p className="font-extrabold text-slate-800 text-sm">
                  {Number(p.amount).toLocaleString('ar-IQ')} <span className="text-xs font-bold text-slate-400">د.ع</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.months === 12 ? 'سنة كاملة' : `${p.months} شهر`}
                  {p.planName ? ` — ${p.planName}` : ''}
                </p>
                {p.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{p.notes}</p>}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-500">{new Date(p.paidAt).toLocaleDateString('ar-IQ')}</p>
                {p.recordedBy && <p className="text-[10px] text-slate-400 mt-0.5">{p.recordedBy}</p>}
              </div>
            </div>
          ))}
          {(tenant.paymentRecords ?? []).length === 0 && (
            <p className="text-center text-slate-400 py-10 text-sm">لا توجد مدفوعات مسجلة بعد</p>
          )}
        </div>
      </div>

      {/* ── Payment Modal ──────────────────────────────────────────────────── */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setPayOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>

            {payDone ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                  <CheckCircle className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="font-extrabold text-slate-800">تم تسجيل الدفعة بنجاح!</p>
                <p className="text-sm text-slate-500">تم تفعيل الحساب وتمديد الاشتراك</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-lg">تسديد / تجديد الاشتراك</h3>
                  <button onClick={() => setPayOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">مدة التجديد</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 3, 6, 12].map(m => (
                        <button key={m} type="button"
                          onClick={() => setPayForm(f => ({ ...f, months: m }))}
                          className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                            payForm.months === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                          }`}>
                          {m === 12 ? 'سنة' : `${m}م`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ (د.ع)</label>
                    <input type="number" min="0" placeholder="0" value={payForm.amount}
                      onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات <span className="font-normal text-slate-400">(اختياري)</span></label>
                    <input placeholder="مثال: تم الدفع نقداً" value={payForm.notes}
                      onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-xs text-emerald-800 font-bold">
                    سيتم تمديد الاشتراك لـ {payForm.months === 12 ? 'سنة كاملة' : `${payForm.months} شهر`} وتفعيل الحساب تلقائياً
                  </div>
                </div>

                {payError && <p className="text-xs text-red-600 font-bold bg-red-50 px-3 py-2 rounded-lg">{payError}</p>}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setPayOpen(false)} disabled={paySaving}
                    className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all">
                    إلغاء
                  </button>
                  <button onClick={submitPay} disabled={paySaving}
                    className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                    تأكيد التسديد
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
