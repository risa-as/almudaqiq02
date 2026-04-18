const fs = require('fs');

const content = `'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Calendar, Plus, Minus, Users, Printer, FileSpreadsheet, RefreshCw, Filter } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { formatCurrency } from '@/lib/format';

interface SupplierLedgerItem {
    id: string;
    type: string; // 'PURCHASE' | 'PAYMENT' | 'RETURN'
    amount: number;
    description: string;
    date: string;
}

interface Supplier {
    id: string;
    name: string;
    balance: number;
    creditLimit?: number;
    notes?: string;
}

export default function SupplierLedgerPage() {
    const params = useParams();
    const router = useRouter();
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [ledger, setLedger] = useState<SupplierLedgerItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        if (params.id) fetchLedger();
    }, [params.id, dateFrom, dateTo]);

    const fetchLedger = async () => {
        try {
            setLoading(true);
            const res = await fetch(\`/api/suppliers/\${params.id}\`);
            if (res.ok) {
                const data = await res.json();
                setSupplier(data.supplier);
                
                let filteredLedger = data.ledger as SupplierLedgerItem[];
                
                // Keep frontend filtering for simplicity, though backend is better for large datasets
                if (dateFrom) {
                    filteredLedger = filteredLedger.filter(item => new Date(item.date) >= new Date(dateFrom));
                }
                if (dateTo) {
                    const to = new Date(dateTo);
                    to.setHours(23, 59, 59, 999);
                    filteredLedger = filteredLedger.filter(item => new Date(item.date) <= to);
                }

                // Sort by date ascending to calculate running balance correctly
                filteredLedger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                setLedger(filteredLedger);
            }
        } catch (error) {
            console.error('Failed to fetch ledger');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const headers = ['التاريخ', 'النوع', 'الوصف', 'المبلغ', 'الرصيد بعد العملية (لنا / علينا)'];
        let runningBalance = 0;
        
        const csvContent = [
            headers.join(','),
            ...ledger.map(item => {
                // Calculate running balance
                if (item.type === 'PURCHASE') {
                    runningBalance += Number(item.amount);
                } else if (item.type === 'PAYMENT' || item.type === 'RETURN') {
                    runningBalance -= Number(item.amount);
                }

                const typeAr = item.type === 'PURCHASE' ? 'فاتورة مشتريات' : item.type === 'PAYMENT' ? 'دفعة مسددة' : 'مرتجع مشتريات';
                const balanceStr = runningBalance > 0 ? \`"\${runningBalance} (علينا)"\` : \`"\${Math.abs(runningBalance)} (لنا)"\`;

                return [
                    new Date(item.date).toLocaleDateString('en-GB'),
                    \`"\${typeAr}"\`,
                    \`"\${item.description || ''}"\`,
                    item.amount,
                    balanceStr
                ].join(',');
            })
        ].join('\\n');

        const blob = new Blob(['\\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = \`ledger_\${supplier?.name}_\${new Date().toISOString().split('T')[0]}.csv\`;
        link.click();
    };

    // Calculate running balances for render
    const ledgerWithBalance = useMemo(() => {
        let currentBalance = 0;
        return ledger.map(item => {
            if (item.type === 'PURCHASE') {
                currentBalance += Number(item.amount);
            } else if (item.type === 'PAYMENT' || item.type === 'RETURN') {
                currentBalance -= Number(item.amount);
            }
            return { ...item, runningBalance: currentBalance };
        }).reverse(); // Reverse back to descending for display (newest first)
    }, [ledger]);

    return (
        <div className="min-h-screen p-6 md:p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <style jsx global>{\`
                @media print {
                    header, button, input, .filters-section { display: none !important; }
                    main { padding: 0 !important; }
                    body { background: white !important; }
                    table { width: 100% !important; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd !important; padding: 12px !important; color: black !important; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .page-break { page-break-inside: avoid; }
                }
            \`}</style>

            <div className="max-w-5xl mx-auto mb-8">
                <PageHeader
                    title="كشف حساب مورد / شركة"
                    subtitle={loading ? 'جاري التحميل...' : supplier?.name || ''}
                    icon={Users}
                    actions={
                        <>
                            <button
                                onClick={handlePrint}
                                className="p-3 text-gray-500 hover:bg-gray-100 rounded-xl border border-gray-200"
                                title="طباعة كشف الحساب"
                            >
                                <Printer size={20} />
                            </button>
                            <button
                                onClick={handleExport}
                                className="p-3 text-green-600 hover:bg-green-50 rounded-xl border border-green-200"
                                title="تصدير كشف الحساب Excel"
                            >
                                <FileSpreadsheet size={20} />
                            </button>
                            <button
                                onClick={() => router.back()}
                                className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                                title="العودة للقائمة"
                            >
                                <ArrowRight className="text-gray-600" />
                            </button>
                            <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-200">
                                <div className="text-xs text-gray-400 font-bold mb-1">الرصيد الإجمالي الحالي</div>
                                <div className={\`text-2xl font-extrabold \${Number(supplier?.balance) < 0 ? 'text-green-600' : 'text-red-600'}\`}>
                                    {formatCurrency(Number(supplier?.balance || 0))} 
                                    <span className="text-sm font-normal text-gray-500 mr-2">
                                        {Number(supplier?.balance) > 0 ? '(مطلوب سداده)' : Number(supplier?.balance) < 0 ? '(رصيد لنا)' : ''}
                                    </span>
                                </div>
                            </div>
                        </>
                    }
                />

                {/* Print Only Header */}
                <div className="hidden print-only mb-8 text-center border-b pb-6">
                    <h1 className="text-2xl font-bold mb-2">كشف حساب مطبوع</h1>
                    <h2 className="text-xl">المورد: {supplier?.name}</h2>
                    {dateFrom || dateTo ? (
                        <p className="text-gray-600 mt-2">
                            الفترة: {dateFrom ? new Date(dateFrom).toLocaleDateString('ar-IQ') : 'البداية'} - {dateTo ? new Date(dateTo).toLocaleDateString('ar-IQ') : 'النهاية'}
                        </p>
                    ) : (
                        <p className="text-gray-600 mt-2">جميع الحركات المسجلة</p>
                    )}
                </div>

                <div className="filters-section bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-wrap items-end gap-4">
                    <div className="flex items-center gap-2 text-gray-700 font-bold w-full md:w-auto mb-2 md:mb-0">
                        <Filter size={20} className="text-blue-500" />
                        تصفية التاريخ:
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-gray-500 mb-1 font-bold">من تاريخ</label>
                        <input 
                            type="date" 
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-gray-500 mb-1 font-bold">إلى تاريخ</label>
                        <input 
                            type="date" 
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-auto">
                        <button 
                            onClick={() => {setDateFrom(''); setDateTo('');}}
                            className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-lg transition-colors"
                        >
                            مسح التصفية
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden page-break">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-500 text-sm uppercase border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 font-bold">التاريخ</th>
                                    <th className="px-6 py-4 font-bold">نوع الحركة</th>
                                    <th className="px-6 py-4 font-bold">البيان / الوصف</th>
                                    <th className="px-6 py-4 font-bold">المبلغ (د.ع)</th>
                                    <th className="px-6 py-4 font-bold text-left bg-blue-50/50">الرصيد الجاري</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading && ledger.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-bold">جاري تحميل الحركات...</td></tr>
                                ) : ledgerWithBalance.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-bold">لا توجد حركات مسجلة للفترة المحددة</td></tr>
                                ) : (
                                    ledgerWithBalance.map((item, idx) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-600 font-bold text-sm whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    {new Date(item.date).toLocaleDateString('en-GB')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={\`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center w-fit gap-1.5
                                                    \${item.type === 'PURCHASE' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                                        item.type === 'PAYMENT' ? 'bg-green-50 text-green-700 border border-green-100' : 
                                                        'bg-blue-50 text-blue-700 border border-blue-100'}\`}>
                                                    {item.type === 'PURCHASE' && <Plus size={14} />}
                                                    {item.type === 'PAYMENT' && <Minus size={14} />}
                                                    {item.type === 'RETURN' && <RefreshCw size={14} />}
                                                    {item.type === 'PURCHASE' ? 'فاتورة مشتريات' : item.type === 'PAYMENT' ? 'دفعة مسددة' : 'مرتجع مشتريات'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 text-sm max-w-md truncate" title={item.description || ''}>
                                                {item.description || '-'}
                                            </td>
                                            <td className={\`px-6 py-4 font-extrabold text-base \${item.type === 'PURCHASE' ? 'text-orange-600' : 'text-green-600'}\`}>
                                                <div className="flex items-center gap-1">
                                                    {item.type === 'PURCHASE' ? '+' : '-'} {formatCurrency(Number(item.amount))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-left bg-blue-50/10 border-r border-gray-50">
                                                <span className={\`font-bold text-base px-3 py-1 rounded-md \${
                                                    item.runningBalance > 0 ? 'text-red-600 bg-red-50' : 
                                                    item.runningBalance < 0 ? 'text-green-600 bg-green-50' : 'text-gray-500'
                                                }\`}>
                                                    {formatCurrency(Math.abs(item.runningBalance))}
                                                    <span className="text-xs mr-2 font-normal opacity-70">
                                                        {item.runningBalance > 0 ? 'دائن (له)' : item.runningBalance < 0 ? 'مدين (عليه)' : 'مُصفى'}
                                                    </span>
                                                </span>
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
`;

fs.writeFileSync('app/(tenant)/purchases/suppliers/[id]/ledger/page.tsx', content);
console.log('Done rebuild ledger page');
