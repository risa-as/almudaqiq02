'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Building2, Save, Loader2, AlertTriangle,
  ShieldCheck, Mail, Lock, Hash, Calendar, CreditCard,
  CheckCircle, Copy
} from 'lucide-react'

interface Plan { id: string; name: string; monthlyPrice: number }

export default function NewTenantPage() {
  usePageTitle('تفاصيل المستأجر');
  const router = useRouter()
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [plans, setPlans]         = useState<Plan[]>([])
  const [createdEmail, setCreatedEmail] = useState('')   // shown after success
  const [copied, setCopied]       = useState(false)

  const [form, setForm] = useState({
    name:          '',
    planName:      '',
    adminEmail:    '',
    adminPassword: '',
    trialDays:     14,
  })

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then(r => r.json())
      .then((data: Plan[]) => {
        setPlans(data)
        if (data.length > 0) setForm(f => ({ ...f, planName: data[0].name }))
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/super-admin/tenants', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.error && typeof data.error === 'object'
            ? 'يرجى التحقق من صحة البيانات المدخلة'
            : data.error || 'حدث خطأ أثناء الإنشاء'
        )
        return
      }
      setCreatedEmail(data.email)
    } catch {
      setError('تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(createdEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const field = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 outline-none focus:ring-4 focus:border-blue-500 transition-all font-medium placeholder:text-slate-300'

  // ── Success screen ──────────────────────────────────────────────────────────
  if (createdEmail) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center py-4" dir="rtl">
        <div className="w-full max-w-md rounded-3xl p-8 text-center space-y-6"
          style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center mx-auto overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>
            <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
            <CheckCircle className="w-9 h-9 text-white relative z-10" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              تم إنشاء المنظمة بنجاح!
            </h2>
            <p className="text-sm text-slate-500 mt-1">أرسل بيانات الدخول أدناه إلى العميل</p>
          </div>

          <div className="rounded-2xl p-5 text-right space-y-3"
            style={{ background: 'linear-gradient(135deg, rgba(9,75,159,0.05), rgba(14,99,212,0.05))', border: '1px solid rgba(9,75,159,0.15)' }}>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 mb-1 uppercase tracking-wider">رابط الدخول</p>
              <p className="text-sm font-bold text-slate-600">{typeof window !== 'undefined' ? window.location.origin : ''}/login</p>
            </div>
            <div className="border-t border-blue-100 pt-3">
              <p className="text-[10px] font-extrabold text-slate-400 mb-1 uppercase tracking-wider">البريد الإلكتروني</p>
              <p className="text-base font-black" style={{ color: '#073D82' }}>{createdEmail}</p>
            </div>
          </div>

          <button
            onClick={copyCode}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold border text-sm transition-all"
            style={{ border: '1px solid #e2e8f0', background: 'white', color: '#475569' }}
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'تم النسخ!' : 'نسخ البريد الإلكتروني'}
          </button>

          <button
            onClick={() => router.push('/super-admin/tenants')}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 4px 16px rgba(9,75,159,0.35)' }}
          >
            العودة إلى قائمة المنظمات
          </button>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full flex flex-col items-center justify-start py-4" dir="rtl">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
          >
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 4px 16px rgba(9,75,159,0.3)' }}>
              <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
              <Building2 className="w-5 h-5 text-white relative z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                إضافة مستأجر جديد
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">سيتم توليد كود المنظمة تلقائياً بعد الحفظ</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="font-semibold text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Section 1 ──────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="px-6 py-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0' }}>
              <div className="relative w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)' }}>
                <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
                <Building2 className="w-4 h-4 text-white relative z-10" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">بيانات المتجر / الشركة</h2>
            </div>

            <div className="p-6 space-y-5 bg-white">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" /> الاسم التجاري
                  <span className="text-red-500 mr-0.5">*</span>
                </label>
                <input
                  className={field}
                  placeholder="مثال: أسواق السلام"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" /> خطة الاشتراك
                  </label>
                  <select
                    className={`${field} appearance-none cursor-pointer`}
                    value={form.planName}
                    onChange={e => setForm(f => ({ ...f, planName: e.target.value }))}
                    disabled={plans.length === 0}
                  >
                    {plans.length === 0
                      ? <option value="">جاري التحميل...</option>
                      : plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> أيام التجربة
                  </label>
                  <input
                    type="number" min="0"
                    className={field}
                    value={form.trialDays}
                    onChange={e => setForm(f => ({ ...f, trialDays: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2 ──────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="px-6 py-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0' }}>
              <div className="relative w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)' }}>
                <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />
                <ShieldCheck className="w-4 h-4 text-white relative z-10" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">حساب مدير النظام الافتراضي</h2>
            </div>

            <div className="p-6 space-y-5 bg-white">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> البريد الإلكتروني
                  <span className="text-red-500 mr-0.5">*</span>
                </label>
                <input
                  type="email" dir="ltr"
                  className={field}
                  placeholder="admin@example.com"
                  value={form.adminEmail}
                  onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  required
                />
                <p className="text-xs text-slate-400 mt-1">سيُستخدم هذا البريد لتسجيل الدخول إلى النظام</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> كلمة المرور
                  <span className="text-red-500 mr-0.5">*</span>
                </label>
                <input
                  type="password"
                  className={field}
                  placeholder="••••••••"
                  value={form.adminPassword}
                  onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                  required minLength={6}
                />
              </div>
            </div>
          </div>

          {/* ── Actions ────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-1 pb-6">
            <button
              type="button" onClick={() => router.back()} disabled={loading}
              className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              إلغاء
            </button>
            <button
              type="submit" disabled={loading}
              className="px-8 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 4px 16px rgba(9,75,159,0.35)' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'جاري الحفظ...' : 'حفظ وإنشاء السجل'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
