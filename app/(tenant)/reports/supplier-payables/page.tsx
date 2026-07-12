'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
    HandCoins, DollarSign, Users, Trophy, Search,
    Download, Phone, XCircle, ExternalLink, ShoppingBag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import { useBranch } from '@/contexts/BranchContext';
import PageHeader from '@/components/ui/PageHeader';

interface PayableRow {
    id: string; name: string; phone?: string | null;
    balance: number; lastEntryDate: string | null;
}

interface Summary {
    totalPayables: number;
    supplierCount: number;
    topSupplier: { name: string; balance: number } | null;
}

export default function SupplierPayablesPage() {
    usePageTitle('مستحقات الموردين');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [data,        setData]        = useState<{ summary: Summary; suppliers: PayableRow[] } | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [search,      setSearch]      = useState('');

    useEffect(() => {
        if (branchLoading) return;
        setLoading(true);
        const q = selectedBranch?.id && selectedBranch.id !== 'all' ? `?branchId=${selectedBranch.id}` : '';
        fetch(`/api/reports/supplier-payables${q}`)
            .then(r => r.json()).then(setData).catch(console.error)
            .finally(() => { setLoading(false); setInitialized(true); });
    }, [selectedBranch, branchLoading]);

    const filtered = useMemo(() => {
        if (!data) return [];
        return data.suppliers.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.phone ?? '').includes(search)
        );
    }, [data, search]);

    const chartData = useMemo(() =>
        (data?.suppliers ?? []).slice(0, 8).map(s => ({ name: s.name, value: s.balance })),
    [data]);

    const handleExport = () => exportToCSV(
        filtered.map(s => ({
            name:    s.name,
            phone:   s.phone ?? '',
            balance: s.balance,
            lastEntryDate: s.lastEntryDate ? new Date(s.lastEntryDate).toLocaleDateString('ar-IQ') : '',
        })),
        'supplier-payables',
        { name: 'المورد', phone: 'الهاتف', balance: 'الرصيد المستحق', lastEntryDate: 'آخر حركة' }
    );

    if (!initialized) return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
            {/* Hero */}
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 12px 40px rgba(245,158,11,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <HandCoins size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', boxShadow: '0 2px 8px rgba(245,158,11,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل مستحقات الموردين</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم حساب أرصدة الموردين من دفتر الحسابات</p>
                </div>
            </div>
            {/* KPI skeletons */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
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
            <p className="text-sm font-semibold text-red-600">خطأ في تحميل بيانات مستحقات الموردين</p>
        </div>
    );

    const { summary } = data;
    const maxBalance = Math.max(...(data.suppliers.map(s => s.balance)), 1);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}

            {/* Header */}
            <PageHeader
                title="مستحقات الموردين"
                subtitle="أرصدة الموردين الدائنة مرتبة من الأعلى للأدنى"
                icon={HandCoins}
                gradient="linear-gradient(135deg, #f59e0b, #d97706)"
                actions={
                    <button onClick={handleExport} className="btn-success">
                        <Download size={16} /> تصدير Excel
                    </button>
                }
            />

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="kpi-card col-span-2 md:col-span-1">
                    <div className="kpi-icon" style={{ background: '#fffbeb' }}>
                        <DollarSign size={16} style={{ color: '#f59e0b' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">إجمالي المستحقات</p>
                        <p className="kpi-value text-amber-600">{formatCurrency(summary.totalPayables)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">المبالغ المستحقة للموردين</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#eef2ff' }}>
                        <Users size={16} style={{ color: '#094B9F' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">عدد الموردين الدائنين</p>
                        <p className="kpi-value">{summary.supplierCount}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">مورد لديه رصيد مستحق</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#fef2f2' }}>
                        <Trophy size={16} style={{ color: '#ef4444' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">أكبر مورد دائن</p>
                        <p className="kpi-value truncate">{summary.topSupplier?.name ?? '—'}</p>
                        <p className="text-[11px] text-red-500 font-bold mt-0.5">
                            {summary.topSupplier ? formatCurrency(summary.topSupplier.balance) : 'لا يوجد'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Top creditors bar chart */}
            {chartData.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">أكبر الموردين الدائنين</h3>
                    <div className="h-64" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)} مليون` : v >= 1000 ? `${(v/1000).toFixed(0)} الف` : String(v)} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(v: any) => [formatCurrency(Number(v)), 'الرصيد المستحق']}
                                />
                                <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={60} />
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
                        <input type="text" placeholder="بحث بالاسم أو الهاتف..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                        />
                    </div>
                    <span className="text-xs text-gray-400 mr-auto">{filtered.length} مورد</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right data-table">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                            <tr>
                                {['المورد', 'الهاتف', 'الرصيد المستحق', 'نسبة من الإجمالي', 'آخر حركة'].map(h => (
                                    <th key={h} className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-14 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <ShoppingBag size={28} className="opacity-30" />
                                            <p className="font-semibold text-sm">لا توجد مستحقات للموردين</p>
                                            <p className="text-xs">جميع أرصدة الموردين مسددة</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map(row => (
                                <tr key={row.id} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <Link href="/purchases/suppliers"
                                            className="group inline-flex items-center gap-1 font-semibold text-sm text-gray-800 hover:text-amber-600 transition-colors">
                                            {row.name}
                                            <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                                        </Link>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-gray-500">
                                        {row.phone
                                            ? <span className="flex items-center gap-1"><Phone size={11} />{row.phone}</span>
                                            : <span className="text-gray-300">—</span>
                                        }
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className="text-sm font-extrabold text-amber-600">{formatCurrency(row.balance)}</span>
                                    </td>
                                    <td className="px-5 py-3.5 w-40">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                                                <div className="h-full rounded-full bg-amber-400"
                                                    style={{ width: `${(row.balance / maxBalance) * 100}%` }} />
                                            </div>
                                            <span className="text-[11px] text-gray-400 font-semibold w-10">
                                                {summary.totalPayables > 0 ? ((row.balance / summary.totalPayables) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-gray-400">
                                        {row.lastEntryDate ? new Date(row.lastEntryDate).toLocaleDateString('ar-IQ') : '—'}
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
