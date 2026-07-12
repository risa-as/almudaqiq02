'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { Search, FileText, ChevronLeft, ChevronRight, Eye, Printer, X, RotateCcw, Receipt, TrendingUp, Package, User, Banknote, CreditCard, Clock, Layers, Check, ScanLine, RotateCw, Filter, Tag, Pencil, Loader2 } from 'lucide-react';
import { HowItWorks } from '@/components/ui/HowItWorks';
import { DateRangeFilter, DEFAULT_PRESETS } from '@/components/ui/DateRangeFilter';
import { formatCurrency } from '@/lib/format';

/* Time presets requested for the invoices page: today, yesterday, this week, this month (+ custom) */
const INVOICE_DATE_PRESETS = DEFAULT_PRESETS.filter(p =>
    ['today', 'yesterday', 'this_week', 'this_month'].includes(p.key)
);
import { ReceiptPrint, ReceiptData, StoreSettings } from '@/components/ReceiptPrint';
import { useBranch } from '@/contexts/BranchContext';
import toast from 'react-hot-toast';

interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    cost?: number;          // total FIFO line cost recorded at sale time
    returnedQuantity?: number; // how much of this line was already returned
    productId: number;
    unitId: number;
    product: { name: string };
    unit: { name: string };
}

type PaymentMethod = 'CASH' | 'CARD' | 'CREDIT' | 'SPLIT';

interface Order {
    id: number;
    type: string;
    totalAmount: number;
    date: string;
    paymentMethod: PaymentMethod;
    discount?: number;
    priceEdited?: boolean;
    user?: { username: string };
    items: OrderItem[];
}

const PAYMENT_LABELS: Record<PaymentMethod, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    CASH:   { label: 'نقدي',       icon: Banknote,    color: '#059669', bg: '#ecfdf5' },
    CARD:   { label: 'بطاقة',      icon: CreditCard,  color: '#2563eb', bg: '#eff6ff' },
    CREDIT: { label: 'آجل',        icon: Clock,       color: '#073D82', bg: '#EEF4FF' },
    SPLIT:  { label: 'دفع جزئي',   icon: Layers,      color: '#7c3aed', bg: '#f5f3ff' },
};

function PaymentBadge({ method }: { method: PaymentMethod }) {
    const cfg = PAYMENT_LABELS[method] ?? PAYMENT_LABELS.CASH;
    const Icon = cfg.icon;
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg"
            style={{ background: cfg.bg, color: cfg.color }}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
}

function SkeletonRow() {
    return (
        <tr className="animate-pulse">
            {[1,2,3,4,5,6,7].map(i => (
                <td key={i} className="px-6 py-4">
                    <div className="h-4 bg-slate-100 rounded-lg" style={{ width: i === 7 ? '80px' : '100%' }} />
                </td>
            ))}
        </tr>
    );
}

