'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/query/fetcher';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Trash2, Wallet, Receipt, TrendingDown, Edit, Search, Download, Loader2, X, Hash, Layers, Calendar, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import PageHeader from '@/components/ui/PageHeader';
import { useBranch } from '@/contexts/BranchContext';

import toast from 'react-hot-toast';

interface Expense {
    id: string;
    title: string;
    amount: number;
    category: string;
    description?: string;
    date: string;
}

// Categories + color identity (shared between modal, filter & breakdown)
const CATEGORIES = ['تشغيلي', 'رواتب', 'صيانة', 'تسويق', 'بضاعة تالفة', 'أخرى'];
const CATEGORY_COLORS: Record<string, string> = {
    'تشغيلي': '#094B9F',
    'رواتب': '#8b5cf6',
    'صيانة': '#f59e0b',
    'تسويق': '#06b6d4',
    'بضاعة تالفة': '#ef4444',
    'أخرى': '#64748b',
};
const colorFor = (cat: string) => CATEGORY_COLORS[cat] ?? '#64748b';

// KPI tile shape — `valueColor` is optional, so the array needs an explicit type
interface StatTile {
    key: string;
    label: string;
    value: string | number;
    icon: LucideIcon;
    tint: string;
    gradient: string;
    valueColor?: string;
    footer: React.ReactNode;
}

