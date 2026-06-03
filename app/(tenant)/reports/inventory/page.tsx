"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Layers,
  Clock,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  TrendingDown,
  Archive,
  CalendarX2,
  BarChart3,
  Filter,
  ExternalLink,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { useBranch } from "@/contexts/BranchContext";
import { HowItWorks } from "@/components/ui/HowItWorks";
import PageHeader from "@/components/ui/PageHeader";

interface InventoryData {
  stats: {
    totalValuation: number;
    totalProducts: number;
    totalItems: number;
    outOfStockCount: number;
    lowStockCount: number;
    warningStockCount: number;
    expiringCount: number;
    expiredCount: number;
    criticalCount: number;
  };
  outOfStock: any[];
  lowStockItems: any[];
  warningItems: any[];
  expiringBatches: any[];
  valuationDistribution: { name: string; value: number }[];
}

type SortKey = "name" | "stock" | "cost" | "daysLeft";

const PIE_COLORS = [
  "#094B9F",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];
const BAR_GRADIENTS = [
  "from-blue-500 to-violet-500",
  "from-blue-500 to-blue-500",
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-blue-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
];

function UrgencyBadge({
  urgency,
  daysLeft,
}: {
  urgency: string;
  daysLeft: number;
}) {
  if (urgency === "expired")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-700 border border-red-200">
        منتهي الصلاحية
      </span>
    );
  if (urgency === "critical")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 border border-orange-200">
        {daysLeft} أيام
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
      {daysLeft} يوم
    </span>
  );
}

function StockBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SortableTable({
  title,
  icon: Icon,
  gradientStyle,
  accentColor,
  items,
  emptyMsg,
  columns,
  defaultSort,
}: {
  title: string;
  icon: any;
  gradientStyle: string;
  accentColor: string;
  items: any[];
  emptyMsg: string;
  columns: {
    key: string;
    label: string;
    sortable?: boolean;
    render: (item: any) => React.ReactNode;
  }[];
  defaultSort?: SortKey;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>(defaultSort ?? "name");
  const [asc, setAsc] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const filtered = useMemo(() => {
    let r = items.filter(
      (i) =>
        (i.name ?? i.productName ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (i.supplier ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.category ?? "").toLowerCase().includes(search.toLowerCase()),
    );
    r = [...r].sort((a, b) => {
      const va = a[sort] ?? 0,
        vb = b[sort] ?? 0;
      if (typeof va === "string")
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      return asc ? va - vb : vb - va;
    });
    return r;
  }, [items, search, sort, asc]);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setAsc((p) => !p);
    else {
      setSort(k);
      setAsc(true);
    }
  };
  const SortIcon = ({ k }: { k: SortKey }) =>
    sort === k ? (
      asc ? (
        <ChevronUp size={11} />
      ) : (
        <ChevronDown size={11} />
      )
    ) : (
      <ChevronDown size={11} className="opacity-25" />
    );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: gradientStyle }}
          >
            <Icon size={15} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-[11px] text-gray-400">
              {filtered.length} من {items.length} عنصر
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-8 pl-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 w-36 transition-all"
            />
          </div>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-right data-table">
            <thead className="bg-gray-50/50 border-b border-[var(--border-color)] sticky top-0 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() =>
                      col.sortable !== false && toggleSort(col.key as SortKey)
                    }
                    className={`px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider select-none ${col.sortable !== false ? "cursor-pointer hover:text-gray-800" : ""}`}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      {col.label}
                      {col.sortable !== false && (
                        <SortIcon k={col.key as SortKey} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-10 text-center text-sm text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Package size={18} className="text-gray-300" />
                      </div>
                      {emptyMsg}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item, i) => (
                  <tr
                    key={item.id ?? i}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-3.5">
                        {col.render(item)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductLink({ id, name }: { id?: string | null; name: string }) {
  if (!id)
    return <span className="text-sm font-semibold text-gray-800">{name}</span>;
  return (
    <Link
      href={`/inventory/edit/${id}`}
      className="group inline-flex items-center gap-1 text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors"
    >
      {name}
      <ExternalLink
        size={11}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"
      />
    </Link>
  );
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-right">
      <p className="text-xs font-bold text-gray-800">{d.name}</p>
      <p className="text-sm font-extrabold" style={{ color: d.payload.fill }}>
        {formatCurrency(d.value)}
      </p>
      <p className="text-[11px] text-gray-400">{d.payload.pct}% من الإجمالي</p>
    </div>
  );
};

export default function InventoryReportPage() {
  usePageTitle('تقرير المخزون');
  const { selectedBranch, loading: branchLoading } = useBranch();
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  useEffect(() => {
    if (branchLoading) return;
    setLoading(true);
    const q =
      selectedBranch?.id && selectedBranch.id !== "all"
        ? `?branchId=${selectedBranch.id}`
        : "";
    fetch(`/api/reports/inventory${q}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBranch, branchLoading]);

  const allCategories = useMemo(() => {
    if (!data) return [];
    const cats = new Set<string>();
    [...data.outOfStock, ...data.lowStockItems, ...data.warningItems].forEach(
      (i) => {
        if (i.category) cats.add(i.category);
      },
    );
    return Array.from(cats).sort();
  }, [data]);

  const filterByCategory = (items: any[]) =>
    categoryFilter === "ALL"
      ? items
      : items.filter((i) => i.category === categoryFilter);

  const pieData = useMemo(() => {
    if (!data) return [];
    const total = data.valuationDistribution.reduce((s, d) => s + d.value, 0);
    return data.valuationDistribution.map((d, i) => ({
      name: d.name,
      value: d.value,
      fill: PIE_COLORS[i % PIE_COLORS.length],
      pct: total > 0 ? ((d.value / total) * 100).toFixed(1) : "0",
    }));
  }, [data]);

  if (loading)
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
        {/* Hero */}
        <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
              <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
              <Package size={36} className="text-white relative z-10 sk-spin" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
              style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-xl font-black text-slate-800">جاري تحميل تقرير المخزون</p>
            <div className="flex items-center justify-center gap-1.5">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
            <p className="text-sm text-slate-400 font-medium">يتم تحليل بيانات المخزون والتقييم</p>
          </div>
        </div>
        {/* KPI skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        {/* Table skeletons */}
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div className="skeleton h-4 w-36" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex gap-3">
                    <div className="skeleton h-3 flex-1" />
                    <div className="skeleton h-3 w-16" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  if (!data)
    return (
      <div
        className="p-8 flex flex-col items-center justify-center gap-3"
        dir="rtl"
      >
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <XCircle size={24} className="text-red-500" />
        </div>
        <p className="text-sm font-semibold text-red-600">
          خطأ في تحميل بيانات المخزون
        </p>
      </div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
      {/* ── Header ── */}
      <PageHeader
        title="تقرير المخزون"
        subtitle="تقييم البضاعة والتنبيهات الحرجة"
        icon={Package}
        gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
        actions={
          <HowItWorks
            label="كيف يعمل التقرير؟"
            title="كيف يعمل تقرير المخزون؟"
            steps={[
              {
                icon: DollarSign,
                title: "قيمة المخزون",
                description:
                  "إجمالي تكلفة البضاعة الموجودة حالياً محسوبة بسعر التكلفة لكل منتج.",
                gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
                shadow: "rgba(9,75,159,0.3)",
              },
              {
                icon: XCircle,
                title: "منتجات نفد مخزونها",
                description:
                  "المنتجات التي وصل مخزونها إلى صفر — تحتاج إعادة طلب فوري.",
                gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
                shadow: "rgba(239,68,68,0.3)",
              },
              {
                icon: AlertTriangle,
                title: "مخزون حرج ومنخفض",
                description:
                  "منتجات أقل من الحد الأدنى المحدد — تحتاج متابعة وإعادة طلب قريبة.",
                gradient: "linear-gradient(135deg,#f97316,#ea580c)",
                shadow: "rgba(249,115,22,0.3)",
              },
              {
                icon: Clock,
                title: "دفعات قاربت على الانتهاء",
                description:
                  "الدفعات التي ستنتهي صلاحيتها خلال 30 يوماً أو انتهت بالفعل.",
                gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
                shadow: "rgba(245,158,11,0.3)",
              },
              {
                icon: BarChart3,
                title: "توزيع قيمة المخزون حسب القسم",
                description:
                  "يوضح نسبة كل قسم من إجمالي قيمة المخزون لمعرفة أين يتركز رأس المال.",
                gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
                shadow: "rgba(14,99,212,0.3)",
              },
            ]}
          />
        }
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#eef2ff' }}>
            <DollarSign size={16} style={{ color: '#094B9F' }} />
          </div>
          <div className="min-w-0">
            <p className="kpi-label">قيمة المخزون</p>
            <p className="kpi-value">{formatCurrency(data.stats.totalValuation)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{data.stats.totalProducts} منتج · {data.stats.totalItems} وحدة</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#fef2f2' }}>
            <XCircle size={16} style={{ color: '#ef4444' }} />
          </div>
          <div className="min-w-0">
            <p className="kpi-label">نفد من المخزون</p>
            <p className={`kpi-value ${data.stats.outOfStockCount > 0 ? 'text-red-600' : ''}`}>
              {data.stats.outOfStockCount} منتج
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">يحتاج إعادة طلب فوري</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#fff7ed' }}>
            <AlertTriangle size={16} style={{ color: '#f97316' }} />
          </div>
          <div className="min-w-0">
            <p className="kpi-label">مخزون حرج</p>
            <p className={`kpi-value ${data.stats.lowStockCount > 0 ? 'text-orange-600' : ''}`}>
              {data.stats.lowStockCount} منتج
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">أقل من الحد الأدنى المحدد</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: '#fffbeb' }}>
            <Clock size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div className="min-w-0">
            <p className="kpi-label">انتهاء الصلاحية</p>
            <p className="kpi-value">{data.stats.expiringCount} دفعة</p>
            <p className="text-[11px] mt-0.5 flex flex-wrap gap-1">
              {data.stats.expiredCount > 0 && <span className="text-red-600 font-bold">{data.stats.expiredCount} منتهية</span>}
              {data.stats.criticalCount > 0 && <span className="text-orange-600 font-bold">{data.stats.criticalCount} حرجة</span>}
              {data.stats.expiredCount === 0 && data.stats.criticalCount === 0 && <span className="text-gray-400">أقل من 30 يوم</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Alert Banner ── */}
      {(data.stats.outOfStockCount > 0 || data.stats.expiredCount > 0) && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            background: "linear-gradient(135deg,#fef2f2,#fff7ed)",
            borderColor: "#fca5a5",
          }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <ShieldAlert size={16} className="text-red-600" />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {data.stats.outOfStockCount > 0 && (
                <span className="text-red-700 font-semibold">
                  ⚠ {data.stats.outOfStockCount} منتج نفد مخزونه — يُنصح بإعادة
                  الطلب فوراً
                </span>
              )}
              {data.stats.expiredCount > 0 && (
                <span className="text-orange-700 font-semibold">
                  ⚠ {data.stats.expiredCount} دفعة منتهية الصلاحية
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Category Filter ── */}
      {allCategories.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-500">
            <Filter size={14} />
            <span className="text-xs font-semibold">تصفية حسب القسم</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                categoryFilter === "ALL"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              الكل
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  categoryFilter === cat
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Out of Stock ── */}
      {data.outOfStock.length > 0 && (
        <SortableTable
          title="منتجات نفد مخزونها"
          icon={XCircle}
          gradientStyle="linear-gradient(135deg,#ef4444,#dc2626)"
          accentColor="red"
          items={filterByCategory(data.outOfStock)}
          emptyMsg="لا توجد منتجات نافدة"
          defaultSort="name"
          columns={[
            {
              key: "name",
              label: "المنتج",
              render: (i) => <ProductLink id={i.id} name={i.name} />,
            },
            {
              key: "category",
              label: "القسم",
              render: (i) => (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  {i.category || "—"}
                </span>
              ),
            },
            {
              key: "supplier",
              label: "المورد",
              render: (i) => (
                <span className="text-xs text-gray-500">
                  {i.supplier || "—"}
                </span>
              ),
            },
            {
              key: "cost",
              label: "سعر التكلفة",
              render: (i) => (
                <span className="text-sm font-bold text-gray-700">
                  {formatCurrency(i.cost)}
                </span>
              ),
            },
            {
              key: "status",
              label: "الحالة",
              sortable: false,
              render: () => (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-700 border border-red-200">
                  <XCircle size={10} /> نفد المخزون
                </span>
              ),
            },
          ]}
        />
      )}

      {/* ── Low Stock ── */}
      <SortableTable
        title="مخزون حرج (أقل من الحد الأدنى)"
        icon={AlertTriangle}
        gradientStyle="linear-gradient(135deg,#f97316,#ea580c)"
        accentColor="orange"
        items={filterByCategory(data.lowStockItems)}
        emptyMsg="لا توجد منتجات بمخزون حرج"
        defaultSort="stock"
        columns={[
          {
            key: "name",
            label: "المنتج",
            render: (i) => <ProductLink id={i.id} name={i.name} />,
          },
          {
            key: "category",
            label: "القسم",
            render: (i) => (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                {i.category || "—"}
              </span>
            ),
          },
          {
            key: "stock",
            label: "المخزون",
            render: (i) => (
              <div className="space-y-1 w-28">
                <span className="text-sm font-extrabold text-red-600">
                  {i.stock} وحدة
                </span>
                <StockBar
                  value={i.stock}
                  max={Math.max(i.minimumStock ?? 5, 5)}
                  color="bg-red-400"
                />
              </div>
            ),
          },
          {
            key: "supplier",
            label: "المورد",
            render: (i) => (
              <span className="text-xs text-gray-500">{i.supplier || "—"}</span>
            ),
          },
          {
            key: "cost",
            label: "سعر التكلفة",
            render: (i) => (
              <span className="text-sm font-bold text-gray-700">
                {formatCurrency(i.cost)}
              </span>
            ),
          },
        ]}
      />

      {/* ── Warning Stock ── */}
      {data.warningItems.length > 0 && (
        <SortableTable
          title="مخزون منخفض (6 – 20 وحدة)"
          icon={TrendingDown}
          gradientStyle="linear-gradient(135deg,#eab308,#ca8a04)"
          accentColor="yellow"
          items={filterByCategory(data.warningItems)}
          emptyMsg="لا توجد منتجات"
          defaultSort="stock"
          columns={[
            {
              key: "name",
              label: "المنتج",
              render: (i) => <ProductLink id={i.id} name={i.name} />,
            },
            {
              key: "category",
              label: "القسم",
              render: (i) => (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  {i.category || "—"}
                </span>
              ),
            },
            {
              key: "stock",
              label: "المخزون",
              render: (i) => (
                <div className="space-y-1 w-28">
                  <span className="text-sm font-bold text-blue-700">
                    {i.stock} وحدة
                  </span>
                  <StockBar value={i.stock} max={20} color="bg-blue-400" />
                </div>
              ),
            },
            {
              key: "supplier",
              label: "المورد",
              render: (i) => (
                <span className="text-xs text-gray-500">
                  {i.supplier || "—"}
                </span>
              ),
            },
            {
              key: "cost",
              label: "سعر التكلفة",
              render: (i) => (
                <span className="text-sm font-bold text-gray-700">
                  {formatCurrency(i.cost)}
                </span>
              ),
            },
          ]}
        />
      )}

      {/* ── Expiry Summary Card ── */}
      <div
        className={`rounded-2xl border shadow-sm p-5 ${
          data.stats.expiredCount > 0
            ? "bg-red-50 border-red-200"
            : data.stats.criticalCount > 0
              ? "bg-orange-50 border-orange-200"
              : "bg-blue-50/50 border-blue-100"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
            >
              <CalendarX2 size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">
                الصلاحيات القريبة من الانتهاء
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {data.stats.expiringCount} دفعة في خطر خلال 30 يوم
                {data.stats.expiredCount > 0 && (
                  <span className="text-red-600 font-bold">
                    {" "}
                    · {data.stats.expiredCount} منتهية الآن
                  </span>
                )}
                {data.stats.criticalCount > 0 && (
                  <span className="text-orange-600 font-bold">
                    {" "}
                    · {data.stats.criticalCount} حرجة (≤7 أيام)
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/inventory/expiry"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            إدارة الصلاحيات
            <ExternalLink size={12} />
          </Link>
        </div>
        {data.expiringBatches.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.expiringBatches.slice(0, 6).map((b: any) => (
              <div
                key={b.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl bg-white border ${
                  b.urgency === "expired"
                    ? "border-red-200"
                    : b.urgency === "critical"
                      ? "border-orange-200"
                      : "border-blue-100"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      b.urgency === "expired"
                        ? "bg-red-500"
                        : b.urgency === "critical"
                          ? "bg-orange-500"
                          : "bg-blue-400"
                    }`}
                  />
                  <span className="text-xs font-semibold text-gray-800 truncate">
                    {b.productName}
                  </span>
                </div>
                <UrgencyBadge urgency={b.urgency} daysLeft={b.daysLeft} />
              </div>
            ))}
          </div>
        )}
        {data.expiringBatches.length > 6 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            و {data.expiringBatches.length - 6} دفعات أخرى —
            <Link
              href="/inventory/expiry"
              className="text-blue-700 font-bold hover:underline mr-1"
            >
              عرض الكل ←
            </Link>
          </p>
        )}
      </div>

      {/* ── Valuation by Category — Pie Chart ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#094B9F,#063A8A)" }}
          >
            <Layers size={15} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">
              توزيع قيمة المخزون حسب القسم
            </h3>
            <p className="text-[11px] text-gray-400">
              نسبة كل قسم من إجمالي {formatCurrency(data.stats.totalValuation)}
            </p>
          </div>
        </div>

        {pieData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Archive size={18} className="text-gray-300" />
            </div>
            <p className="text-xs text-gray-400">لا توجد بيانات</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            {/* Pie */}
            <div className="w-full lg:w-64 h-56 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend list */}
            <div className="flex-1 space-y-3 w-full">
              {pieData.map((cat, i) => {
                const gradient = BAR_GRADIENTS[i % BAR_GRADIENTS.length];
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: cat.fill }}
                        />
                        <span className="text-xs font-semibold text-gray-700">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md font-medium">
                          {cat.pct}%
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
