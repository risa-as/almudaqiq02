'use client';

import React, { useEffect, useState } from 'react';
import { Package, DollarSign, AlertTriangle, Layers, Calendar, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';

interface InventoryStats {
    stats: {
        totalValuation: number;
        totalProducts: number;
        totalItems: number;
        lowStockCount: number;
        expiringCount: number;
    };
    lowStockItems: any[];
    expiringBatches: any[];
    valuationDistribution: { name: string, value: number }[];
}

export default function InventoryReportPage() {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [data, setData] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (branchLoading) return;
        fetchData();
    }, [selectedBranch, branchLoading]);

    const fetchData = async () => {
        try {
            const branchParam = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/reports/inventory${branchParam}`);
            if (res.ok) {
                setData(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">جاري تحميل تقرير المخزون...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">خطأ في تحميل البيانات</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                    <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                    <Package size={26} color="white" />
                </div>
                <div>
                    <h2 className="text-2xl font-extrabold" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        تقارير المخزون وتقييم البضاعة
                    </h2>
                    <p className="text-gray-500 mt-1 text-sm">القيمة المالية الدقيقة للمخزون الحالي بالأسعار المعتمدة (سعر التكلفة).</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={20} /></div>
                        <span className="text-sm font-bold text-gray-500">قيمة المخزون</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900">{formatCurrency(data.stats.totalValuation)}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Package size={20} /></div>
                        <span className="text-sm font-bold text-gray-500">المنتجات</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900">{data.stats.totalProducts}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Layers size={20} /></div>
                        <span className="text-sm font-bold text-gray-500">الوحدات</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900">{data.stats.totalItems}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={20} /></div>
                        <span className="text-sm font-bold text-gray-500">نواقص المخزون</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-red-600">{data.stats.lowStockCount}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Clock size={20} /></div>
                        <span className="text-sm font-bold text-gray-500">قاربت الانتهاء</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-orange-600">{data.stats.expiringCount}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Low Stock Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={20} />
                        <h3 className="font-bold text-gray-800">تنبيهات انخفاض المخزون (أقل من 10)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase">المنتج</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase">المخزون</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.lowStockItems.length > 0 ? data.lowStockItems.map((item: any) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                                        <td className="px-6 py-4 text-red-600 font-bold">{item.stock}</td>
                                    </tr>
                                )) : <tr><td colSpan={2} className="p-4 text-center text-gray-400">لا يوجد نواقص</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Expiring Batches Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                        <Clock className="text-orange-500" size={20} />
                        <h3 className="font-bold text-gray-800">صلاحيات قاربت على الانتهاء (أقل من 30 يوم)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase">المنتج</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase">باتش/تشغيلة</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase">تاريخ الانتهاء</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase">الكمية</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.expiringBatches.length > 0 ? data.expiringBatches.map((item: any) => {
                                    const isExpired = new Date(item.expiryDate) < new Date();
                                    return (
                                        <tr key={item.id} className={isExpired ? 'bg-red-50' : ''}>
                                            <td className="px-6 py-4 font-medium text-gray-800">{item.productName}</td>
                                            <td className="px-6 py-4 text-gray-500">{item.batchNumber}</td>
                                            <td className={`px-6 py-4 font-bold ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>
                                                {new Date(item.expiryDate).toLocaleDateString()}
                                                {isExpired && <span className="mr-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">منتهي</span>}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-bold">{item.quantity}</td>
                                        </tr>
                                    );
                                }) : <tr><td colSpan={4} className="p-4 text-center text-gray-400">لا توجد صلاحيات قريبة الانتهاء</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Valuation Distribution */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">توزيع القيمة حسب القسم</h3>
                <div className="space-y-4">
                    {data.valuationDistribution.map((cat, idx) => (
                        <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700 font-medium">{cat.name}</span>
                                <span className="text-gray-900 font-bold">{formatCurrency(cat.value)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${(cat.value / data.stats.totalValuation) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
