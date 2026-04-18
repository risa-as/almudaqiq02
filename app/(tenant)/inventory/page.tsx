'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus, Package, AlertCircle, DollarSign, Calendar, Filter, FolderTree, Trash2, Printer, ScanLine, X, Save } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useUser } from '@/hooks/useUser';
import { useBranch } from '@/contexts/BranchContext';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';

import toast from 'react-hot-toast';
// Interfaces
interface ProductUnit {
    name: string;
    price: number;
}

interface Product {
    id: number;
    name: string;
    baseStock: number;
    costPrice: number;
    units: ProductUnit[];
    categoryId?: number;
    category?: { name: string };
    supplierId?: number;
    supplier?: { name: string };
}

export default function InventoryPage() {
    const { isAdmin, loading: userLoading } = useUser();
    const { selectedBranch, isOwner, branches, loading: branchLoading } = useBranch();
    const router = useRouter();
    // ... (State remains same)
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [filterSupplier, setFilterSupplier] = useState<string>('ALL');
    const [filterStock, setFilterStock] = useState<string>('ALL'); // ALL, LOW, OUT
    const [sortBy, setSortBy] = useState<string>('NEWEST');

    // --- Barcode Scanner State ---
    const barcodeBuffer = useRef<string>('');
    const lastKeyTime = useRef<number>(0);
    const SCANNER_SPEED_THRESHOLD_MS = 50; // Scanners type each char in < 50ms

    // Stock-In Quick Modal State
    const [stockInModal, setStockInModal] = useState<{
        open: boolean;
        productId: string | null;
        productName: string;
        unitId: string;
        units: { id: string; name: string; conversionFactor: number }[];
        barcode: string;
    }>({
        open: false,
        productId: null,
        productName: '',
        unitId: '',
        units: [],
        barcode: ''
    });
    const [stockInQty, setStockInQty] = useState('');
    const [stockInCost, setStockInCost] = useState('');
    const [stockInSupplierId, setStockInSupplierId] = useState('');
    const [stockInExpiryDate, setStockInExpiryDate] = useState('');
    const [stockInPaidAmount, setStockInPaidAmount] = useState('');
    const [stockInLoading, setStockInLoading] = useState(false);
    const [barcodeToast, setBarcodeToast] = useState<string | null>(null);

    useEffect(() => {
        if (branchLoading) return;
        fetchProducts();
        fetchCategories();
        fetchSuppliers();
    }, [selectedBranch, branchLoading]);

    // --- Global Barcode Scanner Listener ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input/textarea/select
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

            const now = Date.now();
            const timeSinceLast = now - lastKeyTime.current;
            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                const code = barcodeBuffer.current.trim();
                barcodeBuffer.current = '';

                if (code.length >= 3) {
                    // It looks like a barcode was scanned - check it
                    handleBarcodeScanned(code);
                }
                return;
            }

            // If delay between keystrokes is large (manual typing), reset buffer
            if (timeSinceLast > SCANNER_SPEED_THRESHOLD_MS * 3 && barcodeBuffer.current.length > 0) {
                barcodeBuffer.current = '';
            }

            // Append character to buffer
            if (e.key.length === 1) {
                barcodeBuffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleBarcodeScanned = useCallback(async (code: string) => {
        setBarcodeToast(`🔍 جاري البحث عن باركود: ${code}`);
        try {
            const res = await fetch(`/api/inventory/check-barcode?code=${encodeURIComponent(code)}`);
            if (res.status === 404) {
                // Product not found — redirect to new product page with barcode pre-filled
                setBarcodeToast(`➕ باركود جديد! جاري فتح نموذج إضافة منتج...`);
                setTimeout(() => {
                    setBarcodeToast(null);
                    router.push(`/inventory/new?barcode=${encodeURIComponent(code)}`);
                }, 800);
            } else if (res.ok) {
                const data = await res.json();
                // Product found — open stock-in modal with details pre-filled
                setBarcodeToast(`✅ تم العثور على: ${data.product.name}`);
                // Find the unit matching this barcode
                const matchedUnit = data.product.units.find((u: any) => u.barcode === code);
                setTimeout(() => {
                    setBarcodeToast(null);
                    setStockInQty('');
                    setStockInCost(data.product.costPrice ? String(data.product.costPrice) : '');
                    setStockInSupplierId(data.product.supplierId ? String(data.product.supplierId) : '');
                    setStockInExpiryDate('');
                    setStockInPaidAmount('');
                    setStockInModal({
                        open: true,
                        productId: data.product.id,
                        productName: data.product.name,
                        unitId: matchedUnit?.id || (data.product.units[0]?.id ?? ''),
                        units: data.product.units,
                        barcode: code
                    });
                }, 600);
            } else {
                setBarcodeToast(`❌ خطأ في البحث عن الباركود`);
                setTimeout(() => setBarcodeToast(null), 3000);
            }
        } catch (err) {
            console.error(err);
            setBarcodeToast(`❌ تعذر الاتصال بالخادم`);
            setTimeout(() => setBarcodeToast(null), 3000);
        }
    }, [router]);

    const handleStockInSubmit = async () => {
        if (!stockInModal.productId || !stockInModal.unitId || !stockInQty) {
            toast.error('يرجى تعبئة جميع الحقول المطلوبة');
            return;
        }

        if (isOwner && selectedBranch?.id === 'all' && branches.length > 1) {
            toast.error('يرجى اختيار فرع محدد من الشريط العلوي أولاً لتعيين المخزون فيه');
            return;
        }

        setStockInLoading(true);
        try {
            const res = await fetch('/api/inventory/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: stockInModal.productId,
                    unitId: stockInModal.unitId,
                    quantity: Number(stockInQty),
                    costPrice: Number(stockInCost) || 0,
                    expiryDate: stockInExpiryDate || null,
                    supplierId: stockInSupplierId || null,
                    paidAmount: stockInPaidAmount || null,
                    branchId: selectedBranch?.id !== 'all' ? selectedBranch?.id : (branches.length === 1 ? branches[0].id : undefined),
                })
            });
            if (res.ok) {
                setStockInModal(prev => ({ ...prev, open: false }));
                fetchProducts(); // Refresh table
            } else {
                const err = await res.json();
                toast.error(`خطأ: ${err.error || 'فشل إدخال المخزون'}`);
            }
        } catch (err) {
            console.error(err);
            toast.error('حدث خطأ أثناء إدخال المخزون');
        } finally {
            setStockInLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            if (res.ok) setCategories(await res.json());
        } catch (e) {
            console.error('Error fetching categories', e);
        }
    }

    const fetchSuppliers = async () => {
        try {
            const res = await fetch('/api/suppliers');
            if (res.ok) setSuppliers(await res.json());
        } catch (e) {
            console.error('Error fetching suppliers', e);
        }
    }

    const fetchProducts = async () => {
        try {
            const branchParam = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `?branchId=${selectedBranch.id}`
                : '';
            const res = await fetch(`/api/products${branchParam}`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا المنتج؟ سيتم حذف جميع الوحدات المرتبطة به.')) return;

        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProducts(prev => prev.filter(p => p.id !== id));
                toast.success('تم حذف المنتج بنجاح ✅');
            } else {
                const error = await res.json();
                toast.error(`خطأ: ${error.error || 'فشل الحذف'}`);
            }
        } catch (err) {
            console.error(err);
            toast.error('حدث خطأ أثناء الحذف');
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = filterCategory === 'ALL' || String(p.categoryId) === filterCategory;
        const matchesSupplier = filterSupplier === 'ALL' || String(p.supplierId) === filterSupplier;

        let matchesStock = true;
        if (filterStock === 'LOW') matchesStock = p.baseStock > 0 && p.baseStock <= 10;
        if (filterStock === 'OUT') matchesStock = p.baseStock === 0;

        return matchesSearch && matchesCategory && matchesStock && matchesSupplier;
    }).sort((a, b) => {
        if (sortBy === 'ID_ASC') return a.id - b.id;
        if (sortBy === 'ID_DESC') return b.id - a.id;
        if (sortBy === 'PRICE_HIGH') return b.costPrice - a.costPrice;
        if (sortBy === 'PRICE_LOW') return a.costPrice - b.costPrice;
        if (sortBy === 'STOCK_HIGH') return b.baseStock - a.baseStock;
        if (sortBy === 'STOCK_LOW') return a.baseStock - b.baseStock;
        return 0; // Default (API sends ID DESC)
    });

    // Calculate Stats
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => p.baseStock < 10).length;
    const totalValue = products.reduce((sum, p) => sum + (p.costPrice * p.baseStock), 0);

    return (
        <div className="min-h-screen p-6 md:p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>

            {/* Barcode Toast Notification */}
            {barcodeToast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 animate-fade-in-up">
                    <ScanLine size={20} className="text-blue-400 animate-pulse" />
                    {barcodeToast}
                </div>
            )}

            {/* Stock-In Quick Modal */}
            {stockInModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">

                        {/* Header — compact */}
                        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
                            <div className="min-w-0">
                                <div className="text-blue-200 text-[11px] font-medium flex items-center gap-1.5 mb-0.5">
                                    <ScanLine size={12} />
                                    باركود: {stockInModal.barcode}
                                </div>
                                <h3 className="text-base font-extrabold leading-tight truncate">{stockInModal.productName}</h3>
                            </div>
                            <button
                                onClick={() => setStockInModal(prev => ({ ...prev, open: false }))}
                                className="bg-white/20 hover:bg-white/30 p-1.5 rounded-lg transition-colors shrink-0 mr-3"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body — no scroll, compact spacing */}
                        <div className="p-4 space-y-3">

                            {/* Row 1: Unit + Quantity + Cost */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">الوحدة</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 px-2 py-2 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={stockInModal.unitId}
                                        onChange={e => setStockInModal(prev => ({ ...prev, unitId: e.target.value }))}
                                    >
                                        {stockInModal.units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} (x{u.conversionFactor})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">الكمية *</label>
                                    <input
                                        type="number" min="1" autoFocus required
                                        className="w-full bg-gray-50 border border-gray-200 px-2 py-2 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                        value={stockInQty}
                                        onChange={e => setStockInQty(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">سعر الشراء</label>
                                    <div className="relative">
                                        <input
                                            type="number" step="0.01" min="0"
                                            className="w-full bg-gray-50 border border-gray-200 px-2 py-2 pl-7 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="0"
                                            value={stockInCost}
                                            onChange={e => setStockInCost(e.target.value)}
                                        />
                                        <DollarSign className="absolute left-2 top-2.5 text-gray-400" size={14} />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Expiry Date */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ الانتهاء</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50 border border-gray-200 px-2 py-2 pl-7 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={stockInExpiryDate}
                                        onChange={e => setStockInExpiryDate(e.target.value)}
                                    />
                                    <Calendar className="absolute left-2 top-2.5 text-gray-400" size={14} />
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                    <DollarSign size={12} className="text-blue-400" />فاتورة الشراء
                                </span>
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>

                            {/* Row 3: Supplier + Paid Amount */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">المورد (اختياري)</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 px-2 py-2 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={stockInSupplierId}
                                        onChange={e => { setStockInSupplierId(e.target.value); setStockInPaidAmount(''); }}
                                    >
                                        <option value="">نقدي عام</option>
                                        {suppliers.map(sup => (
                                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">المبلغ المدفوع</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        disabled={!stockInSupplierId}
                                        className="w-full bg-gray-50 border border-gray-200 px-2 py-2 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                                        placeholder={stockInSupplierId ? '0' : 'اختر المورد أولاً'}
                                        value={stockInPaidAmount}
                                        onChange={e => setStockInPaidAmount(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Financial summary — horizontal strip */}
                            {stockInSupplierId && (() => {
                                const total     = Number(stockInQty || 0) * Number(stockInCost || 0);
                                const paid      = Number(stockInPaidAmount || 0);
                                const remaining = total - paid;
                                return (
                                    <div className="grid grid-cols-3 divide-x divide-x-reverse divide-gray-100 rounded-xl border border-gray-100 bg-gray-50 text-center text-xs overflow-hidden">
                                        <div className="px-2 py-2">
                                            <div className="text-gray-400 mb-0.5">الإجمالي</div>
                                            <div className="font-extrabold text-gray-800">{formatCurrency(total)}</div>
                                        </div>
                                        <div className="px-2 py-2">
                                            <div className="text-gray-400 mb-0.5">المدفوع</div>
                                            <div className="font-extrabold text-green-600">{formatCurrency(paid)}</div>
                                        </div>
                                        <div className="px-2 py-2">
                                            <div className="text-gray-400 mb-0.5">{remaining > 0 ? 'الدين' : remaining < 0 ? 'زيادة' : 'مسدد'}</div>
                                            <div className={`font-extrabold ${remaining > 0 ? 'text-red-500' : remaining < 0 ? 'text-orange-500' : 'text-green-600'}`}>
                                                {formatCurrency(Math.abs(remaining))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                        </div>

                        {/* Footer */}
                        <div className="px-4 pb-4 pt-1 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setStockInModal(prev => ({ ...prev, open: false }))}
                                className="px-4 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleStockInSubmit}
                                disabled={stockInLoading}
                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
                            >
                                {stockInLoading
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري الحفظ...</>
                                    : <><Save size={16} />حفظ المخزون</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-8">
                <PageHeader
                    title="إدارة المخزون"
                    subtitle="إضافة وتعديل وحذف المنتجات وإدارة الأصناف والموردين."
                    icon={Package}
                    actions={
                        <div className="flex flex-wrap gap-3">
                            {userLoading ? (
                                <div className="flex gap-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-9 w-24 rounded-xl bg-gray-100 animate-pulse" />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <Link href="/inventory/print-labels" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all shadow-sm font-bold text-sm group" title="طباعة ملصقات">
                                        <Printer size={20} className="text-gray-500 group-hover:text-purple-600 transition-colors" />
                                        <span className="hidden md:inline">طباعة ملصقات</span>
                                    </Link>
                                    <Link href="/inventory/categories" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm font-bold text-sm group" title="الأقسام">
                                        <FolderTree size={20} className="text-gray-500 group-hover:text-indigo-600 transition-colors" />
                                        <span className="hidden md:inline">الأقسام</span>
                                    </Link>
                                    {isAdmin && <Link href="/inventory/stock-in" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all shadow-sm font-bold text-sm group" title="إدخال مخزون">
                                        <Package size={20} className="text-gray-500 group-hover:text-emerald-600 transition-colors" />
                                        <span className="hidden md:inline">إدخال مخزون</span>
                                    </Link>}
                                    {isAdmin && <Link href="/inventory/new" className="btn-primary group">
                                        <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                                        <span>إضافة منتج جديد</span>
                                    </Link>}
                                </>
                            )}
                        </div>
                    }
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        label="إجمالي المنتجات"
                        value={totalProducts}
                        icon={Package}
                        gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                    />
                    <StatCard
                        label="نواقص المخزون"
                        value={lowStockCount}
                        icon={AlertCircle}
                        gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                        valueColor="var(--value-negative)"
                    />
                    <StatCard
                        label="القيمة التقديرية (التكلفة)"
                        value={formatCurrency(totalValue)}
                        icon={DollarSign}
                        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        valueColor="var(--value-positive)"
                    />
                </div>

                {/* Barcode Scanner Active Indicator */}
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3">
                    <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-xl flex-shrink-0">
                        <ScanLine size={20} className="text-blue-600 animate-pulse" />
                    </div>
                    <div className="flex-1">
                        <p className="text-blue-800 font-bold text-sm">وضع المسح بالباركود نشط ⚡</p>
                        <p className="text-blue-500 text-xs font-medium">امسح أي باركود بجهاز القارئ — يفتح تلقائياً نافذة إدخال مخزون للمنتجات الموجودة، أو نموذج إضافة منتج جديد للباركودات الجديدة</p>
                    </div>
                    <span className="hidden md:flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg flex-shrink-0">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse inline-block"></span>
                        نشط
                    </span>
                </div>

                {/* Filters & Search */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] flex flex-col md:flex-row gap-4 items-center justify-between relative z-20">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                        <input type="text" placeholder="بحث عن منتج بالاسم..." className="block w-full pr-10 pl-4 py-3 border border-[var(--border-color)] rounded-xl focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-[var(--bg-page)] hover:bg-[var(--bg-card)] transition-colors text-right" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border ${isFilterOpen ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                        >
                            <Filter size={18} />
                            <span>تصفية متقدمة</span>
                            {(filterCategory !== 'ALL' || filterStock !== 'ALL' || filterSupplier !== 'ALL' || sortBy !== 'NEWEST') && <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2"></span>}
                        </button>

                        {/* Filter Dropdown */}
                        {isFilterOpen && (
                            <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-30 animate-fade-in-up">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">ترتيب حسب</label>
                                        <select className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                            <option value="NEWEST">الأحدث إضافة (الافتراضي)</option>
                                            <option value="ID_ASC">الرقم التسلسلي (تصاعدي 1-10)</option>
                                            <option value="ID_DESC">الرقم التسلسلي (تنازلي 10-1)</option>
                                            <option value="STOCK_HIGH">الأكثر مخزوناً</option>
                                            <option value="STOCK_LOW">الأقل مخزوناً</option>
                                            <option value="PRICE_HIGH">الأعلى سعراً (تكلفة)</option>
                                            <option value="PRICE_LOW">الأقل سعراً (تكلفة)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">حالة المخزون</label>
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={filterStock}
                                            onChange={(e) => setFilterStock(e.target.value)}
                                        >
                                            <option value="ALL">الكل</option>
                                            <option value="LOW">مخزون منخفض (أقل من 10)</option>
                                            <option value="OUT">نافذ من المخزون (0)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">القسم</label>
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={filterCategory}
                                            onChange={(e) => setFilterCategory(e.target.value)}
                                        >
                                            <option value="ALL">جميع الأقسام</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">المورد</label>
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={filterSupplier}
                                            onChange={(e) => setFilterSupplier(e.target.value)}
                                        >
                                            <option value="ALL">جميع الموردين</option>
                                            {suppliers.map(sup => (
                                                <option key={sup.id} value={sup.id}>{sup.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setFilterCategory('ALL');
                                            setFilterStock('ALL');
                                            setFilterSupplier('ALL');
                                            setSortBy('NEWEST');
                                            setIsFilterOpen(false);
                                        }}
                                        className="w-full text-center text-sm text-red-500 font-bold hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    >
                                        إزالة التصفية
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right data-table">
                            <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">#</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">اسم المنتج</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">القسم</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المورد</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المخزون الأساسي</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التكلفة</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الوحدات والأسعار</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan={8} className="p-12 text-center text-gray-400 animate-pulse">جاري تحميل البيانات...</td></tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                                <Package size={48} className="text-gray-200" />
                                                <p>لا توجد منتجات مطابقة للبحث أو التصفية.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product, idx) => (
                                        <tr key={product.id} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-bold text-gray-600">{idx + 1}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-gray-800 text-sm block">{product.name}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                                                    {product.category?.name || 'بدون قسم'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-bold text-blue-600">
                                                    {product.supplier?.name || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${product.baseStock <= 10
                                                    ? 'bg-red-100 text-red-700 ring-4 ring-red-50'
                                                    : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {product.baseStock} وحدة
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{formatCurrency(Number(product.costPrice))}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {product.units.map((u, idx) => (
                                                        <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2 py-1.5 rounded-md border border-gray-200 font-medium">
                                                            {u.name}: <span className="text-blue-600 font-bold">{formatCurrency(Number(u.price))}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {isAdmin && <Link
                                                        href={`/inventory/edit/${product.id}`}
                                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg font-medium text-sm transition-colors"
                                                    >
                                                        تعديل
                                                    </Link>}
                                                    <Link
                                                        href={`/inventory/history/${product.id}`}
                                                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg text-sm transition-colors"
                                                    >
                                                        السجل
                                                    </Link>
                                                    {isAdmin && <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="text-red-400 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg text-sm transition-colors"
                                                        title="حذف المنتج"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
