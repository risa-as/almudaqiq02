"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar, Filter, User, Download, TrendingUp,
  CreditCard, Banknote, Clock, RotateCcw, ChevronRight, ChevronLeft,
  ShoppingBag, ExternalLink,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { exportToCSV } from "@/lib/export";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useBranch } from "@/contexts/BranchContext";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";

interface SalesData {
  totalSales: number;
  transactionCount: number;
  totalReturns?: number;
  returnCount?: number;
  netRevenue?: number;
  netProfit?: number;
  transactions: any[];
  chartData: { name: string; value: number }[];
  salesByCategory?: { name: string; value: number }[];
}

const PAGE_SIZE = 25;

export default function SalesReportPage() {
  usePageTitle('تقرير المبيعات');
  const { selectedBranch, loading: branchLoading } = useBranch();
  const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate]     = useState(() => new Date().toISOString().split('T')[0]);
  const [userId, setUserId]       = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [data, setData]           = useState<SalesData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [users, setUsers]         = useState<{ id: number; username: string }[]>([]);
  const [page, setPage]           = useState(1);

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (branchLoading) return;
    fetchSales();
  }, [startDate, endDate, userId, selectedBranch, branchLoading]);

  useEffect(() => { setPage(1); }, [startDate, endDate, userId, paymentFilter]);

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period: 'custom', userId, startDate, endDate });
      if (selectedBranch?.id && selectedBranch.id !== "all") {
        params.append("branchId", selectedBranch.id);
      }
      const res = await fetch(`/api/reports/sales?${params}`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const handleDateChange = (s: string, e: string) => { setStartDate(s); setEndDate(e); };

  // ── Client-side derived data ──────────────────────────────────────────────
  const allTxs = data?.transactions ?? [];

  // Returns come from the API (the transactions list holds SALE rows only, so
  // deriving them client-side would always be 0).
  const refundTotal = Number(data?.totalReturns ?? 0);
  const refundCount = Number(data?.returnCount ?? 0);

  const filteredTxs = useMemo(() => {
    const sales = allTxs.filter((tx: any) => tx.type !== 'REFUND' && tx.type !== 'RETURN');
    if (paymentFilter === 'ALL') return sales;
    return sales.filter((tx: any) => tx.paymentMethod === paymentFilter);
  }, [allTxs, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / PAGE_SIZE));
  const paginatedTxs = filteredTxs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportExcel = () => {
    if (!data) return;
    const headers = ["رقم الفاتورة", "التوقيت", "الكاشير", "طريقة الدفع", "الإجمالي"];
    const rows = filteredTxs.map((tx: any) => [
      `#${tx.id}`,
      new Date(tx.date).toLocaleString("ar-EG"),
      tx.user?.username || "System",
      tx.paymentMethod || '—',
      tx.totalAmount,
    ]);
    exportToCSV(`Sales_Report_${startDate}_${endDate}`, headers, rows);
  };

  const paymentLabel: Record<string, string> = {
    CASH: 'نقد', CARD: 'بطاقة', CREDIT: 'آجل', SPLIT: 'مختلط',
  };

  const paymentColor: Record<string, string> = {
    CASH: 'bg-emerald-100 text-emerald-700',
    CARD: 'bg-blue-100 text-blue-700',
    CREDIT: 'bg-orange-100 text-orange-700',
    SPLIT: 'bg-violet-100 text-violet-700',
  };

  if (!initialized) return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
            <ShoppingBag size={36} className="text-white relative z-10 sk-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-xl font-black text-slate-800">جاري تحميل تقرير المبيعات</p>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
          <p className="text-sm text-slate-400 font-medium">يتم تحليل بيانات المبيعات والفواتير</p>
        </div>
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-6 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton w-8 h-8 rounded-xl" />
            </div>
            <div className="skeleton h-9 w-32" />
            <div className="skeleton h-2.5 w-20" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-7 w-24 rounded-lg" />
        </div>
        <div className="skeleton h-52 rounded-xl" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-7 w-20 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              {[90, 70, 55, 65, 48, 52].map((w, j) => (
                <div key={j} className="skeleton h-3 flex-1" style={{ maxWidth: `${w}px` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 report-container" dir="rtl">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #094B9F, #063A8A)", boxShadow: "0 8px 24px rgba(9,75,159,0.25)" }}>
            <div className="absolute inset-0 opacity-25"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)" }} />
            <TrendingUp size={22} className="text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black"
              style={{ background: "linear-gradient(135deg, #0f172a 0%, #063380 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              تقرير المبيعات
            </h1>
            <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
              سجل حركة البيع والرسوم التفصيلية
            </p>
          </div>
        </div>
        <button onClick={handleExportExcel} className="btn-success no-print">
          <Download size={16} /> تصدير CSV
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center p-4 rounded-2xl no-print"
        style={{ background: "var(--bg-card-glass)", backdropFilter: "blur(12px)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center gap-2 font-bold" style={{ color: "var(--text-secondary)" }}>
          <Filter size={16} /><span className="text-sm">تصفية:</span>
        </div>

        {/* Date range */}
        <DateRangeFilter accentColor="indigo" defaultPreset="this_month" onChange={handleDateChange} />

        {/* Cashier */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--bg-page)", border: "1.5px solid var(--border-color)" }}>
          <User size={15} className="text-slate-400" />
          <select value={userId} onChange={e => setUserId(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none min-w-[120px]"
            style={{ color: "var(--text-primary)" }}>
            <option value="ALL">كل الكاشيرات</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        </div>

        {/* Payment method */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--bg-page)", border: "1.5px solid var(--border-color)" }}>
          <CreditCard size={15} className="text-slate-400" />
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none min-w-[110px]"
            style={{ color: "var(--text-primary)" }}>
            <option value="ALL">كل طرق الدفع</option>
            <option value="CASH">نقد</option>
            <option value="CARD">بطاقة</option>
            <option value="CREDIT">آجل</option>
            <option value="SPLIT">مختلط</option>
          </select>
        </div>
      </div>

      {data ? (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: '#eef2ff' }}>
                <Banknote size={18} style={{ color: '#094B9F' }} />
              </div>
              <div className="min-w-0">
                <p className="kpi-label">صافي الإيرادات</p>
                <p className="kpi-value">{formatCurrency(Number(data.netRevenue ?? (data.totalSales - refundTotal)))}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{data.transactionCount} فاتورة</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: '#ecfdf5' }}>
                <ShoppingBag size={18} style={{ color: '#10b981' }} />
              </div>
              <div className="min-w-0">
                <p className="kpi-label">عدد الفواتير</p>
                <p className="kpi-value">{filteredTxs.length}</p>
                {paymentFilter !== 'ALL' && <p className="text-[11px] text-gray-400 mt-0.5">مفلترة — {paymentLabel[paymentFilter]}</p>}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: '#fef2f2' }}>
                <RotateCcw size={18} style={{ color: '#ef4444' }} />
              </div>
              <div className="min-w-0">
                <p className="kpi-label">إجمالي الإرجاعات</p>
                <p className="kpi-value">{formatCurrency(refundTotal)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{refundCount} عملية استرداد</p>
              </div>
            </div>
          </div>

          {/* ── Chart + Category ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 p-6 rounded-2xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}>
              <h3 className="font-bold mb-6 flex items-center gap-2.5" style={{ color: "var(--text-primary)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #094B9F, #063A8A)" }}>
                  <TrendingUp size={14} className="text-white" />
                </div>
                الرسم البياني للمبيعات
              </h3>
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#094B9F" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#094B9F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickFormatter={(v: number) => v === 0 ? "0" : v >= 1000000 ? `${(v / 1000000).toFixed(1)}م` : `${(v / 1000).toFixed(0)}ك`}
                      dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      formatter={(v: any) => [formatCurrency(Number(v) || 0), "المبيعات"]} />
                    <Area type="monotone" dataKey="value" stroke="#094B9F" strokeWidth={2.5}
                      fill="url(#salesGradient)" dot={false} activeDot={{ r: 5, fill: "#094B9F" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-y-auto max-h-[380px]">
              <h3 className="font-bold text-gray-800 mb-4">مبيعات الأقسام</h3>
              <div className="space-y-4">
                {data.salesByCategory?.map((cat, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{cat.name}</span>
                      <span className="font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(cat.value)}</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: "var(--border-color)" }}>
                      <div className="h-2 rounded-full"
                        style={{ width: `${data.totalSales > 0 ? (cat.value / data.totalSales) * 100 : 0}%`, background: "linear-gradient(90deg, #094B9F, #063A8A)" }} />
                    </div>
                  </div>
                ))}
                {(!data.salesByCategory || data.salesByCategory.length === 0) && (
                  <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>لا توجد بيانات للأقسام</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Transactions Table ── */}
          <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-light)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #64748b, #475569)" }}>
                  <Calendar size={14} className="text-white" />
                </div>
                <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>سجل العمليات</h3>
                <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                  {filteredTxs.length} سجل
                </span>
              </div>
              {totalPages > 1 && (
                <span className="text-xs text-slate-400 font-medium">
                  صفحة {page} من {totalPages}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right data-table">
                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">رقم الفاتورة</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الكاشير</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">طريقة الدفع</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedTxs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        لا توجد مبيعات في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    paginatedTxs.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <Link href={`/sales/invoices`}
                            className="flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-800 transition-colors">
                            <span>#{tx.id}</span>
                            <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-600" dir="ltr">
                          {new Date(tx.date).toLocaleString("ar-IQ", { hour12: true, hour: '2-digit', minute: '2-digit', year: 'numeric', month: 'numeric', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="badge badge-primary">{tx.user?.username || "System"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${paymentColor[tx.paymentMethod] || 'bg-slate-100 text-slate-600'}`}>
                            {paymentLabel[tx.paymentMethod] || tx.paymentMethod || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black" style={{ color: "var(--color-primary)" }}>
                          {formatCurrency(Number(tx.totalAmount))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)] bg-gray-50/50">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-white hover:shadow-sm"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                  <ChevronRight size={16} /> السابق
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1
                      : page <= 4 ? i + 1
                      : page >= totalPages - 3 ? totalPages - 6 + i
                      : page - 3 + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${p === page ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}>
                        {p}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-white hover:shadow-sm"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                  التالي <ChevronLeft size={16} />
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
