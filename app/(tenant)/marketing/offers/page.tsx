'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { Tag, Plus, Edit, Trash2, Search, XCircle, Percent, Gift, DollarSign, Calendar, Store, ToggleLeft, ToggleRight, Zap, Package, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';
import toast from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';

interface Offer {
    id: string;
    name: string;
    type: string;
    value: number;
    buyQuantity: number | null;
    getQuantity: number | null;
    productId: string | null;
    categoryId: string | null;
    branchId: string | null;
    branch?: { id: string; name: string };
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    product?: { name: string };
    category?: { name: string };
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; gradient: string; badge: string }> = {
    FIXED_DISCOUNT:      { label: 'خصم ثابت',    icon: <DollarSign size={18}/>, gradient: 'from-blue-500 to-blue-600',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    PERCENTAGE_DISCOUNT: { label: 'خصم نسبة',    icon: <Percent size={18}/>,    gradient: 'from-violet-500 to-purple-600', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
    BUY_X_GET_Y:         { label: 'اشترِ واحصل', icon: <Gift size={18}/>,        gradient: 'from-pink-500 to-rose-600',     badge: 'bg-pink-50 text-pink-700 border-pink-200' },
};

export default function OffersPage() {
  usePageTitle('العروض التسويقية');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const { confirm, dialog } = useConfirm();
    const [offers, setOffers]       = useState<Offer[]>([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive'>('all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editId, setEditId]           = useState<string | null>(null);
    const [formData, setFormData]       = useState<any>({
        name: '', type: 'FIXED_DISCOUNT', value: '',
        buyQuantity: '', getQuantity: '', productId: '', categoryId: '',
        startDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true
    });
    const [products,     setProducts]     = useState<{ id: string; name: string }[]>([]);
    const [categories,   setCategories]   = useState<{ id: string; name: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId,   setDeletingId]   = useState<string | null>(null);
    const [removingId,   setRemovingId]   = useState<string | null>(null);

    useEffect(() => {
        if (branchLoading) return;
        fetchOffers();
        fetchProducts();
        fetchCategories();
    }, [selectedBranch, branchLoading]);

    const fetchOffers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedBranch?.id && selectedBranch.id !== 'all') params.set('branchId', selectedBranch.id);
            const res = await fetch(`/api/offers?${params}`);
            if (res.ok) setOffers(await res.json());
        } catch { } finally { setLoading(false); }
    };

    const fetchProducts   = async () => { const r = await fetch('/api/products');   if (r.ok) setProducts(await r.json()); };
    const fetchCategories = async () => { const r = await fetch('/api/categories'); if (r.ok) setCategories(await r.json()); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const url    = editId ? `/api/offers/${editId}` : '/api/offers';
            const method = editId ? 'PUT' : 'POST';
            const payload = { ...formData };
            if (payload.type !== 'BUY_X_GET_Y') { payload.buyQuantity = null; payload.getQuantity = null; }
            if (!editId && selectedBranch?.id && selectedBranch.id !== 'all') payload.branchId = selectedBranch.id;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) { toast.success(editId ? 'تم تحديث العرض' : 'تم إضافة العرض'); fetchOffers(); setIsModalOpen(false); }
            else toast.error('فشل حفظ العرض.');
        } catch { toast.error('حدث خطأ أثناء الحفظ.'); }
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ title: 'حذف العرض', message: 'هل أنت متأكد من حذف هذا العرض؟ لا يمكن التراجع عن هذا الإجراء.', variant: 'danger', confirmLabel: 'حذف' })) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/offers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setDeletingId(null);
                setRemovingId(id);
                setTimeout(() => {
                    setOffers(prev => prev.filter(o => o.id !== id));
                    setRemovingId(null);
                    toast.success('تم حذف العرض');
                }, 450);
            } else {
                toast.error('فشل الحذف');
                setDeletingId(null);
            }
        } catch {
            toast.error('حدث خطأ أثناء الحذف');
            setDeletingId(null);
        }
    };

    const openEdit = (offer: Offer) => {
        setEditId(offer.id);
        setFormData({ ...offer, startDate: new Date(offer.startDate).toISOString().split('T')[0], endDate: offer.endDate ? new Date(offer.endDate).toISOString().split('T')[0] : '', productId: offer.productId || '', categoryId: offer.categoryId || '', buyQuantity: offer.buyQuantity || '', getQuantity: offer.getQuantity || '' });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditId(null);
        setFormData({ name: '', type: 'FIXED_DISCOUNT', value: '', buyQuantity: '', getQuantity: '', productId: '', categoryId: '', startDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true });
        setIsModalOpen(true);
    };

    const getOfferDescription = (o: Offer) => {
        if (o.type === 'FIXED_DISCOUNT')      return `خصم ${formatCurrency(o.value)}`;
        if (o.type === 'PERCENTAGE_DISCOUNT') return `خصم ${o.value}%`;
        if (o.type === 'BUY_X_GET_Y')         return `اشترِ ${o.buyQuantity} + ${o.getQuantity} مجاناً`;
        return 'عرض مخصص';
    };

    const isExpired = (o: Offer) => o.endDate ? new Date(o.endDate) < new Date() : false;

    const filtered = useMemo(() => offers.filter(o => {
        if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterType === 'active')   return o.isActive && !isExpired(o);
        if (filterType === 'inactive') return !o.isActive || isExpired(o);
        return true;
    }), [offers, search, filterType]);

    const stats = useMemo(() => ({
        total:    offers.length,
        active:   offers.filter(o => o.isActive && !isExpired(o)).length,
        inactive: offers.filter(o => !o.isActive || isExpired(o)).length,
        expired:  offers.filter(isExpired).length,
    }), [offers]);

    if (loading) return (
        <div className="min-h-screen p-6" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Hero loader */}
                <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg,#ec4899,#be185d)', boxShadow: '0 12px 40px rgba(236,72,153,0.4)' }}>
                            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                            <Tag size={36} className="text-white relative z-10 sk-spin" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                            style={{ background: 'linear-gradient(135deg,#f472b6,#ec4899)', boxShadow: '0 2px 8px rgba(236,72,153,0.5)' }} />
                    </div>
                    <div className="text-center space-y-1.5">
                        <p className="text-xl font-black text-slate-800">جاري تحميل العروض التسويقية</p>
                        <div className="flex items-center justify-center gap-1.5">
                            {[0, 0.2, 0.4].map((delay, i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-pink-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                            ))}
                        </div>
                        <p className="text-sm text-slate-400 font-medium">يتم استرجاع العروض والخصومات الحالية</p>
                    </div>
                </div>

                {/* KPI skeletons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                            <div className="flex items-center justify-between">
                                <div className="skeleton h-3 w-20" />
                                <div className="skeleton w-9 h-9 rounded-xl" />
                            </div>
                            <div className="skeleton h-7 w-16" />
                        </div>
                    ))}
                </div>

                {/* Toolbar skeleton */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
                    <div className="skeleton h-9 flex-1 min-w-[180px] max-w-xs rounded-xl" />
                    <div className="skeleton h-9 w-48 rounded-xl" />
                </div>

                {/* Offer card skeletons */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                            <div className="skeleton h-24 w-full" />
                            <div className="p-4 space-y-2.5">
                                <div className="skeleton h-3 w-2/3" />
                                <div className="skeleton h-3 w-1/2" />
                                <div className="skeleton h-3 w-3/5" />
                                <div className="flex gap-2 pt-2">
                                    <div className="skeleton h-8 flex-1 rounded-xl" />
                                    <div className="skeleton h-8 flex-1 rounded-xl" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen p-6" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            {dialog}
            <style>{`
                @keyframes cardDeletingPulse {
                    0%, 100% { box-shadow: 0 0 0 2px rgba(239,68,68,0.25); background-color: rgba(254,226,226,0.35); }
                    50%      { box-shadow: 0 0 0 2px rgba(239,68,68,0.5);  background-color: rgba(254,202,202,0.6);  }
                }
                .card-deleting { animation: cardDeletingPulse 1.1s ease-in-out infinite; border-color: rgba(239,68,68,0.3) !important; }
                @keyframes cardRemoving {
                    0%   { opacity: 1; transform: scale(1);    }
                    30%  { opacity: 0.7; transform: scale(0.97); }
                    100% { opacity: 0; transform: scale(0.88); }
                }
                .card-removing { animation: cardRemoving 0.45s cubic-bezier(0.4,0,0.2,1) forwards; pointer-events: none; }
            `}</style>
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <PageHeader
                    title="العروض والخصومات"
                    subtitle="إدارة عروض المبيعات وخصومات المنتجات"
                    icon={Tag}
                    gradient="linear-gradient(135deg,#ec4899,#be185d)"
                    actions={
                        <button onClick={openNew}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg hover:-translate-y-0.5 transition-all active:translate-y-0"
                            style={{ background: 'linear-gradient(135deg,#ec4899,#be185d)', boxShadow: '0 8px 24px rgba(236,72,153,0.35)' }}>
                            <Plus size={18} /> إضافة عرض جديد
                        </button>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'إجمالي العروض', value: stats.total,    iconBg: '#f8fafc', iconColor: '#64748b', icon: Tag },
                        { label: 'نشطة',          value: stats.active,   iconBg: '#ecfdf5', iconColor: '#10b981', icon: Zap },
                        { label: 'متوقفة',        value: stats.inactive, iconBg: '#f8fafc', iconColor: '#94a3b8', icon: ToggleLeft },
                        { label: 'منتهية',        value: stats.expired,  iconBg: '#fef2f2', iconColor: '#ef4444', icon: Calendar },
                    ].map(s => (
                        <div key={s.label} className="kpi-card">
                            <div className="kpi-icon" style={{ background: s.iconBg }}>
                                <s.icon size={18} style={{ color: s.iconColor }} />
                            </div>
                            <div className="min-w-0">
                                <p className="kpi-label">{s.label}</p>
                                <p className="kpi-value">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Toolbar */}
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input type="text" placeholder="بحث عن عرض..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pr-8 pl-3 py-2 text-sm border border-[var(--border-color)] rounded-xl bg-[var(--bg-page)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-pink-200" />
                    </div>
                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl p-1">
                        {([['all','الكل'],['active','نشطة'],['inactive','متوقفة']] as const).map(([v,l]) => (
                            <button key={v} onClick={() => setFilterType(v)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === v ? 'bg-pink-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] mr-auto">{filtered.length} عرض</span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.length === 0 ? (
                        <div className="col-span-full py-20 flex flex-col items-center gap-3 text-[var(--text-muted)]">
                            <div className="w-16 h-16 rounded-2xl bg-pink-50 flex items-center justify-center">
                                <Tag size={28} className="text-pink-300" />
                            </div>
                            <p className="font-bold text-sm">لا توجد عروض</p>
                            <p className="text-xs">أضف عرضاً جديداً للبدء</p>
                        </div>
                    ) : (
                        filtered.map(offer => {
                            const isCardDeleting = deletingId === offer.id;
                            const isCardRemoving = removingId === offer.id;
                            const cfg     = TYPE_CONFIG[offer.type] ?? TYPE_CONFIG.FIXED_DISCOUNT;
                            const expired = isExpired(offer);
                            return (
                                <div key={offer.id} className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm transition-all group ${isCardRemoving ? 'card-removing' : isCardDeleting ? 'card-deleting' : 'hover:shadow-md'}`}>
                                    {/* Gradient header */}
                                    <div className={`bg-gradient-to-br ${cfg.gradient} p-5 relative overflow-hidden`}>
                                        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 80% 20%,rgba(255,255,255,.5),transparent)' }} />
                                        <div className="flex items-start justify-between relative z-10">
                                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                                                {cfg.icon}
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${offer.isActive && !expired ? 'bg-white/20 text-white border-white/30' : 'bg-black/20 text-white/70 border-white/20'}`}>
                                                    {expired ? 'منتهية' : offer.isActive ? 'نشط' : 'متوقف'}
                                                </span>
                                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/30">{cfg.label}</span>
                                            </div>
                                        </div>
                                        <div className="mt-3 relative z-10">
                                            <p className="text-white font-black text-2xl">{getOfferDescription(offer)}</p>
                                            <p className="text-white/80 font-semibold text-sm mt-0.5 line-clamp-1">{offer.name}</p>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 space-y-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[var(--text-muted)]">ينطبق على</span>
                                            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1">
                                                <Package size={11} className="text-[var(--text-muted)]" />
                                                {offer.product?.name ? offer.product.name : offer.category?.name ? offer.category.name : 'كل المنتجات'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[var(--text-muted)]">الفرع</span>
                                            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1">
                                                <Store size={11} className="text-[var(--text-muted)]" />
                                                {offer.branch?.name ?? 'كل الفروع'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[var(--text-muted)]">ينتهي في</span>
                                            <span className={`font-bold flex items-center gap-1 ${expired ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                                                <Calendar size={11} />
                                                {offer.endDate ? new Date(offer.endDate).toLocaleDateString('ar-IQ') : 'مستمر'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="px-4 pb-4 flex gap-2">
                                        <button onClick={() => openEdit(offer)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                            <Edit size={13} /> تعديل
                                        </button>
                                        <button onClick={() => handleDelete(offer.id)} disabled={isCardDeleting || isCardRemoving}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all disabled:cursor-not-allowed ${isCardDeleting ? 'border-red-300 text-red-600 bg-red-50' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-60'}`}>
                                            {isCardDeleting
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : <Trash2 size={13} />}
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                    <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
                        className="bg-[var(--bg-card)] w-full max-w-2xl rounded-2xl shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#ec4899,#be185d)' }}>
                                    <Tag size={15} className="text-white" />
                                </div>
                                <h2 className="text-base font-extrabold text-[var(--text-primary)]">{editId ? 'تعديل العرض' : 'إضافة عرض جديد'}</h2>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500 transition-colors">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">اسم العرض <span className="text-red-500">*</span></label>
                                <input required placeholder="مثال: خصم الصيف 20%"
                                    className="w-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>

                            {/* Type + Value */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">نوع العرض <span className="text-red-500">*</span></label>
                                    <select className="w-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                                        value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="FIXED_DISCOUNT">خصم مبلغ ثابت</option>
                                        <option value="PERCENTAGE_DISCOUNT">خصم نسبة مئوية %</option>
                                        <option value="BUY_X_GET_Y">اشترِ X واحصل على Y</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                        {formData.type === 'PERCENTAGE_DISCOUNT' ? 'نسبة الخصم %' : formData.type === 'BUY_X_GET_Y' ? 'القيمة' : 'مبلغ الخصم'} <span className="text-red-500">*</span>
                                    </label>
                                    <input type="number" step="0.01" disabled={formData.type === 'BUY_X_GET_Y'}
                                        className="w-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:opacity-40"
                                        value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} />
                                </div>
                            </div>

                            {/* Buy X Get Y */}
                            {formData.type === 'BUY_X_GET_Y' && (
                                <div className="grid grid-cols-2 gap-4 bg-pink-50 border border-pink-100 p-4 rounded-xl">
                                    <div>
                                        <label className="block text-xs font-bold text-pink-800 mb-1.5">اشترِ (كمية) <span className="text-red-500">*</span></label>
                                        <input type="number" required className="w-full bg-white border border-pink-200 text-slate-800 px-4 py-2.5 rounded-xl text-sm focus:outline-none" value={formData.buyQuantity} onChange={e => setFormData({ ...formData, buyQuantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-pink-800 mb-1.5">احصل على (مجاناً) <span className="text-red-500">*</span></label>
                                        <input type="number" required className="w-full bg-white border border-pink-200 text-slate-800 px-4 py-2.5 rounded-xl text-sm focus:outline-none" value={formData.getQuantity} onChange={e => setFormData({ ...formData, getQuantity: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {/* Product / Category */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">ينطبق على منتج</label>
                                    <select className="w-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                                        value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value, categoryId: '' })}>
                                        <option value="">الكل</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">ينطبق على قسم</label>
                                    <select disabled={!!formData.productId}
                                        className="w-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm focus:outline-none disabled:opacity-40"
                                        value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                                        <option value="">الكل</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                {!formData.productId && !formData.categoryId && (
                                    <p className="col-span-2 text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                                        تحذير: بدون تحديد منتج أو قسم سيُطبَّق العرض على جميع المنتجات!
                                    </p>
                                )}
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">تاريخ البدء</label>
                                    <input type="date" className="w-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"
                                        value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">تاريخ الانتهاء <span className="text-[var(--text-muted)]">(اختياري)</span></label>
                                    <input type="date" className="w-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"
                                        value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                </div>
                            </div>

                            {/* Active toggle */}
                            <button type="button" onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${formData.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-[var(--bg-page)] border-[var(--border-color)]'}`}>
                                <span className={`text-sm font-bold ${formData.isActive ? 'text-emerald-700' : 'text-[var(--text-secondary)]'}`}>
                                    {formData.isActive ? 'العرض مفعّل' : 'العرض متوقف'}
                                </span>
                                {formData.isActive
                                    ? <ToggleRight size={24} className="text-emerald-500" />
                                    : <ToggleLeft size={24} className="text-[var(--text-muted)]" />}
                            </button>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 px-6 pb-6">
                            <button type="button" onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-page)] transition-colors">
                                إلغاء
                            </button>
                            <button type="submit" disabled={isSubmitting}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(135deg,#ec4899,#be185d)', boxShadow: '0 4px 16px rgba(236,72,153,0.35)' }}>
                                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : null}
                                {isSubmitting ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة العرض'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
