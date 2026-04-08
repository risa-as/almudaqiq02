'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, LogIn, Store, Sparkles } from 'lucide-react'

export default function LoginPage() {
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
      const res = await fetch('/api/auth/login', {
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
    <div
      className="min-h-screen flex flex-col justify-center items-center p-6 relative overflow-hidden"
      dir="rtl"
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #1e1b4b 30%, #312e81 60%, #1e1b4b 80%, #0f0c29 100%)',
      }}
    >
      {/* Mesh gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', top: '-10%', right: '-5%' }} />
        <div className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', bottom: '10%', left: '5%' }} />
        <div className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #c084fc, transparent)', top: '40%', left: '40%' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
      </div>

      {/* Logo / Brand */}
      <div className="relative mb-8 text-center animate-fade-in-up">
        <div className="flex items-center justify-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
            }}
          >
            <div className="absolute inset-0 opacity-30"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
            <Store size={28} className="text-white relative z-10" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          نظام <span style={{ background: 'linear-gradient(90deg, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>البيان</span>
        </h1>
        <p className="text-indigo-300/70 text-sm mt-1.5 font-medium">إدارة متكاملة لمتجرك</p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md relative animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <div className="p-8">
            <div className="text-center mb-7">
              <div className="inline-flex items-center gap-2 bg-indigo-500/15 border border-indigo-400/20 rounded-full px-4 py-1.5 mb-4">
                <Sparkles size={13} className="text-indigo-300" />
                <span className="text-indigo-300 text-xs font-semibold">مرحباً بعودتك</span>
              </div>
              <h2 className="text-2xl font-bold text-white">تسجيل الدخول</h2>
              <p className="text-slate-400 text-sm mt-1">أدخل بياناتك للوصول إلى النظام</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 block">البريد الإلكتروني</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none z-10">
                    <Mail size={18} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors duration-200" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pr-12 pl-4 py-3.5 rounded-xl text-sm font-semibold outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                    placeholder="you@example.com"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 block">كلمة المرور</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none z-10">
                    <Lock size={18} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors duration-200" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pr-12 pl-4 py-3.5 rounded-xl text-sm font-semibold outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                    }}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm font-bold p-3.5 rounded-xl text-center"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-70"
                style={{
                  background: loading ? 'rgba(99,102,241,0.6)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: loading ? 'none' : '0 8px 32px rgba(99,102,241,0.4)',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>دخول إلى النظام</span>
                    <LogIn size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="px-8 py-4 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
            <p className="text-xs text-slate-500 font-semibold">نظام البيان — الإصدار 2.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
