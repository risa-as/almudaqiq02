const fs = require('fs');

const content = `'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, Calendar, DollarSign, ArrowRight, AlertTriangle } from 'lucide-react';
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
    const router = useRouter();
    const { selectedBranch, isOwner, branches } = useBranch();
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(false);

    // Form Fields
    const [selectedUnitId, setSelectedUnitId] = useState<string>('');
    const [quantity, setQuantity] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [supplierId, setSupplierId] = useState<number | ''>('');
    const [paidAmount, setPaidAmount] = useState<string>('');

    const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

    useEffect(() => {
        fetch('/api/suppliers')
            .then(res => res.json())
            .then(data => setSuppliers(data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        const fetchProducts = async () => {
            if (searchQuery.length < 2) {
                if (searchQuery.length === 0) setProducts([]);
                return;
            }
            try {
                const res = await fetch(\`/api/products?search=\${encodeURIComponent(searchQuery)}\`);
                const listData: Product[] = await res.json();
                setProducts(listData.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())));
            } catch (err) {
                console.error(err);
            }
        };
        const timeout = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const generateBatchNumber = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const datePart = \`\${now.getFullYear()}\${pad(now.getMonth() + 1)}\${pad(now.getDate())}\`;
        const randPart = Math.floor(1000 + Math.random() * 9000);
        return \`BATCH-\${datePart}-\${randPart}\`;
    };

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchQuery('');
        setProducts([]);
        setBatchNumber(generateBatchNumber());

        if (product.units.length > 0) {
            const defaultUnit = product.units[0];
            setSelectedUnitId(defaultUnit.id);
            setCostPrice(String(product.costPrice * defaultUnit.conversionFactor));
        } else {
            setCostPrice(String(product.costPrice));
        }
    };

    const handleUnitChange = (unitId: string) => {
        setSelectedUnitId(unitId);
        if (selectedProduct) {
            const unit = selectedProduct.units.find(u => u.id === unitId);
            if (unit) {
                setCostPrice(String(selectedProduct.costPrice * unit.conversionFactor));
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !selectedUnitId || !quantity) return;

        if (isOwner && selectedBranch?.id === 'all' && branches.length > 1) {
            toast.error('يرجى تحديد فرع معين من القائمة في الشريط الجانبي لإضافة المخزون.');
            return;
        }

        setLoading(true);
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
                    paidAmount: paidAmount || null,
                    branchId: selectedBranch?.id !== 'all' ? selectedBranch?.id : (branches.length === 1 ? branches[0].id : undefined),
                })
            });

            if (!res.ok) throw new Error('Failed');

            toast.success('تمت إضافة المخزون بنجاح!');
            router.push('/inventory');
        } catch (err) {
            toast.error('فشل حفظ المخزون. تأكد من البيانات.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
            <div className="max-w-3xl mx-auto">

                <h1 className="text-2xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
                    <Package className="text-blue-600" size={32} />
                    إدخال مخزون جديد (توريد)
                </h1>

                {isOwner && selectedBranch?.id === 'all' && branches.length > 1 && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                        <p className="text-amber-800 text-sm font-bold">
                            أنت تعرض جميع الفروع. يرجى تحديد فرع معين من القائمة في الشريط الجانبي لإضافة مخزون.
                        </p>
                    </div>
                )}

                {!selectedProduct ? (
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <label className="block text-lg font-bold text-gray-700 mb-4">ابحث عن المنتج لإضافته</label>
                        <div className="relative">
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 p-4 pl-10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg text-gray-900 font-bold"
                                placeholder="اسم المنتج..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Search className="absolute left-4 top-5 text-gray-400" />
                        </div>

                        {products.length > 0 && (
                            <div className="mt-4 border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                {products.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectProduct(p)}
                                        className="w-full text-right p-4 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors"
                                    >
                                        <span className="font-bold text-gray-800">{p.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">رصيد: {p.baseStock}</span>
                                            <ArrowRight size={16} className="text-gray-400" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {searchQuery && products.length === 0 && (
                            <div className="p-4 text-center text-gray-400">لا توجد نتائج</div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-6 animate-fade-in-up">

                        <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-lg flex justify-between items-center">
                            <div>
                                <div className="text-blue-200 text-sm font-bold uppercase mb-1">المنتج المحدد</div>
                                <h2 className="text-2xl font-bold">{selectedProduct.name}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedProduct(null)}
                                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm font-bold transition-colors"
                            >
                                تغيير
                            </button>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">الوحدة المشتراة</label>
                                    <select
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none text-gray-900 font-bold"
                                        value={selectedUnitId}
                                        onChange={(e) => handleUnitChange(e.target.value)}
                                    >
                                        {selectedProduct.units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} (x{u.conversionFactor})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">الكمية</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الشراء (للوحدة المحددة)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 p-4 pl-10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg text-gray-900"
                                        value={costPrice}
                                        onChange={(e) => setCostPrice(e.target.value)}
                                    />
                                    <DollarSign className="absolute left-4 top-5 text-gray-400" size={20} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الانتهاء</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50 border border-gray-200 p-4 pl-10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                    />
                                    <Calendar className="absolute left-4 top-4.5 text-gray-400" size={20} />
                                </div>
                            </div>

                            {/* batchNumber is auto-generated and hidden from UI */}
                            <input type="hidden" value={batchNumber} />

                            <hr className="border-gray-100 my-6" />
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign className="text-blue-500" size={20} />
                                فاتورة الشراء (المورد)
                            </h3>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">المورد (اختياري)</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"
                                        value={supplierId}
                                        onChange={(e) => setSupplierId(Number(e.target.value) || '')}
                                    >
                                        <option value="">لا يوجد مورد محدد (نقدي عام)</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ المدفوع (الواصل)</label>
                                    <input
                                        type="number"
                                        disabled={!supplierId}
                                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold disabled:opacity-50"
                                        placeholder={supplierId ? "الواصل..." : "اختر المورد أولاً لتسجيل دفعة"}
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                    />
                                    {supplierId && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            إجمالي الفاتورة: <span className="font-bold text-red-500">{formatCurrency(Number(quantity || 0) * Number(costPrice || 0))}</span>
                                            <br />
                                            (المتبقي سيُسجل كدين عليك للمورد)
                                        </p>
                                    )}
                                </div>
                            </div>

                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setSelectedProduct(null)}
                                className="px-6 py-4 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 hover:shadow-xl hover:-translate-y-1 transition-all flex justify-center items-center gap-2"
                            >
                                {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                {loading ? 'جاري الحفظ...' : 'حفظ المخزون'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
`;

fs.writeFileSync('app/(tenant)/inventory/stock-in/page.tsx', content);
console.log('Done: stock-in page rebuilt with auto batch number');
