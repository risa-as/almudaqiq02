'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/query/fetcher';
import {
    Tag, TrendingUp, DollarSign, Percent, Zap, Search,
    Download, XCircle, Clock, CheckCircle2, PauseCircle, CalendarClock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import { useBranch } from '@/contexts/BranchContext';
import PageHeader from '@/components/ui/PageHeader';
import { DateRangeFilter, type DatePreset } from '@/components/ui/DateRangeFilter';

interface OfferRow {
    id: string; name: string; type: string; value: number;
    branchName: string | null; status: 'ACTIVE' | 'EXPIRED' | 'SCHEDULED' | 'DISABLED';
    startDate: string; endDate: string | null;
    usageCount: number; revenue: number; discount: number;
}

interface Summary {
    totalUsage: number; totalRevenue: number; totalDiscount: number;
    activeCount: number; offerCount: number;
}

const TYPE_LABELS: Record<string, string> = {
    FIXED_DISCOUNT:      'خصم ثابت',
    PERCENTAGE_DISCOUNT: 'خصم نسبة',
    BUY_X_GET_Y:         'اشترِ واحصل',
};

const STATUS_CONFIG: Record<OfferRow['status'], { label: string; bg: string; text: string; border: string; icon: any }> = {
    ACTIVE:    { label: 'نشط',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
    EXPIRED:   { label: 'منتهي', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: Clock },
    SCHEDULED: { label: 'مجدول', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: CalendarClock },
    DISABLED:  { label: 'متوقف', bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    icon: PauseCircle },
};

const today   = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

const PRESETS: DatePreset[] = [
    { key: 'last_7',   label: 'آخر 7 أيام',   getRange: () => ({ s: daysAgo(6),  e: today() }) },
    { key: 'last_30',  label: 'آخر 30 يوماً', getRange: () => ({ s: daysAgo(29), e: today() }) },
    { key: 'last_90',  label: 'آخر 90 يوماً', getRange: () => ({ s: daysAgo(89), e: today() }) },
    { key: 'this_year', label: 'هذا العام',   getRange: () => ({ s: `${new Date().getFullYear()}-01-01`, e: today() }) },
];

function StatusBadge({ status }: { status: OfferRow['status'] }) {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <Icon size={10} />{cfg.label}
        </span>
    );
}

export default function OffersPerformancePage() {
    usePageTitle('أداء العروض');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [search,      setSearch]      = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [startDate,   setStartDate]   = useState(() => daysAgo(29));
    const [endDate,     setEndDate]     = useState(() => today());

    const bId = selectedBranch?.id ?? 'all';
    const offersQuery = useQuery({
        queryKey: ['report-offers-performance', bId, startDate, endDate],
        queryFn: () => {
            const params = new URLSearchParams({ startDate, endDate });
            if (selectedBranch?.id && selectedBranch.id !== 'all') params.set('branchId', selectedBranch.id);
            return fetchJson<{ summary: Summary; offers: OfferRow[] }>(`/api/reports/offers-performance?${params}`);
        },
        enabled: !branchLoading,
        placeholderData: (prev) => prev,
    });
    const data = offersQuery.data ?? null;
    const loading = offersQuery.isFetching;
    const initialized = !(branchLoading || offersQuery.isPending);

    const handleDateChange = (s: string, e: string) => { setStartDate(s); setEndDate(e); };

    const filtered = useMemo(() => {
        if (!data) return [];
        return data.offers.filter(o => {
            const matchSearch = o.name.toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
            return matchSearch && matchStatus;
        });
    }, [data, search, statusFilter]);

    const chartData = useMemo(() =>
        (data?.offers ?? []).filter(o => o.usageCount > 0).slice(0, 8)
            .map(o => ({ name: o.name, value: o.usageCount })),
    [data]);

    const handleExport = () => exportToCSV(
        filtered.map(o => ({
            name:      o.name,
            type:      TYPE_LABELS[o.type] ?? o.type,
            status:    STATUS_CONFIG[o.status].label,
            usageCount: o.usageCount,
            revenue:   o.revenue,
            discount:  o.discount,
            startDate: new Date(o.startDate).toLocaleDateString('ar-IQ'),
            endDate:   o.endDate ? new Date(o.endDate).toLocaleDateString('ar-IQ') : 'مفتوح',
        })),
        'offers-performance',
        {
            name: 'العرض', type: 'النوع', status: 'الحالة', usageCount: 'مرات الاستخدام',
            revenue: 'الإيرادات', discount: 'الخصم الممنوح', startDate: 'البداية', endDate: 'النهاية',
        }
    );

    if (!initialized) return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
            {/* Hero */}
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', boxShadow: '0 12px 40px rgba(139,92,246,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <Tag size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', boxShadow: '0 2px 8px rgba(139,92,246,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل أداء العروض</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم تحليل استخدام العروض وإيراداتها</p>
                </div>
            </div>
            {/* Date filter skeleton */}
            <div className="flex justify-between items-center gap-4">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-9 w-52 rounded-xl" />
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
                    </div>
                ))}
            </div>
            {/* Chart skeleton */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-48 rounded-xl" />
            </div>
            {/* Table skeleton */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className="px-5 py-4 border-b border-slate-100">
                    <div className="skeleton h-4 w-32" />
                </div>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-4">
                            <div className="skeleton w-9 h-9 rounded-xl flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="skeleton h-3 w-32" />
                                <div className="skeleton h-2.5 w-20" />
                            </div>
                            <div className="skeleton h-3 w-16" />
                            <div className="skeleton h-6 w-14 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    if (!data || !data.summary) return (
        <div className="p-8 flex flex-col items-center justify-center gap-3" dir="rtl">
            <XCircle size={24} className="text-red-500" />
            <p className="text-sm font-semibold text-red-600">خطأ في تحميل بيانات أداء العروض</p>
        </div>
    );

    const { summary } = data;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}

            {/* Header */}
            <PageHeader
                title="أداء العروض"
                subtitle="استخدام العروض وإيراداتها والخصومات الممنوحة خلال الفترة"
                icon={Tag}
                gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)"
                actions={
                    <>
                        <DateRangeFilter presets={PRESETS} defaultPreset="last_30" onChange={handleDateChange} />
                        <button onClick={handleExport} className="btn-success">
                            <Download size={16} /> تصدير Excel
                        </button>
                    </>
                }
            />

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#f5f3ff' }}>
                        <TrendingUp size={16} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">مرات الاستخدام</p>
                        <p className="kpi-value">{summary.totalUsage}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">فاتورة استخدمت عرضاً</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#eef2ff' }}>
                        <DollarSign size={16} style={{ color: '#094B9F' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">إيرادات العروض</p>
                        <p className="kpi-value">{formatCurrency(summary.totalRevenue)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">مبيعات الفواتير المرتبطة بعروض</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#fff7ed' }}>
                        <Percent size={16} style={{ color: '#f97316' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">إجمالي الخصومات</p>
                        <p className="kpi-value text-orange-600">{formatCurrency(summary.totalDiscount)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">قيمة الخصم الممنوح للعملاء</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#ecfdf5' }}>
                        <Zap size={16} style={{ color: '#10b981' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">العروض النشطة</p>
                        <p className="kpi-value text-emerald-600">{summary.activeCount}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">من أصل {summary.offerCount} عرض</p>
                    </div>
                </div>
            </div>

            {/* Top offers bar chart */}
            {chartData.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">أكثر العروض استخداماً في الفترة</h3>
                    <div className="h-64" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(v: any) => [`${v} مرة`, 'مرات الاستخدام']}
                                />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--border-color)] bg-gray-50/50">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="بحث باسم العرض..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                        <button onClick={() => setStatusFilter('ALL')}
                            style={statusFilter === 'ALL' ? { background: '#094B9F', color: '#fff', fontWeight: 700 } : undefined}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === 'ALL' ? 'shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                            الكل
                        </button>
                        {(Object.keys(STATUS_CONFIG) as OfferRow['status'][]).map(key => {
                            const cfg = STATUS_CONFIG[key];
                            return (
                                <button key={key} onClick={() => setStatusFilter(key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === key ? `${cfg.bg} ${cfg.text} shadow-sm` : 'text-gray-500 hover:text-gray-800'}`}>
                                    {cfg.label}
                                </button>
                            );
                        })}
                    </div>

                    <span className="text-xs text-gray-400 mr-auto">{filtered.length} عرض</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right data-table">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                            <tr>
                                {['العرض', 'النوع', 'النطاق', 'الحالة', 'مرات الاستخدام', 'الإيرادات', 'الخصم الممنوح', 'الفترة'].map(h => (
                                    <th key={h} className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-14 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Tag size={28} className="opacity-30" />
                                            <p className="font-semibold text-sm">لا توجد عروض</p>
                                            <p className="text-xs">جرب تغيير الفترة الزمنية أو الفلاتر</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map(row => (
                                <tr key={row.id} className="hover:bg-violet-50/30 transition-colors">
                                    <td className="px-5 py-3.5 font-semibold text-sm text-gray-800 max-w-[200px] truncate">{row.name}</td>
                                    <td className="px-5 py-3.5">
                                        <span className="bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-md text-[11px] font-medium">
                                            {TYPE_LABELS[row.type] ?? row.type}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-gray-500">
                                        {row.branchName ?? <span className="text-blue-600 font-semibold">جميع الفروع</span>}
                                    </td>
                                    <td className="px-5 py-3.5"><StatusBadge status={row.status} /></td>
                                    <td className="px-5 py-3.5">
                                        <span className="text-sm font-extrabold text-violet-600">{row.usageCount}</span>
                                    </td>
                                    <td className="px-5 py-3.5 font-bold text-sm text-gray-700">{formatCurrency(row.revenue)}</td>
                                    <td className="px-5 py-3.5 font-bold text-sm text-orange-600">{formatCurrency(row.discount)}</td>
                                    <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                                        {new Date(row.startDate).toLocaleDateString('ar-IQ')}
                                        {' — '}
                                        {row.endDate ? new Date(row.endDate).toLocaleDateString('ar-IQ') : 'مفتوح'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
