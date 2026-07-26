"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetcher";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Banknote,
  Clock,
  Users,
  ShoppingBag,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CalendarRange,
  Receipt,
  LineChart,
  BarChart3,
  Trophy,
  Activity,
  PieChart,
  ArrowDownToLine,
  Building2,
  Shield,
  Wallet,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { HowItWorks } from "@/components/ui/HowItWorks";
import PageHeader from "@/components/ui/PageHeader";
import { formatCurrency } from "@/lib/format";
import { useBranch } from "@/contexts/BranchContext";

interface DashData {
  today: { sales: number; txCount: number; returns?: number; netSales?: number };
  thisWeek: { sales: number; txCount: number };
  prevWeek: { sales: number; txCount: number };
  weekGrowth: number | null;
  avgTxValue: number;
  refundRate: number;
  refundCount: number;
  paymentBreakdown: {
    CASH: number;
    CARD: number;
    CREDIT: number;
    SPLIT: number;
  };
  topProducts: { name: string; qty: number }[];
  sparkline: { label: string; total: number }[];
  dayOfWeek: { label: string; total: number }[];
  debtTotal: number;
  debtors: number;
  totalCustomers: number;
}

function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Sparkline({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-14">
      {data.map((d, i) => {
        const pct = Math.max((d.total / max) * 100, 4);
        const isToday = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-sm transition-all ${isToday ? "bg-blue-500" : "bg-blue-200"}`}
              style={{ height: `${pct}%` }}
              title={`${d.label}: ${formatCurrency(d.total)}`}
            />
            <span className="text-[9px] text-gray-400 leading-none">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GrowthChip({ pct }: { pct: number | null }) {
  if (pct === null)
    return <span className="text-xs text-gray-400">لا يوجد مقارنة</span>;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
    >
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function ReportsDashboard() {
  usePageTitle('التقارير');
  const { selectedBranch, loading: branchLoading } = useBranch();
  const bId = selectedBranch?.id ?? "all";
  const q =
    selectedBranch?.id && selectedBranch.id !== "all"
      ? `?branchId=${selectedBranch.id}`
      : "";
  const dashQuery = useQuery({
    queryKey: ["report-dashboard", bId],
    queryFn: () => fetchJson<DashData>(`/api/reports/dashboard${q}`),
    enabled: !branchLoading,
  });
  const data = dashQuery.data ?? null;
  const loading = branchLoading || dashQuery.isPending;

  if (loading)
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
        {/* Hero */}
        <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
              <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
              <Activity size={36} className="text-white relative z-10 sk-spin" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
              style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-xl font-black text-slate-800">جاري تحميل لوحة التقارير</p>
            <div className="flex items-center justify-center gap-1.5">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
            <p className="text-sm text-slate-400 font-medium">يتم تجميع إحصائيات المبيعات والمخزون</p>
          </div>
        </div>
        {/* KPI skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton w-9 h-9 rounded-xl" />
              </div>
              <div className="skeleton h-7 w-24" />
              <div className="skeleton h-2.5 w-16" />
            </div>
          ))}
        </div>
        {/* Chart skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[{ cols: 'lg:col-span-2', h: 'h-56' }, { cols: 'lg:col-span-1', h: 'h-56' }, { cols: 'lg:col-span-3', h: 'h-48' }].map((c, i) => (
            <div key={i} className={`${c.cols} rounded-2xl p-5 space-y-3`} style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div className="skeleton h-4 w-32" />
              <div className={`skeleton ${c.h} rounded-xl`} />
            </div>
          ))}
        </div>
      </div>
    );

  if (!data) return null;

  const payTotal =
    data.paymentBreakdown.CASH +
    data.paymentBreakdown.CARD +
    data.paymentBreakdown.CREDIT +
    data.paymentBreakdown.SPLIT;
  const maxDow = Math.max(...data.dayOfWeek.map((d) => d.total), 1);
  const maxProd = Math.max(...data.topProducts.map((p) => p.qty), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
      {/* ── Header ── */}
      <PageHeader
        title="لوحة التقارير التنفيذية"
        subtitle="مقاييس تفصيلية وحصرية — آخر تحديث الآن"
        icon={BarChart3}
        gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
        actions={
          <HowItWorks
            label="كيف تقرأ التقارير؟"
            title="كيف تعمل لوحة التقارير؟"
            steps={[
              {
                icon: CalendarRange,
                title: "مبيعات اليوم وهذا الأسبوع",
                description:
                  "أول صف يعرض مبيعات اليوم، مقارنة الأسبوع الحالي بالسابق، متوسط قيمة الفاتورة، ومعدل الاسترداد.",
                gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
                shadow: "rgba(9,75,159,0.3)",
              },
              {
                icon: BarChart2,
                title: "مبيعات آخر 7 أيام",
                description:
                  "مخطط أعمدة يوضح مجموع المبيعات اليومية خلال الأسبوع الأخير، مع تمييز اليوم الحالي.",
                gradient: "linear-gradient(135deg,#094B9F,#073D82)",
                shadow: "rgba(9,75,159,0.3)",
              },
              {
                icon: Banknote,
                title: "توزيع طرق الدفع",
                description:
                  "يُظهر النسب بين الكاش، الشبكة، والآجل خلال آخر 30 يوماً — مفيد لمعرفة عادات العملاء.",
                gradient: "linear-gradient(135deg,#10b981,#059669)",
                shadow: "rgba(16,185,129,0.3)",
              },
              {
                icon: Users,
                title: "الذمم المدينة (آجل)",
                description:
                  "يعرض إجمالي الديون المستحقة وعدد العملاء الذين لديهم رصيد آجل من إجمالي العملاء.",
                gradient: "linear-gradient(135deg,#f97316,#ea580c)",
                shadow: "rgba(249,115,22,0.3)",
              },
              {
                icon: BarChart3,
                title: "أكثر 5 منتجات مبيعاً",
                description:
                  "قائمة المنتجات الأعلى مبيعاً في آخر 30 يوماً مرتبةً تنازلياً حسب الكمية المباعة.",
                gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
                shadow: "rgba(245,158,11,0.3)",
              },
              {
                icon: LineChart,
                title: "توزيع المبيعات حسب يوم الأسبوع",
                description:
                  "يُظهر إجمالي مبيعات كل يوم مجمّعةً من آخر 30 يوماً — يساعد في معرفة أكثر الأيام نشاطاً تاريخياً.",
                gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
                shadow: "rgba(14,99,212,0.3)",
              },
            ]}
          />
        }
      />

      {/* ── Row 1: 4 KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today sales */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">
              صافي إيرادات اليوم
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <TrendingUp size={15} className="text-blue-600" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-gray-900">
            {formatCurrency(data.today.netSales ?? data.today.sales)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {(data.today.returns ?? 0) > 0
              ? `إجمالي ${formatCurrency(data.today.sales)} − مرتجعات ${formatCurrency(data.today.returns ?? 0)} • ${data.today.txCount} فاتورة`
              : `${data.today.txCount} فاتورة اليوم`}
          </p>
        </div>

        {/* Week vs prev week */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">
              هذا الأسبوع
            </span>
            <GrowthChip pct={data.weekGrowth} />
          </div>
          <p className="text-xl font-extrabold text-gray-900">
            {formatCurrency(data.thisWeek.sales)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            الأسبوع السابق: {formatCurrency(data.prevWeek.sales)}
          </p>
        </div>

        {/* Avg transaction value */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">
              متوسط قيمة الفاتورة
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShoppingBag size={15} className="text-blue-600" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-gray-900">
            {formatCurrency(data.avgTxValue)}
          </p>
          <p className="text-xs text-gray-400 mt-1">آخر 30 يوماً</p>
        </div>

        {/* Refund rate */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">
              معدل الاسترداد
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <RefreshCw size={15} className="text-blue-600" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-gray-900">
            {data.refundRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {data.refundCount} عملية استرداد
          </p>
        </div>
      </div>

      {/* ── Row 2: Sparkline + Payment + Debt ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 7-day sparkline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">
              مبيعات آخر 7 أيام
            </h3>
            <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
              أسبوعي
            </span>
          </div>
          <Sparkline data={data.sparkline} />
          <div className="flex justify-between mt-3 text-xs text-gray-400">
            <span>
              إجمالي:{" "}
              <strong className="text-gray-700">
                {formatCurrency(data.thisWeek.sales)}
              </strong>
            </span>
            <span>{data.thisWeek.txCount} فاتورة</span>
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">
            توزيع طرق الدفع{" "}
            <span className="text-xs font-normal text-gray-400">(30 يوم)</span>
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "نقد",
                value: data.paymentBreakdown.CASH,
                icon: Banknote,
                color: "bg-emerald-500",
                text: "text-emerald-700",
                bg: "bg-emerald-50",
              },
              {
                label: "بطاقة",
                value: data.paymentBreakdown.CARD,
                icon: CreditCard,
                color: "bg-blue-500",
                text: "text-blue-700",
                bg: "bg-blue-50",
              },
              {
                label: "آجل",
                value: data.paymentBreakdown.CREDIT,
                icon: Clock,
                color: "bg-orange-500",
                text: "text-orange-700",
                bg: "bg-orange-50",
              },
            ].map(({ label, value, icon: Icon, color, text, bg }) => {
              const pct =
                payTotal > 0 ? ((value / payTotal) * 100).toFixed(0) : "0";
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-5 h-5 rounded-md ${bg} flex items-center justify-center`}
                      >
                        <Icon size={11} className={text} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${text}`}>
                        {pct}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatCurrency(value)}
                      </span>
                    </div>
                  </div>
                  <MiniBar value={value} max={payTotal} color={color} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer debt */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">
            الذمم المدينة (آجل)
          </h3>
          <div className="flex flex-col items-center justify-center h-28 gap-2">
            <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
              <Users size={24} className="text-orange-600" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatCurrency(data.debtTotal)}
            </p>
            <p className="text-xs text-gray-400">
              {data.debtors} عميل من أصل {data.totalCustomers} لديهم رصيد مستحق
            </p>
          </div>
          <div className="mt-3">
            <MiniBar
              value={data.debtors}
              max={data.totalCustomers}
              color="bg-orange-400"
            />
          </div>
        </div>
      </div>

      {/* ── Quick Navigation Cards ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-blue-500" />
          <h2 className="text-sm font-black text-gray-800">
            الوصول السريع للتقارير
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            {
              href: "/reports/sales",
              icon: TrendingUp,
              label: "تقرير المبيعات",
              desc: "فواتير وإيرادات وكاشيرين",
              gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
              shadow: "rgba(9,75,159,0.2)",
            },
            {
              href: "/reports/inventory",
              icon: PieChart,
              label: "تقرير المخزون",
              desc: "نواقص وتنبيهات الانتهاء",
              gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
              shadow: "rgba(245,158,11,0.2)",
            },
            {
              href: "/reports/analytics",
              icon: BarChart3,
              label: "لوحة التحليلات",
              desc: "تحليل متقدم وتوقعات",
              gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
              shadow: "rgba(14,99,212,0.2)",
            },
            {
              href: "/reports/stock-movement",
              icon: Activity,
              label: "حركة المخزون",
              desc: "وارد وصادر ومخزون",
              gradient: "linear-gradient(135deg,#06b6d4,#0891b2)",
              shadow: "rgba(6,182,212,0.2)",
            },
            {
              href: "/reports/branches",
              icon: Building2,
              label: "مقارنة الفروع",
              desc: "أداء كل فرع مقارنةً",
              gradient: "linear-gradient(135deg,#10b981,#059669)",
              shadow: "rgba(16,185,129,0.2)",
            },

            {
              href: "/reports/audit",
              icon: Shield,
              label: "سجل المراجعة",
              desc: "جميع عمليات النظام",
              gradient: "linear-gradient(135deg,#64748b,#475569)",
              shadow: "rgba(100,116,139,0.2)",
            },
            {
              href: "/reports/customers-debt",
              icon: Users,
              label: "ذمم العملاء",
              desc: "الديون المستحقة والتقادم",
              gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
              shadow: "rgba(239,68,68,0.2)",
            },
            {
              href: "/inventory/expiry",
              icon: CalendarRange,
              label: "إدارة الصلاحيات",
              desc: "الدفعات المنتهية والحرجة",
              gradient: "linear-gradient(135deg,#f97316,#ea580c)",
              shadow: "rgba(249,115,22,0.2)",
            },
          ].map(({ href, icon: Icon, label, desc, gradient, shadow }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              style={{ ["--hover-shadow" as string]: `0 8px 24px ${shadow}` }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.boxShadow =
                  `0 8px 24px ${shadow}`)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.boxShadow = "")
              }
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden"
                style={{
                  background: gradient,
                  boxShadow: `0 4px 12px ${shadow}`,
                }}
              >
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    background:
                      "linear-gradient(135deg,rgba(255,255,255,0.5),transparent)",
                  }}
                />
                <Icon size={18} className="text-white relative z-10" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 leading-tight">
                  {label}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {desc}
                </p>
              </div>
              <ArrowLeft
                size={14}
                className="text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors"
              />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Row 3: Top products + Day of week ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">
            أكثر 5 منتجات مبيعاً{" "}
            <span className="text-xs font-normal text-gray-400">(30 يوم)</span>
          </h3>
          {data.topProducts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              لا توجد مبيعات بعد
            </p>
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${i === 0 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-gray-800 truncate max-w-[180px]">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-blue-700">
                      {p.qty} وحدة
                    </span>
                  </div>
                  <MiniBar value={p.qty} max={maxProd} color="bg-blue-400" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day of week heatmap */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-800">
              توزيع المبيعات حسب يوم الأسبوع{" "}
              <span className="text-xs font-normal text-gray-400">
                (30 يوم)
              </span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              إجمالي مبيعات كل يوم مجمّعة من آخر 30 يوماً
            </p>
          </div>
          <div className="space-y-2.5">
            {data.dayOfWeek.map((d) => {
              const isTop = d.total > 0 && d.total === maxDow;
              return (
                <div key={d.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {isTop ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                          <Trophy size={9} />
                          الأعلى
                        </span>
                      ) : (
                        <span className="w-[52px]" />
                      )}
                      <span
                        className={`text-xs font-medium ${isTop ? "text-gray-900 font-bold" : "text-gray-700"}`}
                      >
                        {d.label}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold ${isTop ? "text-violet-700" : "text-gray-500"}`}
                    >
                      {formatCurrency(d.total)}
                    </span>
                  </div>
                  <MiniBar
                    value={d.total}
                    max={maxDow}
                    color={isTop ? "bg-violet-500" : "bg-violet-200"}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
