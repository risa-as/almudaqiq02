'use client'

import { useEffect, useState } from 'react'
import { GitCompare, TrendingUp } from 'lucide-react'

interface BranchStats {
  branchId: string
  branchName: string
  totalSales: number
  totalExpenses: number
  netProfit: number
  saleCount: number
  avgTicket: number
}

export default function BranchComparisonPage() {
  const [data, setData] = useState<BranchStats[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/branches/comparison?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => setData(d.branches ?? []))
      .finally(() => setLoading(false))
  }, [startDate, endDate])

  const fmt = (n: number) =>
    new Intl.NumberFormat('ar-IQ', { style: 'decimal', maximumFractionDigits: 0 }).format(n)

  const maxSales = Math.max(...data.map(b => b.totalSales), 1)

  return (
    <div dir="rtl" className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
              <GitCompare size={22} color="white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            مقارنة أداء الفروع
          </h1>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <span className="text-gray-500 text-sm">—</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-center text-gray-400 py-12">لا توجد بيانات للفترة المحددة</p>
      ) : (
        <>
          {/* Bar chart visualization */}
          <div className="space-y-3">
            {data.map((branch, idx) => (
              <div key={branch.branchId} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                    <span className="font-semibold text-gray-800">{branch.branchName}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-blue-600">{fmt(branch.totalSales)} د.ع</span>
                  </div>
                </div>

                {/* Sales bar */}
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(branch.totalSales / maxSales) * 100}%` }}
                  />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500">
                  <div>
                    <span className="block text-gray-400">الإيرادات</span>
                    <span className="font-semibold text-gray-700">{fmt(branch.totalSales)}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400">المصاريف</span>
                    <span className="font-semibold text-red-500">{fmt(branch.totalExpenses)}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400">صافي الربح</span>
                    <span className={`font-semibold ${branch.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {fmt(branch.netProfit)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-400">متوسط الفاتورة</span>
                    <span className="font-semibold text-gray-700">{fmt(branch.avgTicket)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {['الفرع', 'الإيرادات', 'المصاريف', 'الربح الصافي', 'الفواتير', 'متوسط الفاتورة'].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(b => (
                  <tr key={b.branchId} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{b.branchName}</td>
                    <td className="px-4 py-3 text-blue-600">{fmt(b.totalSales)}</td>
                    <td className="px-4 py-3 text-red-500">{fmt(b.totalExpenses)}</td>
                    <td className={`px-4 py-3 font-semibold ${b.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmt(b.netProfit)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.saleCount}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(b.avgTicket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
