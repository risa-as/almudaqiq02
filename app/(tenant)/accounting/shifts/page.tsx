'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Wallet, Search, TrendingDown, TrendingUp, Minus,
    Download, Clock, Users, CheckCircle, AlertCircle, Activity, DollarSign,
    ChevronDown, ChevronUp, Receipt, User
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { useBranch } from '@/contexts/BranchContext';

function duration(openedAt: string, closedAt: string | null) {
    if (!closedAt) return null;
    const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}س ${m}د` : `${m} دقيقة`;
}

function DiffBadge({ diff }: { diff: number | null }) {
    if (diff === null) return <span className="text-slate-300 text-xs">—</span>;
    if (Math.abs(diff) < 0.01) return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
            <Minus size={10} /> مطابق
        </span>
    );
    if (diff > 0) return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
            <TrendingUp size={10} /> +{formatCurrency(diff)}
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
            <TrendingDown size={10} /> {formatCurrency(diff)}
        </span>
    );
}

export default function ShiftsReport() {
  usePageTitle('الورديات');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [shifts, setShifts]           = useState<any[]>([]);
    const [loading, setLoading]         = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId]   = useState<string | null>(null);

    useEffect(() => {
        if (branchLoading) return;
        setLoading(true);
        const q = selectedBranch?.id && selectedBranch.id !== 'all' ? `?branchId=${selectedBranch.id}` : '';
        fetch(`/api/reports/shifts${q}`)
            .then(r => r.json())
            .then(data => setShifts(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedBranch, branchLoading]);

    const filtered = useMemo(() =>
        shifts.filter(s =>
            (s.user?.username ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.id.toString().includes(searchQuery)
        ), [shifts, searchQuery]);

    const stats = useMemo(() => {
        const closed     = filtered.filter(s => s.closedAt);
        const active     = filtered.filter(s => !s.closedAt);
        const surplus    = closed.filter(s => Number(s.difference ?? 0) > 0.01).length;
        const deficit    = closed.filter(s => Number(s.difference ?? 0) < -0.01).length;
        const totalSales = filtered.reduce((a, s) => a + (s.totalSales ?? 0), 0);
        return { total: filtered.length, active: active.length, surplus, deficit, totalSales };
    }, [filtered]);

    const handleExport = () => {
        const rows = filtered.map(s => ({
            id: s.id,
            user: s.user?.username ?? 'محذوف',
            branch: s.branchName,
            openedAt: new Date(s.openedAt).toLocaleString('ar-IQ'),
            closedAt: s.closedAt ? new Date(s.closedAt).toLocaleString('ar-IQ') : 'نشطة',
            openingAmount: Number(s.openingAmount),
            cashSales: s.cashSales, cardSales: s.cardSales, creditSales: s.creditSales,
            totalSales: s.totalSales,
            expectedAmount: s.expectedAmount ? Number(s.expectedAmount) : 0,
            closingAmount:  s.closingAmount  ? Number(s.closingAmount)  : 0,
            difference:     s.difference     ? Number(s.difference)     : 0,
            txCount: s.txCount, notes: s.notes ?? ''
        }));
        exportToCSV(rows, 'shifts-report', {
            id: 'رقم الوردية', user: 'الكاشير', branch: 'الفرع',
            openedAt: 'وقت الفتح', closedAt: 'وقت الإغلاق',
            openingAmount: 'العهدة الافتتاحية',
            cashSales: 'مبيعات نقد', cardSales: 'مبيعات بطاقة', creditSales: 'مبيعات آجل',
            totalSales: 'إجمالي المبيعات',
            expectedAmount: 'المبلغ المتوقع', closingAmount: 'النقد الفعلي',
            difference: 'الفرق', txCount: 'عدد الفواتير', notes: 'ملاحظات'
        });
    };

    if (loading) return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <Wallet size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل سجل الورديات</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم تحميل بيانات الورديات والعجز والزيادة</p>
                </div>
            </div>
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
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                    <div className="skeleton h-4 w-28" />
                    <div className="skeleton h-8 w-28 rounded-xl" />
                </div>
                <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-slate-100">
                    {[15,20,15,15,20,15].map((w,i) => <div key={i} className="skeleton h-3" style={{ width:`${w}%` }} />)}
                </div>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-6 gap-3 px-5 py-4">
                            {[20,25,18,18,28,18].map((w,j) => (
                                <div key={j} className="skeleton h-3.5" style={{ width:`${w - ((i*5+j*4)%12)}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">

            <PageHeader
                title="سجل الورديات"
                subtitle="متابعة أداء الكاشيرية والعجز والزيادة لكل وردية"
                icon={Wallet}
                gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
                actions={
                    <button onClick={handleExport} className="btn-success">
                        <Download size={16} /> تصدير Excel
                    </button>
                }
            />

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                    label="إجمالي الورديات"
                    value={stats.total}
                    icon={Activity}
                    gradient="linear-gradient(135deg,#094B9F 0%,#063A8A 100%)"
                />
                <StatCard
                    label="ورديات نشطة"
                    value={stats.active}
                    icon={CheckCircle}
                    gradient="linear-gradient(135deg,#10b981 0%,#059669 100%)"
                />
                <StatCard
                    label="ورديات بزيادة"
                    value={stats.surplus}
                    icon={TrendingUp}
                    gradient="linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)"
                />
                <StatCard
                    label="ورديات بعجز"
                    value={stats.deficit}
                    icon={TrendingDown}
                    gradient="linear-gradient(135deg,#ef4444 0%,#dc2626 100%)"
                    valueColor="var(--value-negative)"
                />
                <StatCard
                    label="إجمالي المبيعات"
                    value={formatCurrency(stats.totalSales)}
                    icon={DollarSign}
                    gradient="linear-gradient(135deg,#f59e0b 0%,#d97706 100%)"
                    valueColor="var(--value-positive)"
                />
            </div>

            {/* ── Table card ── */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">

                {/* Toolbar */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-color)]">
                    <div className="relative flex-1 max-w-sm">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث بالكاشير أو رقم الوردية..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pr-9 pl-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 text-slate-800 transition-all"
                        />
                    </div>
                    <span className="text-xs font-bold text-slate-400 mr-auto">{filtered.length} وردية</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50/60 border-b border-[var(--border-color)]">
                            <tr>
                                {['#','الكاشير','الفرع','الفتح / الإغلاق','المدة','مبيعات الوردية','العهدة','المتوقع','الفعلي','الفرق'].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 10 }).map((_, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="h-3.5 bg-slate-100 rounded-full animate-pulse" style={{ width: `${60 + ((i * 10 + j * 7) % 30)}%` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-300">
                                            <Wallet size={40} />
                                            <p className="font-bold text-slate-400">لا توجد ورديات مطابقة</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map((shift, idx) => {
                                const isActive   = !shift.closedAt;
                                const isExpanded = expandedId === shift.id;
                                const diff       = shift.difference !== null ? Number(shift.difference) : null;
                                const dur        = duration(shift.openedAt, shift.closedAt);

                                return (
                                    <React.Fragment key={shift.id}>
                                        <tr
                                            className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'}`}
                                            onClick={() => setExpandedId(isExpanded ? null : shift.id)}
                                        >
                                            {/* # */}
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs font-mono text-slate-400">{idx + 1}</span>
                                            </td>

                                            {/* Cashier */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                                                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)' }}>
                                                        {(shift.user?.username ?? '?')[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm">{shift.user?.username ?? 'محذوف'}</span>
                                                </div>
                                            </td>

                                            {/* Branch */}
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{shift.branchName}</span>
                                            </td>

                                            {/* Times */}
                                            <td className="px-5 py-3.5">
                                                <div className="text-xs text-emerald-700 font-semibold whitespace-nowrap">
                                                    {new Date(shift.openedAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}
                                                </div>
                                                {isActive ? (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                                                        نشطة الآن
                                                    </span>
                                                ) : (
                                                    <div className="text-xs text-slate-400 font-medium whitespace-nowrap mt-0.5">
                                                        {new Date(shift.closedAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Duration */}
                                            <td className="px-5 py-3.5">
                                                {dur
                                                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md"><Clock size={11} /> {dur}</span>
                                                    : <span className="text-slate-300 text-xs">—</span>}
                                            </td>

                                            {/* Sales breakdown */}
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800 text-sm">{formatCurrency(shift.totalSales ?? 0)}</div>
                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                    {shift.cashSales   > 0 && <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-md font-semibold">نقد</span>}
                                                    {shift.cardSales   > 0 && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-md font-semibold">بطاقة</span>}
                                                    {shift.creditSales > 0 && <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-100 px-1.5 py-0.5 rounded-md font-semibold">آجل</span>}
                                                </div>
                                            </td>

                                            {/* Opening */}
                                            <td className="px-5 py-3.5 text-xs font-semibold text-slate-600">{formatCurrency(Number(shift.openingAmount))}</td>

                                            {/* Expected */}
                                            <td className="px-5 py-3.5 text-xs font-bold text-blue-600">
                                                {shift.expectedAmount !== null ? formatCurrency(Number(shift.expectedAmount)) : <span className="text-slate-300">—</span>}
                                            </td>

                                            {/* Actual */}
                                            <td className="px-5 py-3.5 text-xs font-bold text-slate-700">
                                                {shift.closingAmount !== null ? formatCurrency(Number(shift.closingAmount)) : <span className="text-slate-300">—</span>}
                                            </td>

                                            {/* Diff */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <DiffBadge diff={diff} />
                                                    {isExpanded
                                                        ? <ChevronUp size={14} className="text-blue-400 shrink-0" />
                                                        : <ChevronDown size={14} className="text-slate-300 group-hover:text-slate-400 shrink-0 transition-colors" />}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded details row */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={10} className="px-5 pb-4 pt-0 bg-blue-50/40 border-b border-blue-100">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                                                        {/* Sales detail */}
                                                        <div className="bg-white border border-slate-100 rounded-xl px-4 py-3">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">تفصيل المبيعات</p>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-slate-500">نقد</span>
                                                                    <span className="font-bold text-emerald-600">{formatCurrency(shift.cashSales ?? 0)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-slate-500">بطاقة</span>
                                                                    <span className="font-bold text-blue-600">{formatCurrency(shift.cardSales ?? 0)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-slate-500">آجل</span>
                                                                    <span className="font-bold text-orange-600">{formatCurrency(shift.creditSales ?? 0)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Invoice count */}
                                                        <div className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex flex-col justify-center">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">عدد الفواتير</p>
                                                            <p className="text-2xl font-black text-blue-600">{shift.txCount ?? 0}</p>
                                                        </div>

                                                        {/* Shift ID */}
                                                        <div className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex flex-col justify-center">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">رقم الوردية</p>
                                                            <p className="text-[11px] font-mono text-slate-500 break-all">{shift.id}</p>
                                                        </div>

                                                        {/* Notes */}
                                                        <div className="bg-white border border-slate-100 rounded-xl px-4 py-3">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">ملاحظات</p>
                                                            <p className="text-xs text-slate-600">{shift.notes || <span className="text-slate-300 italic">لا توجد ملاحظات</span>}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
