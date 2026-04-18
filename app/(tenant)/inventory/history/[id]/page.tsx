'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Calendar, FileText, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function ProductHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [history, setHistory] = useState<any>(null);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Product Basic Info
                const prodRes = await fetch(`/api/products/${id}`);
                const prodData = await prodRes.json();
                setProduct(prodData);

                // Fetch History
                const histRes = await fetch(`/api/products/${id}/history`);
                const histData = await histRes.json();
                setHistory(histData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) return <div className="p-12 text-center">جاري التحميل...</div>;
    if (!product) return <div className="p-12 text-center text-red-500">المنتج غير موجود</div>;

    // Combine and Sort Events
    const events = [
        ...history.sales.map((s: any) => ({
            type: 'SALE',
            date: new Date(s.transaction.date),
            amount: s.quantity,
            unit: s.unit.name,
            total: s.price * s.quantity,
            ref: s.transaction.id,
            user: s.transaction.user?.username || 'مدير النظام'
        })),
        ...history.batches.map((b: any) => ({
            type: 'STOCK_IN',
            date: new Date(b.createdAt),
            amount: b.quantity,
            unit: 'وحدة أساسية', // Simplification, ideally store unit name in batch
            total: b.costPrice * b.quantity,
            ref: b.batchNumber || '-',
            user: 'System'
        }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="bg-white p-3 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900">سجل حركة المنتج</h1>
                        <p className="text-gray-500 font-bold mt-1 text-lg">{product.name}</p>
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden p-8">
                    <div className="space-y-8 relative before:absolute before:inset-0 before:mr-[19px] before:w-0.5 before:bg-gray-100 before:h-full">
                        {events.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">لا توجد حركات مسجلة</div>
                        ) : (
                            events.map((event, idx) => (
                                <div key={idx} className="relative flex gap-6 items-start animate-fade-in-up">
                                    {/* Icon */}
                                    <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm shrink-0 ${event.type === 'SALE' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                        {event.type === 'SALE' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className={`font-bold text-lg ${event.type === 'SALE' ? 'text-red-700' : 'text-green-700'
                                                    }`}>
                                                    {event.type === 'SALE' ? 'بيع (Stock Out)' : 'توريد (Stock In)'}
                                                </h3>
                                                <div className="text-gray-500 text-sm flex items-center gap-2 mt-1">
                                                    <Calendar size={14} />
                                                    {event.date.toLocaleString('ar-IQ')}
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold text-xl text-gray-900">{formatCurrency(event.total)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-4 pt-4 border-t border-gray-200">
                                            <div className="flex items-center gap-1">
                                                <Package size={16} />
                                                <span className="font-bold">{event.amount} {event.unit}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <FileText size={16} />
                                                <span>رقم المرجع: {event.ref}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
