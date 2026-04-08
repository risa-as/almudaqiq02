'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, DollarSign, Tag, TrendingDown, Edit, Search, Download } from 'lucide-react';
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
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { selectedBranch } = useBranch();

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
        if (!selectedBranch) return;
        // Default to current month on load if not set
        const now = new Date();
        const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0]; // Today
        
        if (!startDate) setStartDate(start);
        if (!endDate) setEndDate(end); 
        
        fetchExpenses(start, end);
    }, [selectedBranch, startDate, endDate]);

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
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
        try {
            const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setExpenses(expenses.filter(e => e.id !== id));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
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
                <table className="w-full text-right data-table">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                        <tr>
                            <th className="px-6 py-4">العنوان</th>
                            <th className="px-6 py-4">التصنيف</th>
                            <th className="px-6 py-4">المبلغ</th>
                            <th className="px-6 py-4">التاريخ</th>
                            <th className="px-6 py-4 text-center">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {expenses.map((expense) => (
                            <tr key={expense.id} className="hover:bg-red-50/30 transition-colors group">
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
                                            className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                            title="حذف"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {expenses.length === 0 && !loading && (
                            <tr><td colSpan={5} className="p-12 text-center text-gray-400">لا توجد مصروفات مسجلة في هذه الفترة</td></tr>
                        )}
                    </tbody>
                </table>
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
                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-red-200">
                                {editId ? 'حفظ التغييرات' : 'حفظ المصروف'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
