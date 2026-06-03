"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  CalendarX2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Package,
  Search,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Skull,
  CalendarRange,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { exportToCSV } from "@/lib/exportExcel";
import { useBranch } from "@/contexts/BranchContext";
import PageHeader from "@/components/ui/PageHeader";

interface ExpiryBatch {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  categoryId: string | null;
  category: string;
  supplier: string | null;
  branchName: string;
  expiryDate: string | null;
  daysLeft: number | null;
  urgency: "expired" | "critical" | "warning" | "ok" | "none";
  quantity: number;
  costPrice: number;
  totalValue: number;
}

interface Stats {
  total: number;
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
  okCount: number;
  totalValueAtRisk: number;
}

const HORIZON_OPTIONS = [
  {
    key: "expired",
    label: "منتهية",
    icon: Skull,
    color: "text-red-700",
    bg: "bg-red-600",
  },
  {
    key: "7",
    label: "7 أيام",
    icon: ShieldAlert,
    color: "text-orange-700",
    bg: "bg-orange-500",
  },
  {
    key: "14",
    label: "14 يوم",
    icon: AlertTriangle,
    color: "text-blue-700",
    bg: "bg-blue-500",
  },
  {
    key: "30",
    label: "30 يوم",
    icon: Clock,
    color: "text-yellow-700",
    bg: "bg-yellow-500",
  },
  {
    key: "60",
    label: "60 يوم",
    icon: CalendarX2,
    color: "text-blue-700",
    bg: "bg-blue-500",
  },
  {
    key: "90",
    label: "90 يوم",
    icon: CalendarX2,
    color: "text-violet-700",
    bg: "bg-violet-500",
  },
  {
    key: "all",
    label: "الكل",
    icon: Package,
    color: "text-gray-700",
    bg: "bg-gray-500",
  },
  {
    key: "custom",
    label: "مخصص",
    icon: CalendarRange,
    color: "text-teal-700",
    bg: "bg-teal-600",
  },
];

const URGENCY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; rowBg: string }
> = {
  expired: {
    label: "منتهية الصلاحية",
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-300",
    rowBg: "bg-red-50/40",
  },
  critical: {
    label: "حرجة (≤7 أيام)",
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-300",
    rowBg: "bg-orange-50/30",
  },
  warning: {
    label: "تحذير (≤30 يوم)",
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    rowBg: "",
  },
  ok: {
    label: "مقبول",
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-200",
    rowBg: "",
  },
};

type SortKey =
  | "daysLeft"
  | "quantity"
  | "totalValue"
  | "productName"
  | "expiryDate";

