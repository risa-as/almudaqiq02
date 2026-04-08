'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tag, Plus, Edit, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';

import toast from 'react-hot-toast';
interface Offer {
    id: number;
    name: string;
    type: string;
    value: number;
    buyQuantity: number | null;
    getQuantity: number | null;
    productId: number | null;
    categoryId: number | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    product?: { name: string };
    category?: { name: string };
}

export default function OffersPage() {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({
        name: '', type: 'FIXED_DISCOUNT', value: '',
        buyQuantity: '', getQuantity: '', productId: '', categoryId: '',
        startDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true
    });

    const [products, setProducts] = useState<{ id: number, name: string }[]>([]);
    const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchOffers();
        fetchProducts();
        fetchCategories();
    }, []);

    const fetchOffers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/offers');
            if (res.ok) setOffers(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        const res = await fetch('/api/products');
        if (res.ok) setProducts(await res.json());
    };

    const fetchCategories = async () => {
        const res = await fetch('/api/categories');
        if (res.ok) setCategories(await res.json());
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editId ? `/api/offers/${editId}` : '/api/offers';
            const method = editId ? 'PUT' : 'POST';

            const payload = { ...formData };
            if (payload.type !== 'BUY_X_GET_Y') {
                payload.buyQuantity = null;
                payload.getQuantity = null;
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchOffers();
                setIsModalOpen(false);
            } else {
                toast.error('فشل حفظ العرض.');
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء الحفظ.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
        try {
            const res = await fetch(`/api/offers/${id}`, { method: 'DELETE' });
            if (res.ok) fetchOffers();
        } catch (error) {
            console.error(error);
        }
    };

    const openEdit = (offer: Offer) => {
        setEditId(offer.id);
        setFormData({
            ...offer,
            startDate: new Date(offer.startDate).toISOString().split('T')[0],
            endDate: offer.endDate ? new Date(offer.endDate).toISOString().split('T')[0] : '',
            productId: offer.productId || '',
            categoryId: offer.categoryId || '',
            buyQuantity: offer.buyQuantity || '',
            getQuantity: offer.getQuantity || ''
        });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditId(null);
        setFormData({
            name: '', type: 'FIXED_DISCOUNT', value: '',
            buyQuantity: '', getQuantity: '', productId: '', categoryId: '',
            startDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true
        });
        setIsModalOpen(true);
    };

    const getOfferDescription = (offer: Offer) => {
        switch (offer.type) {
            case 'FIXED_DISCOUNT': return `خصم مبلغ ${formatCurrency(offer.value)}`;
            case 'PERCENTAGE_DISCOUNT': return `نسبة خصم ${offer.value}%`;
            case 'BUY_X_GET_Y': return `اشترِ ${offer.buyQuantity} واحصل على ${offer.getQuantity} مجاناً`;
            default: return 'عرض مخصص';
        }
    };

    return (
        <div className="min-h-screen p-6 md:p-12" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <div className="max-w-7xl mx-auto space-y-8">
                <PageHeader
                    title="إدارة العروض والخصومات"
                    subtitle="أضف خصومات وعروض على المنتجات والأقسام لزيادة المبيعات."
                    icon={Tag}
                    gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    actions={
                        <button onClick={openNew} className="bg-pink-600 text-white px-6 py-3 rounded-[var(--border-radius-btn)] font-bold flex items-center gap-2 shadow-lg hover:bg-pink-700 transition-all w-full md:w-auto justify-center">
                            <Plus size={20} />
                            إضافة عرض جديد
                        </button>
                    }
                />

                {/* Search */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] flex items-center gap-4">
                    <Search className="text-gray-400" />
                    <input
                        className="flex-1 outline-none text-gray-700 font-bold bg-transparent"
                        placeholder="ابحث عن العروض..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full p-12 text-center text-gray-400">جاري تحميل العروض...</div>
                    ) : offers.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-gray-400">لا توجد عروض مضافة حالياً.</div>
                    ) : (
                        offers.filter(o => o.name.includes(search)).map(offer => (
                            <div key={offer.id} className="bg-[var(--bg-card)] p-6 rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${offer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {offer.isActive ? 'نشط' : 'متوقف'}
                                    </div>
                                    <div className="text-[var(--color-primary)] font-bold bg-[var(--color-primary-light)] px-3 py-1 rounded-lg">
                                        {offer.type === 'BUY_X_GET_Y' ? 'هدية/مجاني' : 'خصم'}
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-[var(--value-neutral)] mb-1">{offer.name}</h3>
                                <p className="text-[var(--color-primary)] font-extrabold text-lg mb-4">{getOfferDescription(offer)}</p>

                                <div className="space-y-2 text-sm text-[var(--value-neutral)] mb-6 bg-[var(--bg-page)] p-3 rounded-xl">
                                    <div className="flex justify-between">
                                        <span>ينطبق على:</span>
                                        <span className="font-bold">{offer.product?.name ? `منتج: ${offer.product.name}` : offer.category?.name ? `قسم: ${offer.category.name}` : 'كل المنتجات'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ينتهي في:</span>
                                        <span className="text-xs opacity-75">{offer.endDate ? new Date(offer.endDate).toLocaleDateString() : 'مستمر'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-[var(--border-color)] opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(offer)} className="flex-1 py-2 px-3 bg-[var(--bg-page)] text-[var(--color-primary)] rounded-[var(--border-radius-btn)] text-sm font-bold hover:opacity-80 flex items-center justify-center gap-2">
                                        <Edit size={16} /> تعديل
                                    </button>
                                    <button onClick={() => handleDelete(offer.id)} className="flex-1 py-2 px-3 bg-[var(--bg-page)] text-[var(--color-danger)] rounded-[var(--border-radius-btn)] text-sm font-bold hover:opacity-80 flex items-center justify-center gap-2">
                                        <Trash2 size={16} /> حذف
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <form onSubmit={handleSubmit} className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">{editId ? 'تعديل العرض' : 'إضافة عرض جديد'}</h2>
                                <button type="button" onClick={() => setIsModalOpen(false)}><XCircle size={24} className="text-gray-400 hover:text-red-500" /></button>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">اسم العرض <span className="text-red-500">*</span></label>
                                    <input required className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: خصم الصيف 20%" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">نوع العرض <span className="text-red-500">*</span></label>
                                        <select className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                            <option value="FIXED_DISCOUNT">خصم مبلغ ثابت</option>
                                            <option value="PERCENTAGE_DISCOUNT">خصم نسبة مئوية (%)</option>
                                            <option value="BUY_X_GET_Y">اشترِ X واحصل على Y</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            {formData.type === 'BUY_X_GET_Y' ? 'القيمة (غير مستخدمة)' : formData.type === 'PERCENTAGE_DISCOUNT' ? 'نسبة الخصم %' : 'مبلغ الخصم'} <span className="text-red-500">*</span>
                                        </label>
                                        <input type="number" step="0.01" required={formData.type !== 'BUY_X_GET_Y'} disabled={formData.type === 'BUY_X_GET_Y'} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} />
                                    </div>
                                </div>

                                {formData.type === 'BUY_X_GET_Y' && (
                                    <div className="grid grid-cols-2 gap-4 bg-pink-50 p-4 rounded-xl border border-pink-100">
                                        <div>
                                            <label className="block text-sm font-bold text-pink-900 mb-2">اشترِ (كم حبة؟) <span className="text-red-500">*</span></label>
                                            <input type="number" required className="w-full bg-white border border-pink-200 p-3 rounded-xl outline-none" value={formData.buyQuantity} onChange={e => setFormData({ ...formData, buyQuantity: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-pink-900 mb-2">احصل على (مجانًا) <span className="text-red-500">*</span></label>
                                            <input type="number" required className="w-full bg-white border border-pink-200 p-3 rounded-xl outline-none" value={formData.getQuantity} onChange={e => setFormData({ ...formData, getQuantity: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">تطبيق على منتج معين</label>
                                        <select className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value, categoryId: '' })}>
                                            <option value="">بدون (اختر قسم أو الكل)</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">تطبيق على قسم معين</label>
                                        <select disabled={!!formData.productId} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none disabled:opacity-50" value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                                            <option value="">بدون (اختر منتج أو الكل)</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <p className="col-span-2 text-xs text-gray-400">إذا لم تختر منتج أو قسم، سيطبق العرض على كافة المنتجات!</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ البدء</label>
                                        <input type="date" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الانتهاء</label>
                                        <input type="date" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-5 h-5 text-pink-600 rounded border-gray-300 focus:ring-pink-500" />
                                    <span className="font-bold text-gray-700">تفعيل العرض فوراً</span>
                                </label>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
                                <button disabled={isSubmitting} type="submit" className="flex-1 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 shadow-lg shadow-pink-200 disabled:opacity-50">
                                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ العرض'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