export default function ExpensesPage() {
    usePageTitle('المصاريف');
    const { confirm, dialog } = useConfirm();
    const queryClient = useQueryClient();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { selectedBranch, loading: branchLoading } = useBranch();

    // Filter State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    // Applied date range — the range actually used for fetching (set on submit / period shortcut,
    // NOT on every date keystroke, matching the old behavior)
    const [applied, setApplied] = useState<{ start: string; end: string } | null>(null);
    const [searchText, setSearchText] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

    // Form State (for Add and Edit)
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('تشغيلي');
    const [description, setDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState('');

    // Reset dates on mount + branch change only (NOT on every date keystroke)
    useEffect(() => {
        if (branchLoading) return;
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        setApplied({ start, end });
    }, [selectedBranch, branchLoading]);

    const bId = selectedBranch?.id ?? 'all';
    const branchQuery = selectedBranch?.id ? `&branchId=${selectedBranch.id}` : '';
    const expensesQuery = useQuery({
        queryKey: ['expenses', bId, applied?.start, applied?.end],
        queryFn: () => fetchJson<Expense[]>(`/api/expenses?period=custom&startDate=${applied!.start}&endDate=${applied!.end}${branchQuery}`),
        enabled: !branchLoading && !!applied,
        placeholderData: (prev) => prev,
    });
    const expenses = expensesQuery.data ?? [];
    const loading = expensesQuery.isFetching;
    const initialized = !expensesQuery.isPending;

    useEffect(() => {
        if (expensesQuery.isError) {
            console.error(expensesQuery.error);
            toast.error('تعذر تحميل المصروفات');
        }
    }, [expensesQuery.isError, expensesQuery.error]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setApplied({ start: startDate, end: endDate });
    };

    // Quick period shortcuts
    const applyPeriod = (period: 'today' | 'week' | 'month') => {
        const now = new Date();
        let start: Date;
        const end = now;
        if (period === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === 'week') {
            start = new Date(now);
            start.setDate(now.getDate() - 6);
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        const s = start.toISOString().split('T')[0];
        const en = end.toISOString().split('T')[0];
        setStartDate(s);
        setEndDate(en);
        setApplied({ start: s, end: en });
    };

    const openModal = (expense?: Expense) => {
        if (expense) {
            setEditId(expense.id);
            setTitle(expense.title);
            setAmount(expense.amount.toString());
            setCategory(expense.category || 'تشغيلي');
            setDescription(expense.description || '');
            setExpenseDate(new Date(expense.date).toISOString().split('T')[0]);
        } else {
            setEditId(null);
            setTitle('');
            setAmount('');
            setCategory('تشغيلي');
            setDescription('');
            setExpenseDate(new Date().toISOString().split('T')[0]);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const method = editId ? 'PUT' : 'POST';
            const body = {
                id: editId,
                title,
                amount: Number(amount),
                category,
                description,
                date: expenseDate,
                branchId: selectedBranch?.id === 'all' ? undefined : selectedBranch?.id
            };

            const res = await fetch('/api/expenses', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                if (editId) {
                    toast.success('تم تعديل المصروف بنجاح ✅');
                } else {
                    toast.success('تم تسجيل المصروف بنجاح ✅');
                }
                setIsModalOpen(false);
                queryClient.invalidateQueries({ queryKey: ['expenses'] });
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(`فشل الحفظ: ${err.error || 'تحقق من البيانات'}`);
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء الحفظ');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ title: 'حذف المصروف', message: 'هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء.', variant: 'danger', confirmLabel: 'حذف' })) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setDeletingId(null);
                setRemovingId(id);
                setTimeout(async () => {
                    await queryClient.invalidateQueries({ queryKey: ['expenses'] });
                    setRemovingId(null);
                    toast.success('تم حذف المصروف بنجاح');
                }, 480);
            } else {
                toast.error('فشل الحذف');
                setDeletingId(null);
            }
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ أثناء الحذف');
            setDeletingId(null);
        }
    };

    // Client-side filtered list (search + category)
    const filteredExpenses = useMemo(() => expenses.filter(e => {
        const matchesSearch = !searchText ||
            e.title.toLowerCase().includes(searchText.toLowerCase()) ||
            (e.description || '').toLowerCase().includes(searchText.toLowerCase());
        const matchesCategory = filterCategory === 'ALL' || (e.category || 'أخرى') === filterCategory;
        return matchesSearch && matchesCategory;
    }), [expenses, searchText, filterCategory]);

    // Stats — computed over the filtered set so they reflect what the user sees
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const expenseCount = filteredExpenses.length;
    const avgExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

    // Category breakdown — total + count per category, ranked by spend
    const breakdown = useMemo(() => {
        const map: Record<string, { total: number; count: number }> = {};
        for (const e of filteredExpenses) {
            const cat = e.category || 'أخرى';
            if (!map[cat]) map[cat] = { total: 0, count: 0 };
            map[cat].total += Number(e.amount);
            map[cat].count += 1;
        }
        return Object.entries(map)
            .map(([cat, { total, count }]) => ({ cat, total, count, pct: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0 }))
            .sort((a, b) => b.total - a.total);
    }, [filteredExpenses, totalExpenses]);

    const topBreak = breakdown[0];
    const topCategory = topBreak?.cat ?? '—';

    // "2026-07-13" → "13/07" — compact range label for the total card
    const shortDate = (iso?: string) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '—');

    if (!initialized) return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 12px 40px rgba(239,68,68,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <TrendingDown size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#f87171,#ef4444)', boxShadow: '0 2px 8px rgba(239,68,68,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل سجل المصروفات</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم استرجاع المصروفات وتحليل الأرصدة</p>
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
                <div className="px-5 py-4 flex gap-3 border-b border-slate-100">
                    <div className="skeleton h-9 flex-1 rounded-xl" />
                    <div className="skeleton h-9 w-32 rounded-xl" />
                    <div className="skeleton h-9 w-28 rounded-xl" />
                </div>
                <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-slate-100">
                    {[35,20,15,15,15].map((w,i) => <div key={i} className="skeleton h-3" style={{ width:`${w}%` }} />)}
                </div>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-5 gap-4 px-6 py-4">
                            {[50,25,18,18,18].map((w,j) => (
                                <div key={j} className="skeleton h-3.5" style={{ width:`${w - ((i*6+j*5)%15)}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            {dialog}
            <style>{`
                @keyframes rowDeletingPulse {
                    0%, 100% { background-color: rgba(254, 226, 226, 0.45); }
                    50%      { background-color: rgba(254, 202, 202, 0.75); }
                }
                .row-deleting {
                    animation: rowDeletingPulse 1.1s ease-in-out infinite;
                    box-shadow: inset 3px 0 0 0 #ef4444;
                }
                @keyframes rowRemoving {
                    0%   { transform: translateX(0);    opacity: 1; background-color: rgba(254, 202, 202, 0.75); }
                    35%  { transform: translateX(0);    opacity: 1; background-color: rgba(254, 202, 202, 0.95); }
                    100% { transform: translateX(40px); opacity: 0; background-color: rgba(254, 202, 202, 0);    }
                }
                .row-removing { animation: rowRemoving 0.48s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .row-removing > td > * { transition: opacity 0.3s; opacity: 0.35; }
            `}</style>
            <PageHeader
                title="إدارة المصروفات"
                subtitle="سجل تفصيلي للمصروفات مع تحليل حسب التصنيف والفترة."
                icon={TrendingDown}
                gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                actions={
                    <>
                        <button
                            onClick={() => {
                                if (filteredExpenses.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
                                const exportData = filteredExpenses.map(e => ({
                                    date: new Date(e.date).toLocaleDateString('ar-IQ'),
                                    title: e.title,
                                    category: e.category || 'عام',
                                    amount: e.amount,
                                    description: e.description || ''
                                }));
                                exportToCSV(exportData, 'expenses-report', {
                                    date: 'التاريخ',
                                    title: 'العنوان',
                                    category: 'التصنيف',
                                    amount: 'المبلغ',
                                    description: 'الملاحظات'
                                });
                            }}
                            className="btn-success"
                        >
                            <Download size={20} /> تصدير Excel
                        </button>
                        <button
                            onClick={() => openModal()}
                            className="btn-danger"
                        >
                            <Plus size={20} />
                            تسجيل مصروف
                        </button>
                    </>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {([
                    {
                        key: 'total',
                        label: 'إجمالي الفترة',
                        value: formatCurrency(totalExpenses),
                        icon: Wallet,
                        tint: '#ef4444',
                        gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        valueColor: 'var(--value-negative)',
                        footer: (
                            <>
                                <Calendar size={12} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
                                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }} dir="ltr">
                                    {shortDate(applied?.start)} — {shortDate(applied?.end)}
                                </span>
                            </>
                        ),
                    },
                    {
                        key: 'count',
                        label: 'عدد المصروفات',
                        value: expenseCount,
                        icon: Hash,
                        tint: '#094B9F',
                        gradient: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)',
                        footer: <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>معاملة خلال الفترة</span>,
                    },
                    {
                        key: 'avg',
                        label: 'متوسط المصروف',
                        value: formatCurrency(avgExpense),
                        icon: TrendingDown,
                        tint: '#f59e0b',
                        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        footer: <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>لكل مصروف مسجّل</span>,
                    },
                    {
                        key: 'top',
                        label: 'أعلى تصنيف إنفاقاً',
                        value: topCategory,
                        icon: Layers,
                        tint: '#8b5cf6',
                        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        footer: topBreak ? (
                            <>
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorFor(topBreak.cat) }} />
                                <span className="text-[11px] font-black tabular-nums" style={{ color: colorFor(topBreak.cat) }}>{topBreak.pct.toFixed(0)}%</span>
                                <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>من إجمالي الإنفاق</span>
                            </>
                        ) : (
                            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>لا توجد بيانات</span>
                        ),
                    },
                ] as StatTile[]).map(card => (
                    <div
                        key={card.key}
                        className="relative overflow-hidden p-5 rounded-[var(--border-radius-card)] transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-card)',
                        }}
                    >
                        {/* Top accent — direction-neutral, safe under RTL */}
                        <div className="absolute top-0 inset-x-0 h-[3px]" style={{ background: card.gradient }} />
                        {/* Tinted watermark */}
                        <div
                            className="absolute -top-8 -left-8 w-28 h-28 rounded-full pointer-events-none"
                            style={{ background: card.tint, opacity: 0.06 }}
                        />

                        <div className="relative flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                                <p
                                    className="text-2xl font-black leading-none tabular-nums truncate"
                                    style={{ color: card.valueColor ?? 'var(--text-primary)' }}
                                    title={String(card.value)}
                                >
                                    {card.value}
                                </p>
                            </div>
                            <div
                                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                                style={{ background: card.gradient, boxShadow: `0 4px 14px ${card.tint}59` }}
                            >
                                <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 50%)' }} />
                                <card.icon size={20} className="text-white relative z-10" />
                            </div>
                        </div>

                        {/* Contextual footer */}
                        <div
                            className="relative flex items-center gap-1.5 mt-4 pt-3"
                            style={{ borderTop: '1px dashed var(--border-color)' }}
                        >
                            {card.footer}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters bar */}
            <div className="bg-[var(--bg-card)] p-5 rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] space-y-4">
                {/* Period shortcuts + date range */}
                <form onSubmit={handleSearch} className="flex flex-col lg:flex-row lg:items-end gap-4">
                    <div className="flex gap-2">
                        {([['today','اليوم'],['week','أسبوع'],['month','هذا الشهر']] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => applyPeriod(key)}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-end gap-3 flex-wrap">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1">من تاريخ</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1">إلى تاريخ</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300" />
                        </div>
                        <button type="submit" className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2.5 rounded-lg hover:bg-gray-900 transition-colors text-sm font-bold">
                            <Search size={16} /> بحث
                        </button>
                    </div>
                </form>

                <div className="h-px bg-gray-100" />

                {/* Text search + category filter (client-side, instant) */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="بحث في العناوين والملاحظات..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            className="block w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-right outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 transition-colors"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setFilterCategory('ALL')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${filterCategory === 'ALL' ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                        >
                            الكل
                        </button>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setFilterCategory(cat)}
                                className="px-3 py-2 rounded-lg text-xs font-bold border transition-all"
                                style={filterCategory === cat
                                    ? { background: colorFor(cat), color: '#fff', borderColor: colorFor(cat) }
                                    : { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Refresh indicator — shown only while re-filtering (keeps the page in place) */}
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                    <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#ef4444,#f87171,#ef4444)', backgroundSize: '200% 100%', width: '40%', animation: 'shimmer 1.2s ease-in-out infinite' }} />
                </div>
            )}

            {/* Category Breakdown */}
            {breakdown.length > 0 && (
                <div
                    className="rounded-[var(--border-radius-card)] overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}
                >
                    {/* Header — title + running total */}
                    <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4">
                        <h3 className="font-black text-base flex items-center gap-2.5 min-w-0" style={{ color: 'var(--text-primary)' }}>
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}
                            >
                                <Layers size={16} className="text-white" />
                            </div>
                            <span className="truncate">توزيع المصروفات حسب التصنيف</span>
                        </h3>
                        <div className="text-left flex-shrink-0">
                            <p className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>الإجمالي</p>
                            <p className="text-sm font-black tabular-nums" style={{ color: 'var(--value-negative)' }}>{formatCurrency(totalExpenses)}</p>
                        </div>
                    </div>

                    {/* Segmented distribution bar */}
                    <div className="px-6">
                        <div className="flex gap-0.5 h-3 rounded overflow-hidden" style={{ background: 'var(--bg-page)' }}>
                            {breakdown.map(b => (
                                <div
                                    key={b.cat}
                                    className="transition-all duration-500 hover:brightness-110"
                                    style={{ width: `${b.pct}%`, background: colorFor(b.cat) }}
                                    title={`${b.cat} — ${b.pct.toFixed(1)}% · ${formatCurrency(b.total)}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Ranked legend */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-1 px-4 py-4">
                        {breakdown.map((b, i) => {
                            const c = colorFor(b.cat);
                            return (
                                <div key={b.cat} className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors hover:bg-[var(--bg-page)]">
                                    {/* Rank */}
                                    <span
                                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 tabular-nums"
                                        style={{ background: `${c}1f`, color: c }}
                                    >
                                        {i + 1}
                                    </span>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                                                <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{b.cat}</span>
                                                <span className="text-[10px] font-bold flex-shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                    · {b.count} مصروف
                                                </span>
                                            </div>
                                            <span className="text-xs font-black tabular-nums flex-shrink-0" style={{ color: c }}>{formatCurrency(b.total)}</span>
                                        </div>
                                        {/* Share bar — fills from the right under RTL.
                                            Track is category-tinted so it stays visible over the row's hover bg. */}
                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${c}1f` }}>
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${b.pct}%`, background: c }}
                                            />
                                        </div>
                                    </div>

                                    <span className="text-xs font-black tabular-nums flex-shrink-0 w-9 text-left" style={{ color: 'var(--text-secondary)' }}>
                                        {b.pct.toFixed(0)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* List */}
            <div
                className="rounded-[var(--border-radius-card)] overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}
            >
                {/* Toolbar — title, counter, total */}
                <div
                    className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
                    style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#0f172a,#334155)' }}
                        >
                            <Receipt size={16} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>سجل المصروفات</h3>
                            <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {filteredExpenses.length === expenses.length
                                    ? `${expenses.length} مصروف`
                                    : `يعرض ${filteredExpenses.length} من ${expenses.length} مصروف`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {(searchText || filterCategory !== 'ALL') && (
                            <button
                                onClick={() => { setSearchText(''); setFilterCategory('ALL'); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                            >
                                <X size={12} /> إزالة الفلاتر
                            </button>
                        )}
                        <div
                            className="text-left px-3 py-1.5 rounded"
                            style={{ background: 'var(--bg-page)', border: '1px solid var(--border-color)' }}
                        >
                            <p className="text-[10px] font-bold leading-none mb-1" style={{ color: 'var(--text-muted)' }}>المجموع المعروض</p>
                            <p className="text-xs font-black tabular-nums leading-none" style={{ color: 'var(--value-negative)' }}>
                                {formatCurrency(totalExpenses)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-right data-table">
                    <thead>
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">المصروف</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">التصنيف</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">المبلغ</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">التاريخ</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.map((expense) => {
                            const isRowDeleting = deletingId === expense.id;
                            const isRowRemoving = removingId === expense.id;
                            const cat = expense.category || 'أخرى';
                            const c = colorFor(cat);
                            return (
                            <tr key={expense.id} className={`transition-colors ${isRowRemoving ? 'row-removing' : isRowDeleting ? 'row-deleting' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: `${c}14`, color: c, border: `1px solid ${c}29` }}
                                        >
                                            <Receipt size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{expense.title}</p>
                                            {expense.description && (
                                                <p className="text-xs font-medium mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                                                    {expense.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap"
                                        style={{ background: `${c}14`, color: c, border: `1px solid ${c}33` }}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                                        {cat}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-black tabular-nums whitespace-nowrap" style={{ color: 'var(--value-negative)' }}>
                                        −{formatCurrency(Number(expense.amount))}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                        <Calendar size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }} dir="ltr">
                                            {new Date(expense.date).toLocaleDateString('en-GB')}
                                        </span>
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1.5 justify-center">
                                        <button
                                            onClick={() => openModal(expense)}
                                            className="p-2 rounded text-blue-500 hover:text-white hover:bg-blue-500 transition-colors"
                                            style={{ background: 'rgba(59,130,246,0.08)' }}
                                            title="تعديل"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            disabled={isRowDeleting || isRowRemoving}
                                            className={`p-2 rounded transition-colors disabled:cursor-not-allowed ${isRowDeleting ? 'text-white bg-red-500' : 'text-red-500 hover:text-white hover:bg-red-500'}`}
                                            style={isRowDeleting ? undefined : { background: 'rgba(239,68,68,0.08)' }}
                                            title="حذف"
                                        >
                                            {isRowDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );})}
                        {filteredExpenses.length === 0 && !loading && (
                            <tr><td colSpan={5} className="px-6 py-16">
                                <div className="flex flex-col items-center justify-center gap-3 text-center">
                                    <div
                                        className="w-14 h-14 rounded-lg flex items-center justify-center"
                                        style={{ background: 'var(--bg-page)', border: '1px dashed var(--border-color)' }}
                                    >
                                        <Receipt size={24} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black" style={{ color: 'var(--text-secondary)' }}>
                                            {expenses.length === 0 ? 'لا توجد مصروفات مسجلة في هذه الفترة' : 'لا توجد مصروفات مطابقة للبحث أو الفلتر'}
                                        </p>
                                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                            {expenses.length === 0 ? 'ابدأ بتسجيل أول مصروف لهذه الفترة' : 'جرّب تعديل الفلاتر أو توسيع نطاق التاريخ'}
                                        </p>
                                    </div>
                                </div>
                            </td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        style={{ boxShadow: '0 25px 60px rgba(239,68,68,.15), 0 8px 24px rgba(0,0,0,.08)' }}>
                        {/* Gradient header */}
                        <div className="relative px-6 py-5 overflow-hidden" style={{ background: 'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)' }}>
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,.3) 20px,rgba(255,255,255,.3) 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,.3) 20px,rgba(255,255,255,.3) 21px)' }} />
                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                        <TrendingDown size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-black text-white">{editId ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}</h3>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-lg transition-colors">
                                    <X size={16} className="text-white" />
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">عنوان المصروف</label>
                                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" placeholder="مثال: فاتورة كهرباء" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ</label>
                                    <input type="number" required min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ</label>
                                    <input type="date" required value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">التصنيف</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none">
                                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات (اختياري)</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none h-24" placeholder="تفاصيل إضافية..." />
                            </div>
                            <button type="submit" disabled={isSaving} className="btn-danger w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                                {isSaving ? 'جاري الحفظ...' : editId ? 'حفظ التغييرات' : 'حفظ المصروف'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
