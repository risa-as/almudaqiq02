'use client'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@/lib/query/fetcher'
import { BarChart3, Download, Search } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import { useBranch } from '@/contexts/BranchContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatCurrency } from '@/lib/format'

type AbcClass = 'A' | 'B' | 'C'

interface AbcRow {
  rank: number
  productId: string
  name: string
  category: string
  quantity: number
  revenue: number
  profit: number
  sharePct: number
  cumulativePct: number
  class: AbcClass
}

interface AbcData {
  summary: {
    totalRevenue: number
    productCount: number
    classes: Record<AbcClass, { count: number; revenue: number; profit: number; revenueShare: number }>
  }
  products: AbcRow[]
}

const CLASS_META: Record<AbcClass, { label: string; color: string; badge: string; desc: string }> = {
  A: { label: 'الفئة A', color: '#10b981', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', desc: 'تولّد 80% من الإيراد — لا تدعها تنفد أبداً' },
  B: { label: 'الفئة B', color: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border-amber-200',     desc: 'الـ 15% التالية — مراقبة دورية' },
  C: { label: 'الفئة C', color: '#ef4444', badge: 'bg-red-50 text-red-600 border-red-200',           desc: 'آخر 5% — رشّد مخزونها وفكّر بالتصفية' },
}

const toDateInput = (d: Date) => d.toISOString().slice(0, 10)

export default function AbcAnalysisPage() {
  usePageTitle('تحليل ABC للمنتجات')
  const { selectedBranch } = useBranch()

  const [startDate, setStartDate] = useState(() => toDateInput(new Date(Date.now() - 90 * 86400000)))
  const [endDate, setEndDate]     = useState(() => toDateInput(new Date()))
  const [search, setSearch]       = useState('')
  const [classFilter, setClassFilter] = useState<AbcClass | 'all'>('all')

  const bId = selectedBranch?.id ?? 'all'
  const abcQuery = useQuery({
    queryKey: ['report-abc-analysis', bId, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate })
      if (selectedBranch?.id) params.set('branchId', selectedBranch.id)
      return fetchJson<AbcData>(`/api/reports/abc-analysis?${params}`)
    },
    placeholderData: (prev) => prev,
  })
  const data = abcQuery.data ?? null
  const loading = abcQuery.isPending

  const filtered = useMemo(() => {
    if (!data) return []
    return data.products.filter(p =>
      (classFilter === 'all' || p.class === classFilter) &&
      (!search.trim() || p.name.includes(search.trim()) || p.category.includes(search.trim()))
    )
  }, [data, search, classFilter])

  /** أعلى نسبة مساهمة — مرجع تحجيم أشرطة المساهمة في الجدول */
  const topShare = useMemo(
    () => (data?.products.length ? Math.max(...data.products.map(p => p.sharePct)) : 0),
    [data],
  )

  const pieData = useMemo(() => {
    if (!data) return []
    return (['A', 'B', 'C'] as AbcClass[]).map(k => ({
      name:  CLASS_META[k].label,
      value: Math.round(data.summary.classes[k].revenue * 100) / 100,
      color: CLASS_META[k].color,
    })).filter(d => d.value > 0)
  }, [data])

  function exportCsv() {
    if (!data) return
    const header = 'الترتيب,المنتج,القسم,الكمية,الإيراد,الربح,نسبة المساهمة %,الفئة'
    const lines = data.products.map(p =>
      [p.rank, `"${p.name}"`, `"${p.category}"`, Math.round(p.quantity), p.revenue.toFixed(2), p.profit.toFixed(2), p.sharePct.toFixed(1), p.class].join(',')
    )
    const blob = new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abc-analysis-${startDate}-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => Math.round(n).toLocaleString()

  return (
    <div className="max-w-6xl mx-auto space-y-4" dir="rtl">
      <PageHeader
        title="تحليل ABC للمنتجات"
        subtitle="تصنيف المنتجات حسب مساهمتها في الإيراد لترشيد قرارات الشراء والمخزون"
        icon={BarChart3}
        gradient="linear-gradient(135deg, #094B9F, #063A8A)"
        actions={
          <button onClick={exportCsv} disabled={!data || data.products.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
            <Download className="w-3.5 h-3.5" />
            تصدير CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <label className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          من
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--bg-hover, rgba(148,163,184,0.08))', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          إلى
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--bg-hover, rgba(148,163,184,0.08))', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
        </label>
        <div className="flex items-center gap-1.5">
          {(['all', 'A', 'B', 'C'] as const).map(k => (
            <button key={k} onClick={() => setClassFilter(k)}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                classFilter === k
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-transparent border-slate-200 text-slate-500 hover:border-blue-300'
              }`}>
              {k === 'all' ? 'الكل' : `فئة ${k}`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن منتج أو قسم..."
            className="w-full rounded-lg py-1.5 pr-9 pl-3 text-xs outline-none"
            style={{ background: 'var(--bg-hover, rgba(148,163,184,0.08))', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
          جارٍ التحليل...
        </div>
      ) : !data || data.products.length === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>لا توجد مبيعات في الفترة المحددة</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>وسّع النطاق الزمني وحاول مجدداً</p>
        </div>
      ) : (
        <>
          {/* Class cards + donut */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {(['A', 'B', 'C'] as AbcClass[]).map(k => {
              const c = data.summary.classes[k]
              const meta = CLASS_META[k]
              return (
                <div key={k} className="rounded-2xl p-4 flex flex-col"
                  // شريط علوي بلون الفئة — يربط البطاقة بقطاعها في الدائرة وبصفوف الجدول
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderTop: `3px solid ${meta.color}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black border ${meta.badge}`}>{meta.label}</span>
                    <span className="text-sm font-black tabular-nums" style={{ color: meta.color }}>{c.revenueShare.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{c.count}</p>
                    <p className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>منتج</p>
                  </div>
                  <p className="text-xs font-bold mt-0.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(c.revenue)}
                  </p>

                  {/* حصة الفئة من الإيراد كشريط — الرقم وحده لا يُظهر الحجم النسبي */}
                  <div className="h-1.5 rounded-full overflow-hidden mt-3"
                    style={{ background: 'var(--bg-hover, rgba(148,163,184,0.18))' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, c.revenueShare)}%`, background: meta.color }} />
                  </div>

                  <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{meta.desc}</p>
                </div>
              )
            })}

            {/* الدائرة: أصبح لها عنوان وإجمالي في المنتصف ومفتاح ألوان — كانت رسمًا صامتًا */}
            <div className="rounded-2xl p-3 flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>توزيع الإيراد</p>
              <div className="relative" dir="ltr">
                <ResponsiveContainer width="100%" height={128}>
                  <PieChart>
                    <Tooltip
                      formatter={(v: any) => formatCurrency(Number(v))}
                      contentStyle={{ fontSize: 11, borderRadius: 10, direction: 'rtl' }}
                    />
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* الإجمالي في قلب الدائرة بدل ترك الفراغ */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>الإجمالي</p>
                  <p className="text-xs font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmt(data.summary.totalRevenue)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2.5 mt-1">
                {(['A', 'B', 'C'] as AbcClass[]).map(k => (
                  <span key={k} className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: CLASS_META[k].color }} />
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            {/* عدّاد النتائج — لم يكن هناك ما يوضّح أثر الفلاتر على القائمة */}
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border-color)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                عرض <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{filtered.length}</span>
                {' '}من {data.products.length} منتج
              </p>
              {(classFilter !== 'all' || search.trim()) && (
                <button
                  onClick={() => { setClassFilter('all'); setSearch('') }}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-70"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover, rgba(148,163,184,0.1))' }}
                >
                  مسح الفلاتر
                </button>
              )}
            </div>
            <div className="max-h-[55vh] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10"
                  style={{ background: 'var(--bg-card)', boxShadow: '0 1px 0 var(--border-color)' }}>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="text-center px-3 py-3 text-xs font-bold">#</th>
                    <th className="text-right px-4 py-3 text-xs font-bold">المنتج</th>
                    <th className="text-center px-3 py-3 text-xs font-bold whitespace-nowrap">الكمية</th>
                    <th className="text-center px-3 py-3 text-xs font-bold whitespace-nowrap">الإيراد</th>
                    <th className="text-center px-3 py-3 text-xs font-bold whitespace-nowrap">الربح</th>
                    <th className="text-right px-3 py-3 text-xs font-bold whitespace-nowrap w-40">المساهمة</th>
                    <th className="text-center px-3 py-3 text-xs font-bold whitespace-nowrap">التراكمي</th>
                    <th className="text-center px-3 py-3 text-xs font-bold">الفئة</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-25" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                          لا توجد منتجات مطابقة للفلاتر الحالية
                        </p>
                      </td>
                    </tr>
                  ) : filtered.map(p => {
                    const meta = CLASS_META[p.class]
                    // الشريط يُقاس نسبةً لأعلى منتج، وإلا بدت كل الأشرطة صفرًا تقريبًا
                    const barPct = topShare > 0 ? Math.max(2, (p.sharePct / topShare) * 100) : 0
                    return (
                      <tr key={p.productId}
                        className="transition-colors hover:bg-blue-50/40"
                        // حدّ جانبي بلون الفئة ⇒ نطاقات A/B/C تُقرأ أثناء التمرير
                        style={{ borderTop: '1px solid var(--border-color)', borderRight: `3px solid ${meta.color}` }}>
                        <td className="px-3 py-2.5 text-center text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{p.rank}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                          {/* القسم صار سطرًا ثانويًا بدل عمود مستقلّ — عرض أقلّ وقراءة أوضح */}
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.category}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">{fmt(p.quantity)}</td>
                        <td className="px-3 py-2.5 text-center font-bold tabular-nums whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(p.revenue)}
                        </td>
                        <td className={`px-3 py-2.5 text-center font-bold tabular-nums whitespace-nowrap ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatCurrency(p.profit)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[48px]"
                              style={{ background: 'var(--bg-hover, rgba(148,163,184,0.18))' }}>
                              <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: meta.color }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {p.sharePct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        {/* التراكمي كان يُجلب من الخادم ولا يُعرض — وهو جوهر تصنيف ABC */}
                        <td className="px-3 py-2.5 text-center text-xs font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {p.cumulativePct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black border ${meta.badge}`}>{p.class}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
