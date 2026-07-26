'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, use, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJsonOr } from '@/lib/query/fetcher';
import { useRouter } from 'next/navigation';
import {
    History, ArrowDownToLine, ArrowUpFromLine,
    Package, DollarSign, Activity, Search,
    ChevronRight, TrendingUp, TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';

interface HistoryEvent {
    type: 'SALE' | 'STOCK_IN';
    date: Date;
    amount: number;
    unit: string;
    total: number;
    ref: string;
    user: string;
}

const TYPE_CONFIG = {
    SALE:     { label: 'بيع', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: ArrowUpFromLine,   dot: 'bg-orange-400' },
    STOCK_IN: { label: 'توريد', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: ArrowDownToLine, dot: 'bg-emerald-400' },
} as const;

const PAGE_SIZE = 20;

export default function ProductHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  usePageTitle('سجل المنتج');
    const { id } = use(params);
    const router = useRouter();

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'SALE' | 'STOCK_IN'>('all');
    const [page, setPage] = useState(1);

    const productQuery = useQuery({
        queryKey: ['product', id],
        queryFn: () => fetchJsonOr<any>(`/api/products/${id}`, null),
        enabled: !!id,
    });
    const historyQuery = useQuery({
        queryKey: ['product-history', id],
        queryFn: () => fetchJsonOr<any>(`/api/products/${id}/history`, null),
        enabled: !!id,
    });
    const product = productQuery.data ?? null;
    const history = historyQuery.data ?? null;
    const loading = productQuery.isPending || historyQuery.isPending;

    const events = useMemo<HistoryEvent[]>(() => {
        if (!history) return [];
        return [
            ...history.sales.map((s: any) => ({
                type: 'SALE' as const,
                date: new Date(s.transaction.date),
                amount: s.quantity,
                unit: s.unit?.name ?? 'وحدة',
                total: s.price * s.quantity,
                ref: s.transaction.id?.slice(0, 8) ?? '-',
                user: s.transaction.user?.username ?? 'مدير النظام',
            })),
            ...(history.batches ?? []).map((b: any) => ({
                type: 'STOCK_IN' as const,
                date: new Date(b.createdAt),
                amount: b.quantity,
                unit: 'وحدة أساسية',
                total: b.costPrice * b.quantity,
                ref: b.batchNumber === 'INITIAL' ? 'رصيد افتتاحي' : (b.batchNumber ?? '-'),
                user: 'النظام',
            })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [history]);

    const filtered = useMemo(() =>
        events.filter(e => {
            if (typeFilter !== 'all' && e.type !== typeFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                return e.ref.toLowerCase().includes(q) || e.user.toLowerCase().includes(q) || e.unit.toLowerCase().includes(q);
            }
            return true;
        }), [events, typeFilter, search]);

    const pages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const totalIn    = events.filter(e => e.type === 'STOCK_IN').reduce((s, e) => s + e.amount, 0);
    const totalOut   = events.filter(e => e.type === 'SALE').reduce((s, e) => s + e.amount, 0);
    const totalValue = events.reduce((s, e) => s + e.total, 0);

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
                <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="p-6 max-w-7xl mx-auto" dir="rtl">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-600 font-semibold">
                    المنتج غير موجود
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">

            {/* Header */}
            <PageHeader
                title="سجل حركة المنتج"
                subtitle={product.name}
                icon={History}
                gradient="linear-gradient(135deg, #f59e0b, #d97706)"
                actions={
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600"
                    >
                        <ChevronRight size={16} />
                        رجوع
                    </button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'إجمالي الوارد',  value: `${totalIn} وحدة`,     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ArrowDownToLine },
                    { label: 'إجمالي الصادر',  value: `${totalOut} وحدة`,    color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100',  icon: ArrowUpFromLine },
                    { label: 'صافي المخزون',   value: `${totalIn - totalOut} وحدة`, color: (totalIn - totalOut) >= 0 ? 'text-blue-700' : 'text-red-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: (totalIn - totalOut) >= 0 ? TrendingUp : TrendingDown },
                    { label: 'إجمالي القيمة',  value: formatCurrency(totalValue), color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100', icon: DollarSign },
                ].map(({ label, value, color, bg, border, icon: Icon }) => (
                    <div key={label} className={`rounded-2xl border ${border} ${bg} p-4 flex items-center gap-3`}>
                        <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                            <Icon size={16} className={color} />
                        </div>
                        <div>
                            <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table card */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--border-color)] bg-gray-50/50">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث برقم المرجع، المستخدم..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                        {(['all', 'STOCK_IN', 'SALE'] as const).map(k => (
                            <button key={k} onClick={() => { setTypeFilter(k); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${typeFilter === k ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                {k === 'all' ? 'الكل' : k === 'STOCK_IN' ? 'توريد' : 'مبيعات'}
                            </button>
                        ))}
                    </div>

                    <span className="text-xs text-gray-400 mr-auto">{filtered.length} حركة</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-right data-table">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                            <tr>
                                {['التاريخ', 'نوع الحركة', 'الكمية', 'الوحدة', 'القيمة', 'المرجع', 'بواسطة'].map(h => (
                                    <th key={h} className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                                                <Activity size={24} className="text-gray-400" />
                                            </div>
                                            <p className="text-sm font-semibold text-gray-400">لا توجد حركات مسجلة</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginated.map((event, idx) => {
                                const cfg = TYPE_CONFIG[event.type];
                                const Icon = cfg.icon;
                                return (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        {/* Date */}
                                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                                            {event.date.toLocaleDateString('ar-IQ')}
                                            <span className="block text-gray-400 mt-0.5">{event.date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>

                                        {/* Type badge */}
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                <Icon size={12} />
                                                {cfg.label}
                                            </span>
                                        </td>

                                        {/* Amount */}
                                        <td className="px-5 py-3.5">
                                            <span className={`text-sm font-extrabold ${event.type === 'SALE' ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                {event.type === 'SALE' ? '-' : '+'}{event.amount}
                                            </span>
                                        </td>

                                        {/* Unit */}
                                        <td className="px-5 py-3.5 text-xs text-gray-600">{event.unit}</td>

                                        {/* Value */}
                                        <td className="px-5 py-3.5 text-sm font-bold text-gray-800 whitespace-nowrap">
                                            {formatCurrency(event.total)}
                                        </td>

                                        {/* Ref */}
                                        <td className="px-5 py-3.5">
                                            <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-mono">{event.ref}</code>
                                        </td>

                                        {/* User */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 flex-shrink-0">
                                                    {event.user.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs text-gray-600">{event.user}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-color)] bg-gray-50/30">
                        <span className="text-xs text-gray-400">
                            الصفحة {page} من {pages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                                السابق
                            </button>
                            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                                التالي
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
