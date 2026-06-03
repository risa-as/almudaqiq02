'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Users, DollarSign, Clock, AlertTriangle, Search,
    ChevronDown, ChevronUp, ExternalLink, Phone, XCircle,
    Filter,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';
import PageHeader from '@/components/ui/PageHeader';

interface DebtRow {
    id: string; name: string; phone?: string | null;
    branchName: string; balance: number; daysOld: number;
    bucket: '0-30' | '31-60' | '61-90' | '90+';
    oldestDate: string; txCount: number;
    recentTxs: { id: string; receiptNumber?: string | null; date: string; totalAmount: number; paidAmount: number; unpaid: number }[];
}

interface Summary {
    totalDebt: number; customerCount: number;
    byBucket: Record<string, number>; cntBucket: Record<string, number>;
}

const BUCKET_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dotColor: string }> = {
    '0-30':  { label: '0 – 30 يوم',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dotColor: '#10b981' },
    '31-60': { label: '31 – 60 يوم', bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dotColor: '#f59e0b' },
    '61-90': { label: '61 – 90 يوم', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dotColor: '#f97316' },
    '90+':   { label: '90+ يوم',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dotColor: '#ef4444' },
};

function AgingBadge({ bucket }: { bucket: string }) {
    const cfg = BUCKET_CONFIG[bucket];
    if (!cfg) return null;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <Clock size={10} />{cfg.label}
        </span>
    );
}

