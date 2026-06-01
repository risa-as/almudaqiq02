'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useEffect, useState } from 'react'
import {
  GitCompare, TrendingUp, TrendingDown, DollarSign,
  ShoppingBag, Trophy, Lock, RotateCcw,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { useBranch } from '@/contexts/BranchContext'

interface BranchStats {
  branchId: string; branchName: string
  totalSales: number; netRevenue: number; totalExpenses: number; netProfit: number
  saleCount: number; avgTicket: number
  refundTotal: number; refundCount: number; refundRate: number
  cashSales: number; cardSales: number; creditSales: number
}

interface ApiData {
  branches: BranchStats[]
  totals: { totalSales: number; netRevenue: number; refundTotal: number; totalExpenses: number; netProfit: number; saleCount: number }
}

const BRANCH_COLORS = ['#094B9F','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

function MiniPayBar({ cash, card, credit }: { cash: number; card: number; credit: number }) {
  const total = cash + card + credit || 1
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px">
      <div className="bg-emerald-400" style={{ width: `${(cash/total)*100}%` }} />
      <div className="bg-blue-400"    style={{ width: `${(card/total)*100}%` }} />
      <div className="bg-orange-400"  style={{ width: `${(credit/total)*100}%` }} />
    </div>
  )
}

export default function BranchComparisonPage() {
  usePageTitle('تقرير الفروع');
  const { isOwner } = useBranch()
  const [data,      setData]      = useState<ApiData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [initialized, setInitialized] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate,   setEndDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [metric,    setMetric]    = useState<'netRevenue'|'netProfit'|'saleCount'|'avgTicket'>('netRevenue')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/branches/comparison?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => { setLoading(false); setInitialized(true); })
  }, [startDate, endDate])

  const handleDateChange = (s: string, e: string) => { setStartDate(s); setEndDate(e); }

  const branches = data?.branches ?? []
  const totals   = data?.totals
  const maxSales = Math.max(...branches.map(b => b.netRevenue), 1)

  const METRIC_CONFIG = {
    netRevenue:  { label: 'صافي الإيرادات',  color: '#094B9F', fmt: (v: number) => formatCurrency(v) },
    netProfit:   { label: 'صافي الربح',      color: '#10b981', fmt: (v: number) => formatCurrency(v) },
    saleCount:   { label: 'عدد الفواتير',    color: '#f59e0b', fmt: (v: number) => String(v) },
    avgTicket:   { label: 'متوسط الفاتورة',  color: '#094B9F', fmt: (v: number) => formatCurrency(v) },
  }

  const chartData = branches.map(b => ({
    name: b.branchName,
    إيرادات: b.totalSales,
    'صافي ربح': b.netProfit,
    مصاريف: b.totalExpenses,
  }))

  if (!initialized) return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(14,99,212,0.4)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
            <GitCompare size={36} className="text-white relative z-10 sk-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-xl font-black text-slate-800">جاري تحميل تقرير الفروع</p>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
          <p className="text-sm text-slate-400 font-medium">يتم مقارنة أداء الفروع وتحليل المبيعات</p>
        </div>
      </div>
      {/* Date filter skeleton */}
      <div className="flex justify-between items-center gap-4">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-9 w-52 rounded-xl" />
      </div>
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton w-8 h-8 rounded-xl" />
            </div>
            <div className="skeleton h-7 w-24" />
          </div>
        ))}
      </div>
      {/* Branch comparison cards */}
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-2.5 w-full rounded-full" />
              </div>
              <div className="skeleton h-6 w-20 rounded-xl" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[70, 55, 65, 50].map((w, j) => (
                <div key={j} className="space-y-1">
                  <div className="skeleton h-2.5 w-16" />
                  <div className="skeleton h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="skeleton h-4 w-36" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="p-6 max-w-7xl mx-auto space-y-5">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}

      {/* Header */}
      <PageHeader
        title="مقارنة أداء الفروع"
        subtitle="مقارنة تفصيلية بين جميع الفروع النشطة"
        icon={GitCompare}
        gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)"
        actions={
          <DateRangeFilter accentColor="violet" defaultPreset="this_month" onChange={handleDateChange} />
        }
      />

      {/* Restricted view notice for non-owners */}
      {!isOwner && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Lock size={15} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800">عرض مقيّد — بيانات فرعك فقط</p>
            <p className="text-xs text-blue-600 mt-0.5">مديرو الفروع يرون تقارير فرعهم المخصص فقط. تواصل مع الإدارة للاطلاع على المقارنة الكاملة.</p>
          </div>
        </div>
      )}

      {/* Summary KPI row */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'صافي الإيرادات',   value: formatCurrency(totals.netRevenue),    icon: TrendingUp,   color: 'indigo' },
            { label: 'المرتجعات',        value: formatCurrency(totals.refundTotal),   icon: RotateCcw,    color: 'red'    },
            { label: 'إجمالي المصاريف',  value: formatCurrency(totals.totalExpenses), icon: TrendingDown, color: 'amber'  },
            { label: 'صافي الربح',       value: formatCurrency(totals.netProfit),     icon: DollarSign,   color: 'emerald'},
            { label: 'إجمالي الفواتير',  value: String(totals.saleCount),            icon: ShoppingBag,  color: 'violet' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={`text-${color}-600`} />
              </div>
              <div>
                <p className="text-lg font-extrabold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div className="skeleton w-12 h-12 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="hidden md:flex gap-6">
                {[80, 60, 70].map((w, j) => (
                  <div key={j} className="space-y-1.5 text-center">
                    <div className="skeleton h-5 w-16 mx-auto" />
                    <div className="skeleton h-2.5 mx-auto" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
              <div className="skeleton h-7 w-16 rounded-xl" />
            </div>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <GitCompare size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا توجد بيانات للفترة المحددة</p>
        </div>
      ) : (
        <>
          {/* Branch cards */}
          <div className="space-y-3">
            {branches.map((branch, idx) => {
              const shareOfSales = totals && totals.netRevenue > 0 ? (branch.netRevenue / totals.netRevenue) * 100 : 0
              const isTop = idx === 0
              return (
                <div key={branch.branchId}
                  className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${isTop ? 'border-violet-200 ring-1 ring-violet-100' : 'border-gray-100'}`}>
                  {/* Row 1: rank + name + total */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0 ${isTop ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {isTop ? <Trophy size={14} /> : idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{branch.branchName}</p>
                        {isTop && <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">الأفضل أداءً</span>}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-extrabold text-gray-900">{formatCurrency(branch.netRevenue)}</p>
                      <p className="text-xs text-gray-400">صافي الإيراد · {shareOfSales.toFixed(1)}% من الإجمالي</p>
                    </div>
                  </div>

                  {/* Net revenue bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(branch.netRevenue/maxSales)*100}%`, background: BRANCH_COLORS[idx % BRANCH_COLORS.length] }} />
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4 text-xs">
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-gray-400 mb-0.5">مصاريف</p>
                      <p className="font-bold text-red-600">{formatCurrency(branch.totalExpenses)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-gray-400 mb-0.5">صافي ربح</p>
                      <p className={`font-bold ${branch.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(branch.netProfit)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-gray-400 mb-0.5">الفواتير</p>
                      <p className="font-bold text-gray-800">{branch.saleCount}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-gray-400 mb-0.5">متوسط فاتورة</p>
                      <p className="font-bold text-gray-800">{formatCurrency(branch.avgTicket)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-gray-400 mb-0.5">مرتجعات</p>
                      <p className="font-bold text-orange-600">{formatCurrency(branch.refundTotal)}</p>
                      <p className="text-[9px] text-gray-400">{branch.refundRate}%</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-gray-400 mb-1 text-[10px]">طرق الدفع</p>
                      <MiniPayBar cash={branch.cashSales} card={branch.cardSales} credit={branch.creditSales} />
                      <div className="flex justify-between mt-1 text-[10px]">
                        <span className="text-emerald-600">نقد</span>
                        <span className="text-blue-600">بطاقة</span>
                        <span className="text-orange-600">آجل</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bar chart comparison */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">مخطط مقارنة الفروع</h3>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(Object.keys(METRIC_CONFIG) as Array<keyof typeof METRIC_CONFIG>).map(k => (
                  <button key={k} onClick={() => setMetric(k)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${metric === k ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
                    {METRIC_CONFIG[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branches.map(b => ({ name: b.branchName, value: b[metric] }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={v => metric === 'saleCount' ? String(v) : v >= 1000000 ? `${(v/1000000).toFixed(1)} مليون` : v >= 1000 ? `${(v/1000).toFixed(0)} الف` : String(v)} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(v: any) => [METRIC_CONFIG[metric].fmt(Number(v)), METRIC_CONFIG[metric].label]}
                  />
                  <Bar dataKey="value" fill={METRIC_CONFIG[metric].color} radius={[6,6,0,0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-bold text-gray-800">جدول المقارنة التفصيلية</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                  <tr>
                    {['الفرع','صافي الإيرادات','المرتجعات','المصاريف','صافي الربح','الفواتير','متوسط الفاتورة','نقد','بطاقة','آجل'].map(h => (
                      <th key={h} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {branches.map((b, i) => (
                    <tr key={b.branchId} className={`hover:bg-blue-50/50 transition-colors group ${i === 0 ? 'bg-violet-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                          <span className="font-semibold text-gray-800">{b.branchName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-700">{formatCurrency(b.netRevenue)}</td>
                      <td className="px-6 py-4 text-orange-600">{formatCurrency(b.refundTotal)}</td>
                      <td className="px-6 py-4 text-red-600">{formatCurrency(b.totalExpenses)}</td>
                      <td className={`px-6 py-4 font-bold ${b.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(b.netProfit)}</td>
                      <td className="px-6 py-4 text-gray-700">{b.saleCount}</td>
                      <td className="px-6 py-4 text-gray-700">{formatCurrency(b.avgTicket)}</td>
                      <td className="px-6 py-4 text-emerald-600">{formatCurrency(b.cashSales)}</td>
                      <td className="px-6 py-4 text-blue-600">{formatCurrency(b.cardSales)}</td>
                      <td className="px-6 py-4 text-orange-500">{formatCurrency(b.creditSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
