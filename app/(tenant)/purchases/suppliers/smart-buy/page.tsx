'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';
import {
    BrainCircuit,
    AlertTriangle,
    TrendingUp,
    Store,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle2,
    RefreshCw,
    Package,
    Sparkles,
    ShoppingCart,
    Clock,
    BarChart3,
    Skull,
    Star,
    Calendar,
    Phone,
    Trophy,
    AlertCircle,
    Flame,
    DollarSign,
    Layers,
    Info,
    CalendarRange,
} from 'lucide-react';
import { HowItWorks } from '@/components/ui/HowItWorks';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestockItem {
    productId: string;
    name: string;
    categoryName: string;
    currentStock: number;
    minimumStock: number;
    lastPrice: number;
    lowestPrice: number;
    supplierName: string;
    supplierId: string | null;
    salesVelocity: number;
    daysRemaining: number;
    suggestedQty: number;
    estimatedCost: number;
}

interface PriceHikeItem {
    productId: string;
    name: string;
    lastPrice: number;
    lowestPrice: number;
    supplierName: string;
    difference: number;
    pctIncrease: number;
}

interface SupplierDealProduct {
    productId: string;
    name: string;
    price: number;
}

interface SupplierDeal {
    supplierId: string;
    supplierName: string;
    products: SupplierDealProduct[];
}

interface SupplierOrderItem {
    productId: string;
    name: string;
    categoryName: string;
    currentStock: number;
    suggestedQty: number;
    bestPrice: number;
    totalCost: number;
}

interface SupplierOrder {
    supplierId: string | null;
    supplierName: string;
    phone: string | null;
    items: SupplierOrderItem[];
    totalCost: number;
}

interface DeadStockItem {
    productId: string;
    name: string;
    categoryName: string;
    currentStock: number;
    lastSaleDate: string | null;
    stockValue: number;
    supplierName: string;
    supplierId: string | null;
}

