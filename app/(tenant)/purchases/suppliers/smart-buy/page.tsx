'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';
import {
    BrainCircuit,
    AlertTriangle,
    TrendingUp,
    Store,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    RefreshCw,
    CheckCircle2
} from 'lucide-react';

interface RestockItem {
    productId: number;
    name: string;
    currentStock: number;
    lastPrice: number;
    lowestPrice: number;
    supplierName: string;
    supplierId: number | null;
}

interface PriceHikeItem {
    productId: number;
    name: string;
    lastPrice: number;
    lowestPrice: number;
    supplierName: string;
    difference: number;
}

interface SupplierDealProduct {
    productId: number;
    name: string;
    price: number;
}

interface SupplierDeal {
    supplierId: number;
    supplierName: string;
    products: SupplierDealProduct[];
}

interface SmartBuyData {
    restockList: RestockItem[];
    priceHikes: PriceHikeItem[];
    supplierDeals: SupplierDeal[];
}

export default function SmartPurchasingPage() {
    const router = useRouter();
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SmartBuyData | null>(null);
    const [activeTab, setActiveTab] = useState<'RESTOCK' | 'HIKES' | 'DEALS'>('RESTOCK');

    // For deals tab
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

    useEffect(() => {
        if (branchLoading) return;
        fetchData();
    }, [selectedBranch, branchLoading]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const branchParam = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/purchases/smart-buy${branchParam}`);
            const result = await res.json();
            if (result.success) {
                setData(result.data);
                if (result.data.supplierDeals.length > 0) {
                    setSelectedSupplierId(result.data.supplierDeals[0].supplierId);
                }
            }
        } catch (error) {
            console.error('Failed to fetch smart buy data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center space-y-4" dir="rtl" style={{ background: 'var(--bg-page)' }}>
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <p className="text-xl font-bold text-gray-600 animate-pulse">جاري تحليل بيانات الموردين والمخزون...</p>
            </div>
        );
    }

    if (!data) return null;

    const activeSupplierDeal = data.supplierDeals.find(d => d.supplierId === selectedSupplierId);

    return (
        <div className="min-h-screen p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 text-blue-800 mb-2">
                    <div className="p-3 bg-blue-100 rounded-2xl">
                        <BrainCircuit size={32} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">مستشار المشتريات الذكي</h1>
                        <p className="text-gray-500 font-medium mt-1 text-sm">تحليل استباقي للمخزون ومقارنة أسعار الموردين تاريخياً لضمان أعلى هامش ربح.</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 mb-8 max-w-2xl relative z-10">
                <button
                    onClick={() => setActiveTab('RESTOCK')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all ${activeTab === 'RESTOCK' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                    <AlertTriangle size={18} />
                    نواقص موجهة ({data.restockList.length})
                </button>
                <button
                    onClick={() => setActiveTab('HIKES')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all ${activeTab === 'HIKES' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:bg-red-50 hover:text-red-600'}`}
                >
                    <TrendingUp size={18} />
                    تنبيهات الأسعار ({data.priceHikes.length})
                </button>
                <button
                    onClick={() => setActiveTab('DEALS')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all ${activeTab === 'DEALS' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                    <Store size={18} />
                    أفضل صفقات الموردين
                </button>
            </div>

            {/* Tab 1: Smart Restock List */}
            {activeTab === 'RESTOCK' && (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100/50 overflow-hidden animate-fade-in-up">
                    <div className="p-6 border-b border-gray-100 bg-gradient-to-l from-blue-50/50 to-transparent">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <AlertTriangle className="text-blue-500" /> المنتجات التي وصلت للحد الأدنى للمخزون وتحتاج تسوق
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">يُظهر لك النظام أفضل سعر تاريخي واسم المورد الخاص به لمساعدتك في اتخاذ القرار.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50/50 text-gray-500 text-xs font-bold border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">المنتج</th>
                                    <th className="px-6 py-4">المخزون الحالي</th>
                                    <th className="px-6 py-4">آخر سعر (للقطعة)</th>
                                    <th className="px-6 py-4">أفضل سعر (للقطعة)</th>
                                    <th className="px-6 py-4 w-64">المورد الموصى به</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.restockList.length === 0 ? (
                                    <tr><td colSpan={5} className="py-12 text-center text-gray-400 font-medium">لا توجد نواقص في الوقت الحالي! المخزون ممتاز.</td></tr>
                                ) : (
                                    data.restockList.map(item => (
                                        <tr key={item.productId} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-800">{item.name}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold text-sm">
                                                    {item.currentStock} متوفر
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-600">{formatCurrency(item.lastPrice)}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-extrabold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                                    {formatCurrency(item.lowestPrice)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 font-bold text-blue-700 bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100">
                                                    <Store size={16} className="text-blue-400" />
                                                    {item.supplierName}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 2: Price Hike Alerts */}
            {activeTab === 'HIKES' && (
                <div className="bg-white rounded-3xl shadow-xl shadow-red-900/5 border border-red-100/50 overflow-hidden animate-fade-in-up">
                    <div className="p-6 border-b border-red-50 bg-gradient-to-l from-red-50 to-transparent">
                        <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                            <TrendingUp className="text-red-500" /> تنبيهات استغلال الموردين (ارتفاع الأسعار)
                        </h2>
                        <p className="text-red-600/70 text-sm mt-1">منتجات تم شراؤها مؤخراً بسعر يرتفع بأكثر من <span className="font-bold underline">5%</span> عن أفضل سعر متوفر تاريخياً.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50/50 text-gray-500 text-xs font-bold border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">المنتج</th>
                                    <th className="px-6 py-4">المورد الأخير</th>
                                    <th className="px-6 py-4">آخر سعر (للقطعة)</th>
                                    <th className="px-6 py-4">أفضل سعر (للقطعة)</th>
                                    <th className="px-6 py-4">فرق الزيادة للخسارة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.priceHikes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-16 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                                    <CheckCircle2 size={32} />
                                                </div>
                                                <div>
                                                    <p className="text-gray-800 font-bold text-lg">الأسعار مستقرة!</p>
                                                    <p className="text-gray-400 text-sm font-medium">لم نرصد أي زيادات غير مبررة للأسعار مؤخراً.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    data.priceHikes.map(item => (
                                        <tr key={item.productId} className="hover:bg-red-50/30 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-800">{item.name}</td>
                                            <td className="px-6 py-4 font-bold text-gray-600">{item.supplierName}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-extrabold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-1 w-max">
                                                    {formatCurrency(item.lastPrice)} <ArrowUpRight size={14} />
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(item.lowestPrice)}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-red-500">
                                                    +{formatCurrency(item.difference)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 3: Supplier Best Deals */}
            {activeTab === 'DEALS' && (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100/50 overflow-hidden animate-fade-in-up">
                    <div className="p-6 border-b border-gray-100 bg-gradient-to-l from-emerald-50 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                                <Store className="text-emerald-500" /> نقاط قوة الموردين (أرخص أسعار)
                            </h2>
                            <p className="text-emerald-600/70 text-sm mt-1">اكتشف المنتجات التي احتكر المورد أرخص أسعارها لطلبها منه حصراً.</p>
                        </div>
                        {data.supplierDeals.length > 0 && (
                            <select
                                className="bg-white border-2 border-emerald-100 text-emerald-900 rounded-xl px-4 py-2 font-bold outline-none focus:ring-4 ring-emerald-50 transition-all min-w-[200px]"
                                value={selectedSupplierId || ''}
                                onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                            >
                                {data.supplierDeals.map(d => (
                                    <option key={d.supplierId} value={d.supplierId}>{d.supplierName} ({d.products.length} منتجات)</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="p-6">
                        {data.supplierDeals.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 font-medium">لا تتوافر بيانات كافية عن صفقات الموردين حالياً.</div>
                        ) : activeSupplierDeal ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {activeSupplierDeal.products.map(p => (
                                    <div key={p.productId} className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-2xl hover:-translate-y-1 transition-transform group">
                                        <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm mb-3">
                                            <ArrowDownRight className="text-emerald-500" size={20} />
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">{p.name}</h3>
                                        <p className="text-2xl font-extrabold text-emerald-600 tracking-tight mt-2">{formatCurrency(p.price)} <span className="text-sm font-medium text-emerald-600/70">/ للقطعة</span></p>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

        </div>
    );
}
