'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Trash2, DollarSign, TrendingDown, Edit, Search, Download, Loader2, X, Hash, Layers, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
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

export default function ExpensesPage() {
    usePageTitle('المصاريف');
    const { confirm, dialog } = useConfirm();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { selectedBranch, loading: branchLoading } = useBranch();

    // Filter State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchText, setSearchText] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

    // Form State (for Add and Edit)
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('تشغيلي');
    const [description, setDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState('');

    // Fetch on mount + branch change only (NOT on every date keystroke)
    useEffect(() => {
        if (branchLoading) return;
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        fetchExpenses(start, end);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranch, branchLoading]);

    const fetchExpenses = async (start?: string, end?: string) => {
        setLoading(true);
        try {
            const s = start || startDate;
            const e = end || endDate;
            const branchQuery = selectedBranch?.id ? `&branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/expenses?period=custom&startDate=${s}&endDate=${e}${branchQuery}`);
            if (res.ok) setExpenses(await res.json());
        } catch (error) {
            console.error(error);
            toast.error('تعذر تحميل المصروفات');
        } finally {
            setLoading(false);
            setInitialized(true);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchExpenses();
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
        fetchExpenses(s, en);
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
                const savedItem = await res.json();
                if (editId) {
                    setExpenses(expenses.map(ex => ex.id === editId ? savedItem : ex));
                    toast.success('تم تعديل المصروف بنجاح ✅');
                } else {
                    setExpenses([savedItem, ...expenses]);
                    toast.success('تم تسجيل المصروف بنجاح ✅');
                }
                setIsModalOpen(false);
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
                setTimeout(() => {
                    setExpenses(prev => prev.filter(e => e.id !== id));
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

    // Category breakdown
    const breakdown = useMemo(() => {
        const map: Record<string, number> = {};
        for (const e of filteredExpenses) {
            const cat = e.category || 'أخرى';
            map[cat] = (map[cat] || 0) + Number(e.amount);
        }
        return Object.entries(map)
            .map(([cat, total]) => ({ cat, total, pct: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0 }))
            .sort((a, b) => b.total - a.total);
    }, [filteredExpenses, totalExpenses]);

    const topCategory = breakdown[0]?.cat ?? '—';

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
                <StatCard
                    label="إجمالي الفترة"
                    value={formatCurrency(totalExpenses)}
                    icon={DollarSign}
                    gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                    valueColor="var(--value-negative)"
                />
                <StatCard
                    label="عدد المصروفات"
                    value={expenseCount}
                    icon={Hash}
                    gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
                />
                <StatCard
                    label="متوسط المصروف"
                    value={formatCurrency(avgExpense)}
                    icon={TrendingDown}
                    gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                />
                <StatCard
                    label="أعلى تصنيف إنفاقاً"
                    value={topCategory}
                    icon={Layers}
                    gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
                />
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
                <div className="bg-[var(--bg-card)] p-6 rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)]">
                    <h3 className="font-black text-base mb-5 flex items-center gap-2.5" style={{ color: 'var(--text-primary)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                            <Layers size={14} className="text-white" />
                        </div>
                        توزيع المصروفات حسب التصنيف
                    </h3>
                    {/* Stacked bar */}
                    <div className="flex gap-0.5 h-3 rounded-full overflow-hidden mb-4">
                        {breakdown.map(b => (
                            <div
                                key={b.cat}
                                style={{ width: `${b.pct}%`, background: colorFor(b.cat), transition: 'width 0.5s ease' }}
                                title={`${b.cat}: ${b.pct.toFixed(0)}%`}
                            />
                        ))}
                    </div>
                    {/* Legend rows */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {breakdown.map(b => (
                            <div key={b.cat} className="flex items-center justify-between gap-2 p-2.5 rounded-xl" style={{ background: 'var(--bg-page)' }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorFor(b.cat) }} />
                                    <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{b.cat}</span>
                                    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{b.pct.toFixed(0)}%</span>
                                </div>
                                <span className="text-xs font-black flex-shrink-0" style={{ color: colorFor(b.cat) }}>{formatCurrency(b.total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                {/* Counter */}
                <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                        {filteredExpenses.length === expenses.length
                            ? `${expenses.length} مصروف`
                            : `يعرض ${filteredExpenses.length} من ${expenses.length} مصروف`}
                    </p>
                    {(searchText || filterCategory !== 'ALL') && (
                        <button
                            onClick={() => { setSearchText(''); setFilterCategory('ALL'); }}
                            className="text-xs font-bold text-red-500 hover:text-red-600 hover:underline transition-colors"
                        >
                            إزالة الفلاتر
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-right data-table">
                    <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">العنوان</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التصنيف</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المبلغ</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredExpenses.map((expense) => {
                            const isRowDeleting = deletingId === expense.id;
                            const isRowRemoving = removingId === expense.id;
                            const cat = expense.category || 'أخرى';
                            return (
                            <tr key={expense.id} className={`group transition-colors ${isRowRemoving ? 'row-removing' : isRowDeleting ? 'row-deleting' : 'hover:bg-blue-50/50'}`}>
                                <td className="px-6 py-4 font-medium text-gray-800">
                                    {expense.title}
                                    {expense.description && <p className="text-xs text-gray-400 font-normal mt-1">{expense.description}</p>}
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className="px-2 py-1 rounded-md text-xs font-bold border"
                                        style={{ background: `${colorFor(cat)}14`, color: colorFor(cat), borderColor: `${colorFor(cat)}33` }}
                                    >
                                        {cat}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-red-600">
                                    -{formatCurrency(Number(expense.amount))}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500" dir="ltr">
                                    {new Date(expense.date).toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex gap-2 justify-center">
                                        <button
                                            onClick={() => openModal(expense)}
                                            className="text-blue-500 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                            title="تعديل"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            disabled={isRowDeleting || isRowRemoving}
                                            className={`p-2 rounded-lg transition-colors disabled:cursor-not-allowed ${isRowDeleting ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                                            title="حذف"
                                        >
                                            {isRowDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );})}
                        {filteredExpenses.length === 0 && !loading && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                {expenses.length === 0 ? 'لا توجد مصروفات مسجلة في هذه الفترة' : 'لا توجد مصروفات مطابقة للبحث أو الفلتر'}
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