export default function OrdersPage() {
  usePageTitle('الفواتير');
    const { confirm, dialog } = useConfirm();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [search, setSearch] = useState('');
    // Seed the range with the same default as <DateRangeFilter defaultPreset="this_month">
    // so the first fetch already carries the right dates. When the filter mounts and
    // fires its onChange with identical values, the deps don't change → no second fetch
    // (which previously caused the table to re-show its skeleton after the page appeared).
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        const end = d.toISOString().split('T')[0];
        return { start, end };
    });
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 });
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [printReceipt, setPrintReceipt] = useState<ReceiptData | null>(null);
    const { selectedBranch, loading: branchLoading } = useBranch();

    const [isReturnMode, setIsReturnMode] = useState(false);
    const [returnItems, setReturnItems] = useState<{ [key: number]: number }>({});
    const [refunding, setRefunding] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) setStoreSettings({
                    storeName: data.storeName || '',
                    storePhone: data.storePhone || '',
                    storeAddress: data.storeAddress || '',
                    footerMessage: data.footerMessage || '',
                });
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (branchLoading) return;
        fetchOrders();
    }, [page, search, selectedBranch?.id, branchLoading, dateRange.start, dateRange.end]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const branchQuery = selectedBranch?.id ? `&branchId=${selectedBranch.id}` : '';
            const dateQuery = dateRange.start && dateRange.end ? `&startDate=${dateRange.start}&endDate=${dateRange.end}` : '';
            const res = await fetch(`/api/orders?page=${page}&search=${search}${branchQuery}${dateQuery}`);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setInitialized(true);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchOrders();
    };

    const handlePrint = (orderId: number) => {
        const orderToPrint = orders.find(o => o.id === orderId) ?? selectedOrder;
        if (!orderToPrint) return;

        setPrintReceipt({
            transactionId: orderToPrint.id,
            receiptNumber: (orderToPrint as any).receiptNumber,
            date: orderToPrint.date,
            items: orderToPrint.items.map(item => ({
                name: item.product.name,
                quantity: item.quantity,
                price: Number(item.price),
                unitName: item.unit.name
            })),
            totalAmount: Number(orderToPrint.totalAmount),
            paymentMethod: orderToPrint.paymentMethod,
            cashierName: orderToPrint.user?.username || 'System'
        });

        setShowPrintModal(true);
    };

    const executePrint = () => {
        setShowPrintModal(false);
        setTimeout(() => {
            window.print();
            setPrintReceipt(null);
        }, 150);
    };

    const handleSubmitReturn = async () => {
        if (!selectedOrder) return;

        const termsToReturn = Object.entries(returnItems)
            .filter(([_, qty]) => qty > 0)
            .map(([itemId, qty]) => {
                // Item ids are cuid strings — compare as strings (Number() would yield NaN)
                const item = selectedOrder.items.find(i => String(i.id) === String(itemId));
                if (!item || !item.productId || !item.unitId) return null;
                const soldQty = Number(item.quantity) || 0;
                // The recorded `cost` is the TOTAL FIFO cost for the whole sold line,
                // so reverse it proportionally to the returned quantity.
                const proportionalCost = soldQty > 0 ? Number(item.cost ?? 0) * (qty / soldQty) : 0;
                return {
                    productId: item.productId,
                    unitId:    item.unitId,
                    quantity:  qty,
                    price:     Number(item.price),   // positive — refund route stores it as-is
                    cost:      proportionalCost,
                };
            })
            .filter((t): t is NonNullable<typeof t> => t !== null);

        if (termsToReturn.length === 0) {
            toast.error('يرجى تحديد كمية واحدة على الأقل للاسترجاع');
            return;
        }

        const refundTotal = termsToReturn.reduce((s, t) => s + t.price * t.quantity, 0);

        if (!await confirm({ title: 'تأكيد الاسترجاع', message: `استرجاع بقيمة ${formatCurrency(refundTotal)}؟ سيُعاد المخزون ويُحدَّث الربح وحساب العميل تلقائياً.`, variant: 'warning', confirmLabel: 'تأكيد الاسترجاع' })) return;

        setRefunding(true);
        try {
            // Use the same accurate refund flow the POS uses (REFUND type): restores
            // stock to a batch, reverses COGS, reduces customer debt, and is counted
            // correctly in the sales/profit reports.
            const res = await fetch('/api/transactions/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalTxId: selectedOrder.id,
                    items: termsToReturn,
                    totalAmount: refundTotal,
                    paymentMethod: 'CASH',
                    paidAmount: refundTotal,
                    notes: `إرجاع من فاتورة ${(selectedOrder as any).receiptNumber ?? selectedOrder.id}`,
                    branchId: selectedBranch?.id === 'all' ? undefined : selectedBranch?.id
                })
            });

            if (res.ok) {
                toast.success('تمت عملية الاسترجاع بنجاح');
                setIsReturnMode(false);
                setReturnItems({});
                setSelectedOrder(null);
                fetchOrders();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'فشلت العملية');
            }
        } catch {
            toast.error('حدث خطأ');
        } finally {
            setRefunding(false);
        }
    };

    // Stats: only SALE type orders (exclude RETURN/REFUND records)
    const saleOrders   = orders.filter(o => o.type === 'SALE');
    const grossRevenue = saleOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const totalItems   = saleOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + Number(i.quantity), 0), 0);
    // Returns visible on this page (REFUND +amount / legacy RETURN −amount → magnitude)
    const returnOrders = orders.filter(o => o.type === 'REFUND' || o.type === 'RETURN');
    const returnsTotal = returnOrders.reduce((s, o) => s + Math.abs(Number(o.totalAmount)), 0);
    const netRevenue   = grossRevenue - returnsTotal;
    const refundCount  = returnOrders.length;

    if (!initialized) return (
        <div className="min-h-screen p-4 md:p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
                            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                            <Receipt size={36} className="text-white relative z-10 sk-spin" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
                    </div>
                    <div className="text-center space-y-1.5">
                        <p className="text-xl font-black text-slate-800">جاري تحميل سجل الفواتير</p>
                        <div className="flex items-center justify-center gap-1.5">
                            {[0, 0.2, 0.4].map((delay, i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                            ))}
                        </div>
                        <p className="text-sm text-slate-400 font-medium">يتم تحميل بيانات المبيعات والفواتير</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                            <div className="flex items-center justify-between">
                                <div className="skeleton h-3 w-24" />
                                <div className="skeleton w-9 h-9 rounded-xl" />
                            </div>
                            <div className="skeleton h-8 w-32" />
                            <div className="skeleton h-2.5 w-20" />
                        </div>
                    ))}
                </div>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                    <div className="px-5 py-4 flex gap-3 flex-wrap border-b border-slate-100">
                        <div className="skeleton h-9 flex-1 min-w-[160px] rounded-xl" />
                        <div className="skeleton h-9 w-32 rounded-xl" />
                        <div className="skeleton h-9 w-32 rounded-xl" />
                        <div className="skeleton h-9 w-28 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-slate-100">
                        {[10,25,18,15,18,14].map((w,i) => <div key={i} className="skeleton h-3" style={{ width:`${w}%` }} />)}
                    </div>
                    <div className="divide-y divide-slate-50">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-6 gap-3 px-5 py-4">
                                {[12,32,22,18,22,18].map((w,j) => (
                                    <div key={j} className="skeleton h-3.5" style={{ width:`${w - ((i*4+j*3)%10)}%` }} />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen p-4 md:p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            {dialog}
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 8px 24px rgba(9,75,159,0.3)' }}>
                            <Receipt size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">سجل الفواتير</h1>
                            <p className="text-sm text-slate-500 mt-0.5">عرض وطباعة وإرجاع فواتير المبيعات</p>
                        </div>
                    </div>

                    {/* How it works + Search */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                    <HowItWorks
                        label="كيف تعمل الفواتير؟"
                        title="كيف يعمل سجل الفواتير؟"
                        steps={[
                            {
                                icon: Receipt,
                                title: 'عرض جميع الفواتير',
                                description: 'تجد هنا كل فواتير المبيعات المنجزة مرتبةً من الأحدث إلى الأقدم. يمكنك البحث برقم الفاتورة مباشرةً.',
                                gradient: 'linear-gradient(135deg,#094B9F,#063A8A)',
                                shadow: 'rgba(9,75,159,0.3)',
                            },
                            {
                                icon: Eye,
                                title: 'عرض تفاصيل الفاتورة',
                                description: 'انقر على أي فاتورة لرؤية المنتجات المشتراة، الكميات، الأسعار، طريقة الدفع، واسم الكاشير.',
                                gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)',
                                shadow: 'rgba(6,182,212,0.3)',
                            },
                            {
                                icon: Printer,
                                title: 'طباعة الإيصال',
                                description: 'من داخل تفاصيل الفاتورة، اضغط "طباعة" لإرسال إيصال POS إلى الطابعة الحرارية مباشرةً.',
                                gradient: 'linear-gradient(135deg,#10b981,#059669)',
                                shadow: 'rgba(16,185,129,0.3)',
                            },
                            {
                                icon: RotateCw,
                                title: 'إرجاع فاتورة',
                                description: 'إذا أراد العميل إرجاع بضاعة، افتح الفاتورة واضغط "إرجاع" — سيُعاد تسجيل الكمية في المخزون تلقائياً.',
                                gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
                                shadow: 'rgba(245,158,11,0.3)',
                            },
                            {
                                icon: Filter,
                                title: 'فلترة حسب الفرع والتاريخ',
                                description: 'استخدم قائمة الفرع أعلى الصفحة لتصفية الفواتير حسب فرع محدد.',
                                gradient: 'linear-gradient(135deg,#094B9F,#063A8A)',
                                shadow: 'rgba(14,99,212,0.3)',
                            },
                        ]}
                    />
                    <form onSubmit={handleSearch} className="relative w-full md:w-72">
                        <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="بحث برقم الفاتورة..."
                            className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-blue-300"
                            style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                            value={search}
                            onChange={e => { setSearch(e.target.value); if (!e.target.value) { setPage(1); } }}
                        />
                    </form>
                    </div>
                </div>

                {/* ── Date range filter ──────────────────────────────── */}
                <div className="rounded-2xl p-3 flex flex-wrap items-center gap-3"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-400" />
                        الفترة الزمنية:
                    </span>
                    <DateRangeFilter
                        presets={INVOICE_DATE_PRESETS}
                        defaultPreset="this_month"
                        accentColor="indigo"
                        onChange={(s, e) => { setDateRange({ start: s, end: e }); setPage(1); }}
                    />
                </div>

                {/* ── Refresh indicator ─────────────────────────────── */}
                {loading && initialized && (
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                        <div className="h-full rounded-full animate-gradient" style={{ background: 'linear-gradient(90deg, #094B9F, #1565C0, #094B9F)', backgroundSize: '200% 100%', width: '40%', animation: 'shimmer 1.2s ease-in-out infinite' }} />
                    </div>
                )}

                {/* ── Stats Row ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'صافي إيرادات الصفحة',    value: formatCurrency(netRevenue),  icon: TrendingUp, iconColor: '#10b981', iconBg: '#ecfdf5' },
                        { label: 'المرتجعات (هذه الصفحة)', value: formatCurrency(returnsTotal), icon: RotateCcw,  iconColor: '#ef4444', iconBg: '#fef2f2' },
                        { label: 'أصناف مباعة',             value: totalItems,                  icon: Package,    iconColor: '#f59e0b', iconBg: '#fffbeb' },
                        { label: 'إجمالي السجلات',          value: pagination.total,            icon: FileText,   iconColor: '#094B9F', iconBg: '#eef2ff' },
                    ].map(({ label, value, icon: Icon, iconColor, iconBg }) => (
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

                {/* ── Table ──────────────────────────────────────────── */}
                <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">

                    <div className="overflow-x-auto">
                        <table className="w-full text-right data-table">
                            <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">رقم الفاتورة</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ والوقت</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الكاشير</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">طريقة الدفع</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الأصناف</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">الإجمالي</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                                ) : orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                                                    <FileText size={28} className="text-slate-300" />
                                                </div>
                                                <p className="font-bold text-slate-400">لا توجد فواتير مطابقة</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : orders.map((order) => {
                                    const refunds     = (order as any).refunds as { totalAmount: number; date: string }[] || [];
                                    const hasRefund   = refunds.length > 0;
                                    const refundTotal = refunds.reduce((s, r) => s + r.totalAmount, 0);
                                    const itemCount   = order.items.reduce((s, i) => s + Number(i.quantity), 0);

                                    return (
                                        <tr key={order.id}
                                            className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                            onClick={() => setSelectedOrder(order)}>
                                            {/* Receipt No */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                        style={{ background: hasRefund ? '#fef2f2' : '#EEF4FF' }}>
                                                        <Receipt size={14} style={{ color: hasRefund ? '#dc2626' : '#094B9F' }} />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-sm text-slate-800">
                                                            #{(order as any).receiptNumber || order.id}
                                                        </span>
                                                        {hasRefund && (
                                                            <span className="mr-2 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                                                <RotateCcw size={8} /> مرتجع
                                                            </span>
                                                        )}
                                                        {Number(order.discount) > 0 && (
                                                            <span className="mr-2 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700"
                                                                title={`خصم: ${formatCurrency(Number(order.discount))}`}>
                                                                <Tag size={8} /> خصم
                                                            </span>
                                                        )}
                                                        {order.priceEdited && (
                                                            <span className="mr-2 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700"
                                                                title="تم تعديل سعر منتج في هذه الفاتورة">
                                                                <Pencil size={8} /> تعديل سعر
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Date */}
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-semibold text-slate-700">
                                                    {new Date(order.date).toLocaleDateString('ar-IQ')}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {new Date(order.date).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>

                                            {/* Cashier */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                                                        <User size={12} className="text-blue-500" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-700">
                                                        {order.user?.username || 'System'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Payment Method */}
                                            <td className="px-6 py-4">
                                                <PaymentBadge method={order.paymentMethod ?? 'CASH'} />
                                            </td>

                                            {/* Items count */}
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                                                    <Package size={11} />
                                                    {itemCount} صنف
                                                </span>
                                            </td>

                                            {/* Total */}
                                            <td className="px-6 py-4 text-left">
                                                <p className="font-black text-base text-blue-600">
                                                    {formatCurrency(Number(order.totalAmount))}
                                                </p>
                                                {hasRefund && (
                                                    <p className="text-xs font-bold text-blue-600 mt-0.5">
                                                        مرتجع: {formatCurrency(refundTotal)}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                                                        style={{ background: '#eef2ff', color: '#073D82' }}
                                                        title="عرض التفاصيل"
                                                    >
                                                        <Eye size={13} />
                                                        عرض
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrint(order.id)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                                                        title="طباعة"
                                                    >
                                                        <Printer size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Pagination ─────────────────────────────────── */}
                    <div className="px-5 py-3.5 flex items-center justify-between"
                        style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-page)' }}>
                        <p className="text-sm text-slate-500 font-medium">
                            إجمالي <span className="font-bold text-slate-700">{pagination.total}</span> فاتورة
                            &nbsp;·&nbsp; صفحة <span className="font-bold text-slate-700">{pagination.page}</span> من <span className="font-bold text-slate-700">{pagination.pages}</span>
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                disabled={pagination.page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border font-bold transition-all disabled:opacity-30 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                style={{ borderColor: 'var(--border-color)' }}
                            >
                                <ChevronRight size={16} />
                            </button>

                            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                const p = Math.max(1, Math.min(pagination.page - 2, pagination.pages - 4)) + i;
                                return p <= pagination.pages ? (
                                    <button key={p} onClick={() => setPage(p)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all"
                                        style={p === pagination.page
                                            ? { background: '#094B9F', color: '#fff' }
                                            : { border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                        {p}
                                    </button>
                                ) : null;
                            })}

                            <button
                                disabled={pagination.page >= pagination.pages}
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border font-bold transition-all disabled:opacity-30 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                style={{ borderColor: 'var(--border-color)' }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Order Details Modal ─────────────────────────────────── */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                    style={{ background: 'rgba(15,23,42,0.6)' }}
                    onClick={e => { if (e.target === e.currentTarget) { setSelectedOrder(null); setIsReturnMode(false); setReturnItems({}); } }}>

                    <div className="w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-fade-in-up"
                        style={{ background: 'var(--bg-card)' }}>

                        {/* Modal Header */}
                        <div className="px-6 py-5 flex items-start justify-between rounded-t-3xl"
                            style={{ borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(135deg,#f8faff,#f0f4ff)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)' }}>
                                    <Receipt size={18} className="text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black text-slate-800">
                                            فاتورة #{(selectedOrder as any).receiptNumber || selectedOrder.id}
                                        </h2>
                                        <PaymentBadge method={selectedOrder.paymentMethod ?? 'CASH'} />
                                        {Number(selectedOrder.discount) > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700">
                                                <Tag size={10} /> خصم
                                            </span>
                                        )}
                                        {selectedOrder.priceEdited && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700">
                                                <Pencil size={10} /> تعديل سعر
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {new Date(selectedOrder.date).toLocaleString('ar-IQ')}
                                        {selectedOrder.user && ` · ${selectedOrder.user.username}`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedOrder(null); setIsReturnMode(false); setReturnItems({}); }}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Return mode banner */}
                        {isReturnMode && (
                            <div className="mx-6 mt-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold"
                                style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                                <RotateCcw size={15} className="shrink-0 text-blue-500" />
                                حدد الكميات المراد إرجاعها من كل صنف
                            </div>
                        )}

                        {/* Items Table */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                                <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm data-table">
                                    <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المنتج</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الوحدة</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">الكمية</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">السعر</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">الإجمالي</th>
                                            {isReturnMode && <th className="px-6 py-4 text-xs font-bold text-blue-600 uppercase tracking-wider text-center">إرجاع</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {selectedOrder.items.map(item => {
                                            const soldQty     = Number(item.quantity);
                                            const returnedQty = Number(item.returnedQuantity ?? 0);
                                            const remaining   = Math.max(0, soldQty - returnedQty);
                                            return (
                                            <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                                                <td className="px-6 py-4 font-bold text-slate-800">{item.product.name}</td>
                                                <td className="px-6 py-4 text-slate-500 text-xs">{item.unit.name}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black bg-blue-50 text-blue-700">
                                                        {soldQty}
                                                    </span>
                                                    {returnedQty > 0 && (
                                                        <span className="block text-[10px] font-bold text-blue-600 mt-1">
                                                            مُرجَع: {returnedQty}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-left text-slate-600 font-medium">
                                                    {formatCurrency(Number(item.price))}
                                                </td>
                                                <td className="px-6 py-4 text-left font-black text-slate-800">
                                                    {formatCurrency(Number(item.price) * soldQty)}
                                                </td>
                                                {isReturnMode && (
                                                    <td className="px-6 py-4 text-center">
                                                        {remaining <= 0 ? (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                                                                <Check size={11} /> مُرجَع بالكامل
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <input
                                                                    type="number" min="0" max={remaining}
                                                                    className="w-16 py-1 px-2 rounded-lg text-center text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                                                                    style={{ border: '1.5px solid #094B9F', background: '#EEF4FF', color: '#073D82' }}
                                                                    value={returnItems[item.id] || 0}
                                                                    onChange={e => {
                                                                        const val = Math.max(0, Math.min(Number(e.target.value), remaining));
                                                                        setReturnItems(prev => ({ ...prev, [item.id]: val }));
                                                                    }}
                                                                />
                                                                <span className="text-[9px] text-gray-400">المتاح: {remaining}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            {/* Refund history */}
                            {((selectedOrder as any).refunds as any[])?.length > 0 && (
                                <div className="mt-4 p-4 rounded-xl" style={{ background: '#EEF4FF', border: '1px solid #bfdbfe' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <RotateCcw size={14} className="text-blue-600" />
                                        <span className="font-bold text-blue-800 text-sm">مرتجعات هذه الفاتورة</span>
                                    </div>
                                    <div className="space-y-2">
                                        {((selectedOrder as any).refunds as { totalAmount: number; date: string }[]).map((r, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="text-blue-600 font-medium">{new Date(r.date).toLocaleString('ar-IQ')}</span>
                                                <span className="font-black text-blue-700">- {formatCurrency(r.totalAmount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 pt-3 flex justify-between text-sm font-black text-blue-800"
                                        style={{ borderTop: '1px solid #bfdbfe' }}>
                                        <span>صافي الفاتورة بعد الإرجاع</span>
                                        <span>{formatCurrency(
                                            Number(selectedOrder.totalAmount) -
                                            ((selectedOrder as any).refunds as any[]).reduce((s: number, r: any) => s + r.totalAmount, 0)
                                        )}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 rounded-b-3xl flex items-center justify-between gap-3"
                            style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-page)' }}>

                            {/* Total */}
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-500 font-medium">الإجمالي</span>
                                <span className="text-xl font-black text-blue-600">
                                    {formatCurrency(Number(selectedOrder.totalAmount))}
                                </span>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-2">
                                {!isReturnMode ? (
                                    <>
                                        <button
                                            onClick={() => { setIsReturnMode(true); setReturnItems({}); }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                                            style={{ background: '#EEF4FF', color: '#073D82', border: '1px solid #bfdbfe' }}>
                                            <RotateCcw size={15} />
                                            مرتجع
                                        </button>
                                        <button
                                            onClick={() => handlePrint(selectedOrder.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-800 text-white transition-all hover:bg-slate-900 hover:scale-105">
                                            <Printer size={15} />
                                            طباعة
                                        </button>
                                        <button
                                            onClick={() => { setSelectedOrder(null); setIsReturnMode(false); }}
                                            className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:bg-slate-100"
                                            style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                            إغلاق
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleSubmitReturn}
                                            disabled={refunding}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}>
                                            {refunding ? (
                                                <>
                                                    <Loader2 size={15} className="animate-spin" />
                                                    جاري الاسترجاع...
                                                </>
                                            ) : (
                                                <>
                                                    <RotateCcw size={15} />
                                                    تأكيد الاسترجاع
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setIsReturnMode(false)}
                                            className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:bg-slate-100"
                                            style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                            إلغاء
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Receipt Preview Modal (same style as POS) ── */}
            {showPrintModal && printReceipt && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-100 p-2 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[95vh] animate-fade-in-up">
                        {/* Modal header */}
                        <div className="bg-white p-3 rounded-t-xl flex justify-between items-center border-b border-gray-200">
                            <h3 className="font-bold text-base flex items-center gap-2 text-blue-600">
                                <Check size={18} /> معاينة الوصل
                            </h3>
                            <button
                                onClick={() => { setShowPrintModal(false); setPrintReceipt(null); }}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Receipt preview */}
                        <div className="flex-1 overflow-y-auto p-2">
                            <ReceiptPrint receipt={printReceipt} isPreview={true} storeSettings={storeSettings} />
                        </div>

                        {/* Actions */}
                        <div className="bg-white p-3 rounded-b-xl border-t border-gray-200 flex gap-2">
                            <button
                                onClick={executePrint}
                                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 transition-colors"
                            >
                                <Printer size={18} /> طباعة
                            </button>
                            <button
                                onClick={() => { setShowPrintModal(false); setPrintReceipt(null); }}
                                className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden print-only receipt */}
            {printReceipt && <ReceiptPrint receipt={printReceipt} storeSettings={storeSettings} />}
        </div>
    );
}
