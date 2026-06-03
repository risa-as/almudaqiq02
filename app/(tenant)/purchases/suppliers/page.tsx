'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { Users, Phone, MapPin, Plus, Search, FileText, Printer, FileSpreadsheet, Edit, Trash2, DollarSign, RefreshCw, Package, Loader2, Wallet, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
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

/**
 * Icon-only action button with a hover tooltip showing its purpose.
 * The tooltip is positioned above the button; it stays within the table's
 * bounds for all rows, so the surrounding overflow containers don't clip it.
 */
function IconAction({
    label, color, onClick, disabled, children,
}: {
    label: string;
    color: string;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="relative group/tip">
            <button
                onClick={onClick}
                disabled={disabled}
                aria-label={label}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${color}`}
            >
                {children}
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-bold whitespace-nowrap opacity-0 translate-y-1 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 transition-all duration-150 z-30 shadow-lg"
            >
                {label}
                <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-[5px] border-transparent border-t-gray-900" />
            </span>
        </div>
    );
}

export default function SuppliersPage() {
  usePageTitle('الموردون');
    const router = useRouter();
    const { selectedBranch, loading: branchLoading } = useBranch();
    const { confirm, dialog } = useConfirm();

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
    const [isPaySaving, setIsPaySaving] = useState(false);

    // Balance Adjustment Modal
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [adjustingSupplier, setAdjustingSupplier] = useState<Supplier | null>(null);
    const [adjustNewBalance, setAdjustNewBalance] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    // Debt Modal
    const [showDebtModal, setShowDebtModal] = useState(false);
    const [debtingSupplier, setDebtingSupplier] = useState<Supplier | null>(null);
    const [debtAmount, setDebtAmount] = useState('');
    const [debtDescription, setDebtDescription] = useState('');
    const [isDebtSaving, setIsDebtSaving] = useState(false);

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
    const [deletingId, setDeletingId] = useState<string | null>(null);   // row currently being deleted (API in-flight)
    const [removingId, setRemovingId] = useState<string | null>(null);   // row playing the exit animation
    const [debtFilter, setDebtFilter] = useState<'ALL' | 'DEBT' | 'CLEAR'>('ALL');

    useEffect(() => {
        if (branchLoading) return;
        fetchSuppliers();
    }, [selectedBranch, branchLoading]);

    useEffect(() => {
        const lowerSearch = searchTerm.toLowerCase();
        setFilteredSuppliers(
            suppliers.filter(s => {
                const matchesSearch =
                    s.name.toLowerCase().includes(lowerSearch) ||
                    s.phone?.includes(lowerSearch) ||
                    s.id.includes(searchTerm);
                const bal = Number(s.balance);
                const matchesDebt =
                    debtFilter === 'ALL' ? true :
                    debtFilter === 'DEBT' ? bal > 0 :
                    bal <= 0;
                return matchesSearch && matchesDebt;
            })
        );
    }, [searchTerm, suppliers, debtFilter]);

    // Latest-request guard: a slow fetch for a previous branch must never overwrite
    // the result of a newer fetch (race condition on branch switch).
    const fetchSeqRef = useRef(0);
    const fetchSuppliers = async () => {
        const seq = ++fetchSeqRef.current;
        try {
            setLoading(true);
            const branchQuery = selectedBranch?.id && selectedBranch.id !== 'all' ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/suppliers${branchQuery}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (seq === fetchSeqRef.current) {
                    setSuppliers(data);
                    setFilteredSuppliers(data);
                }
            }
        } catch (err) { console.error(err); }
        finally { if (seq === fetchSeqRef.current) setLoading(false); }
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
                    // balance only sent when creating — editing balance is done via payment ops
                    ...(editingId ? {} : { balance: Number(initialBalance) || 0, branchId: selectedBranch?.id }),
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

    const openDebtModal = (supplier: Supplier) => {
        setDebtingSupplier(supplier);
        setDebtAmount('');
        setDebtDescription('');
        setShowDebtModal(true);
    };

    const handleDebt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!debtingSupplier || !debtAmount || isDebtSaving) return;
        setIsDebtSaving(true);
        try {
            const res = await fetch(`/api/suppliers/${debtingSupplier.id}/debt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: Number(debtAmount),
                    description: debtDescription || 'دين مضاف يدوياً',
                    branchId: selectedBranch?.id,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('تم تسجيل الدين بنجاح وتحديث رصيد المورد');
                setShowDebtModal(false);
                fetchSuppliers();
            } else { toast.error(data.error || 'فشل تسجيل الدين'); }
        } catch { toast.error('حدث خطأ بالاتصال'); }
        finally { setIsDebtSaving(false); }
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
        if (!payingSupplier || !payAmount || isPaySaving) return;
        setIsPaySaving(true);
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
        finally { setIsPaySaving(false); }
    };

    const handleAdjustBalance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustingSupplier || adjustNewBalance === '' || isAdjusting) return;
        setIsAdjusting(true);
        try {
            const res = await fetch(`/api/suppliers/${adjustingSupplier.id}/adjust-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newBalance: Number(adjustNewBalance), description: adjustReason, branchId: selectedBranch?.id }),
            });
            const data = await res.json();
            if (res.ok) {
                const confirmedBalance = data.balance ?? Number(adjustNewBalance);
                toast.success('تم تسوية رصيد المورد بنجاح');
                setShowAdjustModal(false);
                setInitialBalance(String(confirmedBalance));
                setAdjustingSupplier(prev => prev ? { ...prev, balance: confirmedBalance } : null);
                fetchSuppliers();
            } else { toast.error(data.error || 'فشل تسوية الرصيد'); }
        } catch { toast.error('حدث خطأ بالاتصال'); }
        finally { setIsAdjusting(false); }
    };

    // Compute the return amount automatically from the selected batch cost
    const selectedBatch = useMemo(() => supplierBatches.find(b => b.id === selectedBatchId), [selectedBatchId, supplierBatches]);
    const computedReturnAmount = selectedBatch && returnQty ? (Number(returnQty) * selectedBatch.costPrice) : 0;

    const handleReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returningSupplier || !selectedBatchId || !returnQty || isReturning) return;
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
        if (!await confirm({ title: 'حذف المورد', message: 'هل أنت متأكد من رغبتك في حذف هذا المورد نهائياً؟ لا يمكن التراجع عن هذا الإجراء.', variant: 'danger', confirmLabel: 'حذف نهائي' })) return;
        setDeletingId(supplierId);   // row shows spinner + red glow while the API runs
        try {
            const res = await fetch(`/api/suppliers/${supplierId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                // Play the slide-out/fade exit animation, then drop the row locally
                // (smoother than a full refetch) and surface the toast on completion.
                setDeletingId(null);
                setRemovingId(supplierId);
                setTimeout(() => {
                    setSuppliers(prev => prev.filter(s => s.id !== supplierId));
                    setFilteredSuppliers(prev => prev.filter(s => s.id !== supplierId));
                    setRemovingId(null);
                    toast.success('تم حذف المورد بنجاح');
                }, 480);   // matches the CSS animation duration
            } else {
                toast.error(data.error || 'لا يمكن حذف المورد');
                setDeletingId(null);
            }
        } catch {
            toast.error('فشل الحذف. تأكد من الاتصال');
            setDeletingId(null);
        }
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

    /* Summary stats computed from the full supplier list (not the filtered view) */
    const supplierStats = {
        total:     suppliers.length,
        debtors:   suppliers.filter(s => Number(s.balance) > 0).length,
        totalDebt: suppliers.reduce((acc, s) => acc + Math.max(0, Number(s.balance)), 0),
        overLimit: suppliers.filter(s => s.creditLimit && Number(s.balance) > Number(s.creditLimit)).length,
    };

    if (loading) return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 12px 40px rgba(245,158,11,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <Users size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', boxShadow: '0 2px 8px rgba(245,158,11,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل قائمة الموردين</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم تحميل بيانات الموردين والأرصدة</p>
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
                    <div className="skeleton h-9 w-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-slate-100">
                    {[30,20,15,15,12,8].map((w,i) => <div key={i} className="skeleton h-3" style={{ width:`${w}%` }} />)}
                </div>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-6 gap-3 px-5 py-4">
                            {[40,25,18,18,16,10].map((w,j) => (
                                <div key={j} className="skeleton h-3.5" style={{ width:`${w - ((i*5+j*4)%13)}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            {dialog}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                }
                /* Delete-in-progress: soft red glow + subtle pulse on the row */
                @keyframes rowDeletingPulse {
                    0%, 100% { background-color: rgba(254, 226, 226, 0.45); }
                    50%      { background-color: rgba(254, 202, 202, 0.75); }
                }
                .row-deleting {
                    animation: rowDeletingPulse 1.1s ease-in-out infinite;
                    box-shadow: inset 3px 0 0 0 #ef4444;
                }
                /* Exit: collapse height + slide away + fade once the API confirms */
                @keyframes rowRemoving {
                    0%   { transform: translateX(0);     opacity: 1; background-color: rgba(254, 202, 202, 0.75); }
                    35%  { transform: translateX(0);     opacity: 1; background-color: rgba(254, 202, 202, 0.95); }
                    100% { transform: translateX(40px);  opacity: 0; background-color: rgba(254, 202, 202, 0); }
                }
                .row-removing {
                    animation: rowRemoving 0.48s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                .row-removing > td > * { transition: opacity 0.3s; opacity: 0.35; }
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
                        <button onClick={handleExport} className="btn-success">
                            <FileSpreadsheet size={16} /> تصدير
                        </button>
                        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary">
                            <Plus size={20} /> إضافة مورد
                        </button>
                    </div>
                }
            />

            <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 space-y-5">

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                    {[
                        { label: 'إجمالي الموردين',     value: supplierStats.total,                     icon: Users,         iconBg: '#eef2ff', iconColor: '#094B9F' },
                        { label: 'موردون لهم رصيد',      value: supplierStats.debtors,                   icon: TrendingDown,  iconBg: '#fef2f2', iconColor: '#ef4444' },
                        { label: 'إجمالي المستحقات',     value: formatCurrency(supplierStats.totalDebt), icon: Wallet,        iconBg: '#ecfdf5', iconColor: '#10b981' },
                        { label: 'تجاوزوا حد الائتمان', value: supplierStats.overLimit,                 icon: AlertTriangle, iconBg: '#fffbeb', iconColor: '#f59e0b' },
                    ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
                        <div key={label} className="kpi-card">
                            <div className="kpi-icon" style={{ background: iconBg }}>
                                <Icon size={18} style={{ color: iconColor }} />
                            </div>
                            <div className="min-w-0">
                                <p className="kpi-label">{label}</p>
                                <p className="kpi-value">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Toolbar: search + debt filter */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center gap-3 no-print">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="بحث باسم المورد، رقم الهاتف..."
                            className="w-full pr-9 pl-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition text-gray-700 font-semibold placeholder-gray-300"
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
                        {([
                            { key: 'ALL',   label: 'الكل' },
                            { key: 'DEBT',  label: 'لهم رصيد' },
                            { key: 'CLEAR', label: 'مسددون' },
                        ] as const).map(t => (
                            <button key={t.key} onClick={() => setDebtFilter(t.key)}
                                style={debtFilter === t.key ? { background: '#094B9F', color: '#fff', fontWeight: 700 } : undefined}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${debtFilter === t.key ? 'shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-gray-400 font-semibold">{filteredSuppliers.length} مورد</span>
                </div>

                <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right data-table">
                            <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-1/4">المورد</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-1/4">التواصل</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-36">الرصيد المستحق</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center no-print w-52">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">جاري تحميل بيانات الموردين...</td></tr>
                                ) : filteredSuppliers.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">لا يوجد موردين مسجلين</td></tr>
                                ) : (
                                    filteredSuppliers.map(supplier => {
                                        const bal = Number(supplier.balance);
                                        const overLimit = supplier.creditLimit && bal > Number(supplier.creditLimit);
                                        const isRowDeleting = deletingId === supplier.id;
                                        const isRowRemoving = removingId === supplier.id;
                                        return (
                                            <tr
                                                key={supplier.id}
                                                className={`group transition-colors ${isRowRemoving ? 'row-removing' : isRowDeleting ? 'row-deleting' : 'hover:bg-blue-50/50'}`}
                                            >
                                                {/* Column 1: Supplier Name */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="font-bold text-gray-900 text-[15px] leading-tight">{supplier.name}</div>
                                                    {supplier.notes && (
                                                        <div className="text-[11px] text-gray-400 mt-1 max-w-[220px] truncate">{supplier.notes}</div>
                                                    )}
                                                    {supplier.creditLimit && (
                                                        <div className="inline-block mt-1 text-[10px] text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 font-bold">حد ائتمان: {formatCurrency(Number(supplier.creditLimit))}</div>
                                                    )}
                                                </td>
                                                {/* Column 2: Contact */}
                                                <td className="px-6 py-4 align-top">
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
                                                <td className="px-6 py-4 align-top">
                                                    <span className={`inline-block font-extrabold text-[15px] px-3 py-1 rounded-lg ${bal > 0 ? (overLimit ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-orange-50 text-orange-700 border border-orange-200') : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                                        {formatCurrency(bal)}
                                                    </span>
                                                    {overLimit && <div className="text-[10px] text-red-500 mt-1.5 font-bold">⚠ تجاوز حد الائتمان!</div>}
                                                </td>
                                                {/* Column 4: Actions */}
                                                <td className="px-6 py-4 align-middle no-print">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <IconAction
                                                            label="كشف الحساب"
                                                            color="text-blue-600 bg-blue-50 hover:bg-blue-100"
                                                            onClick={() => router.push(`/purchases/suppliers/${supplier.id}/ledger`)}
                                                        >
                                                            <FileText size={15} />
                                                        </IconAction>
                                                        <IconAction
                                                            label="تسديد دفعة"
                                                            color="text-green-600 bg-green-50 hover:bg-green-100"
                                                            onClick={() => openPayModal(supplier)}
                                                        >
                                                            <DollarSign size={15} />
                                                        </IconAction>
                                                        <IconAction
                                                            label="إضافة دين"
                                                            color="text-rose-600 bg-rose-50 hover:bg-rose-100"
                                                            onClick={() => openDebtModal(supplier)}
                                                        >
                                                            <TrendingUp size={15} />
                                                        </IconAction>
                                                        <IconAction
                                                            label="تسجيل مرتجع"
                                                            color="text-orange-500 bg-orange-50 hover:bg-orange-100"
                                                            onClick={() => openReturnModal(supplier)}
                                                        >
                                                            <RefreshCw size={15} />
                                                        </IconAction>
                                                        <IconAction
                                                            label="تعديل البيانات"
                                                            color="text-gray-500 bg-gray-50 hover:bg-blue-50 hover:text-blue-700"
                                                            onClick={() => openEditModal(supplier)}
                                                        >
                                                            <Edit size={15} />
                                                        </IconAction>
                                                        <IconAction
                                                            label="حذف المورد"
                                                            color={isRowDeleting ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-50 hover:bg-red-50 hover:text-red-600'}
                                                            onClick={() => handleDelete(supplier.id, supplier.balance)}
                                                            disabled={isRowDeleting || isRowRemoving}
                                                        >
                                                            {isRowDeleting
                                                                ? <Loader2 size={15} className="animate-spin" />
                                                                : <Trash2 size={15} />}
                                                        </IconAction>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50/50 border-t border-[var(--border-color)]">
                                <tr>
                                    <td className="px-6 py-4 text-right font-bold text-gray-600 text-sm" colSpan={2}>الإجمالي النهائي للرصيد المستحق:</td>
                                    <td className="px-6 py-4 text-right font-extrabold text-red-600 text-base">{formatCurrency(totalDebt)}</td>
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
                                {editingId ? (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">الرصيد الحالي</label>
                                        <div className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-lg text-sm font-bold text-gray-500 flex items-center justify-between">
                                            <span>{formatCurrency(Number(initialBalance))}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const s = suppliers.find(x => x.id === editingId);
                                                    if (!s) return;
                                                    setAdjustingSupplier(s);
                                                    setAdjustNewBalance(String(s.balance));
                                                    setAdjustReason('');
                                                    setShowAdjustModal(true);
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors"
                                            >
                                                تسوية يدوية
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* When creating: allow setting initial balance */
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">الرصيد الافتتاحي</label>
                                        <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-sm" placeholder="0" />
                                    </div>
                                )}
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
                                <button type="submit" disabled={isSaving} className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed">{isSaving ? <Loader2 size={15} className="animate-spin" /> : null}{isSaving ? 'جاري الحفظ...' : editingId ? 'تحديث البيانات' : 'حفظ البيانات'}</button>
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
                                <label className="block text-xs font-bold text-gray-700 mb-1">المدقق / الوصف</label>
                                <input type="text" value={payDescription} onChange={e => setPayDescription(e.target.value)} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-black font-bold text-sm" />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
                                <button type="submit" disabled={isPaySaving} className="btn-success flex-1 disabled:opacity-60 disabled:cursor-not-allowed">{isPaySaving ? <Loader2 size={16} className="animate-spin" /> : null}{isPaySaving ? 'جاري الحفظ...' : 'تأكيد التسديد'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Balance Adjustment Modal */}
            {showAdjustModal && adjustingSupplier && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-t-4 border-blue-500">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold text-gray-900">تسوية رصيد المورد</h2>
                            <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 space-y-1">
                            <p className="text-sm font-bold text-gray-800">{adjustingSupplier.name}</p>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">الرصيد الحالي</span>
                                <span className="font-bold text-gray-800">{formatCurrency(Number(adjustingSupplier.balance))}</span>
                            </div>
                            {adjustNewBalance !== '' && Number(adjustNewBalance) !== Number(adjustingSupplier.balance) && (
                                <div className="flex justify-between text-sm pt-1 border-t border-blue-200">
                                    <span className="text-gray-500">الفرق</span>
                                    <span className={`font-bold ${Number(adjustNewBalance) - Number(adjustingSupplier.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {Number(adjustNewBalance) - Number(adjustingSupplier.balance) > 0 ? '+' : ''}
                                        {formatCurrency(Number(adjustNewBalance) - Number(adjustingSupplier.balance))}
                                    </span>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleAdjustBalance} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">الرصيد الجديد <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    value={adjustNewBalance}
                                    onChange={e => setAdjustNewBalance(e.target.value)}
                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black font-bold text-lg"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">سبب التسوية</label>
                                <input
                                    type="text"
                                    value={adjustReason}
                                    onChange={e => setAdjustReason(e.target.value)}
                                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black text-sm"
                                    placeholder="مثال: تصحيح خطأ إدخال، اتفاقية خاصة..."
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAdjustModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm">إلغاء</button>
                                <button type="submit" disabled={isAdjusting} className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed">
                                    {isAdjusting ? <Loader2 size={15} className="animate-spin" /> : null}
                                    {isAdjusting ? 'جاري الحفظ...' : 'تأكيد التسوية'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Debt Modal */}
            {showDebtModal && debtingSupplier && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-t-4 border-rose-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <TrendingUp className="text-rose-500" /> إضافة دين على المورد
                            </h2>
                            <button onClick={() => setShowDebtModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-5">
                            <div className="text-xs text-rose-400 font-bold uppercase mb-1">المورد</div>
                            <div className="font-bold text-rose-900 text-base">{debtingSupplier.name}</div>
                            <div className="flex justify-between items-center border-t border-rose-200 pt-2 mt-2">
                                <span className="text-sm font-bold text-gray-600">الرصيد الحالي المستحق:</span>
                                <span className={`font-bold ${Number(debtingSupplier.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(Number(debtingSupplier.balance))}
                                </span>
                            </div>
                        </div>
                        <form onSubmit={handleDebt} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    مبلغ الدين <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        value={debtAmount}
                                        onChange={e => setDebtAmount(e.target.value)}
                                        className="w-full bg-white border border-gray-300 p-3 pl-10 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-black font-bold text-lg"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                    <TrendingUp className="absolute left-3 top-3.5 text-gray-400" size={20} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">البيان / السبب</label>
                                <input
                                    type="text"
                                    value={debtDescription}
                                    onChange={e => setDebtDescription(e.target.value)}
                                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-black font-bold text-sm"
                                    placeholder="مثال: مشتريات بالآجل، دين قديم..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowDebtModal(false)}
                                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={isDebtSaving}
                                    className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-md shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isDebtSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {isDebtSaving ? 'جاري الحفظ...' : 'تأكيد إضافة الدين'}
                                </button>
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
                                    className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isReturning ? <Loader2 size={16} className="animate-spin" /> : null}
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
