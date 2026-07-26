"use client";
import { usePageTitle } from '@/hooks/usePageTitle';
import Link from "next/link";
import {
  ShoppingCart, Package, AlertTriangle, BarChart3,
  TrendingDown, TrendingUp, Activity, ArrowLeft, Users,
  FileText, ArrowDownToLine, Tag, Zap, Receipt,
  LayoutDashboard, Settings2, Award,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchJsonOr } from "@/lib/query/fetcher";
import StatCard from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/format";
import { useBranch } from "@/contexts/BranchContext";
import { HowItWorks } from "@/components/ui/HowItWorks";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from "recharts";

interface DashData {
  today: { sales: number; returns: number; netSales: number; txCount: number };
  thisWeek: { sales: number; txCount: number };
  prevWeek: { sales: number; txCount: number };
  weekGrowth: number | null;
  avgTxValue: number;
  refundRate: number;
  paymentBreakdown: Record<string, number>;
  topProducts: { name: string; qty: number }[];
  sparkline: { label: string; total: number }[];
  debtTotal: number;
  debtors: number;
  totalCustomers: number;
}

interface ProfitData {
  revenue: number;
  grossRevenue: number;
  refunds: number;
  cogs: number;
  expenses: number;
  netProfit: number;
  grossProfit: number;
}