function CustomerRow({ row }: { row: DebtRow }) {
    const [open, setOpen] = useState(false);
    const cfg = BUCKET_CONFIG[row.bucket];

    return (
        <>
            <tr className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${open ? 'bg-blue-50/20' : ''}`}
                onClick={() => setOpen(p => !p)}>
                <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg?.dotColor ?? '#6b7280' }} />
                        <Link href={`/sales/customers/${row.id}`} onClick={e => e.stopPropagation()}
                            className="group inline-flex items-center gap-1 font-semibold text-sm text-gray-800 hover:text-blue-600 transition-colors">
                            {row.name}
                            <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                        </Link>
                    </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-500">
                    {row.phone
                        ? <span className="flex items-center gap-1"><Phone size={11} />{row.phone}</span>
                        : <span className="text-gray-300">—</span>
                    }
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-500">{row.branchName}</td>
                <td className="px-5 py-3.5">
                    <span className="text-sm font-extrabold text-red-600">{formatCurrency(row.balance)}</span>
                </td>
                <td className="px-5 py-3.5">
                    <AgingBadge bucket={row.bucket} />
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400">
                    {new Date(row.oldestDate).toLocaleDateString('ar-IQ')}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400">{row.txCount} فاتورة</td>
                <td className="px-5 py-3.5">
                    <button className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 transition-colors">
                        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                </td>
            </tr>
            {open && row.recentTxs.length > 0 && (
                <tr>
                    <td colSpan={8} className="px-8 pb-4 pt-0 bg-gray-50/50">
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <table className="w-full text-right text-xs data-table">
                                <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                    <tr>
                                        {['رقم الفاتورة','التاريخ','المبلغ الكلي','المدفوع','المتبقي'].map(h => (
                                            <th key={h} className="px-4 py-2 font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {row.recentTxs.map(tx => (
                                        <tr key={tx.id} className="hover:bg-blue-50/30">
                                            <td className="px-4 py-2 font-mono text-gray-600">
                                                <Link href="/sales/invoices" className="hover:text-blue-600 transition-colors">
                                                    {tx.receiptNumber ?? tx.id.slice(-8).toUpperCase()}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">{new Date(tx.date).toLocaleDateString('ar-IQ')}</td>
                                            <td className="px-4 py-2 font-bold text-gray-700">{formatCurrency(tx.totalAmount)}</td>
                                            <td className="px-4 py-2 text-emerald-600 font-medium">{formatCurrency(tx.paidAmount)}</td>
                                            <td className="px-4 py-2 font-bold text-red-600">{formatCurrency(tx.unpaid)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export default function CustomersDebtPage() {
  usePageTitle('ديون العملاء');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [data,    setData]    = useState<{ summary: Summary; customers: DebtRow[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [search,  setSearch]  = useState('');
    const [bucket,  setBucket]  = useState<string>('ALL');

    useEffect(() => {
        if (branchLoading) return;
        setLoading(true);
        const q = selectedBranch?.id && selectedBranch.id !== 'all' ? `?branchId=${selectedBranch.id}` : '';
        fetch(`/api/reports/customers-debt${q}`)
            .then(r => r.json()).then(setData).catch(console.error).finally(() => { setLoading(false); setInitialized(true); });
    }, [selectedBranch, branchLoading]);

    const filtered = useMemo(() => {
        if (!data) return [];
        return data.customers.filter(c => {
            const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                (c.phone ?? '').includes(search);
            const matchBucket = bucket === 'ALL' || c.bucket === bucket;
            return matchSearch && matchBucket;
        });
    }, [data, search, bucket]);

    if (!initialized) return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
            {/* Hero */}
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 12px 40px rgba(239,68,68,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <Users size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#f87171,#ef4444)', boxShadow: '0 2px 8px rgba(239,68,68,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل تقرير الذمم</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم حساب أرصدة العملاء والذمم المتأخرة</p>
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
            {/* Table skeleton */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className="px-5 py-4 border-b border-slate-100">
                    <div className="skeleton h-4 w-32" />
                </div>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 7 }).map((_, i) => (
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

    if (!data) return (
        <div className="p-8 flex flex-col items-center justify-center gap-3" dir="rtl">
            <XCircle size={24} className="text-red-500" />
            <p className="text-sm font-semibold text-red-600">خطأ في تحميل بيانات الذمم</p>
        </div>
    );

    const { summary } = data;
    const maxBucket = Math.max(...Object.values(summary.byBucket), 1);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}

            {/* Header */}
            <PageHeader
                title="ذمم العملاء"
                subtitle="تقرير الديون المستحقة مرتبة حسب العمر"
                icon={Users}
                gradient="linear-gradient(135deg, #ef4444, #dc2626)"
            />

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="kpi-card col-span-2 md:col-span-1">
                    <div className="kpi-icon" style={{ background: '#fef2f2' }}>
                        <DollarSign size={16} style={{ color: '#ef4444' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">إجمالي الذمم</p>
                        <p className="kpi-value text-red-600">{formatCurrency(summary.totalDebt)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{summary.customerCount} عميل</p>
                    </div>
                </div>

                {Object.entries(BUCKET_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="kpi-card">
                        <div className="kpi-icon" style={{ background: cfg.dotColor + '18' }}>
                            <Clock size={14} style={{ color: cfg.dotColor }} />
                        </div>
                        <div className="min-w-0">
                            <p className="kpi-label">{cfg.label}</p>
                            <p className="kpi-value">{formatCurrency(summary.byBucket[key] ?? 0)}</p>
                            <div className="mt-1 h-1 rounded-full overflow-hidden bg-gray-100">
                                <div className="h-full rounded-full"
                                    style={{ width: `${((summary.byBucket[key] ?? 0) / maxBucket) * 100}%`, background: cfg.dotColor }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Alert if over-90 exists */}
            {(summary.cntBucket['90+'] ?? 0) > 0 && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={15} className="text-red-600" />
                    </div>
                    <p className="text-sm text-red-700 font-semibold">
                        ⚠ {summary.cntBucket['90+']} عميل لديهم ديون تجاوزت 90 يوماً — بإجمالي {formatCurrency(summary.byBucket['90+'] ?? 0)}. يُنصح بالتواصل الفوري.
                    </p>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="بحث بالاسم أو الهاتف..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter size={13} className="text-gray-400" />
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                            <button onClick={() => setBucket('ALL')}
                                style={bucket === 'ALL' ? { background: '#094B9F', color: '#fff', fontWeight: 700 } : undefined}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${bucket === 'ALL' ? 'shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                الكل
                            </button>
                            {Object.entries(BUCKET_CONFIG).map(([key, cfg]) => (
                                <button key={key} onClick={() => setBucket(key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${bucket === key ? `${cfg.bg} ${cfg.text} shadow-sm` : 'text-gray-500 hover:text-gray-800'}`}>
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <span className="text-xs text-gray-400 mr-auto">{filtered.length} عميل</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right data-table">
                        <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                {['العميل','الهاتف','الفرع','الرصيد المستحق','العمر','أقدم فاتورة','الفواتير',''].map(h => (
                                    <th key={h} className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-14 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Users size={28} className="opacity-30" />
                                            <p className="font-semibold text-sm">لا توجد ذمم مستحقة</p>
                                            <p className="text-xs">جميع العملاء سددوا مستحقاتهم</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map(row => (
                                <CustomerRow key={row.id} row={row} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
