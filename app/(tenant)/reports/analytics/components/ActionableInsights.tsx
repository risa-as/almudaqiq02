import React from 'react';
import { Trophy, AlertCircle, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface ActionableInsightsProps {
    data: {
        topProducts: { name: string; quantity: number; profit: number }[];
        deadStock: { name: string; baseStock: number; lastUpdated: string }[];
    };
}

export default function ActionableInsights({ data }: ActionableInsightsProps) {
    if (!data) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

            {/* Top 5 Products Table */}
            <div className="bg-white rounded-[20px] shadow-card border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                            <Trophy size={20} className="text-blue-500" />
                            أفضل 5 منتجات مبيعاً
                        </h3>
                        <p className="text-xs text-blue-600/70 mt-1">حسب الكمية وتأثيرها على الأرباح</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3">المنتج</th>
                                <th className="px-5 py-3">الكمية المباعة</th>
                                <th className="px-5 py-3">الأرباح التقديرية</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.topProducts.length === 0 ? (
                                <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">لا توجد مبيعات في هذه الفترة.</td></tr>
                            ) : (
                                data.topProducts.map((product, index) => (
                                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-5 py-3 font-semibold text-gray-800 flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{index + 1}</span>
                                            {product.name}
                                        </td>
                                        <td className="px-5 py-3 font-bold text-gray-700">{product.quantity.toLocaleString()}</td>
                                        <td className="px-5 py-3 text-emerald-600 font-bold" dir="ltr">{formatCurrency(product.profit)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dead Stock / Slow Moving */}
            <div className="bg-white rounded-[20px] shadow-card border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-white flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-rose-800 flex items-center gap-2">
                            <AlertCircle size={20} className="text-rose-500" />
                            منتجات راكدة (Dead Stock)
                        </h3>
                        <p className="text-xs text-rose-600/70 mt-1">منتجات متوفرة بالمخزون ولم تُبع في هذه الفترة</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3">المنتج</th>
                                <th className="px-5 py-3">الكمية المتوفرة</th>
                                <th className="px-5 py-3">تاريخ آخر تحديث</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.deadStock.length === 0 ? (
                                <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">جميع المنتجات المتوفرة سجلت مبيعات، ممتاز!</td></tr>
                            ) : (
                                data.deadStock.map((product, index) => (
                                    <tr key={index} className="hover:bg-rose-50/30 transition-colors">
                                        <td className="px-5 py-3 font-semibold text-gray-800 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                                            {product.name}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold">{product.baseStock} حبة</span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-500" dir="ltr">{product.lastUpdated}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
