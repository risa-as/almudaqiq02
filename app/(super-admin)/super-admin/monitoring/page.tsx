'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useEffect, useState } from 'react'
import { Activity, AlertCircle, Database, RefreshCw, History, TrendingUp, BarChart2, Zap } from 'lucide-react'
import { CardSkeleton } from '@/components/loading/Skeletons'
import { PulseLoader } from '@/components/loading/PulseLoader'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

interface DayActivity {
  day: string
  total: number
  creates: number
  deletes: number
}

interface MonitorData {
  dbResponseMs: number
  auditLogs: { id: string; action: string; entity: string; username: string; createdAt: string; details: string }[]
  activityByDay: DayActivity[]
}

export default function MonitoringPage() {
  usePageTitle('المراقبة');
  const [data, setData]       = useState<MonitorData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/super-admin/monitoring').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // DB health color
  const dbColor = data
    ? data.dbResponseMs < 100 ? '#10b981' : data.dbResponseMs < 300 ? '#f59e0b' : '#ef4444'
    : '#94a3b8'

  const totalEvents = data?.activityByDay.reduce((s, d) => s + d.total, 0) ?? 0

  return (
    <div className="space-y-8 max-w-7xl" dir="rtl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)' }}>
                <div className="absolute inset-0 rounded-xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>المراقبة والأداء</h1>
              <p className="text-sm text-slate-500 mt-0.5">مراقبة أداء قاعدة البيانات وسجل النشاطات على مدار الـ 14 يوم الماضية</p>
            </div>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-slate-200 text-sm font-bold text-slate-700 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'جاري التحديث...' : 'تحديث البيانات'}
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
          <div className="flex justify-center py-20"><PulseLoader text="يتم جلب مقاييس النظام" /></div>
        </div>
      ) : data && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* DB Response */}
            <div className="glass-panel p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -mr-10 -mt-10" style={{ background: dbColor }} />
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">استجابة قاعدة البيانات</p>
                  <p className="text-4xl font-black mt-2 leading-none" style={{ color: dbColor }}>
                    {data.dbResponseMs}
                    <span className="text-sm text-slate-400 font-semibold mr-1">ms</span>
                  </p>
                  <p className="text-xs font-semibold mt-2 text-slate-400">
                    {data.dbResponseMs < 100 ? '✅ ممتاز' : data.dbResponseMs < 300 ? '⚠️ مقبول' : '🔴 بطيء'}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center border" style={{ background: `${dbColor}15`, borderColor: `${dbColor}30` }}>
                  <Database className="w-7 h-7" style={{ color: dbColor }} />
                </div>
              </div>
            </div>

            {/* Total Events */}
            <div className="glass-panel p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl -mr-10 -mt-10" />
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي النشاطات (14 يوم)</p>
                  <p className="text-4xl font-black text-blue-600 mt-2 leading-none">{totalEvents.toLocaleString('en-US')}</p>
                  <p className="text-xs font-semibold mt-2 text-slate-400">إجراء مسجل</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-blue-500" />
                </div>
              </div>
            </div>

            {/* Latest log */}
            <div className="glass-panel p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-violet-500/10 blur-3xl -mr-10 -mt-10" />
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">آخر نشاط</p>
                  {data.auditLogs[0] ? (
                    <>
                      <p className="text-base font-extrabold text-slate-800 mt-2 leading-tight truncate max-w-[160px]">{data.auditLogs[0].entity}</p>
                      <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                        {data.auditLogs[0].action}
                      </span>
                    </>
                  ) : (
                    <p className="text-slate-400 text-sm mt-2">لا توجد نشاطات</p>
                  )}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                  <Activity className="w-7 h-7 text-violet-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Area Chart — Total Activity */}
            <div className="glass-panel p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">النشاط اليومي للنظام</h2>
                  <p className="text-xs text-slate-400">إجمالي الأحداث المسجلة خلال الـ 14 يوم الماضية</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={data.activityByDay} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.08)', background: '#fff', fontSize: 12 }}
                    formatter={(v: number | undefined) => [v ?? 0, 'إجمالي الأحداث']}
                    labelStyle={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} fill="url(#totalGrad)" dot={false} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart — Creates vs Deletes */}
            <div className="glass-panel p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                  <BarChart2 className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">الإنشاء مقابل الحذف</h2>
                  <p className="text-xs text-slate-400">مقارنة العمليات الإنشائية والإزالة يومياً</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={data.activityByDay} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.08)', background: '#fff', fontSize: 12 }}
                    labelStyle={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => v === 'creates' ? 'إنشاء' : 'حذف'}
                    wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 12 }} />
                  <Bar dataKey="creates" fill="#10b981" radius={[4, 4, 0, 0]} name="creates" />
                  <Bar dataKey="deletes" fill="#ef4444" radius={[4, 4, 0, 0]} name="deletes" />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* Audit Log */}
          <div className="glass-panel rounded-3xl overflow-hidden">
            <div className="p-5 bg-slate-50/50 border-b border-white/40 flex items-center gap-3">
              <div className="p-2 bg-slate-800/5 rounded-xl">
                <Activity className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">سجل نشاطات النظام</h2>
                <p className="text-xs text-slate-400">آخر {data.auditLogs.length} حدث</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
              {data.auditLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-4 group">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-2 shrink-0 group-hover:bg-blue-400 transition-colors" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[11px] font-black tracking-wide px-2 py-0.5 rounded text-center border ${
                          log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          log.action === 'DELETE' ? 'bg-red-50 text-red-700 border-red-100' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>{log.action}</span>
                        <span className="text-[13px] text-slate-600 font-bold">{log.entity}</span>
                      </div>
                      <p className="text-[12px] text-slate-500 line-clamp-2 max-w-lg leading-relaxed">{log.details}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[11px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </span>
                    {log.username && <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">{log.username}</span>}
                  </div>
                </div>
              ))}
              {data.auditLogs.length === 0 && (
                <div className="p-12 text-center text-slate-400 text-sm font-medium">لا توجد سجلات نشاط حديثة.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

