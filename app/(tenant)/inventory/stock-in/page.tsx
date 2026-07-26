'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJsonOr } from '@/lib/query/fetcher';
import { useRouter } from 'next/navigation';
import {
    Search, Package, Calendar, DollarSign, ArrowRight,
    AlertTriangle, Layers, Truck, X, Save, PackagePlus,
    CheckCircle2, ChevronLeft, Loader2,
} from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/format';
import toast from 'react-hot-toast';

interface ProductUnit {
    id: string;
    name: string;
    conversionFactor: number;
}

interface Product {
    id: string;
    name: string;
    units: ProductUnit[];
    baseStock: number;
    costPrice: number;
}

export default function StockInPage() {
  usePageTitle('إضافة مخزون');
    const router = useRouter();
    const { selectedBranch, isOwner, branches } = useBranch();

    const [searchQuery, setSearchQuery]     = useState('');
    const [products, setProducts]           = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [loading, setLoading]             = useState(false);

    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [quantity, setQuantity]           = useState('');
    const [costPrice, setCostPrice]         = useState('');
    const [expiryDate, setExpiryDate]       = useState('');
    const [batchNumber, setBatchNumber]     = useState('');
    const [supplierId, setSupplierId]       = useState('');
    const [paidAmount, setPaidAmount]       = useState('');
    const [isPrepaid, setIsPrepaid]         = useState(false);

    const queryClient = useQueryClient();
    const suppliersQuery = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => fetchJsonOr<{ id: string; name: string }[]>('/api/suppliers', []),
    });
    const suppliers = suppliersQuery.data ?? [];

    useEffect(() => {
        const fetchProducts = async () => {
            if (searchQuery.length < 2) { if (!searchQuery) setProducts([]); return; }
            try {
                const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}`);
                const list: Product[] = await res.json();
                setProducts(list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())));
            } catch { /* silent */ }
        };
        const t = setTimeout(fetchProducts, 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const generateBatchNumber = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `BATCH-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.floor(1000+Math.random()*9000)}`;
    };

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchQuery('');
        setProducts([]);
        setBatchNumber(generateBatchNumber());
        if (product.units.length > 0) {
            const u = product.units[0];
            setSelectedUnitId(u.id);
            setCostPrice(String(product.costPrice * u.conversionFactor));
        } else {
            setCostPrice(String(product.costPrice));
        }
        setQuantity('');
        setExpiryDate('');
        setSupplierId('');
        setPaidAmount('');
    };

    const handleUnitChange = (unitId: string) => {
        setSelectedUnitId(unitId);
        if (selectedProduct) {
            const u = selectedProduct.units.find(u => u.id === unitId);
            if (u) setCostPrice(String(selectedProduct.costPrice * u.conversionFactor));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !selectedUnitId || !quantity) return;
        if (isOwner && selectedBranch?.id === 'all' && branches.length > 1) {
            toast.error('يرجى تحديد فرع معين من الشريط العلوي لإضافة المخزون.');
            return;
        }
        setLoading(true);
        const total = Number(quantity) * Number(costPrice);
        const resolvedPaidAmount = supplierId
            ? isPrepaid ? String(total) : paidAmount || null
            : null;
        try {
            const res = await fetch('/api/inventory/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedProduct.id,
                    unitId: selectedUnitId,
                    quantity: Number(quantity),
                    costPrice: Number(costPrice),
                    expiryDate: expiryDate || null,
                    batchNumber: batchNumber || null,
                    supplierId: supplierId || null,
                    paidAmount: resolvedPaidAmount,
                    branchId: selectedBranch?.id !== 'all' ? selectedBranch?.id : (branches.length === 1 ? branches[0].id : undefined),
                }),
            });
            if (!res.ok) throw new Error();
            toast.success('تمت إضافة المخزون بنجاح!');
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['batches'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-expiry'] });
            queryClient.invalidateQueries({ queryKey: ['product-history'] });
            router.push('/inventory');
        } catch {
            toast.error('فشل حفظ المخزون، تأكد من البيانات.');
        } finally {
            setLoading(false);
        }
    };

    const total     = Number(quantity || 0) * Number(costPrice || 0);
    const paid      = Number(paidAmount || 0);
    const remaining = total - paid;

    return (
        <form
            onSubmit={handleSave}
            dir="rtl"
            className="flex flex-col gap-4 h-[calc(100vh-5rem)]"
        >
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 8px 20px rgba(9,75,159,.3)' }}
                    >
                        <PackagePlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">إدخال مخزون جديد</h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">اختر منتجاً وأدخل بيانات التوريد</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/inventory')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <X size={15} />
                        إلغاء
                    </button>
                    {selectedProduct && (
                        <button
                            type="submit"
                            disabled={loading || !quantity}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 6px 20px rgba(9,75,159,.35)' }}
                        >
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            {loading ? 'جاري الحفظ...' : 'حفظ المخزون'}
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Branch warning ─── */}
            {isOwner && selectedBranch?.id === 'all' && branches.length > 1 && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 shrink-0">
                    <AlertTriangle size={18} className="text-blue-500 shrink-0" />
                    <p className="text-blue-800 text-sm font-bold">
                        أنت في وضع «كل الفروع». حدد فرعاً محدداً من الشريط العلوي لإضافة المخزون.
                    </p>
                </div>
            )}

            {/* ─── Two-column body ─── */}
            <div className="flex-1 grid grid-cols-5 gap-4 min-h-0">

                {/* ── LEFT: Product search (2 cols) ── */}
                <div className="col-span-2 glass-panel flex flex-col overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-5 py-4 border-b border-white/40 shrink-0"
                        style={{ background: 'linear-gradient(135deg,rgba(9,75,159,.05) 0%,transparent 60%)' }}
                    >
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,.3)' }}
                        >
                            <Search className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="font-bold text-slate-700 text-sm">اختيار المنتج</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

                        {/* Search box */}
                        <div className="relative">
                            <input
                                autoFocus={!selectedProduct}
                                type="text"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder-slate-300 shadow-sm"
                                placeholder="ابحث باسم المنتج..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                        </div>

                        {/* Search results */}
                        {products.length > 0 && (
                            <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                {products.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelectProduct(p)}
                                        className="w-full text-right px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center justify-between gap-3 transition-colors group"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">رصيد: {p.baseStock} وحدة</p>
                                        </div>
                                        <ChevronLeft size={15} className="text-slate-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {searchQuery.length >= 2 && products.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                                <Package size={32} />
                                <p className="text-xs font-bold mt-2">لا توجد نتائج</p>
                            </div>
                        )}

                        {/* Selected product card */}
                        {selectedProduct && (
                            <div
                                className="rounded-xl p-4 border border-blue-100 relative overflow-hidden"
                                style={{ background: 'linear-gradient(135deg,rgba(9,75,159,.06) 0%,rgba(14,99,212,.04) 100%)' }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                            <CheckCircle2 size={16} className="text-blue-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-0.5">المنتج المحدد</p>
                                            <p className="font-black text-slate-800 text-sm truncate">{selectedProduct.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedProduct(null); setSearchQuery(''); }}
                                        className="text-[11px] font-bold text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                                    >
                                        تغيير
                                    </button>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="bg-white rounded-lg px-3 py-2 text-center border border-blue-50">
                                        <p className="text-[10px] text-slate-400 font-bold">الرصيد الحالي</p>
                                        <p className="text-base font-black text-slate-700">{selectedProduct.baseStock}</p>
                                    </div>
                                    <div className="bg-white rounded-lg px-3 py-2 text-center border border-blue-50">
                                        <p className="text-[10px] text-slate-400 font-bold">سعر التكلفة</p>
                                        <p className="text-base font-black text-blue-600">{formatCurrency(Number(selectedProduct.costPrice))}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!selectedProduct && !searchQuery && (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-200 py-8">
                                <Package size={40} />
                                <p className="text-xs font-bold mt-3 text-slate-300">ابحث عن منتج للبدء</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Form (3 cols) ── */}
                <div className="col-span-3 glass-panel flex flex-col overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-5 py-4 border-b border-white/40 shrink-0"
                        style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.05) 0%,transparent 60%)' }}
                    >
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 12px rgba(16,185,129,.3)' }}
                        >
                            <Layers className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="font-bold text-slate-700 text-sm">بيانات التوريد</h2>
                    </div>

                    {!selectedProduct ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-200 gap-3">
                            <PackagePlus size={48} />
                            <p className="text-sm font-bold text-slate-300">اختر منتجاً من اليمين لبدء الإدخال</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">

                            {/* ── Section: Stock data ── */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)' }}>
                                        <Package size={11} className="text-white" />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">بيانات الكمية</span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Unit */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                            <Layers size={11} className="text-emerald-400" />
                                            الوحدة المشتراة
                                        </label>
                                        <select
                                            required
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer"
                                            value={selectedUnitId}
                                            onChange={e => handleUnitChange(e.target.value)}
                                        >
                                            {selectedProduct.units.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} (x{u.conversionFactor})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Quantity */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                            <Package size={11} className="text-emerald-400" />
                                            الكمية <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number" required min="1" autoFocus
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm text-center"
                                            placeholder="0"
                                            value={quantity}
                                            onChange={e => setQuantity(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Cost Price */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                            <DollarSign size={11} className="text-emerald-400" />
                                            سعر الشراء (للوحدة)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number" step="0.01" required dir="ltr"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-9 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm text-left"
                                                value={costPrice}
                                                onChange={e => setCostPrice(e.target.value)}
                                            />
                                            <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        </div>
                                    </div>

                                    {/* Expiry Date */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                            <Calendar size={11} className="text-emerald-400" />
                                            تاريخ الانتهاء <span className="text-slate-300 font-normal">(اختياري)</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-9 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm"
                                                value={expiryDate}
                                                onChange={e => setExpiryDate(e.target.value)}
                                            />
                                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        </div>
                                    </div>
                                </div>

                                {/* Total preview */}
                                {quantity && costPrice && (
                                    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                                        <span className="text-xs font-bold text-blue-500">إجمالي قيمة هذا التوريد</span>
                                        <span className="text-lg font-black text-blue-700">{formatCurrency(total)}</span>
                                    </div>
                                )}
                            </div>

                            {/* ── Section: Invoice ── */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                                        <Truck size={11} className="text-white" />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">فاتورة الشراء</span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Supplier */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                            <Truck size={11} className="text-emerald-400" />
                                            المورد <span className="text-slate-300 font-normal">(اختياري)</span>
                                        </label>
                                        <select
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer"
                                            value={supplierId}
                                            onChange={e => { setSupplierId(e.target.value); setPaidAmount(''); setIsPrepaid(false); }}
                                        >
                                            <option value="">نقدي عام</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Paid Amount */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                            <DollarSign size={11} className="text-emerald-400" />
                                            المبلغ المدفوع
                                        </label>
                                        <input
                                            type="number" min="0" step="0.01"
                                            disabled={!supplierId || isPrepaid}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                            placeholder={!supplierId ? 'اختر المورد أولاً' : isPrepaid ? 'مدفوع بالكامل' : '0'}
                                            value={isPrepaid ? '' : paidAmount}
                                            onChange={e => setPaidAmount(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Prepaid checkbox */}
                                {supplierId && (
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                                        <div className="relative flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={isPrepaid}
                                                onChange={(e) => {
                                                    setIsPrepaid(e.target.checked);
                                                    if (e.target.checked) setPaidAmount('');
                                                }}
                                            />
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isPrepaid ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}>
                                                {isPrepaid && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600">
                                            تم شراء هذا المخزون مسبقاً
                                            <span className="text-slate-400 font-normal mr-1">(مدفوع بالكامل — لا دين على المورد)</span>
                                        </span>
                                    </label>
                                )}

                                {/* Financial summary */}
                                {supplierId && (
                                    <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-slate-100">
                                        <div className="px-4 py-3 bg-slate-50 text-center border-l border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 mb-0.5">الإجمالي</p>
                                            <p className="text-sm font-black text-slate-700">{formatCurrency(total)}</p>
                                        </div>
                                        <div className="px-4 py-3 bg-emerald-50 text-center border-l border-slate-100">
                                            <p className="text-[10px] font-bold text-emerald-500 mb-0.5">المدفوع</p>
                                            <p className="text-sm font-black text-emerald-600">{formatCurrency(paid)}</p>
                                        </div>
                                        <div className={`px-4 py-3 text-center ${remaining > 0 ? 'bg-red-50' : remaining < 0 ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                                            <p className={`text-[10px] font-bold mb-0.5 ${remaining > 0 ? 'text-red-400' : remaining < 0 ? 'text-orange-400' : 'text-emerald-500'}`}>
                                                {remaining > 0 ? 'الدين' : remaining < 0 ? 'زيادة' : 'مسدد'}
                                            </p>
                                            <p className={`text-sm font-black ${remaining > 0 ? 'text-red-600' : remaining < 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(Math.abs(remaining))}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
}
