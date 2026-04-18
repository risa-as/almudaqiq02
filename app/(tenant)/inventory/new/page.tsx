'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Layers, DollarSign, Barcode, Scan, Save, X, Plus, Search, ChevronDown } from 'lucide-react';

import toast from 'react-hot-toast';
interface UnitInput {
    name: string;
    conversion: number;
    barcode: string;
    price: number;
}

export default function NewProductPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [baseCost, setBaseCost] = useState(0);

    // New Fields
    const [categories, setCategories] = useState<{ id: number, name: string, parentId: number | null }[]>([]);
    const [categoryId, setCategoryId] = useState<string>('');
    const [categorySearch, setCategorySearch] = useState('');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const categoryRef = useRef<HTMLDivElement>(null);
    const [suppliers, setSuppliers] = useState<{ id: number, name: string }[]>([]);
    const [supplierId, setSupplierId] = useState<string>('');

    // Read barcode from URL query param (set by inventory page barcode scanner)
    const prefilledBarcode = searchParams.get('barcode') || '';

    // Default to at least one unit (Piece), with barcode pre-filled if provided
    const [units, setUnits] = useState<UnitInput[]>([
        { name: 'قطعة', conversion: 1, barcode: prefilledBarcode, price: 0 }
    ]);

    // Close category dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
                setCategoryOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        fetch('/api/categories')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCategories(data);
            })
            .catch(err => console.error(err));

        fetch('/api/suppliers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setSuppliers(data);
            })
            .catch(err => console.error(err));
    }, []);

    const addUnit = () => {
        setUnits([...units, { name: 'وحدة جديدة', conversion: 1, barcode: '', price: 0 }]);
    };

    const removeUnit = (index: number) => {
        if (units.length > 1) {
            setUnits(units.filter((_, i) => i !== index));
        }
    };

    const updateUnit = (index: number, field: keyof UnitInput, value: string | number) => {
        const newUnits = [...units];
        newUnits[index] = { ...newUnits[index], [field]: value };
        setUnits(newUnits);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name,
                description,
                baseCost,
                units,
                categoryId: categoryId || null,
                supplierId: supplierId || null,

            };

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('فشل إنشاء المنتج');

            toast.success('تم إنشاء المنتج بنجاح!');
            router.push('/inventory');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء المنتج');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-extrabold text-gray-900">إضافة منتج جديد</h1>
                    <p className="text-gray-500 mt-1">أدخل تفاصيل المنتج، وحدات القياس، والأسعار.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Basic Details Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
                        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Box className="text-blue-500" />
                            البيانات الأساسية
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المنتج</label>
                                <input
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 text-gray-900 font-bold"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="مثال: بيبسي 330 مل"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">الوصف (اختياري)</label>
                                <input
                                    className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 text-gray-900 font-medium"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="وصف مختصر للمنتج..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">القسم / التصنيف</label>
                                <div className="relative" ref={categoryRef}>
                                    {/* Trigger button */}
                                    <button
                                        type="button"
                                        onClick={() => { setCategoryOpen(o => !o); setCategorySearch(''); }}
                                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 font-medium flex items-center justify-between gap-2 text-right"
                                    >
                                        <span className={categoryId ? 'text-gray-900' : 'text-gray-400'}>
                                            {categoryId
                                                ? categories.find(c => String(c.id) === categoryId)?.name ?? '-- اختر القسم --'
                                                : '-- اختر القسم --'}
                                        </span>
                                        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Dropdown */}
                                    {categoryOpen && (
                                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                            {/* Search input */}
                                            <div className="p-2 border-b border-gray-100">
                                                <div className="relative">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="w-full bg-gray-50 border border-gray-200 py-2 px-3 pr-9 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                                                        placeholder="ابحث عن قسم..."
                                                        value={categorySearch}
                                                        onChange={e => setCategorySearch(e.target.value)}
                                                        onKeyDown={e => e.key === 'Escape' && setCategoryOpen(false)}
                                                    />
                                                    <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
                                                </div>
                                            </div>

                                            {/* Options list */}
                                            <div
                                                className="max-h-56 overflow-y-auto"
                                                onWheel={e => e.stopPropagation()}
                                            >
                                                {/* Clear option */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setCategoryId(''); setCategoryOpen(false); }}
                                                    className="w-full text-right px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
                                                >
                                                    -- بدون قسم --
                                                </button>

                                                {(() => {
                                                    const q = categorySearch.toLowerCase();
                                                    const parents = categories.filter(c => !c.parentId);
                                                    const children = categories.filter(c => c.parentId);

                                                    // Filter: if searching, show all matching regardless of hierarchy
                                                    if (q) {
                                                        const matches = categories.filter(c => c.name.toLowerCase().includes(q));
                                                        if (matches.length === 0) return (
                                                            <p className="text-center text-sm text-gray-400 py-4">لا توجد نتائج</p>
                                                        );
                                                        return matches.map(cat => {
                                                            const parent = cat.parentId ? categories.find(p => p.id === cat.parentId) : null;
                                                            const isSelected = String(cat.id) === categoryId;
                                                            return (
                                                                <button
                                                                    key={cat.id}
                                                                    type="button"
                                                                    onClick={() => { setCategoryId(String(cat.id)); setCategoryOpen(false); }}
                                                                    className={`w-full text-right px-4 py-2 text-sm transition-colors flex flex-col gap-0.5 ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-800 hover:bg-gray-50'}`}
                                                                >
                                                                    <span className={`font-bold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{cat.name}</span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {parent ? `📁 ${parent.name} ← ${cat.name}` : '📁 قسم رئيسي'}
                                                                    </span>
                                                                </button>
                                                            );
                                                        });
                                                    }

                                                    // No search — show full hierarchy
                                                    const standalone = parents.filter(p => !children.some(c => c.parentId === p.id));
                                                    const withChildren = parents.filter(p => children.some(c => c.parentId === p.id));

                                                    return (
                                                        <>
                                                            {standalone.map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    type="button"
                                                                    onClick={() => { setCategoryId(String(cat.id)); setCategoryOpen(false); }}
                                                                    className={`w-full text-right px-4 py-2.5 text-sm transition-colors ${String(cat.id) === categoryId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-800 hover:bg-gray-50'}`}
                                                                >
                                                                    {cat.name}
                                                                </button>
                                                            ))}
                                                            {withChildren.map(parent => (
                                                                <div key={parent.id}>
                                                                    <div className="px-4 py-1.5 text-xs font-bold text-gray-400 bg-gray-50 border-y border-gray-100 flex items-center gap-1">
                                                                        📁 {parent.name}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setCategoryId(String(parent.id)); setCategoryOpen(false); }}
                                                                        className={`w-full text-right px-5 py-2.5 text-sm transition-colors ${String(parent.id) === categoryId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                                                                    >
                                                                        {parent.name} (الرئيسي)
                                                                    </button>
                                                                    {children
                                                                        .filter(c => c.parentId === parent.id)
                                                                        .map(child => (
                                                                            <button
                                                                                key={child.id}
                                                                                type="button"
                                                                                onClick={() => { setCategoryId(String(child.id)); setCategoryOpen(false); }}
                                                                                className={`w-full text-right px-7 py-2.5 text-sm transition-colors flex items-center gap-2 ${String(child.id) === categoryId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                                                                            >
                                                                                <span className="text-gray-400">↳</span> {child.name}
                                                                            </button>
                                                                        ))
                                                                    }
                                                                </div>
                                                            ))}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">المورد (المصدر المعتاد)</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium"
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                >
                                    <option value="">-- اختر المورد --</option>
                                    {suppliers.map(sup => (
                                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">تكلفة الشراء (للأصغر وحدة)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-gray-50 border border-gray-200 p-4 pl-10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 text-left text-gray-900 font-bold"
                                        dir="ltr"
                                        value={baseCost}
                                        onChange={(e) => setBaseCost(Number(e.target.value))}
                                    />
                                    <DollarSign className="absolute left-3 top-4 text-gray-400 w-5 h-5" />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">السعر الذي تدفعه للمورد مقابل أصغر وحدة.</p>
                            </div>
                        </div>
                    </div>





                    {/* Units Configuration Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Layers className="text-green-500" />
                                الوحدات والتسعير
                            </h2>
                            <button
                                type="button"
                                onClick={addUnit}
                                className="flex items-center gap-1 text-green-700 hover:text-white hover:bg-green-600 bg-green-50 px-4 py-2 rounded-lg font-bold text-md transition-all"
                            >
                                <Plus size={18} />
                                إضافة وحدة
                            </button>
                        </div>

                        <div className="space-y-4">
                            {units.map((unit, index) => (
                                <div key={index} className="bg-gray-50 p-6 rounded-2xl border border-gray-200 relative group animate-fade-in-up">
                                    <div className="grid grid-cols-12 gap-4 items-start">

                                        {/* Unit Name */}
                                        <div className="col-span-4 md:col-span-3">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" title="مثل: قطعة">اسم الوحدة)</label>
                                            <input
                                                required
                                                className="w-full bg-white border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-gray-900 font-bold placeholder-gray-300"
                                                value={unit.name}
                                                onChange={(e) => updateUnit(index, 'name', e.target.value)}
                                                placeholder="مثال: قطعة"
                                            />
                                        </div>

                                        {/* Conversion Factor */}
                                        <div className="col-span-2 md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">المعامل</label>
                                            <input
                                                type="number"
                                                required
                                                disabled={index === 0}
                                                className={`w-full border border-gray-200 p-3 rounded-lg text-center font-bold outline-none text-gray-900 ${index === 0 ? 'bg-gray-200 text-gray-500' : 'bg-white focus:ring-2 focus:ring-green-500'}`}
                                                value={unit.conversion}
                                                onChange={(e) => updateUnit(index, 'conversion', Number(e.target.value))}
                                            />
                                        </div>

                                        {/* Barcode */}
                                        <div className="col-span-6 md:col-span-4 relative">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">الباركود</label>
                                            <div className="relative">
                                                <input
                                                    required
                                                    className="w-full bg-white border border-gray-200 p-3 pl-10 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-left text-gray-900 font-bold"
                                                    dir="ltr"
                                                    value={unit.barcode}
                                                    onChange={(e) => updateUnit(index, 'barcode', e.target.value)}
                                                    placeholder="Scan..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault(); // Prevent form submission
                                                            // Find and focus the price input in the same row
                                                            const priceInput = e.currentTarget.parentElement?.parentElement?.nextElementSibling?.querySelector('input[type="number"]');
                                                            if (priceInput instanceof HTMLInputElement) {
                                                                priceInput.focus();
                                                                priceInput.select();
                                                            }
                                                        }
                                                    }}
                                                />
                                                <Scan className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                                            </div>
                                        </div>

                                        {/* Sell Price */}
                                        <div className="col-span-6 md:col-span-3 flex items-center gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">سعر البيع</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    className="w-full bg-white border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-900"
                                                    value={unit.price}
                                                    onChange={(e) => updateUnit(index, 'price', Number(e.target.value))}
                                                />
                                            </div>
                                            {index > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeUnit(index)}
                                                    className="mt-6 text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                                                    title="حذف الوحدة"
                                                >
                                                    <X size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {index === 0 && <span className="absolute -top-3 left-4 bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-green-200">الافتراضية</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col-reverse md:flex-row gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-8 py-4 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 hover:text-gray-900 transition-all flex items-center justify-center gap-2"
                        >
                            <X size={20} />
                            إلغاء التغييرات
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 text-lg"
                        >
                            <Save size={20} />
                            حفظ المنتج الجديد
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
