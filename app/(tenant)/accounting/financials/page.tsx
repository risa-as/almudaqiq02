"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Receipt,
  Download,
  Printer,
  Filter,
  AlertTriangle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Package,
  RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { exportToCSV } from "@/lib/export";
import { useBranch } from "@/contexts/BranchContext";

interface FinancialData {
  financials: {
    revenue: number;        // net revenue (gross − returns)
    grossRevenue?: number;
    returns?: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    margin: number;
  };
  salesList: any[];
  expensesList: any[];
  chartData: any[];
}

const DATE_OPTIONS = [
  { value: "TODAY", label: "اليوم" },
  { value: "YESTERDAY", label: "الأمس" },
  { value: "THIS_MONTH", label: "هذا الشهر" },
  { value: "CUSTOM", label: "فترة مخصصة" },
];

export default function FinancialReportPage() {
  usePageTitle('الملخص المالي');
  const { selectedBranch, loading: branchLoading } = useBranch();
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("THIS_MONTH");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });

  useEffect(() => {
    if (branchLoading) return;
    if (dateFilter === "CUSTOM" && (!customDates.start || !customDates.end))
      return;
    fetchData();
  }, [dateFilter, customDates, selectedBranch, branchLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      let start = new Date(),
        end = new Date();

      if (dateFilter === "TODAY") {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (dateFilter === "YESTERDAY") {
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
      } else if (dateFilter === "THIS_MONTH") {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end.setHours(23, 59, 59, 999);
      } else if (dateFilter === "CUSTOM") {
        start = new Date(customDates.start);
        start.setHours(0, 0, 0, 0);
        end = new Date(customDates.end);
        end.setHours(23, 59, 59, 999);
      }

      let url = `/api/reports/financials?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      if (selectedBranch?.id && selectedBranch.id !== "all")
        url += `&branchId=${selectedBranch.id}`;

      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isSingleDay = useMemo(() => {
    if (dateFilter === "TODAY" || dateFilter === "YESTERDAY") return true;
    if (
      dateFilter === "CUSTOM" &&
      customDates.start &&
      customDates.end &&
      customDates.start === customDates.end
    )
      return true;
    return false;
  }, [dateFilter, customDates]);

  const fin = data?.financials ?? {
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    operatingExpenses: 0,
    netProfit: 0,
    margin: 0,
  };
  const chartData = data?.chartData ?? [];
  const isProfit = fin.netProfit >= 0;

  const handleExport = () => {
    if (!data) return;
    exportToCSV(
      `Financial_Report_${new Date().toISOString().split("T")[0]}`,
      ["البند", "القيمة (د.ع)"],
      [
        ["إجمالي المبيعات", fin.grossRevenue ?? fin.revenue],
        ["المرتجعات", fin.returns ?? 0],
        ["صافي الإيرادات", fin.revenue],
        ["تكلفة البضاعة المباعة", fin.cogs],
        ["مجمل الربح", fin.grossProfit],
        ["المصروفات التشغيلية", fin.operatingExpenses],
        ["صافي الربح / الخسارة", fin.netProfit],
        ["هامش الربح (%)", fin.margin.toFixed(2)],
      ],
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 text-right min-w-[180px]"
        dir="rtl"
      >
        <p className="font-bold text-slate-700 text-sm mb-3 pb-2 border-b border-slate-100">
          {label}
        </p>
        {payload.map((e: any, i: number) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 text-xs font-semibold mt-1.5"
          >
            <span className="text-slate-500">
              {e.name === "revenue" ? "الإيرادات" : "صافي الربح"}
            </span>
            <span style={{ color: e.color }} className="font-bold">
              {formatCurrency(e.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="space-y-8 animate-fade-in-up" dir="rtl">
      <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 12px 40px rgba(16,185,129,0.4)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
            <BarChart3 size={36} className="text-white relative z-10 sk-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
            style={{ background: 'linear-gradient(135deg,#34d399,#10b981)', boxShadow: '0 2px 8px rgba(16,185,129,0.5)' }} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-xl font-black text-slate-800">جاري تحميل التقرير المالي</p>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
          <p className="text-sm text-slate-400 font-medium">يتم احتساب الإيرادات والأرباح والمصروفات</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton w-9 h-9 rounded-xl" />
            </div>
            <div className="skeleton h-8 w-28" />
            <div className="skeleton h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5 space-y-4" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-56 rounded-xl" />
        </div>
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-40 w-40 rounded-full mx-auto" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <div className="skeleton w-2.5 h-2.5 rounded-full mt-0.5" />
                <div className="skeleton h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg,#10b981 0%,#059669 100%)",
              boxShadow: "0 10px 28px rgba(16,185,129,.35)",
            }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background:
                  "linear-gradient(135deg,rgba(255,255,255,.4) 0%,transparent 60%)",
              }}
            />
            <BarChart3 className="w-6 h-6 text-white relative z-10" />
          </div>
          <div>
            <h1
              className="text-2xl font-black"
              style={{
                background: "linear-gradient(135deg,#0f172a,#334155)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              قائمة الدخل (الأرباح والخسائر)
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">
              تحليل مالي شامل للفترة المحددة
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Date filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter size={14} className="text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {DATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {dateFilter === "CUSTOM" && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <input
                type="date"
                className="text-sm text-slate-700 font-medium outline-none bg-transparent"
                value={customDates.start}
                onChange={(e) =>
                  setCustomDates({ ...customDates, start: e.target.value })
                }
              />
              <span className="text-slate-300 text-sm">—</span>
              <input
                type="date"
                className="text-sm text-slate-700 font-medium outline-none bg-transparent"
                value={customDates.end}
                onChange={(e) =>
                  setCustomDates({ ...customDates, end: e.target.value })
                }
              />
            </div>
          )}

          <button onClick={handleExport} className="btn-success">
            <Download size={16} /> تصدير
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          {
            label: "صافي الإيرادات",
            sublabel: "Net Revenue",
            value: fin.revenue,
            icon: ShoppingCart,
            gradient: "linear-gradient(135deg,#3b82f6,#2563eb)",
            shadow: "rgba(59,130,246,.25)",
            positive: true,
          },
          {
            label: "المرتجعات",
            sublabel: "Returns",
            value: fin.returns ?? 0,
            icon: RotateCcw,
            gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
            shadow: "rgba(239,68,68,.25)",
            positive: false,
          },
          {
            label: "تكلفة البضاعة",
            sublabel: "COGS",
            value: fin.cogs,
            icon: Package,
            gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
            shadow: "rgba(245,158,11,.25)",
            positive: false,
          },
          {
            label: "المصروفات التشغيلية",
            sublabel: "Operating Expenses",
            value: fin.operatingExpenses,
            icon: Receipt,
            gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
            shadow: "rgba(239,68,68,.25)",
            positive: false,
          },
          {
            label: "مجمل الربح",
            sublabel: "Gross Profit",
            value: fin.grossProfit,
            icon: TrendingUp,
            gradient: "linear-gradient(135deg,#10b981,#059669)",
            shadow: "rgba(16,185,129,.25)",
            positive: true,
          },
        ].map(
          ({
            label,
            sublabel,
            value,
            icon: Icon,
            gradient,
            shadow,
            positive,
          }) => (
            <div
              key={label}
              className="glass-panel p-5 relative overflow-hidden group"
            >
              <div
                className="absolute inset-0 opacity-[.04]"
                style={{ background: gradient }}
              />
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: gradient,
                    boxShadow: `0 6px 16px ${shadow}`,
                  }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                {positive ? (
                  <ArrowUpRight size={16} className="text-emerald-500 mt-1" />
                ) : (
                  <ArrowDownRight size={16} className="text-red-400 mt-1" />
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 mb-0.5">{label}</p>
              <p className="text-[10px] text-slate-400 mb-2">{sublabel}</p>
              {loading ? (
                <div className="h-7 bg-slate-200 animate-pulse rounded-lg w-28" />
              ) : (
                <p
                  className={`text-xl font-black ${positive ? "text-slate-900" : "text-slate-700"}`}
                >
                  {positive ? "" : "("}
                  {formatCurrency(value)}
                  {positive ? "" : ")"}
                </p>
              )}
            </div>
          ),
        )}
      </div>

      {/* ── Net Profit Hero + P&L Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Net Profit card */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 text-white"
          style={{
            background: isProfit
              ? "linear-gradient(135deg,#094B9F 0%,#063A8A 100%)"
              : "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)",
            boxShadow: isProfit
              ? "0 16px 40px rgba(9,75,159,.35)"
              : "0 16px 40px rgba(239,68,68,.35)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
            style={{
              background: "radial-gradient(circle,white,transparent)",
              transform: "translate(30%,-30%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10"
            style={{
              background: "radial-gradient(circle,white,transparent)",
              transform: "translate(-30%,30%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest">
                  Net Profit / Loss
                </p>
                <p className="text-white/90 text-sm font-bold mt-0.5">
                  صافي الربح / الخسارة
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                {isProfit ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
              </div>
            </div>

            {loading ? (
              <div className="h-10 bg-white/20 animate-pulse rounded-xl w-36 mb-3" />
            ) : (
              <p className="text-4xl font-black tracking-tight mb-3" dir="ltr">
                {formatCurrency(fin.netProfit)}
              </p>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/20 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-white transition-all"
                  style={{ width: `${Math.min(Math.abs(fin.margin), 100)}%` }}
                />
              </div>
              <span className="text-white/90 text-sm font-black">
                {fin.margin.toFixed(1)}%
              </span>
            </div>
            <p className="text-white/60 text-xs mt-1.5 font-medium">
              هامش الربح الصافي
            </p>
          </div>
        </div>

        {/* P&L Waterfall Breakdown */}
        <div className="lg:col-span-2 glass-panel p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            تفصيل قائمة الدخل
          </h3>
          <div className="space-y-2.5">
            {[
              {
                label: "إجمالي المبيعات",
                value: fin.grossRevenue ?? fin.revenue,
                bar: 100,
                color: "bg-blue-500",
                text: "text-blue-700",
                bg: "bg-blue-50",
                sign: "+",
              },
              {
                label: "المرتجعات",
                value: fin.returns ?? 0,
                bar: (fin.grossRevenue ?? fin.revenue) ? ((fin.returns ?? 0) / (fin.grossRevenue ?? fin.revenue)) * 100 : 0,
                color: "bg-rose-400",
                text: "text-rose-600",
                bg: "bg-rose-50",
                sign: "−",
              },
              {
                label: "صافي الإيرادات",
                value: fin.revenue,
                bar: (fin.grossRevenue ?? fin.revenue) ? (fin.revenue / (fin.grossRevenue ?? fin.revenue)) * 100 : 0,
                color: "bg-blue-500",
                text: "text-blue-700",
                bg: "bg-blue-50",
                sign: "=",
              },
              {
                label: "تكلفة البضاعة (COGS)",
                value: fin.cogs,
                bar: fin.revenue ? (fin.cogs / fin.revenue) * 100 : 0,
                color: "bg-blue-400",
                text: "text-blue-700",
                bg: "bg-blue-50",
                sign: "−",
              },
              {
                label: "مجمل الربح",
                value: fin.grossProfit,
                bar: fin.revenue ? (fin.grossProfit / fin.revenue) * 100 : 0,
                color: "bg-emerald-500",
                text: "text-emerald-700",
                bg: "bg-emerald-50",
                sign: "=",
              },
              {
                label: "المصروفات التشغيلية",
                value: fin.operatingExpenses,
                bar: fin.revenue
                  ? (fin.operatingExpenses / fin.revenue) * 100
                  : 0,
                color: "bg-red-400",
                text: "text-red-600",
                bg: "bg-red-50",
                sign: "−",
              },
              {
                label: "صافي الربح / الخسارة",
                value: fin.netProfit,
                bar: fin.revenue
                  ? Math.abs(fin.netProfit / fin.revenue) * 100
                  : 0,
                color: isProfit ? "bg-blue-500" : "bg-red-500",
                text: isProfit ? "text-blue-700" : "text-red-700",
                bg: isProfit ? "bg-blue-50" : "bg-red-50",
                sign: "=",
              },
            ].map((row) => (
              <div
                key={row.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${row.bg}`}
              >
                <span
                  className={`w-5 text-center text-sm font-black ${row.text} shrink-0`}
                >
                  {row.sign}
                </span>
                <span className="text-xs font-bold text-slate-600 w-44 shrink-0">
                  {row.label}
                </span>
                <div className="flex-1 bg-white/60 rounded-full h-1.5 overflow-hidden">
                  {!loading && (
                    <div
                      className={`h-full rounded-full ${row.color} transition-all duration-700`}
                      style={{
                        width: `${Math.min(Math.max(row.bar, 0), 100)}%`,
                      }}
                    />
                  )}
                </div>
                {loading ? (
                  <div className="h-4 bg-slate-200 animate-pulse rounded w-20 shrink-0" />
                ) : (
                  <span
                    className={`text-sm font-black ${row.text} shrink-0 w-28 text-left`}
                    dir="ltr"
                  >
                    {formatCurrency(row.value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Revenue Trend Chart ── */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg,#3b82f6,#094B9F)",
                boxShadow: "0 6px 16px rgba(9,75,159,.25)",
              }}
            >
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                مسار الإيرادات والأرباح
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تطور الأداء المالي خلال الفترة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl">
            {[
              { color: "#3b82f6", label: "الإيرادات" },
              { color: "#10b981", label: "صافي الربح" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ background: l.color }}
                />
                <span className="text-xs font-bold text-slate-600">
                  {l.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-64 bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center">
            <p className="text-slate-400 text-sm font-medium">
              جاري تحميل البيانات...
            </p>
          </div>
        ) : chartData.length > 1 ? (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)} مليون`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(0)} الف`
                        : String(v)
                  }
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#gradRevenue)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#3b82f6" }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#gradProfit)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-3">
            <BarChart3 className="w-10 h-10 text-slate-300" />
            <p className="text-slate-400 text-sm font-medium">
              لا تتوافر بيانات كافية للرسم المدققي في هذه الفترة
            </p>
          </div>
        )}
      </div>

      {/* ── Daily Details (single-day mode) ── */}
      {isSingleDay && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sales table */}
          <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-white/40"
              style={{
                background:
                  "linear-gradient(135deg,rgba(16,185,129,.06) 0%,transparent 60%)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#10b981,#059669)",
                    boxShadow: "0 4px 12px rgba(16,185,129,.3)",
                  }}
                >
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-bold text-slate-700 text-sm">
                  مبيعات اليوم
                </h4>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full">
                {data.salesList?.length ?? 0} حركة
              </span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-right data-table">
                <thead className="bg-gray-50/50 border-b border-[var(--border-color)] sticky top-0">
                  <tr>
                    {["المنتج", "الكمية", "الإيراد", "التكلفة"].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {!data.salesList?.length ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        لا توجد مبيعات
                      </td>
                    </tr>
                  ) : (
                    data.salesList.map((s: any, i: number) => (
                      <tr
                        key={i}
                        className="hover:bg-blue-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800 text-sm">
                            {s.productName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {s.unitName}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700 text-sm">
                          {s.quantity}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-emerald-600 text-sm">
                            {formatCurrency(s.price * s.quantity)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-red-400 text-sm">
                            {formatCurrency(s.cost)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses table */}
          <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-white/40"
              style={{
                background:
                  "linear-gradient(135deg,rgba(239,68,68,.06) 0%,transparent 60%)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    boxShadow: "0 4px 12px rgba(239,68,68,.3)",
                  }}
                >
                  <Receipt className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-bold text-slate-700 text-sm">
                  مصروفات اليوم
                </h4>
              </div>
              <span className="text-xs bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded-full">
                {data.expensesList?.length ?? 0} حركة
              </span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-right data-table">
                <thead className="bg-gray-50/50 border-b border-[var(--border-color)] sticky top-0">
                  <tr>
                    {["المدقق", "القسم", "المبلغ"].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {!data.expensesList?.length ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        لا توجد مصروفات
                      </td>
                    </tr>
                  ) : (
                    data.expensesList.map((ex: any, i: number) => (
                      <tr
                        key={i}
                        className="hover:bg-blue-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                          {ex.title}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded-lg">
                            {ex.category || "عام"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-red-500 text-sm">
                            {formatCurrency(Number(ex.amount))}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Accounting Note ── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-blue-800 mb-0.5">
            ملاحظة محاسبية
          </p>
          <p className="text-xs text-blue-700 leading-relaxed">
            يتم احتساب تكلفة البضاعة المباعة (COGS) بناءً على سعر التكلفة المسجل
            لكل منتج وقت البيع. المصروفات التشغيلية تشمل جميع الرواتب والإيجارات
            والفواتير المسجلة في قسم المصروفات.
          </p>
        </div>
      </div>
    </div>
  );
}
