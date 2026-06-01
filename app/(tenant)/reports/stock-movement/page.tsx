'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Package, Search, ArrowDownToLine, ArrowUpFromLine,
    Download, Activity, RefreshCw, Filter, ArrowLeftRight,
    ExternalLink,
} from 'lucide-react';
import { exportToCSV } from '@/lib/exportExcel';
import { useBranch } from '@/contexts/BranchContext';
import PageHeader from '@/components/ui/PageHeader';

const PERIOD_LABELS: Record<string, string> = { today: 'اليوم', week: 'أسبوع', month: '30 يوماً', all: 'الكل' };
const TYPE_LABELS:   Record<string, string> = { all: 'الكل', IN: 'وارد', OUT: 'صادر' };

const SUBTYPE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
    purchase: { label: 'توريد',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: ArrowDownToLine },
    return:   { label: 'مرتجع',   bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: ArrowDownToLine },
    sale:     { label: 'مبيعات',  bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  icon: ArrowUpFromLine },
    transfer: { label: 'تحويل',   bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  icon: ArrowLeftRight  },
};

const PAGE_SIZE = 25;

function ProductLink({ id, name }: { id?: string | null; name: string }) {
    if (!id) return <span className="font-semibold text-gray-800 max-w-[180px] truncate block">{name}</span>;
    return (
        <Link href={`/inventory/edit/${id}`}
            className="group inline-flex items-center gap-1 font-semibold text-gray-800 hover:text-blue-600 transition-colors max-w-[180px] truncate">
            {name}
            <ExternalLink size={11} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
        </Link>
    );
}

