'use client'
import { usePageTitle } from '@/hooks/usePageTitle'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Lock, Mail, LogIn, ShoppingCart, BarChart3,
  Users, Package, Shield, Zap, CheckCircle2,
} from 'lucide-react'

const FEATURES = [
  { icon: BarChart3,    label: 'تقارير وتحليلات متقدمة',   desc: 'إحصائيات لحظية وتقارير مفصّلة' },
  { icon: Package,      label: 'إدارة المخزون',             desc: 'تتبع المخزون عبر جميع الفروع'   },
  { icon: Users,        label: 'إدارة العملاء والموردين',   desc: 'سجلات كاملة مع كشوف الحسابات'  },
  { icon: Shield,       label: 'صلاحيات متعددة المستويات', desc: 'تحكم دقيق بأدوار الموظفين'      },
  { icon: Zap,          label: 'مزامنة فورية',              desc: 'بيانات محدّثة عبر كل الفروع'    },
]

export default function LoginPage() {
  usePageTitle('تسجيل الدخول')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(data.redirectTo ?? '/')
        router.refresh()
      } else {
        setError(data.error || 'فشل تسجيل الدخول')
      }
    } catch {
      setError('حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Outer wrapper — LTR so left/right are visual, inner text stays RTL */
    <div className="h-screen overflow-hidden flex" dir="ltr">

      {/* ── LEFT PANEL — Login Form ── */}
      <div
        className="w-full lg:w-[42%] flex flex-col justify-center items-center px-8 relative overflow-hidden"
        style={{ background: '#0d0b1e' }}
      >
        {/* subtle top-left blob */}
        <div
          className="absolute w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', top: '-10%', left: '-10%' }}
        />
        <div
          className="absolute w-56 h-56 rounded-full opacity-8 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent)', bottom: '5%', right: '0%' }}
        />

        <div className="w-full max-w-sm relative z-10" dir="rtl">

          {/* Logo + brand */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-20 h-20 overflow-hidden mb-4 flex items-center justify-center"
              style={{
                borderRadius: '10px',
                boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
                border: '1.5px solid rgba(255,255,255,0.12)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              نظام{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                المدقق
              </span>
            </h1>
            <p className="text-slate-500 text-xs mt-1 font-medium">إدارة متكاملة لمتجرك</p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
            }}
          >
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white mb-1">تسجيل الدخول</h2>
              <p className="text-slate-400 text-sm">أدخل بياناتك للوصول إلى لوحة التحكم</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 block">
                  البريد الإلكتروني أو اسم المستخدم
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none z-10">
                    <Mail
                      size={16}
                      className="text-slate-500 group-focus-within:text-indigo-400 transition-colors"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com أو admin"
                    dir="ltr"
                    className="w-full pr-10 pl-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'white',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)'
                      e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 block">كلمة المرور</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none z-10">
                    <Lock
                      size={16}
                      className="text-slate-500 group-focus-within:text-indigo-400 transition-colors"
                    />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'white',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)'
                      e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }}
                  />
                </div>
              </div>

              {error && (
                <div
                  className="text-sm font-semibold p-3 rounded-xl text-center"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#fca5a5',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-60 mt-2"
                style={{
                  background: loading
                    ? 'rgba(99,102,241,0.5)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: loading ? 'none' : '0 8px 28px rgba(99,102,241,0.4)',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>دخول إلى النظام</span>
                    <LogIn size={17} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-600 mt-4 font-medium">
            نظام المدقق — الإصدار 2.0 &nbsp;·&nbsp; جميع الحقوق محفوظة
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — System Info (hidden on mobile) ── */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden p-10"
        style={{
          background: 'linear-gradient(145deg, #1e1b4b 0%, #312e81 40%, #1e1b4b 70%, #0f0c29 100%)',
        }}
        dir="rtl"
      >
        {/* decorative blobs */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #4f46e5, transparent)', top: '-15%', right: '-10%' }}
        />
        <div
          className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', bottom: '5%', left: '5%' }}
        />
        <div
          className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #c084fc, transparent)', top: '50%', left: '40%' }}
        />
        {/* grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Top: brand */}
        <div className="relative z-10 flex items-center gap-4">
          <div
            className="w-12 h-12 overflow-hidden flex items-center justify-center"
            style={{
              borderRadius: '10px',
              border: '1.5px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-black text-lg leading-none">نظام المدقق</p>
            <p className="text-indigo-300/70 text-xs mt-0.5">SuperMarket Cloud POS</p>
          </div>
        </div>

        {/* Center: hero text + features */}
        <div className="relative z-10 flex-1 flex flex-col justify-center mt-4">
          <div className="mb-6">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5"
              style={{
                background: 'rgba(99,102,241,0.18)',
                border: '1px solid rgba(99,102,241,0.3)',
              }}
            >
              <ShoppingCart size={13} className="text-indigo-300" />
              <span className="text-indigo-300 text-xs font-bold">منصة SaaS متكاملة</span>
            </div>

            <h2 className="text-4xl font-black text-white leading-snug mb-4">
              أدِر متجرك
              <br />
              <span
                style={{
                  background: 'linear-gradient(90deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                بذكاء وسهولة
              </span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed max-w-sm">
              نظام متكامل لإدارة نقاط البيع، المخزون، المحاسبة، والتقارير
              عبر جميع فروعك من مكان واحد.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(99,102,241,0.2)',
                    border: '1px solid rgba(99,102,241,0.3)',
                  }}
                >
                  <Icon size={17} className="text-indigo-300" />
                </div>
                <div>
                  <p className="text-white text-sm font-bold leading-none mb-0.5">{label}</p>
                  <p className="text-slate-500 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: stats bar */}
        <div
          className="relative z-10 rounded-2xl p-4 mt-4"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: '+500',  label: 'متجر يستخدم النظام' },
              { value: '99.9%', label: 'وقت التشغيل'         },
              { value: '24/7',  label: 'دعم فني مستمر'        },
            ].map(stat => (
              <div key={stat.label}>
                <p
                  className="text-2xl font-black mb-0.5"
                  style={{
                    background: 'linear-gradient(90deg, #818cf8, #c084fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {stat.value}
                </p>
                <p className="text-slate-500 text-xs font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="text-slate-400 text-xs font-medium">
              آمن · موثوق · متوافق مع اللوائح المحلية
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
