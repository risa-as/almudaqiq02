import React from 'react';
import { Trophy, AlertCircle } from 'lucide-react';
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

            {/* Top 5 Products */}
            <div className="bg-[var(--bg-card)] rounded-[20px] shadow-card border border-[var(--border-color)] overflow-hidden">
                <div className="p-5 border-b border-[var(--border-color)] flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg, rgba(9,75,159,0.06) 0%, transparent 60%)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,0.3)' }}>
                        <Trophy size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                            أفضل 5 منتجات مبيعاً
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            حسب الكمية وتأثيرها على الأرباح
                        </p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm data-table">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                            <tr>
                                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">المنتج</th>
                                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الكمية المباعة</th>
                                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الأرباح التقديرية</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.topProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                        لا توجد مبيعات في هذه الفترة.
                                    </td>
                                </tr>
                            ) : (
                                data.topProducts.map((product, index) => (
                                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-5 py-3 font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                                                style={{ background: 'linear-gradient(135deg,#094B9F,#1565C0)' }}>
                                                {index + 1}
                                            </span>
                                            {product.name}
                                        </td>
                                        <td className="px-5 py-3 font-bold" style={{ color: 'var(--text-secondary)' }}>
                                            {product.quantity.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3 font-bold" style={{ color: 'var(--value-positive)' }} dir="ltr">
                                            {formatCurrency(product.profit)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dead Stock */}
            <div className="bg-[var(--bg-card)] rounded-[20px] shadow-card border border-[var(--border-color)] overflow-hidden">
                <div className="p-5 border-b border-[var(--border-color)] flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, transparent 60%)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                        <AlertCircle size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                            منتجات راكدة (Dead Stock)
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            منتجات متوفرة بالمخزون ولم تُبع في هذه الفترة
                        </p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm data-table">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                            <tr>
                                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">المنتج</th>
                                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الكمية المتوفرة</th>
                                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">تاريخ آخر تحديث</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.deadStock.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                        جميع المنتجات المتوفرة سجلت مبيعات، ممتاز!
                                    </td>
                                </tr>
                            ) : (
                                data.deadStock.map((product, index) => (
                                    <tr key={index} className="hover:bg-red-50/20 transition-colors">
                                        <td className="px-5 py-3 font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--value-negative)' }} />
                                            {product.name}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="px-2 py-0.5 rounded text-xs font-bold"
                                                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--value-negative)' }}>
                                                {product.baseStock} حبة
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }} dir="ltr">
                                            {product.lastUpdated}
                                        </td>
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