export default function StockMovementReport() {
  usePageTitle('حركة المخزون');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [movements,    setMovements]    = useState<any[]>([]);
    const [stats,        setStats]        = useState<any>(null);
    const [topProducts,  setTopProducts]  = useState<any[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [search,       setSearch]       = useState('');
    const [period,       setPeriod]       = useState('month');
    const [typeFilter,   setTypeFilter]   = useState('all');
    const [page,         setPage]         = useState(1);

    useEffect(() => {
        if (branchLoading) return;
        setLoading(true);
        setPage(1);
        const params = new URLSearchParams({ period });
        if (typeFilter !== 'all') params.set('type', typeFilter);
        if (selectedBranch?.id && selectedBranch.id !== 'all') params.set('branchId', selectedBranch.id);
        fetch(`/api/reports/stock-movement?${params}`)
            .then(r => r.json())
            .then(d => { setMovements(d.movements ?? []); setStats(d.stats ?? null); setTopProducts(d.topProducts ?? []); })
            .catch(console.error)
            .finally(() => { setLoading(false); setInitialized(true); });
    }, [selectedBranch, branchLoading, period, typeFilter]);

    const filtered = useMemo(() =>
        movements.filter(m =>
            m.productName.toLowerCase().includes(search.toLowerCase()) ||
            m.reference.toLowerCase().includes(search.toLowerCase()) ||
            (m.user ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (m.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (m.supplier ?? '').toLowerCase().includes(search.toLowerCase())
        ), [movements, search]);

    const pages     = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const maxTop    = Math.max(...topProducts.map(p => p.in + p.out), 1);

    const handleExport = () => exportToCSV(filtered, 'stock-movement', {
        date: 'التاريخ', productName: 'المنتج', category: 'القسم', supplier: 'المورد',
        type: 'النوع', quantity: 'الكمية', reference: 'المرجع', user: 'بواسطة'
    });

    if (!initialized) return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
            {/* Hero */}
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 12px 40px rgba(16,185,129,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <Activity size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#34d399,#10b981)', boxShadow: '0 2px 8px rgba(16,185,129,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل حركة المخزون</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم رصد الواردات والصادرات من المخزون</p>
                </div>
            </div>
            {/* Filters skeleton */}
            <div className="flex gap-3 flex-wrap">
                {[120, 96, 96, 140].map((w, i) => <div key={i} className="skeleton h-9 rounded-xl" style={{ width: `${w}px` }} />)}
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                        <div className="flex items-center justify-between">
                            <div className="skeleton h-3 w-16" />
                            <div className="skeleton w-8 h-8 rounded-xl" />
                        </div>
                        <div className="skeleton h-7 w-20" />
                    </div>
                ))}
            </div>
            {/* Table skeleton */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className="px-5 py-4 flex gap-3 border-b border-slate-100">
                    <div className="skeleton h-8 flex-1 rounded-xl" />
                    <div className="skeleton h-8 w-24 rounded-xl" />
                </div>
                <div className="grid grid-cols-8 gap-3 px-5 py-3 border-b border-slate-100">
                    {[30,45,25,20,15,15,20,25].map((w,i) => <div key={i} className="skeleton h-3" style={{ width:`${w}%` }} />)}
                </div>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-8 gap-3 px-5 py-3.5">
                            {[40,55,30,25,20,18,25,30].map((w, j) => (
                                <div key={j} className="skeleton h-3.5" style={{ width: `${w - ((i*5+j*4)%15)}%` }} />
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
                title="حركة المخزون"
                subtitle="سجل الوارد والصادر والتحويلات بين الفروع"
                icon={Activity}
                gradient="linear-gradient(135deg, #10b981, #059669)"
                actions={
                    <button onClick={handleExport}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 text-sm font-bold rounded-xl hover:bg-emerald-700 transition">
                        <Download size={15} /> تصدير Excel
                    </button>
                }
            />

            {/* Stats cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'إجمالي الوارد',  value: stats.totalIn,  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ArrowDownToLine },
                        { label: 'إجمالي الصادر', value: stats.totalOut, color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100',  icon: ArrowUpFromLine },
                        { label: 'صافي الحركة',   value: stats.net,      color: stats.net >= 0 ? 'text-blue-700' : 'text-red-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: RefreshCw },
                        { label: 'عدد الحركات',   value: stats.count,    color: 'text-gray-700',   bg: 'bg-gray-50',    border: 'border-gray-100',    icon: Package },
                    ].map(({ label, value, color, bg, border, icon: Icon }) => (
                        <div key={label} className={`rounded-2xl border ${border} ${bg} p-4 flex items-center gap-3`}>
                            <div className="w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                                <Icon size={15} className={color} />
                            </div>
                            <div>
                                <p className={`text-xl font-extrabold ${color}`}>
                                    {label === 'صافي الحركة' && value > 0 ? '+' : ''}{value}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Top products mini chart */}
            {topProducts.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">أكثر المنتجات حركةً في الفترة</h3>
                    <div className="space-y-3">
                        {topProducts.map((p, i) => {
                            const total = p.in + p.out;
                            return (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{i+1}</span>
                                            <span className="font-semibold text-gray-800 truncate max-w-[200px]">{p.name}</span>
                                            <span className="text-gray-400">{p.category}</span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-emerald-600 font-bold">+{p.in}</span>
                                            <span className="text-orange-600 font-bold">-{p.out}</span>
                                        </div>
                                    </div>
                                    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                                        <div className="bg-emerald-400 h-full" style={{ width: `${Math.round((p.in / maxTop) * 100)}%` }} />
                                        <div className="bg-orange-400 h-full" style={{ width: `${Math.round((p.out / maxTop) * 100)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters + Table */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--border-color)] bg-gray-50/50">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="بحث بالمنتج، المرجع، المورد..."
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                        {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                            <button key={k} onClick={() => { setPeriod(k); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === k ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                {v}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                            <button key={k} onClick={() => { setTypeFilter(k); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${typeFilter === k ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                {v}
                            </button>
                        ))}
                    </div>

                    <span className="text-xs text-gray-400 mr-auto">{filtered.length} حركة</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                            <tr>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ</th>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المنتج</th>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">القسم</th>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المورد</th>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">النوع</th>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الكمية</th>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المرجع</th>
                                <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">بواسطة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="skeleton h-3.5" style={{ width: `${45 + ((i * 11 + j * 7) % 45)}%` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Package size={28} className="opacity-30" />
                                            <p className="font-semibold text-sm">لا توجد حركات</p>
                                            <p className="text-xs">جرب تغيير الفترة الزمنية أو الفلاتر</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((m) => {
                                    const cfg = SUBTYPE_CONFIG[m.subtype] ?? SUBTYPE_CONFIG.sale;
                                    const Icon = cfg.icon;
                                    return (
                                        <tr key={m.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                                                {new Date(m.date).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm">
                                                <ProductLink id={m.productId} name={m.productName} />
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-gray-400">{m.category}</td>
                                            <td className="px-5 py-3.5 text-xs text-gray-500">
                                                {m.supplier
                                                    ? <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md font-medium">{m.supplier}</span>
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                    <Icon size={11} />{cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`font-extrabold text-sm ${m.type === 'IN' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                                    {m.type === 'IN' ? '+' : '−'}{m.quantity}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-xs text-gray-400 max-w-[160px] truncate">{m.reference}</td>
                                            <td className="px-5 py-3.5 text-xs text-gray-500">{m.user}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-color)] bg-gray-50/30">
                        <span className="text-xs text-gray-400">صفحة {page} من {pages}</span>
                        <div className="flex gap-1">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition">
                                السابق
                            </button>
                            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                                const p = page <= 3 ? i + 1 : page - 2 + i;
                                if (p < 1 || p > pages) return null;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${p === page ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 hover:bg-gray-100'}`}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition">
                                التالي
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
