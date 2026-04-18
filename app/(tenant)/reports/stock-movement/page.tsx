'use client';

import React, { useEffect, useState } from 'react';
import { Package, Search, ArrowRight, ArrowLeft, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import { useBranch } from '@/contexts/BranchContext';

export default function StockMovementReport() {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (branchLoading) return;
        fetchMovements();
    }, [selectedBranch, branchLoading]);

    const fetchMovements = async () => {
        setLoading(true);
        try {
            const branchParam = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/reports/stock-movement${branchParam}`);
            const data = await res.json();
            setMovements(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredMovements = movements.filter(m =>
        m.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.reference.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in-up" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                            <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                            <Package size={22} color="white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                سجل حركة المخزون
                            </h1>
                            <p className="text-gray-500 mt-1 text-sm">متابعة تفصيلية لدخول وخروج المنتجات (مبيعات ومشتريات)</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => exportToCSV(filteredMovements, 'stock-movement', {
                        date: 'التاريخ',
                        reference: 'المرجع',
                        productName: 'المنتج',
                        type: 'نوع الحركة',
                        quantity: 'الكمية',
                        user: 'بواسطة'
                    })}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 font-bold rounded-xl hover:bg-green-700 transition"
                >
                    <Download size={20} /> تصدير Excel
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="relative max-w-md">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="بحث برقم الفاتورة، أو اسم المنتج..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm font-bold"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 text-sm font-bold text-gray-600">التاريخ</th>
                                <th className="p-4 text-sm font-bold text-gray-600">المرجع</th>
                                <th className="p-4 text-sm font-bold text-gray-600">المنتج</th>
                                <th className="p-4 text-sm font-bold text-gray-600">الحركة</th>
                                <th className="p-4 text-sm font-bold text-gray-600">الكمية</th>
                                <th className="p-4 text-sm font-bold text-gray-600">بواسطة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">جاري تحميل السجل...</td>
                                </tr>
                            ) : filteredMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">لا توجد حركات مطابقة للبحث</td>
                                </tr>
                            ) : (
                                filteredMovements.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm font-bold text-gray-700 whitespace-nowrap">
                                            {new Date(item.date).toLocaleString('ar-IQ')}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-600">
                                            {item.reference}
                                        </td>
                                        <td className="p-4 text-sm font-extrabold text-blue-600">
                                            {item.productName}
                                        </td>
                                        <td className="p-4">
                                            {item.type === 'IN' ? (
                                                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold border border-green-200">
                                                    <ArrowRight size={14} /> إدخال للمخزن
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2.5 py-1 rounded-md text-xs font-bold border border-orange-200">
                                                    <ArrowLeft size={14} /> سحب (مبيعات)
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-lg font-bold text-gray-900">
                                            <span className={item.type === 'IN' ? 'text-green-600' : 'text-orange-600'}>
                                                {item.type === 'IN' ? '+' : '-'}{item.quantity}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-gray-500">
                                            {item.user}
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
