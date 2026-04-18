'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Layers, DollarSign, Barcode, Scan, Save, X, Plus, Trash2 } from 'lucide-react';

import toast from 'react-hot-toast';
interface UnitInput {
    id?: number;
    name: string;
    conversion: number;
    barcode: string;
    price: number;
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [baseCost, setBaseCost] = useState(0);
    const [units, setUnits] = useState<UnitInput[]>([]);
    const [suppliers, setSuppliers] = useState<{ id: number, name: string }[]>([]);
    const [supplierId, setSupplierId] = useState<string>('');

    useEffect(() => {
        fetchProduct();
        fetchSuppliers();
    }, [id]);

    const fetchSuppliers = async () => {
        try {
            const res = await fetch('/api/suppliers');
            if (res.ok) setSuppliers(await res.json());
        } catch (e) {
            console.error(e);
        }
    }

    const fetchProduct = async () => {
        try {
            const res = await fetch(`/api/products/${id}`);
            if (res.ok) {
                const data = await res.json();
                setName(data.name);
                setDescription(data.description || '');
                setBaseCost(data.costPrice);
                if (data.supplierId) setSupplierId(String(data.supplierId));

                if (data.units) {
                    setUnits(data.units.map((u: any) => ({
                        id: u.id,
                        name: u.name,
                        conversion: u.conversionFactor,
                        barcode: u.barcode,
                        price: u.price
                    })));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const addUnit = () => {
        setUnits([...units, { name: 'وحدة جديدة', conversion: 1, barcode: '', price: 0 }]);
    };

    // Note: We are not implementing DELETE unit on backend yet, so just UI removal from submission list
    // This might cause sync issues if backend expects all.
    // For now, let's assume UI removal means "don't update" but existing ones stay?
    // Or better, only allow adding new ones and editing existing.

    const updateUnit = (index: number, field: keyof UnitInput, value: string | number) => {
        const newUnits = [...units];
        newUnits[index] = { ...newUnits[index], [field]: value };
        setUnits(newUnits);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, baseCost, units, supplierId: supplierId || null }),
            });

            if (!res.ok) throw new Error('فشل التحديث');

            toast.success('تم تحديث المنتج بنجاح!');
            router.push('/inventory');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'حدث خطأ');
        }
    };

    if (loading) return <div className="p-12 text-center text-xl font-bold">جاري تحميل البيانات...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 animate-fade-in-up" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900">تعديل المنتج</h1>
                        <p className="text-gray-500 mt-1">تعديل بيانات {name}</p>
                    </div>
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
                                    className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">المورد (المصدر المعتاد)</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium outline-none transition-all"
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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">الوصف</label>
                                <input
                                    className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">تكلفة الشراء (للأصغر وحدة)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-gray-50 border border-gray-200 p-4 pl-10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-left text-gray-900 font-bold"
                                        dir="ltr"
                                        value={baseCost}
                                        onChange={(e) => setBaseCost(Number(e.target.value))}
                                    />
                                    <DollarSign className="absolute left-3 top-4 text-gray-400 w-5 h-5" />
                                </div>
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
                                <div key={index} className="bg-gray-50 p-6 rounded-2xl border border-gray-200 relative group">
                                    <div className="grid grid-cols-12 gap-4 items-start">

                                        {/* Unit Name */}
                                        <div className="col-span-4 md:col-span-3">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 truncate" title="اسم الوحدة / الصنف (اللون، المقاس)">اسم الوحدة / الصنف</label>
                                            <input
                                                required
                                                className="w-full bg-white border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-300 text-gray-900 font-bold"
                                                value={unit.name}
                                                onChange={(e) => updateUnit(index, 'name', e.target.value)}
                                                placeholder="مثال: قطعة / أحمر - XL"
                                            />
                                        </div>
                                        {/* Conversion Factor */}
                                        <div className="col-span-2 md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">المعامل</label>
                                            <input
                                                type="number"
                                                required
                                                // Disable conversion edit for existing units to avoid inventory corruption
                                                disabled={!!unit.id || index === 0}
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
                                        </div>
                                    </div>
                                    {unit.id && <span className="absolute -top-3 left-4 bg-blue-100 text-blue-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-blue-200">محفوظ</span>}
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
                            حفظ التعديلات
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