const PAYMENT_LABELS: Record<string, string> = { CASH: "نقدي", CARD: "بطاقة", CREDIT: "آجل", SPLIT: "جزئي" };
const PAYMENT_COLORS: Record<string, string> = { CASH: "#10b981", CARD: "#094B9F", CREDIT: "#f59e0b", SPLIT: "#8b5cf6" };
const PRODUCT_COLORS = ["#094B9F", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

function SparkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs font-bold shadow-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      dir="rtl"
    >
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      <p style={{ color: "var(--color-primary)" }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function Home() {
  usePageTitle("لوحة التحكم");
  const { selectedBranch, loading: branchLoading } = useBranch();

  const bId = selectedBranch?.id && selectedBranch.id !== "all" ? selectedBranch.id : null;
  const bq = bId ? `?branchId=${bId}` : "";
  const bq2 = bId ? `&branchId=${bId}` : "";
  const branchKey = bId ?? "all";

  const alertsQuery = useQuery({
    queryKey: ["dashboard-alerts", branchKey],
    queryFn: () => fetchJsonOr<{ lowStock: any[]; expiringBatches: any[] }>(`/api/inventory/alerts${bq}`, { lowStock: [], expiringBatches: [] }),
    enabled: !branchLoading,
  });
  const profitQuery = useQuery({
    queryKey: ["dashboard-profit", branchKey],
    queryFn: () => fetchJsonOr<(ProfitData & { error?: string }) | null>(`/api/reports/profit?period=daily${bq2}`, null),
    enabled: !branchLoading,
  });
  const txQuery = useQuery({
    queryKey: ["dashboard-tx", branchKey],
    queryFn: () => fetchJsonOr<any>(`/api/transactions?limit=7${bq2}`, []),
    enabled: !branchLoading,
  });
  const dashQuery = useQuery({
    queryKey: ["dashboard-summary", branchKey],
    queryFn: () => fetchJsonOr<(DashData & { error?: string }) | null>(`/api/reports/dashboard${bq}`, null),
    enabled: !branchLoading,
  });

  const alerts = alertsQuery.data ?? null;
  const profitData = profitQuery.data;
  const profit: ProfitData = profitData && !profitData.error
    ? profitData
    : { revenue: 0, grossRevenue: 0, refunds: 0, cogs: 0, expenses: 0, netProfit: 0, grossProfit: 0 };
  const txData = txQuery.data;
  const latestTransactions: any[] = Array.isArray(txData)
    ? txData.slice(0, 7)
    : txData?.transactions
      ? txData.transactions.slice(0, 7)
      : [];
  const dashRaw = dashQuery.data;
  const dashData: DashData | null = dashRaw && !dashRaw.error ? dashRaw : null;
  const loading = alertsQuery.isPending || profitQuery.isPending || txQuery.isPending || dashQuery.isPending;

  const quickActions = [
    { href: "/inventory/new", icon: Package, label: "منتج جديد", gradient: "linear-gradient(135deg,#10b981,#059669)", glow: "rgba(16,185,129,0.2)" },
    { href: "/inventory/stock-in", icon: ArrowDownToLine, label: "إدخال مخزون", gradient: "linear-gradient(135deg,#094B9F,#063A8A)", glow: "rgba(9,75,159,0.2)" },
    { href: "/accounting/expenses", icon: TrendingDown, label: "مصروف", gradient: "linear-gradient(135deg,#ef4444,#dc2626)", glow: "rgba(239,68,68,0.2)" },
    { href: "/sales/customers", icon: Users, label: "العملاء", gradient: "linear-gradient(135deg,#094B9F,#063A8A)", glow: "rgba(14,99,212,0.2)" },
    { href: "/sales/invoices", icon: FileText, label: "الفواتير", gradient: "linear-gradient(135deg,#06b6d4,#0891b2)", glow: "rgba(6,182,212,0.2)" },
    { href: "/marketing/offers", icon: Tag, label: "العروض", gradient: "linear-gradient(135deg,#f59e0b,#d97706)", glow: "rgba(245,158,11,0.2)" },
  ];

  const totalPayments = dashData
    ? Object.values(dashData.paymentBreakdown).reduce((s, v) => s + v, 0)
    : 0;

  const weekGrowthPositive = dashData?.weekGrowth != null && dashData.weekGrowth >= 0;

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: "var(--bg-page)" }}>

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-7">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ background: "var(--gradient-brand)" }} />
            <h1
              className="text-2xl font-black"
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #063380 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              لوحة القيادة
            </h1>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)", paddingRight: "12px" }}>
            {new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HowItWorks
            label="كيف تستخدم اللوحة؟"
            title="كيف تعمل لوحة القيادة؟"
            steps={[
              { icon: LayoutDashboard, title: "مؤشرات اليوم الأساسية", description: "الصف الأول يعرض أربعة مؤشرات آنية: صافي الإيرادات (بعد المرتجعات)، تكلفة البضاعة المباعة، المصروفات، وصافي الربح — كلها محسوبة تلقائياً لليوم الحالي.", gradient: "linear-gradient(135deg,#094B9F,#063A8A)", shadow: "rgba(9,75,159,0.3)" },
              { icon: TrendingUp, title: "إحصاءات الأسبوع والعملاء", description: "الصف الثاني يُظهر مبيعات الأسبوع مع نسبة النمو مقارنةً بالأسبوع الماضي، إجمالي ديون العملاء وعددهم، ومتوسط قيمة الفاتورة خلال آخر 30 يوماً.", gradient: "linear-gradient(135deg,#8b5cf6,#7c3aed)", shadow: "rgba(139,92,246,0.3)" },
              { icon: Activity, title: "منحنى المبيعات وأحدث الفواتير", description: "المنحنى البياني يعرض تطور المبيعات على مدار الأيام السبعة الماضية. أسفله تجد آخر 7 فواتير مع طريقة الدفع لكل منها للمراجعة الفورية.", gradient: "linear-gradient(135deg,#10b981,#059669)", shadow: "rgba(16,185,129,0.3)" },
              { icon: Award, title: "أعلى المنتجات وتوزيع الدفع", description: "العمود الأيمن يعرض أكثر 5 منتجات مبيعاً خلال آخر 30 يوماً بأشرطة نسبية، ثم توزيع طرق الدفع (نقدي، بطاقة، آجل، جزئي) كنسب مئوية مرئية.", gradient: "linear-gradient(135deg,#10b981,#059669)", shadow: "rgba(16,185,129,0.3)" },
              { icon: Zap, title: "الإجراءات السريعة", description: "ستة اختصارات مباشرة لأكثر العمليات تكراراً: إضافة منتج جديد، إدخال مخزون، تسجيل مصروف، إدارة العملاء، عرض الفواتير، وإنشاء العروض.", gradient: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "rgba(245,158,11,0.3)" },
              { icon: Settings2, title: "تصفية حسب الفرع", description: "اختر فرعاً محدداً من القائمة في أعلى الصفحة لعرض جميع البيانات الخاصة بذلك الفرع فقط، أو اختر \"كل الفروع\" للرؤية الإجمالية للمتجر.", gradient: "linear-gradient(135deg,#094B9F,#063A8A)", shadow: "rgba(14,99,212,0.3)" },
            ]}
          />
          <Link href="/pos" className="btn-primary">
            <ShoppingCart size={17} />
            شاشة الكاشير
          </Link>
        </div>
      </div>

      {/* ── Alerts ── */}
      {alerts && (alerts.lowStock.length > 0 || alerts.expiringBatches.length > 0) && (
        <div className="space-y-3 mb-6">
          {alerts.lowStock.length > 0 && (
            <div
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{ background: "linear-gradient(135deg,#fffbeb,#fef9c3)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 4px 16px rgba(245,158,11,0.1)" }}
            >
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <AlertTriangle size={15} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: "#92400e" }}>مخزون منخفض — {alerts.lowStock.length} منتج</p>
                <p className="text-xs mt-0.5" style={{ color: "#b45309" }}>
                  بعض المنتجات قريبة من النفاذ —{" "}
                  <Link href="/inventory" target="_blank" className="underline font-bold">مراجعة المخزون</Link>
                </p>
              </div>
            </div>
          )}
          {alerts.expiringBatches.length > 0 && (
            <div
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "1px solid rgba(239,68,68,0.3)", boxShadow: "0 4px 16px rgba(239,68,68,0.1)" }}
            >
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
                <AlertTriangle size={15} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: "#991b1b" }}>منتجات ستنتهي صلاحيتها — {alerts.expiringBatches.length} دفعة</p>
                <p className="text-xs mt-0.5" style={{ color: "#b91c1c" }}>
                  تحتاج مراجعة فورية —{" "}
                  <Link href="/reports/expiry" target="_blank" className="underline font-bold">مراجعة إدارة الصلاحيات</Link>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="صافي إيرادات اليوم"
          value={formatCurrency(profit.revenue)}
          icon={TrendingUp}
          gradient="linear-gradient(135deg,#10b981,#059669)"
          valueColor="var(--value-positive)"
          trend={{
            direction: "up",
            label: dashData?.today.txCount
              ? `${dashData.today.txCount} فاتورة — إجمالي ${formatCurrency(profit.grossRevenue)}`
              : profit.refunds > 0
                ? `إجمالي ${formatCurrency(profit.grossRevenue)} − مرتجعات ${formatCurrency(profit.refunds)}`
                : `إجمالي المبيعات ${formatCurrency(profit.grossRevenue)}`,
          }}
        />
        <StatCard
          label="تكلفة البضاعة"
          value={formatCurrency(profit.cogs)}
          icon={Package}
          gradient="linear-gradient(135deg,#f59e0b,#d97706)"
          valueColor="var(--value-negative)"
        />
        <StatCard
          label="مصروفات اليوم"
          value={formatCurrency(profit.expenses)}
          icon={TrendingDown}
          gradient="linear-gradient(135deg,#ef4444,#dc2626)"
          valueColor="var(--value-negative)"
        />
        <StatCard
          label="الربح الصافي"
          value={formatCurrency(profit.netProfit)}
          icon={BarChart3}
          gradient="linear-gradient(135deg,#094B9F,#063A8A)"
          valueColor={profit.netProfit >= 0 ? "var(--value-positive)" : "var(--value-negative)"}
          highlight
          trend={{ direction: profit.netProfit >= 0 ? "up" : "down", label: profit.netProfit >= 0 ? "ربح" : "خسارة" }}
        />
      </div>

      {/* ── Secondary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {/* Weekly Sales */}
        <div
          className="stat-card flex items-center gap-4"
          style={{ borderRight: `3px solid ${weekGrowthPositive ? "#10b981" : "#ef4444"}` }}
        >
          <div
            className="kpi-icon w-12 h-12 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", boxShadow: "0 4px 16px rgba(139,92,246,0.25)" }}
          >
            <div className="absolute inset-0 opacity-25" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.6),transparent 50%)" }} />
            <BarChart3 size={22} className="text-white relative z-10" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-card-label kpi-label">مبيعات الأسبوع</p>
            <p className="stat-card-value kpi-value">{formatCurrency(dashData?.thisWeek.sales ?? 0)}</p>
            {dashData?.weekGrowth != null ? (
              <div className="flex items-center gap-1 mt-1">
                {weekGrowthPositive
                  ? <TrendingUp size={12} style={{ color: "#10b981" }} />
                  : <TrendingDown size={12} style={{ color: "#ef4444" }} />}
                <span className="text-xs font-bold" style={{ color: weekGrowthPositive ? "#10b981" : "#ef4444" }}>
                  {Math.abs(dashData.weekGrowth).toFixed(1)}% مقارنة بالأسبوع الماضي
                </span>
              </div>
            ) : (
              <p className="text-xs font-bold mt-1" style={{ color: "var(--text-muted)" }}>
                {dashData?.thisWeek.txCount ?? 0} فاتورة هذا الأسبوع
              </p>
            )}
          </div>
        </div>

        {/* Customer Debt */}
        <div className="stat-card flex items-center gap-4">
          <div
            className="kpi-icon w-12 h-12 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 4px 16px rgba(245,158,11,0.25)" }}
          >
            <div className="absolute inset-0 opacity-25" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.6),transparent 50%)" }} />
            <Users size={22} className="text-white relative z-10" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-card-label kpi-label">ديون العملاء</p>
            <p className="stat-card-value kpi-value" style={{ color: dashData?.debtTotal ? "var(--value-negative)" : "var(--value-positive)" }}>
              {formatCurrency(dashData?.debtTotal ?? 0)}
            </p>
            <p className="text-xs font-bold mt-1" style={{ color: "var(--text-muted)" }}>
              {dashData?.debtors ?? 0} عميل مدين من {dashData?.totalCustomers ?? 0}
            </p>
          </div>
        </div>

        {/* Avg Transaction */}
        <div className="stat-card flex items-center gap-4">
          <div
            className="kpi-icon w-12 h-12 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#06b6d4,#0891b2)", boxShadow: "0 4px 16px rgba(6,182,212,0.25)" }}
          >
            <div className="absolute inset-0 opacity-25" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.6),transparent 50%)" }} />
            <Receipt size={22} className="text-white relative z-10" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-card-label kpi-label">متوسط قيمة الفاتورة</p>
            <p className="stat-card-value kpi-value">{formatCurrency(dashData?.avgTxValue ?? 0)}</p>
            <p className="text-xs font-bold mt-1" style={{ color: "var(--text-muted)" }}>آخر 30 يوماً</p>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: Sparkline + Transactions */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Sparkline Chart */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="font-black text-base mb-4 flex items-center gap-2.5" style={{ color: "var(--text-primary)" }}>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
              >
                <BarChart3 size={14} className="text-white" />
              </div>
              مبيعات الأيام السبعة الماضية
            </h2>
            {loading ? (
              <div className="h-36 rounded-xl skeleton" />
            ) : dashData?.sparkline && dashData.sparkline.length > 0 ? (
              <div style={{ height: 144 }} dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashData.sparkline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#094B9F" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#094B9F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--text-muted)" as string }}
                    />
                    <YAxis hide />
                    <Tooltip content={<SparkTooltip />} cursor={{ stroke: "rgba(9,75,159,0.15)", strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#094B9F"
                      strokeWidth={2.5}
                      fill="url(#sparkGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#094B9F", strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                لا توجد بيانات مبيعات بعد
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-black text-base flex items-center gap-2.5" style={{ color: "var(--text-primary)" }}>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#094B9F,#063A8A)" }}
                >
                  <Activity size={14} className="text-white" />
                </div>
                أحدث الفواتير
              </h2>
              <Link
                href="/sales/invoices"
                className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:bg-blue-50"
                style={{ color: "var(--color-primary)" }}
              >
                عرض الكل <ArrowLeft size={13} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl skeleton" />)}
              </div>
            ) : latestTransactions.length > 0 ? (
              <div className="space-y-2">
                {latestTransactions.map((tx: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3.5 rounded-xl transition-all duration-150"
                    style={{ background: "var(--bg-page)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-primary-light)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-page)")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: tx.type === "REFUND" || tx.type === "RETURN"
                            ? "linear-gradient(135deg,#ef4444,#dc2626)"
                            : tx.customerId
                              ? "linear-gradient(135deg,#f59e0b,#d97706)"
                              : "linear-gradient(135deg,#10b981,#059669)",
                        }}
                      >
                        <Receipt size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                          فاتورة #{tx.receiptNumber || tx.id}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {new Date(tx.date).toLocaleString("ar-IQ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="font-black text-sm" style={{ color: "var(--color-primary)" }}>
                        {formatCurrency(Number(tx.totalAmount))}
                      </p>
                      <span
                        className="badge"
                        style={
                          tx.type === "REFUND" || tx.type === "RETURN"
                            ? { background: "#fef2f2", color: "#991b1b" }
                            : tx.paymentMethod === "CARD"
                              ? { background: "#eff6ff", color: "#1d4ed8" }
                              : tx.paymentMethod === "CREDIT"
                                ? { background: "#EEF4FF", color: "#073D82" }
                                : tx.paymentMethod === "SPLIT"
                                  ? { background: "#f5f3ff", color: "#6d28d9" }
                                  : { background: "#ecfdf5", color: "#065f46" }
                        }
                      >
                        {tx.type === "REFUND" || tx.type === "RETURN" ? "مرتجع"
                          : tx.paymentMethod === "CARD" ? "بطاقة"
                            : tx.paymentMethod === "CREDIT" ? "آجل"
                              : tx.paymentMethod === "SPLIT" ? "جزئي"
                                : "نقدي"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-14" style={{ color: "var(--text-muted)" }}>
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "var(--color-secondary-light)" }}
                >
                  <Activity size={28} className="opacity-40" />
                </div>
                <p className="font-bold text-sm">لا توجد فواتير اليوم بعد</p>
                <p className="text-xs mt-1 opacity-60">ابدأ أول بيع من شاشة الكاشير</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-5">

          {/* Quick Actions */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="font-black text-base mb-5 flex items-center gap-2.5" style={{ color: "var(--text-primary)" }}>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
              >
                <Zap size={14} className="text-white" />
              </div>
              إجراءات سريعة
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl text-center transition-all duration-200 relative overflow-hidden"
                  style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = `0 8px 24px ${action.glow}`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                    style={{ background: action.gradient, boxShadow: `0 4px 12px ${action.glow}` }}
                  >
                    <div
                      className="absolute inset-0 opacity-25"
                      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.5),transparent 50%)" }}
                    />
                    <action.icon size={18} className="text-white relative z-10" />
                  </div>
                  <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Top Products + Payment Breakdown */}
          <div
            className="rounded-2xl p-5 flex-1"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="font-black text-base mb-4 flex items-center gap-2.5" style={{ color: "var(--text-primary)" }}>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
              >
                <Award size={14} className="text-white" />
              </div>
              أعلى المبيعات (30 يوم)
            </h2>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 rounded-lg skeleton" />)}
              </div>
            ) : dashData?.topProducts && dashData.topProducts.length > 0 ? (
              <div className="space-y-3">
                {dashData.topProducts.map((p, i) => {
                  const maxQty = dashData.topProducts[0].qty;
                  const pct = maxQty > 0 ? (p.qty / maxQty) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className="text-xs font-bold truncate"
                          style={{ color: "var(--text-primary)", maxWidth: "65%" }}
                          title={p.name}
                        >
                          {p.name}
                        </span>
                        <span className="text-xs font-black" style={{ color: PRODUCT_COLORS[i] }}>
                          {p.qty} وحدة
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-secondary-light)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: PRODUCT_COLORS[i], transition: "width 0.5s ease" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                لا توجد بيانات مبيعات بعد
              </p>
            )}

            {/* Payment Breakdown */}
            {dashData && totalPayments > 0 && (
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <p className="text-xs font-black mb-3" style={{ color: "var(--text-muted)" }}>
                  توزيع طرق الدفع (30 يوم)
                </p>
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-3">
                  {Object.entries(dashData.paymentBreakdown).map(([method, amount]) =>
                    amount > 0 ? (
                      <div
                        key={method}
                        style={{
                          width: `${(amount / totalPayments) * 100}%`,
                          background: PAYMENT_COLORS[method] ?? "#94a3b8",
                          transition: "width 0.5s ease",
                        }}
                        title={`${PAYMENT_LABELS[method] ?? method}: ${((amount / totalPayments) * 100).toFixed(0)}%`}
                      />
                    ) : null
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {Object.entries(dashData.paymentBreakdown).map(([method, amount]) =>
                    amount > 0 ? (
                      <div key={method} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: PAYMENT_COLORS[method] ?? "#94a3b8" }} />
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                          {PAYMENT_LABELS[method] ?? method} {((amount / totalPayments) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-10 text-center text-xs pb-4" style={{ color: "var(--text-muted)" }}>
        © 2026 جميع الحقوق محفوظة — نظام المدقق ERP
      </footer>
    </div>
  );
}