export default function ExpiryManagementPage() {
  usePageTitle('تقرير انتهاء الصلاحية');
  const { selectedBranch, loading: branchLoading } = useBranch();
  const [batches, setBatches] = useState<ExpiryBatch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
  const [horizon, setHorizon] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("daysLeft");
  const [asc, setAsc] = useState(true);

  const fetchData = useCallback(() => {
    if (branchLoading) return;
    if (horizon === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (horizon === "custom") {
      params.set("fromDate", customFrom);
      params.set("toDate", customTo);
    } else {
      params.set("days", horizon);
    }
    if (selectedBranch?.id && selectedBranch.id !== "all")
      params.set("branchId", selectedBranch.id);
    fetch(`/api/inventory/expiry?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setBatches(d.batches ?? []);
        setStats(d.stats ?? null);
        setCats(d.categories ?? []);
      })
      .catch(console.error)
      .finally(() => { setLoading(false); setInitialized(true); });
  }, [branchLoading, horizon, customFrom, customTo, selectedBranch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let r = batches.filter((b) => {
      const matchSearch =
        b.productName.toLowerCase().includes(search.toLowerCase()) ||
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        (b.supplier ?? "").toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "ALL" || b.categoryId === catFilter;
      return matchSearch && matchCat;
    });
    r = [...r].sort((a, b) => {
      let va: any = a[sort] ?? 0;
      let vb: any = b[sort] ?? 0;
      if (sort === "daysLeft") {
        va = va ?? 999;
        vb = vb ?? 999;
      }
      if (typeof va === "string")
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      return asc ? va - vb : vb - va;
    });
    return r;
  }, [batches, search, catFilter, sort, asc]);

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

  const handleExport = () =>
    exportToCSV(filtered, "expiry-management", {
      productName: "المنتج",
      category: "القسم",
      supplier: "المورد",
      batchNumber: "رقم الدفعة",
      branchName: "الفرع",
      expiryDate: "تاريخ الانتهاء",
      daysLeft: "الأيام المتبقية",
      urgency: "الحالة",
      quantity: "الكمية",
      totalValue: "القيمة",
    });

  const totalFiltered = filtered.reduce((s, b) => s + b.totalValue, 0);
  const totalQty = filtered.reduce((s, b) => s + b.quantity, 0);

  if (!initialized) return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 12px 40px rgba(249,115,22,0.4)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
            <CalendarX2 size={36} className="text-white relative z-10 sk-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
            style={{ background: 'linear-gradient(135deg,#fb923c,#f97316)', boxShadow: '0 2px 8px rgba(249,115,22,0.5)' }} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-xl font-black text-slate-800">جاري تحميل تقرير الصلاحيات</p>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
          <p className="text-sm text-slate-400 font-medium">يتم فحص تواريخ انتهاء صلاحية المنتجات</p>
        </div>
      </div>
      {/* KPI urgency cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton w-9 h-9 rounded-xl" />
            </div>
            <div className="skeleton h-8 w-12" />
            <div className="skeleton h-2.5 w-24" />
          </div>
        ))}
      </div>
      {/* Filter bar skeleton */}
      <div className="rounded-2xl p-4 flex gap-3 flex-wrap" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="skeleton h-9 flex-1 rounded-xl min-w-[160px]" />
        <div className="skeleton h-9 w-28 rounded-xl" />
        <div className="skeleton h-9 w-28 rounded-xl" />
        <div className="skeleton h-9 w-28 rounded-xl" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="grid grid-cols-6 gap-3 px-5 py-3.5 border-b border-slate-100">
          {[35,20,15,15,10,12].map((w,i) => <div key={i} className="skeleton h-3" style={{ width:`${w}%` }} />)}
        </div>
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-3 px-5 py-4">
              {[50,25,18,18,14,16].map((w, j) => (
                <div key={j} className="skeleton h-3.5" style={{ width:`${w - ((i*6+j*4)%18)}%` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}
      {/* Header */}
      <PageHeader
        title="إدارة الصلاحيات"
        subtitle="مراقبة دفعات المنتجات القريبة من انتهاء الصلاحية واتخاذ الإجراءات"
        icon={CalendarX2}
        gradient="linear-gradient(135deg, #f97316 0%, #ea580c 100%)"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={13} /> تحديث
            </button>
            <button onClick={handleExport} className="btn-success">
              <Download size={16} /> تصدير CSV
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              label: "منتهية الصلاحية",
              value: stats.expiredCount,
              icon: Skull,
              grad: "linear-gradient(135deg,#ef4444,#dc2626)",
              alert: stats.expiredCount > 0,
            },
            {
              label: "حرجة (≤ 7 أيام)",
              value: stats.criticalCount,
              icon: ShieldAlert,
              grad: "linear-gradient(135deg,#f97316,#ea580c)",
              alert: stats.criticalCount > 0,
            },
            {
              label: "تحذير (≤ 30 يوم)",
              value: stats.warningCount,
              icon: AlertTriangle,
              grad: "linear-gradient(135deg,#f59e0b,#d97706)",
              alert: false,
            },
            {
              label: "طبيعية (> 30 يوم)",
              value: stats.okCount,
              icon: CheckCircle,
              grad: "linear-gradient(135deg,#10b981,#059669)",
              alert: false,
            },
            {
              label: "قيمة في خطر",
              value: formatCurrency(stats.totalValueAtRisk),
              icon: XCircle,
              grad: "linear-gradient(135deg,#094B9F,#063A8A)",
              alert: stats.totalValueAtRisk > 0,
              isText: true,
            },
          ].map(({ label, value, icon: Icon, grad, alert, isText }) => (
            <div
              key={label}
              className={`rounded-2xl border shadow-sm p-4 transition-colors ${
                alert ? "bg-red-50 border-red-200" : "bg-white border-gray-100"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-500 leading-tight">
                  {label}
                </span>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: grad }}
                >
                  <Icon size={13} className="text-white" />
                </div>
              </div>
              <p
                className={`font-extrabold ${isText ? "text-base" : "text-2xl"} ${alert ? "text-red-700" : "text-gray-900"}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Alert banner */}
      {stats && stats.expiredCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Skull size={17} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-800">
              ⚠ {stats.expiredCount} دفعة منتهية الصلاحية بقيمة{" "}
              {formatCurrency(stats.totalValueAtRisk)}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              يجب سحب هذه المنتجات فوراً من الرفوف وتوثيق الإجراء المتخذ (إتلاف
              / إرجاع مورد / تخفيض سعر).
            </p>
          </div>
        </div>
      )}

      {/* Horizon filter + search + category */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Horizon buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <Clock size={13} /> تصفية حسب المدة:
          </span>
          {HORIZON_OPTIONS.map((h) => {
            const Icon = h.icon;
            const active = horizon === h.key;
            return (
              <button
                key={h.key}
                onClick={() => setHorizon(h.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  active
                    ? `${h.bg} text-white border-transparent shadow-sm`
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                <Icon size={11} /> {h.label}
              </button>
            );
          })}
        </div>

        {/* Custom date range inputs — shown only when مخصص is active */}
        {horizon === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <CalendarRange size={13} className="text-teal-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-500">
              نطاق تاريخ الصلاحية:
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">من:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">إلى:</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400"
                />
              </div>
              {customFrom && customTo && (
                <button
                  onClick={fetchData}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors"
                >
                  <RefreshCw size={11} /> تطبيق
                </button>
              )}
            </div>
            {(!customFrom || !customTo) && (
              <span className="text-xs text-teal-600 font-medium">
                اختر تاريخ البداية والنهاية للبحث
              </span>
            )}
          </div>
        )}

        {/* Search + category row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="بحث بالمنتج، رقم الدفعة، المورد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
            />
          </div>
          {cats.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-gray-400" />
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
                <button
                  onClick={() => setCatFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${catFilter === "ALL" ? "bg-orange-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                >
                  الكل
                </button>
                {cats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCatFilter(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${catFilter === c.id ? "bg-orange-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <span className="text-xs text-gray-400 mr-auto">
            {filtered.length} دفعة · {totalQty} وحدة · قيمة{" "}
            {formatCurrency(totalFiltered)}
          </span>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-right data-table">
            <thead className="bg-gray-50/50 border-b border-[var(--border-color)] sticky top-0 z-10">
              <tr>
                {[
                  { key: "productName", label: "المنتج" },
                  { key: null, label: "القسم" },
                  { key: null, label: "المورد" },
                  { key: null, label: "الفرع" },
                  { key: null, label: "رقم الدفعة" },
                  { key: "expiryDate", label: "تاريخ الانتهاء" },
                  { key: "daysLeft", label: "المتبقي" },
                  { key: "quantity", label: "الكمية" },
                  { key: "totalValue", label: "القيمة" },
                  { key: null, label: "الحالة" },
                ].map((col) => (
                  <th
                    key={col.label}
                    onClick={() => col.key && toggleSort(col.key as SortKey)}
                    className={`px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider select-none ${col.key ? "cursor-pointer hover:text-gray-800" : ""}`}
                  >
                    <span className="flex items-center gap-1 justify-center">
                      {col.label}
                      {col.key && <SortIcon k={col.key as SortKey} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="skeleton h-3.5" style={{ width: `${45 + ((i * 11 + j * 7) % 45)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <CheckCircle size={24} className="text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-gray-700">
                        لا توجد دفعات تنتهي في هذه الفترة
                      </p>
                      <p className="text-xs text-gray-400">
                        جرّب تغيير فلتر المدة أو البحث
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const cfg = URGENCY_CONFIG[b.urgency] ?? URGENCY_CONFIG.ok;
                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-orange-50/20 transition-colors ${cfg.rowBg}`}
                    >
                      {/* Product */}
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/inventory/edit/${b.productId}`}
                          className="group inline-flex items-center gap-1 text-sm font-semibold text-gray-800 hover:text-orange-600 transition-colors"
                        >
                          {b.productName}
                          <ExternalLink
                            size={11}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-orange-400"
                          />
                        </Link>
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {b.category}
                        </span>
                      </td>
                      {/* Supplier */}
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {b.supplier ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md font-medium">
                            {b.supplier}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {/* Branch */}
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {b.branchName}
                      </td>
                      {/* Batch # */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          {b.batchNumber}
                        </span>
                      </td>
                      {/* Expiry date */}
                      <td
                        className="px-4 py-3.5 text-xs font-bold"
                        style={{
                          color:
                            b.urgency === "expired"
                              ? "#b91c1c"
                              : b.urgency === "critical"
                                ? "#c2410c"
                                : "#92400e",
                        }}
                      >
                        {b.expiryDate
                          ? new Date(b.expiryDate).toLocaleDateString("ar-IQ")
                          : "—"}
                      </td>
                      {/* Days left */}
                      <td className="px-4 py-3.5">
                        {b.daysLeft === null ? (
                          <span className="text-gray-300">—</span>
                        ) : b.daysLeft < 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-700 border border-red-200">
                            <Skull size={9} /> منتهية
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                          >
                            <Clock size={9} /> {b.daysLeft} يوم
                          </span>
                        )}
                      </td>
                      {/* Qty */}
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-700">
                        {b.quantity}
                      </td>
                      {/* Value */}
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-900">
                        {formatCurrency(b.totalValue)}
                      </td>
                      {/* Urgency badge */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex text-[11px] font-bold px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>
              {filtered.length} دفعة · إجمالي {totalQty} وحدة
            </span>
            <span className="font-bold text-gray-800">
              إجمالي القيمة: {formatCurrency(totalFiltered)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