interface SupplierScore {
    supplierId: string;
    supplierName: string;
    productCount: number;
    avgPriceStability: number;
    priceIncreaseCount: number;
    priceDecreaseCount: number;
    score: number;
    badge: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

interface ExpiryAlert {
    batchId: string;
    productId: string;
    productName: string;
    branchName: string;
    quantity: number;
    expiryDate: string;
    daysUntilExpiry: number;
    stockValue: number;
    urgency: 'CRITICAL' | 'WARNING' | 'NOTICE';
}

interface Summary {
    totalRestockBudget: number;
    totalRestockItems: number;
    totalDeadStockValue: number;
    criticalExpiryItems: number;
    avgSupplierScore: number;
}

const COVERAGE_PRESETS = [10, 15, 30];

interface SmartBuyData {
    restockList: RestockItem[];
    priceHikes: PriceHikeItem[];
    supplierDeals: SupplierDeal[];
    supplierOrders: SupplierOrder[];
    deadStock: DeadStockItem[];
    supplierScores: SupplierScore[];
    expiryAlerts: ExpiryAlert[];
    coverageDays: number;
    summary: Summary;
}

type TabKey = 'RESTOCK' | 'ORDERS' | 'HIKES' | 'DEALS' | 'DEAD' | 'SCORES' | 'EXPIRY';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgeColors(badge: SupplierScore['badge']) {
    switch (badge) {
        case 'EXCELLENT': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'ممتاز' };
        case 'GOOD':      return { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200',  label: 'جيد'   };
        case 'FAIR':      return { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'متوسط' };
        case 'POOR':      return { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     label: 'ضعيف'  };
    }
}

function urgencyColors(urgency: ExpiryAlert['urgency']) {
    switch (urgency) {
        case 'CRITICAL': return { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    icon: Flame,        label: 'حرج'    };
        case 'WARNING':  return { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200',  icon: AlertTriangle, label: 'تحذير'  };
        case 'NOTICE':   return { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   icon: AlertCircle,  label: 'تنبيه'  };
    }
}

function ScoreRing({ score }: { score: number }) {
    const r = 28; const circ = 2 * Math.PI * r;
    const fill = circ - (score / 100) * circ;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#094B9F' : score >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
            <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
                strokeDasharray={circ} strokeDashoffset={fill}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SmartPurchasingPage() {
  usePageTitle('الشراء الذكي');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<SmartBuyData | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('RESTOCK');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    // Days-of-stock coverage window driving the suggested quantity (user-adjustable).
    const [coverageDays, setCoverageDays] = useState(15);

    // Restore the saved preference after mount (avoids SSR/hydration mismatch).
    useEffect(() => {
        const saved = parseInt(localStorage.getItem('smartBuyCoverageDays') || '', 10);
        if (Number.isFinite(saved) && saved >= 1 && saved <= 365) setCoverageDays(saved);
    }, []);

    // Fetch on branch / coverage change — debounced so typing in the input
    // doesn't fire a request on every keystroke.
    useEffect(() => {
        if (branchLoading) return;
        localStorage.setItem('smartBuyCoverageDays', String(coverageDays));
        const t = setTimeout(() => fetchData(), 300);
        return () => clearTimeout(t);
    }, [selectedBranch, branchLoading, coverageDays]);

    // Latest-request guard: a slow fetch for a previous branch must never overwrite
    // the result of a newer fetch (race condition on branch switch).
    const fetchSeqRef = useRef(0);
    const fetchData = async (isRefresh = false) => {
        const seq = ++fetchSeqRef.current;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedBranch?.id && selectedBranch.id !== 'all') params.set('branchId', selectedBranch.id);
            params.set('coverageDays', String(coverageDays));
            const res = await fetch(`/api/purchases/smart-buy?${params}`);
            const result = await res.json();
            if (seq !== fetchSeqRef.current) return; // a newer request superseded this one
            if (result.success) {
                setData(result.data);
                if (result.data.supplierDeals.length > 0) {
                    setSelectedSupplierId(result.data.supplierDeals[0].supplierId);
                }
                if (result.data.supplierOrders.length > 0) {
                    setExpandedOrder(result.data.supplierOrders[0].supplierId ?? '__unknown__');
                }
            }
        } catch (error) {
            console.error('Failed to fetch smart buy data:', error);
        } finally {
            if (seq === fetchSeqRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    if (loading) return (
        <div className="space-y-8 animate-fade-in-up" dir="rtl">
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <BrainCircuit size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحليل بيانات المشتريات</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">مقارنة أسعار الموردين وتحليل المخزون الذكي</p>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                        <div className="flex items-center justify-between">
                            <div className="skeleton h-3 w-16" />
                            <div className="skeleton w-8 h-8 rounded-xl" />
                        </div>
                        <div className="skeleton h-7 w-20" />
                    </div>
                ))}
            </div>
            <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-9 w-28 rounded-xl" />)}
            </div>
            <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                        <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="skeleton h-4 w-48" />
                            <div className="skeleton h-3 w-32" />
                        </div>
                        <div className="skeleton h-6 w-20 rounded-xl" />
                        <div className="skeleton h-8 w-24 rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );

    if (!data) return null;

    const activeSupplierDeal = data.supplierDeals.find(d => d.supplierId === selectedSupplierId);

    const tabs: { key: TabKey; label: string; count: number; icon: React.ElementType; gradient: string; shadow: string; inactiveText: string }[] = [
        { key: 'RESTOCK', label: 'نواقص موجهة',     count: data.restockList.length,   icon: AlertTriangle, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,0.35)',   inactiveText: 'text-blue-600' },
        { key: 'ORDERS',  label: 'طلبيات الموردين', count: data.supplierOrders.length, icon: ShoppingCart,  gradient: 'linear-gradient(135deg,#094B9F,#073D82)', shadow: 'rgba(9,75,159,0.35)',   inactiveText: 'text-blue-600' },
        { key: 'HIKES',   label: 'تنبيهات الأسعار', count: data.priceHikes.length,    icon: TrendingUp,    gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', shadow: 'rgba(239,68,68,0.35)',    inactiveText: 'text-red-500' },
        { key: 'DEALS',   label: 'أفضل الصفقات',    count: data.supplierDeals.length,  icon: Sparkles,      gradient: 'linear-gradient(135deg,#10b981,#059669)', shadow: 'rgba(16,185,129,0.35)',   inactiveText: 'text-emerald-600' },
        { key: 'DEAD',    label: 'مخزون راكد',      count: data.deadStock.length,      icon: Skull,         gradient: 'linear-gradient(135deg,#64748b,#475569)', shadow: 'rgba(100,116,139,0.35)', inactiveText: 'text-slate-600' },
        { key: 'SCORES',  label: 'تقييم الموردين',  count: data.supplierScores.length, icon: Star,          gradient: 'linear-gradient(135deg,#094B9F,#063A8A)', shadow: 'rgba(14,99,212,0.35)',  inactiveText: 'text-violet-600' },
        { key: 'EXPIRY',  label: 'تنبيهات الانتهاء', count: data.expiryAlerts.length,  icon: Calendar,      gradient: 'linear-gradient(135deg,#f97316,#ea580c)', shadow: 'rgba(249,115,22,0.35)',  inactiveText: 'text-orange-600' },
    ];

    const kpis = [
        { label: 'إجمالي ميزانية التخزين',  value: formatCurrency(data.summary.totalRestockBudget), icon: DollarSign,   gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,0.25)'   },
        { label: 'منتج يحتاج تخزين',        value: data.summary.totalRestockItems,                   icon: Package,      gradient: 'linear-gradient(135deg,#094B9F,#073D82)', shadow: 'rgba(9,75,159,0.25)'   },
        { label: 'قيمة المخزون الراكد',     value: formatCurrency(data.summary.totalDeadStockValue), icon: Layers,       gradient: 'linear-gradient(135deg,#64748b,#475569)', shadow: 'rgba(100,116,139,0.25)'  },
        { label: 'منتج حرج الانتهاء',       value: data.summary.criticalExpiryItems,                 icon: Flame,        gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', shadow: 'rgba(239,68,68,0.25)'    },
        { label: 'متوسط تقييم الموردين',    value: `${data.summary.avgSupplierScore}%`,              icon: BarChart3,    gradient: 'linear-gradient(135deg,#094B9F,#063A8A)', shadow: 'rgba(14,99,212,0.25)'   },
    ];

    return (
        <div className="space-y-6 animate-fade-in-up" dir="rtl">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 12px 32px rgba(9,75,159,0.35)' }}>
                        <div className="absolute inset-0 opacity-30"
                            style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.4) 0%,transparent 60%)' }} />
                        <BrainCircuit className="w-7 h-7 text-white relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black"
                            style={{ background: 'linear-gradient(135deg,#0f172a 0%,#334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            مستشار المشتريات الذكي
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5 font-medium">
                            تحليل استباقي للمخزون · مقارنة أسعار الموردين · تتبع انتهاء الصلاحية
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Coverage window control */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl pr-3 pl-1.5 py-1.5 shadow-sm">
                        <CalendarRange size={15} className="text-blue-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-600 whitespace-nowrap">أيام التغطية</span>
                        <input
                            type="number" min={1} max={365}
                            value={coverageDays}
                            onChange={e => {
                                const v = parseInt(e.target.value, 10);
                                if (Number.isFinite(v)) setCoverageDays(Math.max(1, Math.min(365, v)));
                                else if (e.target.value === '') setCoverageDays(1);
                            }}
                            className="w-12 text-center text-sm font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        />
                        <div className="flex items-center gap-1">
                            {COVERAGE_PRESETS.map(d => (
                                <button key={d} onClick={() => setCoverageDays(d)}
                                    className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-all ${
                                        coverageDays === d ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}>
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                    <HowItWorks
                        label="كيف يعمل المستشار؟"
                        title="كيف يعمل مستشار المشتريات الذكي؟"
                        steps={[
                            {
                                icon: AlertTriangle,
                                title: 'نواقص موجهة',
                                description: 'يفحص النظام مستوى كل منتج ويقارنه بالحد الأدنى وسرعة البيع اليومية لتحديد المنتجات التي تحتاج إعادة طلب عاجلة.',
                                gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
                                shadow: 'rgba(245,158,11,0.3)',
                            },
                            {
                                icon: ShoppingCart,
                                title: 'طلبيات الموردين',
                                description: 'يُجمّع النواقص حسب المورد في طلبية واحدة مع الكمية المقترحة (حسب عدد أيام التغطية الذي تحدده، افتراضياً 15 يوماً) والتكلفة التقديرية لكل طلب.',
                                gradient: 'linear-gradient(135deg,#094B9F,#073D82)',
                                shadow: 'rgba(9,75,159,0.3)',
                            },
                            {
                                icon: TrendingUp,
                                title: 'تنبيهات الأسعار',
                                description: 'يقارن سعر آخر دفعة شراء بأفضل سعر تاريخي، ويُنبّهك عند وجود زيادة تتجاوز 5% — استخدمه للتفاوض مع الموردين.',
                                gradient: 'linear-gradient(135deg,#ef4444,#dc2626)',
                                shadow: 'rgba(239,68,68,0.3)',
                            },
                            {
                                icon: Sparkles,
                                title: 'أفضل الصفقات',
                                description: 'يُبرز المنتجات التي يبيعها الموردون بسعر مساوٍ أو أقل من أرخص سعر تاريخي — فرصة لتخزين مخزون احتياطي بتكلفة منخفضة.',
                                gradient: 'linear-gradient(135deg,#10b981,#059669)',
                                shadow: 'rgba(16,185,129,0.3)',
                            },
                            {
                                icon: Skull,
                                title: 'مخزون راكد',
                                description: 'يرصد المنتجات التي لم تُباع خلال 30 يوماً مع قيمتها المجمدة في المستودع — يساعدك على اتخاذ قرار التصفية أو العرض.',
                                gradient: 'linear-gradient(135deg,#64748b,#475569)',
                                shadow: 'rgba(100,116,139,0.3)',
                            },
                            {
                                icon: Star,
                                title: 'تقييم الموردين',
                                description: 'يحسب درجة لكل مورد بناءً على استقرار أسعاره ونسبة الزيادات التاريخية، ويُصنّفه: ممتاز / جيد / متوسط / ضعيف.',
                                gradient: 'linear-gradient(135deg,#094B9F,#063A8A)',
                                shadow: 'rgba(14,99,212,0.3)',
                            },
                            {
                                icon: Calendar,
                                title: 'تنبيهات الانتهاء',
                                description: 'يعرض الدفعات التي تنتهي صلاحيتها خلال 90 يوماً مع تصنيف حرج / تحذير / تنبيه لمساعدتك في اتخاذ إجراء سريع.',
                                gradient: 'linear-gradient(135deg,#f97316,#ea580c)',
                                shadow: 'rgba(249,115,22,0.3)',
                            },
                        ]}
                    />
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        تحديث
                    </button>
                </div>
            </div>

            {/* ── KPI Row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {kpis.map(({ label, value, icon: Icon, gradient }) => (
                    <div key={label} className="kpi-card">
                        <div className="kpi-icon" style={{ background: gradient }}>
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="kpi-label">{label}</p>
                            <p className="kpi-value">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Tabs ── */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-card w-fit max-w-full">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${isActive ? 'text-white' : `${tab.inactiveText} hover:bg-gray-50/50`}`}
                            style={isActive ? { background: tab.gradient, boxShadow: `0 4px 16px ${tab.shadow}` } : {}}
                        >
                            <Icon size={14} />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-[var(--text-secondary)]'}`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 1 — RESTOCK                                                   */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'RESTOCK' && (
                <div className="glass-panel overflow-hidden animate-fade-in-up">
                    <div className="px-6 py-5 border-b border-white/40 flex items-center gap-4"
                        style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.06) 0%,transparent 60%)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 6px 16px rgba(245,158,11,0.3)' }}>
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">المنتجات التي تحتاج إعادة تخزين</h2>
                            <p className="text-xs text-slate-500 mt-0.5">مرتبة حسب الأيام المتبقية · يشمل الكمية المقترحة وتكلفتها التقديرية</p>
                        </div>
                    </div>
                    {data.restockList.length === 0 ? (
                        <EmptyState icon={CheckCircle2} gradient="linear-gradient(135deg,#10b981,#059669)" shadow="rgba(16,185,129,0.3)"
                            title="المخزون ممتاز!" desc="لا توجد نواقص في الوقت الحالي" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right data-table">
                                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                    <tr>
                                        {['المنتج', 'الفئة', 'المخزون', 'الحد الأدنى', 'أيام متبقية', 'مبيعات/يوم', 'كمية مقترحة', 'تكلفة تقديرية', 'أفضل سعر', 'المورد'].map(h => (
                                            <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap overflow-visible">
                                                {h === 'كمية مقترحة' ? <SuggestedQtyHeader coverageDays={data.coverageDays ?? coverageDays} /> : h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.restockList.map(item => (
                                        <tr key={item.productId} className="hover:bg-blue-50/40 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                        <Package className="w-3.5 h-3.5 text-blue-600" />
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{item.categoryName}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-lg text-sm font-bold whitespace-nowrap">
                                                    <AlertTriangle size={11} />{item.currentStock}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500 text-center">{item.minimumStock}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-sm font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${
                                                    item.daysRemaining <= 3 ? 'bg-red-50 text-red-600 border border-red-100' :
                                                    item.daysRemaining <= 7 ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                                    'bg-slate-50 text-slate-600 border border-slate-100'
                                                }`}>
                                                    {item.daysRemaining === 999 ? '—' : `${item.daysRemaining} يوم`}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500 text-center">{item.salesVelocity}/يوم</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg text-sm font-bold whitespace-nowrap">
                                                    {item.suggestedQty} وحدة
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-700 text-sm whitespace-nowrap">{formatCurrency(item.estimatedCost)}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg font-extrabold text-sm whitespace-nowrap">
                                                    <ArrowDownRight size={12} />{formatCurrency(item.lowestPrice)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1.5 rounded-xl font-bold text-sm whitespace-nowrap">
                                                    <Store size={12} className="text-blue-400" />{item.supplierName}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 2 — SUPPLIER ORDERS                                           */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'ORDERS' && (
                <div className="space-y-4 animate-fade-in-up">
                    <div className="glass-panel px-6 py-5 flex items-center gap-4"
                        style={{ borderBottom: '1px solid rgba(9,75,159,0.1)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#073D82)', boxShadow: '0 6px 16px rgba(9,75,159,0.3)' }}>
                            <ShoppingCart className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">طلبيات الشراء المقترحة بالمورد</h2>
                            <p className="text-xs text-slate-500 mt-0.5">النواقص مجمّعة تلقائياً حسب المورد · انقر على طلبية لعرض تفاصيل المنتجات</p>
                        </div>
                    </div>
                    {data.supplierOrders.length === 0 ? (
                        <div className="glass-panel">
                            <EmptyState icon={CheckCircle2} gradient="linear-gradient(135deg,#10b981,#059669)" shadow="rgba(16,185,129,0.3)"
                                title="لا توجد طلبيات مقترحة" desc="المخزون ضمن الحدود الدنيا لجميع الموردين" />
                        </div>
                    ) : (
                        data.supplierOrders.map((order, idx) => {
                            const key = order.supplierId ?? '__unknown__';
                            const isOpen = expandedOrder === key;
                            return (
                                <div key={key} className="glass-panel overflow-hidden">
                                    <button
                                        onClick={() => setExpandedOrder(isOpen ? null : key)}
                                        className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-blue-50/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 font-black text-blue-700 text-sm">
                                                #{idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{order.supplierName}</p>
                                                {order.phone && (
                                                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <Phone size={10} />{order.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400 font-medium">إجمالي التكلفة</p>
                                                <p className="font-black text-blue-700 text-lg">{formatCurrency(order.totalCost)}</p>
                                            </div>
                                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
                                                {order.items.length} منتج
                                            </span>
                                            <ArrowDownRight
                                                size={18}
                                                className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                            />
                                        </div>
                                    </button>
                                    {isOpen && (
                                        <div className="border-t border-slate-100 overflow-x-auto">
                                            <table className="w-full text-right data-table">
                                                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                                    <tr>
                                                        {['المنتج', 'الفئة', 'المخزون الحالي', 'كمية مقترحة', 'أفضل سعر', 'إجمالي'].map(h => (
                                                            <th key={h} className="px-4 py-3 text-[11px] font-bold text-blue-600 whitespace-nowrap overflow-visible">
                                                                {h === 'كمية مقترحة' ? <SuggestedQtyHeader coverageDays={data.coverageDays ?? coverageDays} /> : h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {order.items.map(item => (
                                                        <tr key={item.productId} className="hover:bg-blue-50/20 transition-colors">
                                                            <td className="px-4 py-3 font-semibold text-slate-800 text-sm whitespace-nowrap">{item.name}</td>
                                                            <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{item.categoryName}</td>
                                                            <td className="px-4 py-3 text-sm text-red-600 font-bold text-center">{item.currentStock}</td>
                                                            <td className="px-4 py-3 text-sm text-blue-700 font-bold text-center">{item.suggestedQty}</td>
                                                            <td className="px-4 py-3 text-sm text-emerald-600 font-bold whitespace-nowrap">{formatCurrency(item.bestPrice)}</td>
                                                            <td className="px-4 py-3 font-extrabold text-slate-800 whitespace-nowrap">{formatCurrency(item.totalCost)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-blue-50/60">
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-3 font-black text-blue-700 text-sm">المجموع الكلي</td>
                                                        <td className="px-4 py-3 font-black text-blue-700">{formatCurrency(order.totalCost)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 3 — PRICE HIKES                                               */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'HIKES' && (
                <div className="glass-panel overflow-hidden animate-fade-in-up">
                    <div className="px-6 py-5 border-b border-white/40 flex items-center gap-4"
                        style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.06) 0%,transparent 60%)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 6px 16px rgba(239,68,68,0.3)' }}>
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">تنبيهات ارتفاع الأسعار</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                منتجات اشتُريت بسعر أعلى من أفضل سعر تاريخي بأكثر من
                                <span className="font-bold text-red-500 mx-1">5%</span>
                            </p>
                        </div>
                    </div>
                    {data.priceHikes.length === 0 ? (
                        <EmptyState icon={CheckCircle2} gradient="linear-gradient(135deg,#10b981,#059669)" shadow="rgba(16,185,129,0.3)"
                            title="الأسعار مستقرة!" desc="لم يُرصد أي ارتفاع غير مبرر في أسعار الموردين" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right data-table">
                                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                    <tr>
                                        {['المنتج', 'المورد', 'آخر سعر مدفوع', 'أفضل سعر تاريخي', 'فرق الزيادة', 'نسبة الزيادة'].map(h => (
                                            <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.priceHikes.map(item => (
                                        <tr key={item.productId} className="hover:bg-red-50/40 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                                        <Package className="w-3.5 h-3.5 text-red-500" />
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 border border-slate-100 px-2.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap">
                                                    <Store size={11} className="text-slate-400" />{item.supplierName}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-lg font-extrabold text-sm whitespace-nowrap">
                                                    <ArrowUpRight size={12} />{formatCurrency(item.lastPrice)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(item.lowestPrice)}</td>
                                            <td className="px-4 py-3 font-extrabold text-red-500 whitespace-nowrap">+{formatCurrency(item.difference)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-sm font-black px-3 py-1 rounded-full whitespace-nowrap ${
                                                    item.pctIncrease >= 20 ? 'bg-red-100 text-red-700' :
                                                    item.pctIncrease >= 10 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    +{item.pctIncrease}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 4 — SUPPLIER DEALS                                            */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'DEALS' && (
                <div className="glass-panel overflow-hidden animate-fade-in-up">
                    <div className="px-6 py-5 border-b border-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.06) 0%,transparent 60%)' }}>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 6px 16px rgba(16,185,129,0.3)' }}>
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800">نقاط قوة الموردين</h2>
                                <p className="text-xs text-slate-500 mt-0.5">المنتجات التي يمتلك فيها كل مورد أرخص سعر تاريخي</p>
                            </div>
                        </div>
                        {data.supplierDeals.length > 0 && (
                            <select
                                className="bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all shadow-sm min-w-[220px]"
                                value={selectedSupplierId || ''}
                                onChange={e => setSelectedSupplierId(e.target.value)}
                            >
                                {data.supplierDeals.map(d => (
                                    <option key={d.supplierId} value={d.supplierId}>
                                        {d.supplierName} — {d.products.length} منتج
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="p-6">
                        {data.supplierDeals.length === 0 ? (
                            <EmptyState icon={ShoppingCart} gradient="linear-gradient(135deg,#64748b,#475569)" shadow="rgba(100,116,139,0.3)"
                                title="لا تتوافر بيانات كافية" desc="أضف المزيد من فواتير الشراء لرؤية صفقات الموردين" />
                        ) : activeSupplierDeal ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {activeSupplierDeal.products.map(p => (
                                    <div key={p.productId}
                                        className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-100 hover:border-emerald-200 transition-all duration-200 overflow-hidden">
                                        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ background: 'linear-gradient(90deg,#10b981,#059669)' }} />
                                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                                            <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <h3 className="font-bold text-slate-700 text-sm leading-snug line-clamp-2 mb-3 group-hover:text-emerald-700 transition-colors">
                                            {p.name}
                                        </h3>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-medium mb-0.5">أرخص سعر</p>
                                                <p className="text-xl font-black text-emerald-600">{formatCurrency(p.price)}</p>
                                            </div>
                                            <span className="text-[10px] text-emerald-500 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">
                                                / للقطعة
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 5 — DEAD STOCK                                                */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'DEAD' && (
                <div className="glass-panel overflow-hidden animate-fade-in-up">
                    <div className="px-6 py-5 border-b border-white/40 flex items-center gap-4"
                        style={{ background: 'linear-gradient(135deg,rgba(100,116,139,0.06) 0%,transparent 60%)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#64748b,#475569)', boxShadow: '0 6px 16px rgba(100,116,139,0.3)' }}>
                            <Skull className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">المخزون الراكد</h2>
                            <p className="text-xs text-slate-500 mt-0.5">منتجات موجودة في المخزون ولم تُباع خلال آخر 30 يوماً</p>
                        </div>
                    </div>
                    {data.deadStock.length === 0 ? (
                        <EmptyState icon={CheckCircle2} gradient="linear-gradient(135deg,#10b981,#059669)" shadow="rgba(16,185,129,0.3)"
                            title="لا يوجد مخزون راكد!" desc="جميع منتجاتك تُباع بانتظام خلال الفترة الأخيرة" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right data-table">
                                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                    <tr>
                                        {['المنتج', 'الفئة', 'الكمية المتوفرة', 'آخر بيعة', 'قيمة المخزون', 'المورد'].map(h => (
                                            <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.deadStock.map(item => (
                                        <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                        <Package className="w-3.5 h-3.5 text-slate-500" />
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{item.categoryName}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-sm font-bold">
                                                    {item.currentStock} وحدة
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.lastSaleDate ? (
                                                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                        <Clock size={12} />
                                                        {new Date(item.lastSaleDate).toLocaleDateString('ar-SA')}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-slate-400 font-medium">لا توجد مبيعات</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{formatCurrency(item.stockValue)}</td>
                                            <td className="px-4 py-3">
                                                <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 border border-slate-100 px-2.5 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap">
                                                    <Store size={11} className="text-slate-400" />{item.supplierName}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 6 — SUPPLIER SCORES                                           */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'SCORES' && (
                <div className="animate-fade-in-up space-y-4">
                    <div className="glass-panel px-6 py-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 6px 16px rgba(14,99,212,0.3)' }}>
                            <Star className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">تقييم الموردين</h2>
                            <p className="text-xs text-slate-500 mt-0.5">مبني على استقرار الأسعار ونسبة الزيادات التاريخية</p>
                        </div>
                    </div>
                    {data.supplierScores.length === 0 ? (
                        <div className="glass-panel">
                            <EmptyState icon={BarChart3} gradient="linear-gradient(135deg,#094B9F,#063A8A)" shadow="rgba(14,99,212,0.3)"
                                title="بيانات غير كافية" desc="أضف دفعات شراء متعددة لنفس المورد لحساب تقييمه" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.supplierScores.map((sc, idx) => {
                                const colors = badgeColors(sc.badge);
                                return (
                                    <div key={sc.supplierId}
                                        className="glass-panel p-5 flex flex-col gap-4 relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-200">
                                        {idx === 0 && (
                                            <div className="absolute top-3 left-3">
                                                <Trophy className="w-5 h-5 text-blue-400" />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4">
                                            <div className="relative shrink-0">
                                                <ScoreRing score={sc.score} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-lg font-black text-slate-800">{sc.score}</span>
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-800 text-base leading-snug truncate">{sc.supplierName}</p>
                                                <span className={`inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border mt-1 ${colors.bg} ${colors.text} ${colors.border}`}>
                                                    {colors.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-slate-50 rounded-xl py-2.5">
                                                <p className="text-sm font-black text-slate-800">{sc.productCount}</p>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">منتجات</p>
                                            </div>
                                            <div className="bg-emerald-50 rounded-xl py-2.5">
                                                <p className="text-sm font-black text-emerald-700">{sc.avgPriceStability}%</p>
                                                <p className="text-[10px] text-emerald-500 font-medium mt-0.5">استقرار</p>
                                            </div>
                                            <div className={`rounded-xl py-2.5 ${sc.priceIncreaseCount > sc.priceDecreaseCount ? 'bg-red-50' : 'bg-slate-50'}`}>
                                                <p className={`text-sm font-black ${sc.priceIncreaseCount > sc.priceDecreaseCount ? 'text-red-600' : 'text-slate-600'}`}>
                                                    ↑{sc.priceIncreaseCount} ↓{sc.priceDecreaseCount}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">زيادات/نزلات</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 7 — EXPIRY ALERTS                                             */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'EXPIRY' && (
                <div className="glass-panel overflow-hidden animate-fade-in-up">
                    <div className="px-6 py-5 border-b border-white/40 flex items-center gap-4"
                        style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.06) 0%,transparent 60%)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 6px 16px rgba(249,115,22,0.3)' }}>
                            <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">تنبيهات انتهاء الصلاحية</h2>
                            <p className="text-xs text-slate-500 mt-0.5">منتجات تنتهي صلاحيتها خلال 90 يوماً · مرتبة حسب الأقرب انتهاءً</p>
                        </div>
                    </div>
                    {data.expiryAlerts.length === 0 ? (
                        <EmptyState icon={CheckCircle2} gradient="linear-gradient(135deg,#10b981,#059669)" shadow="rgba(16,185,129,0.3)"
                            title="لا تنبيهات انتهاء قريبة!" desc="جميع المنتجات لديها صلاحية أكثر من 90 يوماً" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right data-table">
                                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                    <tr>
                                        {['المنتج', 'الفرع', 'الكمية', 'تاريخ الانتهاء', 'أيام متبقية', 'قيمة المخزون', 'الحالة'].map(h => (
                                            <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.expiryAlerts.map(alert => {
                                        const uc = urgencyColors(alert.urgency);
                                        const UrgIcon = uc.icon;
                                        return (
                                            <tr key={alert.batchId} className="hover:bg-orange-50/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${uc.bg}`}>
                                                            <Package className={`w-3.5 h-3.5 ${uc.text}`} />
                                                        </div>
                                                        <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{alert.productName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{alert.branchName}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-700 text-center">{alert.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar size={11} className="text-slate-400" />
                                                        {new Date(alert.expiryDate).toLocaleDateString('ar-SA')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-sm font-black px-2.5 py-1 rounded-lg whitespace-nowrap border ${uc.bg} ${uc.text} ${uc.border}`}>
                                                        {alert.daysUntilExpiry} يوم
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{formatCurrency(alert.stockValue)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${uc.bg} ${uc.text} ${uc.border}`}>
                                                        <UrgIcon size={11} />{uc.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}

// ─── Suggested-quantity column header with an explanation tooltip ─────────────

function SuggestedQtyHeader({ coverageDays }: { coverageDays: number }) {
    const iconRef = useRef<HTMLSpanElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);

    const TW = 288;   // tooltip width  (w-72)
    const EST_H = 180; // estimated tooltip height for flip decision

    const show = () => {
        const r = iconRef.current?.getBoundingClientRect();
        if (!r) return;
        // Clamp horizontally so the centered box stays inside the viewport.
        const left = Math.min(Math.max(r.left + r.width / 2, TW / 2 + 8), window.innerWidth - TW / 2 - 8);
        // Flip above the icon when there isn't enough room below.
        const placeAbove = r.bottom + EST_H + 12 > window.innerHeight;
        const top = placeAbove ? r.top - 8 : r.bottom + 8;
        setPos({ top, left, placeAbove });
    };
    const hide = () => setPos(null);

    return (
        <span className="inline-flex items-center gap-1 align-middle">
            كمية مقترحة
            <span ref={iconRef} onMouseEnter={show} onMouseLeave={hide}
                className="inline-flex cursor-help">
                <Info size={12} className="text-blue-400 shrink-0" />
            </span>
            {pos && createPortal(
                <div
                    style={{
                        position: 'fixed', top: pos.top, left: pos.left,
                        transform: `translate(-50%, ${pos.placeAbove ? '-100%' : '0'})`,
                        width: TW, zIndex: 9999,
                        background: 'white', border: '1px solid #e2e8f0', borderRadius: 14,
                        boxShadow: '0 12px 32px rgba(15,23,42,0.18)', padding: 14,
                        whiteSpace: 'normal', textAlign: 'right', direction: 'rtl',
                    }}
                >
                    <p className="text-xs font-black text-slate-800 mb-2">طريقة حساب الكمية المقترحة</p>
                    <div className="space-y-1.5 text-[11px] font-medium text-slate-600 leading-relaxed">
                        <p>• <b>معدل البيع اليومي</b> = مبيعات آخر 30 يوماً ÷ 30 (بالوحدة الأساسية).</p>
                        <p>• <b>الهدف</b> = معدل البيع اليومي × <b className="text-blue-600">{coverageDays} يوم</b> (أيام التغطية).</p>
                        <p>• <b>المقترح</b> = الهدف − المخزون الحالي.</p>
                        <p>• بحدٍّ أدنى يكفي لإعادة المخزون إلى <b>الحد الأدنى</b> للمنتج (للمنتجات بطيئة الحركة).</p>
                    </div>
                    <p className="mt-2 pt-2 text-[10px] text-slate-400" style={{ borderTop: '1px solid #f1f5f9' }}>
                        غيّر «أيام التغطية» من أعلى الصفحة لإعادة حساب الأرقام فوراً.
                    </p>
                </div>,
                document.body
            )}
        </span>
    );
}

// ─── Shared Empty State ───────────────────────────────────────────────────────

function EmptyState({ icon: Icon, gradient, shadow, title, desc }: {
    icon: React.ElementType; gradient: string; shadow: string; title: string; desc: string
}) {
    return (
        <div className="py-20 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: gradient, boxShadow: `0 8px 24px ${shadow}` }}>
                <Icon className="w-8 h-8 text-white" />
            </div>
            <div>
                <p className="font-bold text-slate-700 text-lg">{title}</p>
                <p className="text-sm text-slate-400 mt-1">{desc}</p>
            </div>
        </div>
    );
}
