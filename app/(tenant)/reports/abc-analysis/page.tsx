'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, Search } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import { useBranch } from '@/contexts/BranchContext'
import { usePageTitle } from '@/hooks/usePageTitle'

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
  const [data, setData]           = useState<AbcData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [classFilter, setClassFilter] = useState<AbcClass | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (selectedBranch?.id) params.set('branchId', selectedBranch.id)
      const res = await fetch(`/api/reports/abc-analysis?${params}`)
      const json = await res.json()
      if (res.ok) setData(json)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedBranch?.id])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.products.filter(p =>
      (classFilter === 'all' || p.class === classFilter) &&
      (!search.trim() || p.name.includes(search.trim()) || p.category.includes(search.trim()))
    )
  }, [data, search, classFilter])

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
          {/* Class cards + pie */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {(['A', 'B', 'C'] as AbcClass[]).map(k => {
              const c = data.summary.classes[k]
              const meta = CLASS_META[k]
              return (
                <div key={k} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black border ${meta.badge}`}>{meta.label}</span>
                    <span className="text-xs font-black" style={{ color: meta.color }}>{c.revenueShare.toFixed(1)}%</span>
                  </div>
                  <p className="text-2xl font-black mt-2" style={{ color: 'var(--text-primary)' }}>{c.count}</p>
                  <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>منتج — إيراد {fmt(c.revenue)}</p>
                  <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{meta.desc}</p>
                </div>
              )
            })}
            <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} dir="ltr">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString()} contentStyle={{ fontSize: 11 }} />
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="text-center px-3 py-3 text-xs font-bold">#</th>
                    <th className="text-right px-4 py-3 text-xs font-bold">المنتج</th>
                    <th className="text-right px-4 py-3 text-xs font-bold">القسم</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">الكمية</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">الإيراد</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">الربح</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">المساهمة</th>
                    <th className="text-center px-4 py-3 text-xs font-bold">الفئة</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.productId} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="px-3 py-2.5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>{p.rank}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{p.category}</td>
                      <td className="px-4 py-2.5 text-center">{fmt(p.quantity)}</td>
                      <td className="px-4 py-2.5 text-center font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(p.revenue)}</td>
                      <td className={`px-4 py-2.5 text-center font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(p.profit)}</td>
                      <td className="px-4 py-2.5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>{p.sharePct.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black border ${CLASS_META[p.class].badge}`}>{p.class}</span>
                      </td>
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
