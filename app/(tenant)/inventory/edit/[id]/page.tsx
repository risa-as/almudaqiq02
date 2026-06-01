'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box, Layers, DollarSign, Scan, Save, X, Loader2,
    Plus, Package, Truck, Hash, AlertTriangle, PencilLine, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UnitInput {
    id?: string;
    name: string;
    conversion: number;
    barcode: string;
    price: number;
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  usePageTitle('تعديل المنتج');
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [baseCost, setBaseCost] = useState(0);
    const [minimumStock, setMinimumStock] = useState(0);
    const [supplierId, setSupplierId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [units, setUnits] = useState<UnitInput[]>([]);

    useEffect(() => {
        fetchProduct();
        fetchSuppliers();
        fetchCategories();
    }, [id]);

    const fetchSuppliers = async () => {
        try {
            const res = await fetch('/api/suppliers');
            if (res.ok) setSuppliers(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            if (res.ok) setCategories(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchProduct = async () => {
        try {
            const res = await fetch(`/api/products/${id}`);
            if (res.ok) {
                const data = await res.json();
                setName(data.name);
                setDescription(data.description || '');
                setBaseCost(Number(data.costPrice));
                setMinimumStock(data.minimumStock ?? 0);
                if (data.supplierId) setSupplierId(String(data.supplierId));
                if (data.categoryId) setCategoryId(String(data.categoryId));
                if (data.units) {
                    setUnits(data.units.map((u: any) => ({
                        id: u.id,
                        name: u.name,
                        conversion: u.conversionFactor,
                        barcode: u.barcode || '',
                        price: Number(u.price),
                    })));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const addUnit = () =>
        setUnits(u => [...u, { name: 'وحدة جديدة', conversion: 1, barcode: '', price: 0 }]);

    const updateUnit = (i: number, field: keyof UnitInput, value: string | number) =>
        setUnits(u => u.map((unit, idx) => idx === i ? { ...unit, [field]: value } : unit));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, baseCost, minimumStock, units, supplierId: supplierId || null, categoryId: categoryId || null }),
            });
            if (!res.ok) throw new Error('فشل التحديث');
            toast.success('تم تحديث المنتج بنجاح!');
            router.push('/inventory');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'حدث خطأ');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-5rem)]" dir="rtl">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-slate-500 font-semibold text-sm">جاري تحميل بيانات المنتج...</p>
                </div>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            dir="rtl"
            className="flex flex-col gap-4 h-[calc(100vh-5rem)]"
        >
            {/* ─── Header bar ─── */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 8px 20px rgba(9,75,159,.3)' }}
                    >
                        <PencilLine className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">تعديل المنتج</h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 truncate max-w-xs">{name}</p>
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
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 6px 20px rgba(9,75,159,.35)' }}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </button>
                </div>
            </div>

            {/* ─── Two-column body ─── */}
            <div className="flex-1 grid grid-cols-5 gap-4 min-h-0">

                {/* ── LEFT: Basic Details (2 cols) ── */}
                <div className="col-span-2 glass-panel flex flex-col overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-5 py-4 border-b border-white/40 shrink-0"
                        style={{ background: 'linear-gradient(135deg,rgba(9,75,159,.05) 0%,transparent 60%)' }}
                    >
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,.3)' }}
                        >
                            <Box className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="font-bold text-slate-700 text-sm">البيانات الأساسية</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">

                        {/* Name */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                <Package size={12} className="text-blue-400" />
                                اسم المنتج <span className="text-red-400">*</span>
                            </label>
                            <input
                                required autoFocus
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder-slate-300 shadow-sm"
                                placeholder="اسم المنتج"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                <Hash size={12} className="text-blue-400" />
                                الوصف <span className="text-slate-300 font-normal">(اختياري)</span>
                            </label>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder-slate-300 shadow-sm"
                                placeholder="وصف مختصر..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                <Tag size={12} className="text-blue-400" />
                                الفئة <span className="text-slate-300 font-normal">(اختياري)</span>
                            </label>
                            <select
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer"
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                            >
                                <option value="">-- اختر الفئة --</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Supplier */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                <Truck size={12} className="text-blue-400" />
                                المورد المعتاد <span className="text-slate-300 font-normal">(اختياري)</span>
                            </label>
                            <select
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer"
                                value={supplierId}
                                onChange={e => setSupplierId(e.target.value)}
                            >
                                <option value="">-- اختر المورد --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Base Cost */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                <DollarSign size={12} className="text-blue-400" />
                                تكلفة الشراء <span className="text-slate-400 font-normal">(للوحدة الأصغر)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number" step="0.01" min="0" dir="ltr"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm text-left"
                                    value={baseCost}
                                    onChange={e => setBaseCost(Number(e.target.value))}
                                />
                                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        {/* Minimum Stock */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                                <AlertTriangle size={12} className="text-blue-400" />
                                الحد الأدنى للمخزون
                            </label>
                            <div className="relative">
                                <input
                                    type="number" step="1" min="0" dir="ltr"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm text-left"
                                    value={minimumStock}
                                    onChange={e => setMinimumStock(Number(e.target.value))}
                                />
                                <AlertTriangle className="absolute left-3 top-2.5 w-4 h-4 text-blue-400" />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">عند الانخفاض لهذا الرقم يُعتبر المنتج ناقصاً في التقارير</p>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Units & Pricing (3 cols) ── */}
                <div className="col-span-3 glass-panel flex flex-col overflow-hidden">
                    <div
                        className="flex items-center justify-between px-4 py-2.5 border-b border-white/40 shrink-0"
                        style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.05) 0%,transparent 60%)' }}
                    >
                        <div className="flex items-center gap-2.5">
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 3px 8px rgba(16,185,129,.3)' }}
                            >
                                <Layers className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-slate-700 text-sm">الوحدات والتسعير</h2>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                                    {units.length} وحدة
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addUnit}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all text-white"
                            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 3px 8px rgba(16,185,129,.25)' }}
                        >
                            <Plus size={11} />
                            إضافة وحدة
                        </button>
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-50/60 border-b border-slate-100 shrink-0">
                        {[
                            { label: 'اسم الوحدة',  cols: 'col-span-3' },
                            { label: 'المعامل',      cols: 'col-span-2' },
                            { label: 'الباركود',     cols: 'col-span-4' },
                            { label: 'سعر البيع',    cols: 'col-span-3' },
                        ].map(h => (
                            <div key={h.label} className={`${h.cols} text-[10px] font-bold text-slate-400 uppercase tracking-wide`}>
                                {h.label}
                            </div>
                        ))}
                    </div>

                    {/* Units list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                        {units.map((unit, i) => (
                            <div
                                key={i}
                                className={`grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg border transition-all relative ${
                                    i === 0 ? 'bg-emerald-50/40 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'
                                }`}
                            >
                                {/* Saved badge */}
                                {unit.id && (
                                    <span className="absolute -top-2 left-2 bg-blue-100 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-blue-200 leading-none">
                                        محفوظ
                                    </span>
                                )}

                                {/* Name */}
                                <div className="col-span-3 relative">
                                    <input
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all placeholder-slate-300"
                                        value={unit.name}
                                        onChange={e => updateUnit(i, 'name', e.target.value)}
                                        placeholder="قطعة"
                                    />
                                    {i === 0 && (
                                        <span className="absolute -top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full leading-none">
                                            افتراضية
                                        </span>
                                    )}
                                </div>

                                {/* Conversion */}
                                <div className="col-span-2">
                                    <input
                                        type="number" required min="1"
                                        disabled={!!unit.id || i === 0}
                                        className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none transition-all ${
                                            !!unit.id || i === 0
                                                ? 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'
                                                : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400'
                                        }`}
                                        value={unit.conversion}
                                        onChange={e => updateUnit(i, 'conversion', Number(e.target.value))}
                                    />
                                </div>

                                {/* Barcode */}
                                <div className="col-span-4 relative">
                                    <input
                                        dir="ltr"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 pl-6 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all placeholder-slate-300 text-left"
                                        placeholder="Scan..."
                                        value={unit.barcode}
                                        onChange={e => updateUnit(i, 'barcode', e.target.value)}
                                    />
                                    <Scan className="absolute left-1.5 top-2 w-3 h-3 text-slate-400" />
                                </div>

                                {/* Price */}
                                <div className="col-span-3">
                                    <input
                                        type="number" step="0.01" required min="0"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all"
                                        value={unit.price}
                                        onChange={e => updateUnit(i, 'price', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        ))}

                        {units.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                                <Layers size={32} />
                                <p className="text-xs font-bold mt-2">لا توجد وحدات</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
