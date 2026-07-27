'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, CreditCard, Activity, Megaphone, KeyRound, KeySquare, LogOut, Shield, WifiOff, Wallet, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clearClientSession } from '@/lib/client-session';

const NAV = [
  { href: '/super-admin/dashboard',      label: 'لوحة التحكم',   icon: LayoutDashboard, gradient: 'from-blue-400 to-violet-500' },
  { href: '/super-admin/tenants',        label: 'المنظمات',      icon: Building2,       gradient: 'from-cyan-400 to-blue-500' },
  { href: '/super-admin/plans',          label: 'خطط الاشتراك',  icon: CreditCard,      gradient: 'from-blue-400 to-orange-500' },
  { href: '/super-admin/payment-methods',label: 'طرق الدفع',     icon: Wallet,          gradient: 'from-purple-400 to-violet-500' },
  { href: '/super-admin/monitoring',     label: 'المراقبة',      icon: Activity,        gradient: 'from-emerald-400 to-teal-500' },
  { href: '/super-admin/announcements',  label: 'الإعلانات',     icon: Megaphone,       gradient: 'from-pink-400 to-rose-500' },
  { href: '/super-admin/licenses',       label: 'التراخيص',      icon: KeyRound,        gradient: 'from-violet-400 to-purple-500' },
  { href: '/super-admin/offline-licenses', label: 'تراخيص أوف لاين', icon: KeySquare,   gradient: 'from-amber-400 to-orange-500' },
  { href: '/super-admin/settings',       label: 'الإعدادات',     icon: Settings,        gradient: 'from-slate-400 to-gray-500' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online',  update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearClientSession();
    router.push('/login')
  }

  return (
    <div className="flex h-screen" dir="rtl" style={{ background: '#0d1117' }}>
      {/* Premium Sidebar */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col overflow-hidden relative"
        style={{
          background: 'linear-gradient(170deg, #0a0a1a 0%, #0d1117 40%, #0a0f1a 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.04)',
          boxShadow: '2px 0 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #094B9F, transparent)', transform: 'translate(20%,-30%)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #094B9F, transparent)', transform: 'translate(-20%,20%)' }} />

        {/* Brand */}
        <div className="px-5 py-6 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 opacity-20"
            style={{ background: 'linear-gradient(135deg, rgba(14,99,212,0.5) 0%, transparent 60%)' }} />
          <div className="relative flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)',
                boxShadow: '0 4px 20px rgba(14,99,212,0.5)',
              }}
            >
              <div className="absolute inset-0 opacity-25"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
              <Shield size={22} className="text-white relative z-10" />
            </div>
            <div>
              <h1 className="text-white font-black text-[15px] tracking-wide leading-tight">Super Admin</h1>
              <p className="text-violet-400/60 text-[10px] font-semibold mt-0.5 tracking-widest uppercase">إدارة المنصة</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 mb-3 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
          {NAV.map(({ href, label, icon: Icon, gradient }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-bold transition-all duration-200 group ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-white/4'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(90deg, rgba(14,99,212,0.2) 0%, rgba(9,75,159,0.08) 100%)',
                  border: '1px solid rgba(14,99,212,0.25)',
                  boxShadow: '0 0 20px rgba(14,99,212,0.1)',
                } : {}}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${gradient} transition-all`}
                  style={{
                    opacity: isActive ? 1 : 0.5,
                    boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <Icon size={14} className="text-white" />
                </div>
                {label}
                {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-[13px] font-bold text-slate-500 hover:text-red-400 transition-all duration-200 rounded-xl hover:bg-red-500/8"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative" style={{ background: '#f8fafc' }}>
        <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(14,99,212,0.04) 0%, transparent 100%)' }} />

        {/* Offline banner */}
        {offline && (
          <div className="sticky top-0 z-50 flex items-center gap-3 px-6 py-3 text-sm font-bold"
            style={{ background: 'linear-gradient(90deg, #dc2626, #b91c1c)', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <WifiOff size={16} />
            <span>وضع بدون إنترنت — لوحة Super Admin تتطلب اتصالاً بالسحابة. البيانات غير متاحة حالياً.</span>
          </div>
        )}

        <div className="relative p-8 z-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
