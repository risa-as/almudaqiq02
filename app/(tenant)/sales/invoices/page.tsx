'use client';

import React, { useEffect, useState } from 'react';
import { Search, FileText, Calendar, ChevronLeft, ChevronRight, Eye, Printer, X, RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ReceiptPrint, ReceiptData } from '@/components/ReceiptPrint';
import { useBranch } from '@/contexts/BranchContext';

import toast from 'react-hot-toast';
interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    productId: number;
    unitId: number;
    product: { name: string };
    unit: { name: string };
}

interface Order {
    id: number;
    totalAmount: number;
    date: string;
    user?: { username: string };
    items: OrderItem[];
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 });
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [printReceipt, setPrintReceipt] = useState<ReceiptData | null>(null);
    const { selectedBranch } = useBranch();

    // Return Logic State
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [returnItems, setReturnItems] = useState<{ [key: number]: number }>({});

    useEffect(() => {
        fetchOrders();
    }, [page, search, selectedBranch?.id]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const branchQuery = selectedBranch?.id ? `&branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/orders?page=${page}&search=${search}${branchQuery}`);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchOrders();
    };

    const handlePrint = (orderId: number) => {
        const orderToPrint = orders.find(o => o.id === orderId);
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
            cashierName: orderToPrint.user?.username || 'System'
        });

        setTimeout(() => {
            window.print();
            setPrintReceipt(null);
        }, 300);
    };

    const handleSubmitReturn = async () => {
        if (!selectedOrder) return;

        const termsToReturn = Object.entries(returnItems)
            .filter(([_, qty]) => qty > 0)
            .map(([itemId, qty]) => {
                const item = selectedOrder.items.find(i => i.id === Number(itemId));
                return {
                    itemId: Number(itemId),
                    quantity: qty,
                    price: item?.price,
                    productId: item?.productId,
                    unitId: item?.unitId
                };
            });

        if (termsToReturn.length === 0) {
            toast.error('يرجى تحديد كمية واحدة على الأقل للاسترجاع');
            return;
        }

        if (!confirm('هل أنت متأكد من استرجاع هذه المواد؟ سيتم تعديل المخزون وإنشاء قيد مرتجع.')) return;

        try {
            const res = await fetch('/api/transactions/return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalTransactionId: selectedOrder.id,
                    items: termsToReturn,
                    branchId: selectedBranch?.id === 'all' ? undefined : selectedBranch?.id
                })
            });

            if (res.ok) {
                toast.success('تمت عملية الاسترجاع بنجاح ✅');
                setIsReturnMode(false);
                setReturnItems({});
                setSelectedOrder(null);
                fetchOrders();
            } else {
                toast.error('فشلت العملية');
            }
        } catch (error) {
            toast.error('حدث خطأ');
        }
    };

    // ... UI Code ...


    return (
        <div className="min-h-screen p-6 md:p-8 text-right" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}>
                            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
                            <FileText size={22} className="text-white relative z-10" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                سجل الفواتير والمبيعات
                            </h1>
                            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>عرض وطباعة وإرجاع الفواتير السابقة</p>
                        </div>
                    </div>

                    <form onSubmit={handleSearch} className="relative w-full md:w-80">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="بحث برقم الفاتورة..."
                            className="w-full pr-10 pl-4 py-2.5 rounded-xl outline-none transition-all font-semibold text-sm"
                            style={{ background: 'white', border: '1.5px solid var(--border-color)', color: '#0f172a', boxShadow: 'var(--shadow-sm)' }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </form>
                </div>

                {/* Orders List */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>رقم الفاتورة</th>
                                    <th>التاريخ</th>
                                    <th>الكاشير</th>
                                    <th className="text-left">الإجمالي</th>
                                    <th className="text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="p-12 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>جاري التحميل...</td></tr>
                                ) : orders.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>لا توجد فواتير مطابقة.</td></tr>
                                ) : (
                                    orders.map((order) => {
                                        const refunds = (order as any).refunds as { totalAmount: number; date: string; type: string }[] || [];
                                        const hasRefund = refunds.length > 0;
                                        const refundedTotal = refunds.reduce((s, r) => s + r.totalAmount, 0);
                                        return (
                                        <tr key={order.id} style={hasRefund ? { background: 'rgba(245,158,11,0.04)' } : {}}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{(order as any).receiptNumber || order.id}</span>
                                                    {hasRefund && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                            style={{ background: '#fffbeb', color: '#92400e' }}>
                                                            <RotateCcw size={9} />
                                                            مرتجع
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(order.date).toLocaleString('ar-IQ')}
                                            </td>
                                            <td>
                                                <span className="badge badge-primary">{order.user?.username || 'System'}</span>
                                            </td>
                                            <td className="text-left">
                                                <span className="font-black text-base" style={{ color: 'var(--color-primary)' }}>{formatCurrency(Number(order.totalAmount))}</span>
                                                {hasRefund && (
                                                    <span className="block text-xs font-bold mt-0.5" style={{ color: '#d97706' }}>
                                                        مرتجع: {formatCurrency(refundedTotal)}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs transition-all"
                                                        style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-text)' }}
                                                    >
                                                        <Eye size={14} />
                                                        عرض
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrint(order.id)}
                                                        className="p-1.5 rounded-lg transition-all"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        title="طباعة نسخة"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                        <span>صفحة {pagination.page} من {pagination.pages}</span>
                        <div className="flex gap-2">
                            <button
                                disabled={pagination.page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                <ChevronRight size={18} />
                            </button>
                            <button
                                disabled={pagination.page >= pagination.pages}
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-fade-in-up max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">تفاصيل الفاتورة #{(selectedOrder as any).receiptNumber || selectedOrder.id}</h2>
                                <p className="text-sm text-gray-500 mt-1">{new Date(selectedOrder.date).toLocaleString('ar-IQ')}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X size={28} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {isReturnMode && (
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 mb-4 text-orange-800 text-sm">
                                    <strong>وضع الاسترجاع:</strong> قم بتحديد الكميات التي ترغب باسترجاعها من كل صنف.
                                </div>
                            )}
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
                                    <tr>
                                        <th className="p-3 font-bold">المنتج</th>
                                        <th className="p-3 font-bold">الوحدة</th>
                                        <th className="p-3 font-bold text-center">الكمية</th>
                                        <th className="p-3 font-bold text-left">السعر</th>
                                        <th className="p-3 font-bold text-left">الإجمالي</th>
                                        {isReturnMode && <th className="p-3 font-bold text-center text-orange-600">استرجاع</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {selectedOrder.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="p-3 font-bold text-gray-800">{item.product.name}</td>
                                            <td className="p-3 text-gray-600 text-sm">{item.unit.name}</td>
                                            <td className="p-3 text-center">{item.quantity}</td>
                                            <td className="p-3 text-left text-gray-600">{formatCurrency(Number(item.price))}</td>
                                            <td className="p-3 text-left font-bold text-gray-900">{formatCurrency(Number(item.price) * Number(item.quantity))}</td>
                                            {isReturnMode && (
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={item.quantity}
                                                        className="w-20 p-1 border border-orange-300 rounded text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                                        value={returnItems[item.id] || 0}
                                                        onChange={(e) => {
                                                            const val = Math.min(Number(e.target.value), item.quantity);
                                                            setReturnItems(prev => ({ ...prev, [item.id]: val }));
                                                        }}
                                                    />
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Refund summary inside modal */}
                        {((selectedOrder as any).refunds as any[])?.length > 0 && (
                            <div className="mx-6 mb-4 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <RotateCcw size={15} className="text-orange-600" />
                                    <span className="font-bold text-orange-700 text-sm">مرتجعات هذه الفاتورة</span>
                                </div>
                                <div className="space-y-1.5">
                                    {((selectedOrder as any).refunds as { totalAmount: number; date: string; type: string }[]).map((r, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm">
                                            <span className="text-orange-600 font-medium">{new Date(r.date).toLocaleString('ar-IQ')}</span>
                                            <span className="font-extrabold text-orange-700">- {formatCurrency(r.totalAmount)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-orange-200 flex justify-between text-sm font-bold text-orange-800">
                                    <span>صافي الفاتورة بعد الإرجاع:</span>
                                    <span>{formatCurrency(Number(selectedOrder.totalAmount) - ((selectedOrder as any).refunds as any[]).reduce((s: number, r: any) => s + r.totalAmount, 0))}</span>
                                </div>
                            </div>
                        )}

                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-between items-center">
                            <div className="text-xl font-bold text-gray-900">
                                الإجمالي النهائي: <span className="text-blue-600">{formatCurrency(Number(selectedOrder.totalAmount))}</span>
                            </div>
                            <div className="flex gap-3">
                                {!isReturnMode ? (
                                    <>
                                        <button
                                            onClick={() => { setIsReturnMode(true); setReturnItems({}); }}
                                            className="bg-orange-100 text-orange-700 px-6 py-2.5 rounded-xl font-bold hover:bg-orange-200 flex items-center gap-2"
                                        >
                                            مرتجع
                                        </button>
                                        <button
                                            onClick={() => handlePrint(selectedOrder.id)}
                                            className="bg-gray-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-900 flex items-center gap-2"
                                        >
                                            <Printer size={18} />
                                            طباعة نسخة
                                        </button>
                                        <button
                                            onClick={() => setSelectedOrder(null)}
                                            className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-50"
                                        >
                                            إغلاق
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleSubmitReturn}
                                            className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-200"
                                        >
                                            تأكيد الاسترجاع
                                        </button>
                                        <button
                                            onClick={() => setIsReturnMode(false)}
                                            className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-300"
                                        >
                                            إلغاء
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden thermal print layout */}
            {printReceipt && <ReceiptPrint receipt={printReceipt} />}
        </div>
    );
}
