'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Users, Phone, MapPin, Plus, Search, FileText, Printer, FileSpreadsheet, Edit, Trash2, DollarSign, RefreshCw, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { useBranch } from '@/contexts/BranchContext';
import toast from 'react-hot-toast';

interface Supplier {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    balance: number;
    creditLimit?: number;
    notes?: string;
}

interface BatchItem {
    id: string;
    batchNumber: string;
    productId: string;
    productName: string;
    supplierName: string;
    quantity: number;
    costPrice: number;
    expiryDate: string | null;
}

export default function SuppliersPage() {
    const router = useRouter();
    const { selectedBranch, loading: branchLoading } = useBranch();

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Payment Modal
    const [showPayModal, setShowPayModal] = useState(false);
    const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payDescription, setPayDescription] = useState('دفعة سداد نقدية مستحقة للمورد');
    const [isSaving, setIsSaving] = useState(false);

    // Return Modal (new, inventory-linked)
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returningSupplier, setReturningSupplier] = useState<Supplier | null>(null);
    const [supplierBatches, setSupplierBatches] = useState<BatchItem[]>([]);
    const [batchesLoading, setBatchesLoading] = useState(false);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [returnQty, setReturnQty] = useState('');
    const [returnDescription, setReturnDescription] = useState('');
    const [isReturning, setIsReturning] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [initialBalance, setInitialBalance] = useState('');
    const [creditLimit, setCreditLimit] = useState('');
    const [notes, setNotes] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (branchLoading) return;
        fetchSuppliers();
    }, [selectedBranch, branchLoading]);

    useEffect(() => {
        const lowerSearch = searchTerm.toLowerCase();
        setFilteredSuppliers(
            suppliers.filter(s =>
                s.name.toLowerCase().includes(lowerSearch) ||
                s.phone?.includes(lowerSearch) ||
                s.id.includes(searchTerm)
            )
        );
    }, [searchTerm, suppliers]);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const branchQuery = selectedBranch?.id && selectedBranch.id !== 'all' ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/suppliers${branchQuery}`);
            if (res.ok) {
                const data = await res.json();
                setSuppliers(data);
                setFilteredSuppliers(data);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        try {
            const url = editingId ? `/api/suppliers/${editingId}` : '/api/suppliers';
            const method = editingId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName,
                    phone: newPhone,
                    address: newAddress,
                    balance: Number(initialBalance) || 0,
                    creditLimit: creditLimit ? Number(creditLimit) : null,
                    notes: notes || null,
                }),
            });
            if (res.ok) {
                setShowModal(false);
                resetForm();
                fetchSuppliers();
                toast.success(editingId ? 'تم تحديث بيانات المورد' : 'تم إضافة المورد بنجاح');
            } else {
                const d = await res.json();
                toast.error(d.error || 'فشل حفظ البيانات');
            }
        } catch { toast.error('حدث خطأ بالاتصال'); }
        finally { setIsSaving(false); }
    };

    const resetForm = () => {
        setEditingId(null); setNewName(''); setNewPhone('');
        setNewAddress(''); setInitialBalance(''); setCreditLimit(''); setNotes('');
    };

    const openEditModal = (supplier: Supplier) => {
        setEditingId(supplier.id);
        setNewName(supplier.name);
        setNewPhone(supplier.phone || '');
        setNewAddress(supplier.address || '');
        setInitialBalance(supplier.balance.toString());
        setCreditLimit(supplier.creditLimit ? supplier.creditLimit.toString() : '');
        setNotes(supplier.notes || '');
        setShowModal(true);
    };

    const openPayModal = (supplier: Supplier) => {
        setPayingSupplier(supplier);
        setPayAmount('');
        setPayDescription('دفعة سداد نقدية مستحقة للمورد');
        setShowPayModal(true);
    };

    const openReturnModal = async (supplier: Supplier) => {
        setReturningSupplier(supplier);
        setSelectedBatchId('');
        setReturnQty('');
        setReturnDescription('');
        setShowReturnModal(true);

        // Fetch batches for this supplier
        try {
            setBatchesLoading(true);
            const branchQuery = selectedBranch?.id && selectedBranch.id !== 'all' ? `&branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/inventory/batches?supplierId=${supplier.id}${branchQuery}`);
            if (res.ok) {
                const data = await res.json();
                setSupplierBatches(data.filter((b: BatchItem) => b.quantity > 0));
            }
        } catch { toast.error('تعذر تحميل بيانات المخزون'); }
        finally { setBatchesLoading(false); }
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payingSupplier || !payAmount) return;
        try {
            const res = await fetch(`/api/suppliers/${payingSupplier.id}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: Number(payAmount), description: payDescription, type: 'PAYMENT', branchId: selectedBranch?.id }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('تم تسجيل الدفعة بنجاح وتحديث الرصيد');
                setShowPayModal(false);
                fetchSuppliers();
            } else { toast.error(data.error || 'فشل تسجيل العملية'); }
        } catch { toast.error('حدث خطأ بالاتصال'); }
    };

    // Compute the return amount automatically from the selected batch cost
    const selectedBatch = useMemo(() => supplierBatches.find(b => b.id === selectedBatchId), [selectedBatchId, supplierBatches]);
    const computedReturnAmount = selectedBatch && returnQty ? (Number(returnQty) * selectedBatch.costPrice) : 0;

    const handleReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returningSupplier || !selectedBatchId || !returnQty) return;
        if (!selectedBatch || Number(returnQty) > selectedBatch.quantity) {
            toast.error(`الكمية المرتجعة تتجاوز المتوفر في الدفعة (${selectedBatch?.quantity ?? 0})`);
            return;
        }
        setIsReturning(true);
        try {
            const res = await fetch(`/api/suppliers/${returningSupplier.id}/return-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchId: selectedBatchId,
                    quantity: Number(returnQty),
                    returnAmount: computedReturnAmount,
                    description: returnDescription,
                    branchId: selectedBranch?.id,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('تم تسجيل المرتجع وخصم المخزون بنجاح ✓');
                setShowReturnModal(false);
                fetchSuppliers();
            } else { toast.error(data.error || 'فشل تسجيل المرتجع'); }
        } catch { toast.error('حدث خطأ بالاتصال'); }
        finally { setIsReturning(false); }
    };

    const handleDelete = async (supplierId: string, balance: number) => {
        if (Number(balance) !== 0) {
            toast.error('لا يمكن حذف المورد حالياً لوجود رصيد معلق.');
            return;
        }
        if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المورد نهائياً؟')) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/suppliers/${supplierId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) { toast.success('تم حذف المورد بنجاح'); fetchSuppliers(); }
            else { toast.error(data.error || 'لا يمكن حذف المورد'); }
        } catch { toast.error('فشل الحذف. تأكد من الاتصال'); }
        finally { setIsDeleting(false); }
    };

    const handlePrint = () => window.print();

    const handleExport = () => {
        const headers = ['اسم المورد', 'الهاتف', 'العنوان', 'الرصيد المستحق', 'حد الائتمان'];
        const csvContent = [
            headers.join(','),
            ...filteredSuppliers.map(s => [
                `"${s.name}"`,
                s.phone || '',
                `"${s.address || ''}"`,
                Number(s.balance).toFixed(2),
                s.creditLimit ? Number(s.creditLimit).toFixed(2) : ''
            ].join(','))
        ].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'suppliers_' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
    };

    const totalDebt = filteredSuppliers.reduce((acc, s) => acc + Number(s.balance), 0);

    return (
        <div className="min-h-screen flex flex-col" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                }
            `}</style>

            <PageHeader
                title="إدارة الموردين"
                subtitle="سجل موردي المنشأة وكشوفات حساباتهم المالية"
                icon={Users}
                gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                actions={
                    <div className="flex gap-2 no-print">
                        <button onClick={handlePrint} className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 border border-gray-200 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors text-sm">
                            <Printer size={16} /> طباعة
                        </button>
                        <button onClick={handleExport} className="bg-white hover:bg-green-50 text-green-700 px-3 py-2 border border-green-200 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors text-sm">
                            <FileSpreadsheet size={16} /> تصدير
                        </button>
                        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors text-sm">
                            <Plus size={20} /> إضافة مورد
                        </button>
                    </div>
                }
            />

            <div className="flex flex-wrap gap-4 items-center px-6 py-4 border-b border-gray-100 bg-white no-print">
                <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-3 min-w-[200px]">
                    <Users size={18} className="text-blue-500" />
                    <div>
                        <div className="text-[10px] text-blue-400 font-bold uppercase">عدد الموردين</div>
                        <div className="text-lg font-bold text-blue-900">{filteredSuppliers.length}</div>
                    </div>
                </div>
                <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-100 flex items-center gap-3 min-w-[200px]">
                    <FileText size={18} className="text-red-500" />
                    <div>
                        <div className="text-[10px] text-red-400 font-bold uppercase">إجمالي الرصيد (علينا)</div>
                        <div className="text-lg font-bold text-red-600 tracking-tight">{formatCurrency(totalDebt)}</div>
                    </div>
                </div>
                <div className="relative flex-1 max-w-lg mr-auto">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="بحث باسم المورد، رقم الهاتف..."
                        className="w-full bg-white border border-gray-200 rounded-lg py-2.5 pr-10 pl-4 text-black text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                </div>
            </div>

            <main className="flex-1 max-w-[1600px] mx-auto w-full p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                                <tr>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-500 uppercase w-1/4">المورد</th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-500 uppercase w-1/4">التواصل</th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-500 uppercase w-36">الرصيد المستحق</th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-500 uppercase no-print">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {loading ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-400 font-bold">جاري تحميل بيانات الموردين...</td></tr>
                                ) : filteredSuppliers.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-gray-400 font-bold">لا يوجد موردين مسجلين</td></tr>
                                ) : (
                                    filteredSuppliers.map(supplier => {
                                        const bal = Number(supplier.balance);
                                        const overLimit = supplier.creditLimit && bal > Number(supplier.creditLimit);
                                        return (
                                            <tr key={supplier.id} className="hover:bg-blue-50/40 transition-colors border-b border-gray-100 last:border-0">
                                                {/* Column 1: Supplier Name */}
                                                <td className="px-5 py-4 align-top">
                                                    <div className="font-bold text-gray-900 text-[15px] leading-tight">{supplier.name}</div>
                                                    {supplier.notes && (
                                                        <div className="text-[11px] text-gray-400 mt-1 max-w-[220px] truncate">{supplier.notes}</div>
                                                    )}
                                                    {supplier.creditLimit && (
                                                        <div className="inline-block mt-1 text-[10px] text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 font-bold">حد ائتمان: {formatCurrency(Number(supplier.creditLimit))}</div>
                                                    )}
                                                </td>
                                                {/* Column 2: Contact */}
                                                <td className="px-5 py-4 align-top">
                                                    {supplier.phone ? (
                                                        <div className="flex items-center gap-1.5 text-gray-700 font-medium text-sm">
                                                            <Phone size={13} className="text-gray-400 flex-shrink-0" />
                                                            <span>{supplier.phone}</span>
                                                        </div>
                                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                                    {supplier.address && (
                                                        <div className="flex items-start gap-1.5 text-gray-500 text-xs mt-1.5">
                                                            <MapPin size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                                            <span>{supplier.address}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                {/* Column 3: Balance */}
                                                <td className="px-5 py-4 align-top">
                                                    <span className={`inline-block font-extrabold text-[15px] px-3 py-1 rounded-lg ${bal > 0 ? (overLimit ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-orange-50 text-orange-700 border border-orange-200') : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                                        {formatCurrency(bal)}
                                                    </span>
                                                    {overLimit && <div className="text-[10px] text-red-500 mt-1.5 font-bold">⚠ تجاوز حد الائتمان!</div>}
                                                </td>
                                                {/* Column 4: Actions */}
                                                <td className="px-5 py-4 align-top no-print">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <button
                                                            onClick={() => router.push(`/purchases/suppliers/${supplier.id}/ledger`)}
                                                            className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap"
                                                        >
                                                            <FileText size={13} /> كشف الحساب
                                                        </button>
                                                        <button
                                                            onClick={() => openPayModal(supplier)}
                                                            className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap"
                                                        >
                                                            <DollarSign size={13} /> دفعة
                                                        </button>
                                                        <button
                                                            onClick={() => openReturnModal(supplier)}
                                                            className="text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap"
                                                        >
                                                            <RefreshCw size={13} /> مرتجع
                                                        </button>
                                                        <button onClick={() => openEditModal(supplier)} className="text-gray-500 hover:text-blue-700 bg-gray-50 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="تعديل">
                                                            <Edit size={14} />
                                                        </button>
                                                        <button onClick={() => handleDelete(supplier.id, supplier.balance)} disabled={isDeleting} className="text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="حذف">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                    <td className="px-5 py-3 text-right font-bold text-gray-600 text-sm" colSpan={2}>الإجمالي النهائي للرصيد المستحق:</td>
                                    <td className="px-5 py-3 text-right font-extrabold text-red-600 text-base">{formatCurrency(totalDebt)}</td>
                                    <td className="no-print"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </main>

            {/* Add/Edit Supplier Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">{editingId ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSaveSupplier} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">اسم المورد <span className="text-red-500">*</span></label>
                                <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-sm" placeholder="شركة ..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف</label>
                                    <input value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-sm" placeholder="07..." />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">العنوان</label>
                                    <input value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-sm" placeholder="بغداد..." />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">الرصيد الافتتاحي</label>
                                    <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-sm" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">حد الائتمان (اختياري)</label>
                                    <input type="number" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-sm" placeholder="مثال: 5000000" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات وشروط الدفع</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-sm resize-none" placeholder="ملاحظات حول المورد..." />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm">إلغاء</button>
                                <button type="submit" disabled={isSaving} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm disabled:opacity-50">{isSaving ? 'جاري الحفظ...' : editingId ? 'تحديث البيانات' : 'حفظ البيانات'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPayModal && payingSupplier && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-t-4 border-green-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><DollarSign className="text-green-500" /> تسديد دفعة نقدية</h2>
                            <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                            <div className="text-sm text-gray-500 mb-1">المورد</div>
                            <div className="font-bold text-gray-900 text-lg">{payingSupplier.name}</div>
                            <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                                <span className="text-sm font-bold text-gray-600">الرصيد الحالي المستحق:</span>
                                <span className={`font-bold ${Number(payingSupplier.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Number(payingSupplier.balance))}</span>
                            </div>
                        </div>
                        <form onSubmit={handlePayment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ المراد تسديده <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input type="number" required min="1" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-white border border-gray-300 p-3 pl-10 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-black font-bold text-lg" placeholder="0.00" />
                                    <DollarSign className="absolute left-3 top-3.5 text-gray-400" size={20} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">البيان / الوصف</label>
                                <input type="text" value={payDescription} onChange={e => setPayDescription(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-black font-bold text-sm" />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
                                <button type="submit" className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md shadow-green-200">تأكيد التسديد</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* NEW: Inventory-Linked Return Modal */}
            {showReturnModal && returningSupplier && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border-t-4 border-orange-500">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><RefreshCw className="text-orange-500" /> تسجيل مرتجع بضاعة</h2>
                            <button onClick={() => setShowReturnModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-4">
                            <div className="text-xs text-orange-500 font-bold uppercase mb-1">المورد</div>
                            <div className="font-bold text-orange-900">{returningSupplier.name}</div>
                            <div className="text-xs text-orange-600 mt-1">الرصيد الحالي: <span className="font-bold">{formatCurrency(Number(returningSupplier.balance))}</span></div>
                        </div>

                        <form onSubmit={handleReturn} className="space-y-4">
                            {/* Batch Selection */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                                    <Package size={13} /> اختر الدفعة / التشغيلة المرتجعة <span className="text-red-500">*</span>
                                </label>
                                {batchesLoading ? (
                                    <div className="text-center py-4 text-gray-400 text-sm font-bold">جاري تحميل دفعات المورد من المخزون...</div>
                                ) : supplierBatches.length === 0 ? (
                                    <div className="text-center py-4 bg-gray-50 rounded-lg text-gray-500 text-sm font-bold border border-dashed border-gray-200">
                                        لا توجد دفعات مخزنية متاحة لهذا المورد
                                    </div>
                                ) : (
                                    <select
                                        required
                                        value={selectedBatchId}
                                        onChange={e => { setSelectedBatchId(e.target.value); setReturnQty(''); }}
                                        className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black font-bold text-sm"
                                    >
                                        <option value="">-- اختر المادة والدفعة --</option>
                                        {supplierBatches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.productName} — تشغيلة: {b.batchNumber} (متوفر: {b.quantity} وحدة | التكلفة: {formatCurrency(b.costPrice)})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {selectedBatch && (
                                <>
                                    {/* Batch Details */}
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <div className="text-[10px] text-blue-400 font-bold uppercase">الكمية المتوفرة</div>
                                                <div className="font-extrabold text-blue-900 text-base">{selectedBatch.quantity}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-blue-400 font-bold uppercase">سعر التكلفة / وحدة</div>
                                                <div className="font-extrabold text-blue-900 text-base">{formatCurrency(selectedBatch.costPrice)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-blue-400 font-bold uppercase">قيمة المرتجع</div>
                                                <div className={`font-extrabold text-lg ${computedReturnAmount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                                    {computedReturnAmount > 0 ? formatCurrency(computedReturnAmount) : '--'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">الكمية المرتجعة <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            max={selectedBatch.quantity}
                                            value={returnQty}
                                            onChange={e => setReturnQty(e.target.value)}
                                            className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black font-bold text-sm"
                                            placeholder={`أقصى كمية: ${selectedBatch.quantity}`}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">سيتم خصم هذه الكمية مباشرة من المخزون وتخفيض رصيد المورد تلقائياً.</p>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظة (اختياري)</label>
                                        <input type="text" value={returnDescription} onChange={e => setReturnDescription(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black font-bold text-sm" placeholder="سبب الإرجاع..." />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowReturnModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
                                <button
                                    type="submit"
                                    disabled={isReturning || !selectedBatchId || !returnQty || supplierBatches.length === 0}
                                    className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isReturning ? 'جاري المعالجة...' : 'تأكيد تسجيل المرتجع'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
