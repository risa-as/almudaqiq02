'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, Search, TrendingDown, TrendingUp, Minus, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/exportExcel';
import PageHeader from '@/components/ui/PageHeader';
import { useBranch } from '@/contexts/BranchContext';

export default function ShiftsReport() {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (branchLoading) return;
        fetchShifts();
    }, [selectedBranch, branchLoading]);

    const fetchShifts = async () => {
        setLoading(true);
        try {
            const branchParam = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/reports/shifts${branchParam}`);
            const data = await res.json();
            setShifts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredShifts = shifts.filter(s =>
        s.user?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toString().includes(searchQuery)
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in-up min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            <PageHeader
                title="سجل الورديات والصندوق"
                subtitle="متابعة العجز والزيادة وأداء الكاشيرية خلال كل وردية"
                icon={Wallet}
                gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                actions={
                    <button
                        onClick={() => {
                            const exportData = filteredShifts.map(s => ({
                                id: s.id,
                                user: s.user?.username || 'مستخدم محذوف',
                                openedAt: new Date(s.openedAt).toLocaleString('ar-IQ'),
                                closedAt: s.closedAt ? new Date(s.closedAt).toLocaleString('ar-IQ') : 'وردية نشطة',
                                openingAmount: Number(s.openingAmount),
                                expectedAmount: s.expectedAmount ? Number(s.expectedAmount) : 0,
                                closingAmount: s.closingAmount ? Number(s.closingAmount) : 0,
                                difference: s.difference ? Number(s.difference) : 0,
                                notes: s.notes || ''
                            }));
                            exportToCSV(exportData, 'shifts-report', {
                                id: 'رقم الوردية',
                                user: 'الكاشير',
                                openedAt: 'وقت الفتح',
                                closedAt: 'وقت الإغلاق',
                                openingAmount: 'العهدة الافتتاحية',
                                expectedAmount: 'المبلغ المتوقع',
                                closingAmount: 'النقد الفعلي',
                                difference: 'الفرق (عجز/زيادة)',
                                notes: 'الملاحظات'
                            });
                        }}
                        className="btn-success"
                    >
                        <Download size={20} /> تصدير Excel
                    </button>
                }
            />

            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border-color)] bg-gray-50 flex items-center justify-between">
                    <div className="relative max-w-md w-full">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="بحث باسم الكاشير أو رقم الوردية..."
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
                                <th className="p-4 text-sm font-bold text-gray-600">رقم الوردية</th>
                                <th className="p-4 text-sm font-bold text-gray-600">الكاشير</th>
                                <th className="p-4 text-sm font-bold text-gray-600">وقت الفتح / الإغلاق</th>
                                <th className="p-4 text-sm font-bold text-gray-600">العهدة الافتتاحية</th>
                                <th className="p-4 text-sm font-bold text-gray-600">المبلغ المتوقع</th>
                                <th className="p-4 text-sm font-bold text-gray-600">النقد الفعلي</th>
                                <th className="p-4 text-sm font-bold text-gray-600">الفرق (عجز / زيادة)</th>
                                <th className="p-4 text-sm font-bold text-gray-600">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-500 font-bold">جاري تحميل السجل...</td>
                                </tr>
                            ) : filteredShifts.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-500 font-bold">لا توجد ورديات سابقة</td>
                                </tr>
                            ) : (
                                filteredShifts.map((shift, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm font-bold text-gray-500">
                                            {index + 1}
                                        </td>
                                        <td className="p-4 text-sm font-extrabold text-blue-600">
                                            {shift.user?.username || 'مستخدم محذوف'}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            <div className="font-bold text-green-700 whitespace-nowrap">ف: {new Date(shift.openedAt).toLocaleString('ar-IQ')}</div>
                                            {shift.closedAt ? (
                                                <div className="font-bold text-red-700 whitespace-nowrap mt-1">غ: {new Date(shift.closedAt).toLocaleString('ar-IQ')}</div>
                                            ) : (
                                                <div className="text-orange-500 font-bold text-xs mt-1 animate-pulse">وردية نشطة (مفتوحة)</div>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-gray-600">
                                            {formatCurrency(Number(shift.openingAmount))}
                                        </td>
                                        <td className="p-4 font-bold text-blue-800 bg-blue-50/50">
                                            {shift.expectedAmount !== null ? formatCurrency(Number(shift.expectedAmount)) : '-'}
                                        </td>
                                        <td className="p-4 font-bold text-gray-900 border-l border-r border-gray-100">
                                            {shift.closingAmount !== null ? formatCurrency(Number(shift.closingAmount)) : '-'}
                                        </td>
                                        <td className="p-4 text-base font-bold">
                                            {shift.difference !== null ? (
                                                Number(shift.difference) < 0 ? (
                                                    <span className="text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1 rounded w-fit">
                                                        <TrendingDown size={14} /> {formatCurrency(Math.abs(Number(shift.difference)))} عجز
                                                    </span>
                                                ) : Number(shift.difference) > 0 ? (
                                                    <span className="text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded w-fit">
                                                        <TrendingUp size={14} /> {formatCurrency(Number(shift.difference))} زيادة
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 flex items-center gap-1 bg-gray-100 px-2 py-1 rounded w-fit">
                                                        <Minus size={14} /> مطابق
                                                    </span>
                                                )
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td className="p-4 text-xs font-bold text-gray-500 max-w-[200px] truncate">
                                            {shift.notes || 'لا يوجد'}
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
