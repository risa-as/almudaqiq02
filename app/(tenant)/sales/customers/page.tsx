'use client';

import React, { useEffect, useState } from 'react';
import { Users, Plus, Edit, Trash2, Search, Phone, MapPin, DollarSign, X, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useUser } from '@/hooks/useUser';
import PageHeader from '@/components/ui/PageHeader';
import { useBranch } from '@/contexts/BranchContext';

import toast from 'react-hot-toast';
interface Customer {
    id: number;
    name: string;
    phone?: string;
    address?: string;
    balance: number;
    _count?: { transactions: number };
}

export default function CustomersPage() {
    const { isAdmin } = useUser();
    const { selectedBranch, loading: branchLoading } = useBranch();
    
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formData, setFormData] = useState<{ name: string, phone: string, address: string, initialBalance: string }>({
        name: '', phone: '', address: '', initialBalance: '0'
    });

    useEffect(() => {
        if (branchLoading) return;
        fetchCustomers();
    }, [selectedBranch, branchLoading]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const branchQuery = selectedBranch?.id ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/customers${branchQuery}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const url = '/api/customers';
            const method = editId ? 'PUT' : 'POST';
            const body = editId 
                ? { ...formData, id: editId } 
                : { ...formData, branchId: selectedBranch?.id === 'all' ? null : selectedBranch?.id };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                fetchCustomers();
                setIsModalOpen(false);
                setEditId(null);
                setFormData({ name: '', phone: '', address: '', initialBalance: '0' });
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء الحفظ');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
        try {
            const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchCustomers();
        } catch (error) {
            console.error(error);
        }
    };

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    );

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isPaying, setIsPaying] = useState(false);

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomerForPayment || !paymentAmount) return;

        if (!confirm(`تأكيد استلام مبلغ ${formatCurrency(Number(paymentAmount))} من العميل ${selectedCustomerForPayment.name}؟`)) return;

        setIsPaying(true);
        try {
            const res = await fetch('/api/customers/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: selectedCustomerForPayment.id,
                    amount: paymentAmount
                })
            });

            if (res.ok) {
                toast.success('تم تسجيل الدفعة بنجاح ✅');
                fetchCustomers();
                setIsPaymentModalOpen(false);
                setPaymentAmount('');
                setSelectedCustomerForPayment(null);
            } else {
                toast.error('فشلت العملية');
            }
        } catch (error) {
            toast.error('حدث خطأ');
        } finally {
            setIsPaying(false);
        }
    };

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [customerHistory, setCustomerHistory] = useState<any[]>([]);
    const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);

    const fetchHistory = async (customerId: number) => {
        setHistoryLoading(true);
        try {
            const branchQuery = selectedBranch?.id ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/customers/${customerId}/history${branchQuery}`);
            if (res.ok) {
                const data = await res.json();
                setCustomerHistory(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setHistoryLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 text-right" dir="rtl">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* ... Header & Search ... */}

                {/* Header */}
                <PageHeader
                    title="سجل العملاء والديون"
                    subtitle="تابع عملائك وديونهم بدقة وسهولة."
                    icon={Users}
                    gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                    actions={
                        isAdmin && (
                            <button
                                onClick={() => { setEditId(null); setFormData({ name: '', phone: '', address: '', initialBalance: '0' }); setIsModalOpen(true); }}
                                className="btn-primary"
                            >
                                <Plus size={20} />
                                عميل جديد
                            </button>
                        )
                    }
                />

                {/* Search */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <Search className="text-gray-400" />
                    <input
                        className="flex-1 outline-none text-gray-700 font-bold"
                        placeholder="بحث باسم العميل أو رقم الهاتف..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-200 rounded-2xl animate-pulse"></div>)
                    ) : filtered.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-gray-400">لا يوجد عملاء مضافين.</div>
                    ) : (
                        filtered.map(customer => (
                            <div key={customer.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-blue-50 p-3 rounded-full text-blue-600 font-bold text-lg w-12 h-12 flex items-center justify-center">
                                        {customer.name.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-gray-400 mb-1">الرصيد الحالي (الدين)</p>
                                        <p className={`text-xl font-extrabold ${customer.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            {formatCurrency(Number(customer.balance))}
                                        </p>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 mb-2">{customer.name}</h3>

                                <div className="space-y-2 text-sm text-gray-500 mb-6">
                                    <div className="flex items-center gap-2 text-xs bg-gray-50 px-2 py-1 rounded w-fit">
                                        <span>عدد المعاملات:</span>
                                        <span className="font-bold">{customer._count?.transactions || 0}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-gray-50 opacity-60 group-hover:opacity-100 transition-opacity flex-wrap">
                                    <button
                                        onClick={() => {
                                            setSelectedCustomerForPayment(customer);
                                            setPaymentAmount('');
                                            setIsPaymentModalOpen(true);
                                        }}
                                        className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-bold hover:bg-green-100 transition-colors flex items-center justify-center gap-1 min-w-[80px]"
                                        title="تسديد دفعة"
                                    >
                                        <DollarSign size={16} />
                                        تسديد
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedCustomerForHistory(customer);
                                            setIsHistoryModalOpen(true);
                                            fetchHistory(customer.id);
                                        }}
                                        className="flex-1 py-2 px-3 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 flex items-center justify-center gap-1"
                                        title="كشف حساب تفصيلي"
                                    >
                                        <FileText size={16} /> كشف
                                    </button>
                                    {isAdmin && <button
                                        onClick={() => {
                                            setEditId(customer.id);
                                            setFormData({
                                                name: customer.name,
                                                phone: customer.phone || '',
                                                address: customer.address || '',
                                                initialBalance: String(customer.balance)
                                            });
                                            setIsModalOpen(true);
                                        }}
                                        className="py-2 px-3 bg-gray-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50"
                                    >
                                        <Edit size={16} />
                                    </button>}
                                    {isAdmin && <button
                                        onClick={() => handleDelete(customer.id)}
                                        className="py-2 px-3 bg-gray-50 text-red-500 rounded-lg text-sm font-bold hover:bg-red-50"
                                    >
                                        <Trash2 size={16} />
                                    </button>}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Edit/Add Modal */}
                {isModalOpen && (
                    /* ... (Same Edit Modal) ... */
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <form onSubmit={handleSubmit} className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-fade-in-up">
                            {/* ... Content Same as before ... */}
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {editId ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
                                </h2>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                {/* ... Form Fields ... */}
                                <div><label className="block text-sm font-bold text-gray-700 mb-2">اسم العميل <span className="text-red-500">*</span></label><input required className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف</label><input className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div><div><label className="block text-sm font-bold text-gray-700 mb-2">العنوان</label><input className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div></div>
                                {!editId && (<div><label className="block text-sm font-bold text-gray-700 mb-2">الدين الحالي</label><input type="number" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl font-bold" value={formData.initialBalance} onChange={e => setFormData({ ...formData, initialBalance: e.target.value })} /></div>)}
                            </div>
                            <div className="flex gap-4 mt-8"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إلغاء</button><button disabled={isSubmitting} type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50">{isSubmitting ? 'جاري الحفظ...' : 'حفظ البيانات'}</button></div>
                        </form>
                    </div>
                )}

                {/* Payment Modal */}
                {isPaymentModalOpen && selectedCustomerForPayment && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <form onSubmit={handlePaymentSubmit} className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-fade-in-up border-t-4 border-green-500">
                            {/* ... Payment Modal Content ... */}
                            <div className="flex justify-between items-center mb-6"><div><h2 className="text-2xl font-bold text-gray-900">تسديد دفعة</h2><p className="text-gray-500 text-sm mt-1">{selectedCustomerForPayment.name}</p></div><button type="button" onClick={() => setIsPaymentModalOpen(false)}><X size={24} /></button></div>
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-xl text-center mb-4"><span className="text-gray-500 text-sm block mb-1">الرصيد الحالي</span><span className={`text-2xl font-extrabold ${selectedCustomerForPayment.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Number(selectedCustomerForPayment.balance))}</span></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-2">المبلغ المستلم</label><input type="number" required className="w-full bg-white border-2 border-green-100 focus:border-green-500 p-4 rounded-xl text-2xl font-bold text-center outline-none text-green-700" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} autoFocus /></div>
                            </div>
                            <div className="flex gap-4 mt-8"><button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إلغاء</button><button disabled={isPaying} type="submit" className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 disabled:opacity-50">{isPaying ? 'جاري الاستلام...' : 'تأكيد الاستلام'}</button></div>
                        </form>
                    </div>
                )}

                {/* History Modal */}
                {isHistoryModalOpen && selectedCustomerForHistory && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">سجل المعاملات</h2>
                                    <p className="text-gray-500 text-sm mt-1">العميل: {selectedCustomerForHistory.name}</p>
                                </div>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-red-500">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {historyLoading ? (
                                    <div className="text-center py-12 text-gray-400">جاري تحميل السجل...</div>
                                ) : customerHistory.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">لا توجد معاملات سابقة لهذا العميل.</div>
                                ) : (
                                    <table className="w-full text-right">
                                        <thead className="text-gray-500 text-xs uppercase bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="p-3 font-bold rounded-r-lg">التاريخ</th>
                                                <th className="p-3 font-bold">النوع</th>
                                                <th className="p-3 font-bold">التفاصيل</th>
                                                <th className="p-3 font-bold rounded-l-lg text-left">المبلغ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {customerHistory.map(tx => (
                                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="p-3 text-sm text-gray-600">
                                                        {new Date(tx.date).toLocaleDateString('ar-IQ')} <br />
                                                        <span className="text-xs text-gray-400">{new Date(tx.date).toLocaleTimeString('ar-IQ')}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${tx.type === 'SALE' ? 'bg-orange-100 text-orange-700' :
                                                            tx.type === 'PAYMENT' ? 'bg-green-100 text-green-700' :
                                                                tx.type === 'RETURN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {tx.type === 'SALE' ? 'شراء (آجل)' :
                                                                tx.type === 'PAYMENT' ? 'تسديد دفعة' :
                                                                    tx.type === 'RETURN' ? 'مرتجع' : tx.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                        {tx.type === 'SALE' && <span className="text-xs">{tx.items?.length} مواد</span>}
                                                        {tx.type === 'PAYMENT' && <span className="text-xs">دفع نقدي</span>}
                                                        <div className="text-xs text-gray-400">#{tx.id}</div>
                                                    </td>
                                                    <td className={`p-3 text-left font-bold ${tx.type === 'PAYMENT' ? 'text-green-600' :
                                                        tx.type === 'RETURN' ? 'text-green-600' : 'text-red-500'
                                                        }`}>
                                                        {tx.type === 'PAYMENT' || tx.type === 'RETURN' ? '-' : '+'}
                                                        {formatCurrency(Number(tx.totalAmount))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-3xl">
                                <button onClick={() => setIsHistoryModalOpen(false)} className="w-full bg-white border border-gray-300 py-3 rounded-xl font-bold hover:bg-gray-100 text-gray-700">
                                    إغلاق
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
