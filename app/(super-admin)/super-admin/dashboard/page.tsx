'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@/lib/query/fetcher'
import { Building2, Users, AlertTriangle, TrendingUp, CalendarDays, Key } from 'lucide-react'
import { PulseLoader } from '@/components/loading/PulseLoader'
import { CardSkeleton } from '@/components/loading/Skeletons'

interface Stats {
  totalTenants: number
  activeTenants: number
  trialTenants: number
  suspendedTenants: number
  newThisMonth: number
  expiringSoon7: number
  expiringSoon30: number
  totalBranches: number
}

function StatCard({ title, value, sub, icon: Icon, colorClass, bgClass }: {
  title: string; value: number; sub?: string; icon: React.ElementType; colorClass: string; bgClass: string
}) {
  return (
    <div className="stat-card group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 ${bgClass} rounded-full blur-3xl opacity-20 -mr-10 -mt-10 transition-transform group-hover:scale-110`} />
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="stat-card-label">{title}</p>
          <p className="stat-card-value font-[family-name:var(--font-mono)] text-[2rem] leading-tight mt-1">{value.toLocaleString('en-US')}</p>
          {sub && <p className="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-1.5"><TrendingUp size={12} className={colorClass} /> {sub}</p>}
        </div>
        <div className={`stat-card-icon ${bgClass} bg-opacity-15 ring-1 ring-inset ${colorClass.replace('text-', 'ring-').replace('500', '500/20')} shadow-inner`}>
          <Icon className={`w-[26px] h-[26px] ${colorClass}`} />
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  usePageTitle('لوحة تحكم المشرف');
  const statsQuery = useQuery({
    queryKey: ['sa-dashboard'],
    queryFn: () => fetchJson<Stats>('/api/super-admin/stats'),
  })
  const stats = statsQuery.data ?? null
  const loading = statsQuery.isPending

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="mt-12">
          <PulseLoader text="جاري جلب بيانات النظام..." />
        </div>
      </div>
    )
  }
  
  if (!stats) return (
    <div className="glass-panel rounded-2xl p-8 text-center max-w-md mx-auto mt-20 border-red-500/20">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-80" />
      <h3 className="text-lg font-bold text-slate-800">تعذر تحميل البيانات</h3>
      <p className="text-sm text-slate-500 mt-2">حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة لاحقاً.</p>
    </div>
  )

  return (
    <div className="space-y-7 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 8px 24px rgba(14,99,212,0.3)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
            <Building2 size={22} className="text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">لوحة التحكم</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">نظرة عامة على أداء المنصة والمشتركين</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="إجمالي المنظمات" value={stats.totalTenants} icon={Building2} colorClass="text-blue-600" bgClass="bg-blue-500" />
        <StatCard title="نشط" value={stats.activeTenants} sub={`${stats.trialTenants} في فترة تجربة`} icon={TrendingUp} colorClass="text-emerald-600" bgClass="bg-emerald-500" />
        <StatCard title="الفروع النشطة" value={stats.totalBranches} icon={Building2} colorClass="text-violet-600" bgClass="bg-violet-500" />
        <StatCard title="معلق" value={stats.suspendedTenants} icon={AlertTriangle} colorClass="text-rose-500" bgClass="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Expiring soon */}
        <div className="glass-panel rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-xl">
               <Key className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-[1rem] font-bold text-slate-800">اشتراكات تنتهي قريباً</h2>
          </div>
          
          <div className="space-y-4">
            <div className="group flex items-center justify-between p-4 bg-white/50 hover:bg-white rounded-xl border border-slate-100 transition-all shadow-sm hover:shadow-md">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                 <span className="text-[13px] font-bold text-slate-700">تنمي خلال 7 أيام</span>
              </div>
              <span className="px-3 py-1 bg-rose-50 text-rose-700 font-bold rounded-lg text-sm">{stats.expiringSoon7}</span>
            </div>
            
            <div className="group flex items-center justify-between p-4 bg-white/50 hover:bg-white rounded-xl border border-slate-100 transition-all shadow-sm hover:shadow-md">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-blue-400" />
                 <span className="text-[13px] font-bold text-slate-700">تنتهي خلال 30 يوماً</span>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg text-sm">{stats.expiringSoon30}</span>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="glass-panel rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-xl">
               <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-[1rem] font-bold text-slate-800">هذا الشهر</h2>
          </div>

          <div className="flex items-center gap-5 p-5 bg-gradient-to-br from-blue-50 to-blue-50/50 rounded-2xl border border-blue-100/50 shadow-inner">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-800/70 mb-1">مستأجرون جدد</p>
              <p className="text-[2rem] font-black text-blue-700 font-[family-name:var(--font-mono)] leading-none">{stats.newThisMonth}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
