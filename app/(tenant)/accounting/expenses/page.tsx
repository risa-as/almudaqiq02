'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Trash2, Calendar, DollarSign, Tag, TrendingDown, Edit, Search, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { useBranch } from '@/contexts/BranchContext';

import toast from 'react-hot-toast';
interface Expense {
    id: number;
    title: string;
    amount: number;
    category: string;
    description?: string;
    date: string;
}

export default function ExpensesPage() {
  usePageTitle('المصاريف');
    const { confirm, dialog } = useConfirm();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { selectedBranch, loading: branchLoading } = useBranch();

    // Filter State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Form State (for Add and Edit)
    const [editId, setEditId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('تشغيلي');
    const [description, setDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState('');

    useEffect(() => {
        if (branchLoading) return;
        // Default to current month on load if not set
        const now = new Date();
        const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0]; // Today
        
        if (!startDate) setStartDate(start);
        if (!endDate) setEndDate(end); 
        
        fetchExpenses(start, end);
    }, [selectedBranch, startDate, endDate, branchLoading]);

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
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchExpenses();
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
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء الحفظ');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
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

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    if (loading) return (
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
                subtitle="سجل تفصيلي للمصروفات مع إمكانية البحث والتعديل."
                icon={TrendingDown}
                gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                actions={
                    <>
                        <button
                            onClick={() => {
                                const exportData = expenses.map(e => ({
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

            {/* Total & Filter Card */}
            <div className="bg-[var(--bg-card)] p-6 rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="border-l border-[var(--border-color)] pl-6 w-full md:w-auto">
                    <StatCard
                        label="الإجمالي للفترة المحددة"
                        value={formatCurrency(totalExpenses)}
                        icon={DollarSign}
                        gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                        valueColor="var(--value-negative)"
                    />
                </div>

                <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-end gap-3 w-full md:w-auto">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">من تاريخ</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">إلى تاريخ</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                    </div>
                    <button type="submit" className="bg-gray-800 text-white p-2.5 rounded-lg hover:bg-gray-900 transition-colors">
                        <Search size={18} />
                    </button>
                </form>
            </div>

            {/* List */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
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
                        {expenses.map((expense) => {
                            const isRowDeleting = deletingId === expense.id;
                            const isRowRemoving = removingId === expense.id;
                            return (
                            <tr key={expense.id} className={`group transition-colors ${isRowRemoving ? 'row-removing' : isRowDeleting ? 'row-deleting' : 'hover:bg-blue-50/50'}`}>
                                <td className="px-6 py-4 font-medium text-gray-800">
                                    {expense.title}
                                    {expense.description && <p className="text-xs text-gray-400 font-normal mt-1">{expense.description}</p>}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-bold border border-gray-200">
                                        {expense.category || 'عام'}
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
                        {expenses.length === 0 && !loading && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">لا توجد مصروفات مسجلة في هذه الفترة</td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">{editId ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">عنوان المصروف</label>
                                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" placeholder="مثال: فاتورة كهرباء" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ</label>
                                    <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ</label>
                                    <input type="date" required value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">التصنيف</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none">
                                    <option>تشغيلي</option>
                                    <option>رواتب</option>
                                    <option>صيانة</option>
                                    <option>تسويق</option>
                                    <option>بضاعة تالفة</option>
                                    <option>أخرى</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات (اختياري)</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none h-24" placeholder="تفاصيل إضافية..." />
                            </div>
                            <button type="submit" disabled={isSaving} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
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
