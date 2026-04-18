const fs = require('fs');
const path = require('path');

const dir = 'app/(tenant)/inventory/batches';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

const content = `'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Package, Search, Calendar, Filter, Database, FileSpreadsheet, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';
import { useRouter } from 'next/navigation';

interface BatchItem {
    id: string;
    batchNumber: string;
    productId: string;
    productName: string;
    categoryId: string;
    categoryName: string;
    supplierId: string | null;
    supplierName: string;
    branchId: string;
    branchName: string;
    expiryDate: string | null;
    quantity: number;
    costPrice: number;
    createdAt: string;
}

export default function BatchesManagementPage() {
    const router = useRouter();
    const { selectedBranch } = useBranch();
    const [batches, setBatches] = useState<BatchItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'LOW_STOCK' | 'GOOD'>('ALL');

    useEffect(() => {
        if (!selectedBranch) return;
        fetchBatches();
    }, [selectedBranch]);

    const fetchBatches = async () => {
        try {
            setLoading(true);
            const branchQuery = selectedBranch?.id ? \`?branchId=\${selectedBranch.id}\` : '';
            const res = await fetch(\`/api/inventory/batches\${branchQuery}\`);
            if (res.ok) {
                const data = await res.json();
                setBatches(data);
            }
        } catch (error) {
            console.error('Failed to fetch batches:', error);
        } finally {
            setLoading(false);
        }
    };

    const getBatchStatus = (batch: BatchItem) => {
        const today = new Date();
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(today.getMonth() + 3);

        if (batch.expiryDate) {
            const expDate = new Date(batch.expiryDate);
            if (expDate <= today && batch.quantity > 0) return 'EXPIRED';
            if (expDate <= threeMonthsFromNow && batch.quantity > 0) return 'EXPIRING_SOON';
        }

        if (batch.quantity === 0) return 'OUT_OF_STOCK';
        if (batch.quantity < 10) return 'LOW_STOCK';
        return 'GOOD';
    };

    const filteredBatches = useMemo(() => {
        let filtered = batches;

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(b => 
                b.productName.toLowerCase().includes(term) ||
                b.batchNumber.toLowerCase().includes(term) ||
                b.supplierName.toLowerCase().includes(term)
            );
        }

        // Status Filter
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(b => {
                const status = getBatchStatus(b);
                if (statusFilter === 'EXPIRING_SOON') return status === 'EXPIRING_SOON';
                if (statusFilter === 'EXPIRED') return status === 'EXPIRED';
                if (statusFilter === 'LOW_STOCK') return status === 'LOW_STOCK' || status === 'OUT_OF_STOCK';
                if (statusFilter === 'GOOD') return status === 'GOOD';
                return true;
            });
        }

        return filtered;
    }, [batches, searchTerm, statusFilter]);

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'EXPIRED':
                return <span className="bg-red-100 text-red-700 px-2 py-1 flex items-center justify-center gap-1 rounded-md text-[10px] font-bold whitespace-nowrap"><AlertTriangle size={10}/> منتهي الصلاحية</span>;
            case 'EXPIRING_SOON':
                return <span className="bg-orange-100 text-orange-700 px-2 py-1 flex items-center justify-center gap-1 rounded-md text-[10px] font-bold whitespace-nowrap"><Clock size={10}/> قارب على الانتهاء</span>;
            case 'OUT_OF_STOCK':
                return <span className="bg-gray-100 text-gray-700 px-2 py-1 flex items-center justify-center gap-1 rounded-md text-[10px] font-bold whitespace-nowrap"><AlertTriangle size={10}/> نفاد الكمية</span>;
            case 'LOW_STOCK':
                return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 flex items-center justify-center gap-1 rounded-md text-[10px] font-bold whitespace-nowrap"><AlertTriangle size={10}/> رصيد منخفض</span>;
            case 'GOOD':
            default:
                return <span className="bg-green-100 text-green-700 px-2 py-1 flex items-center justify-center gap-1 rounded-md text-[10px] font-bold whitespace-nowrap"><CheckCircle2 size={10}/> سارية وصالحة</span>;
        }
    };

    const handleExport = () => {
        const headers = ['رقم التشغيلة', 'المنتج', 'المورد', 'الفرع', 'تاريخ الصلاحية', 'الكمية (الوحدات)', 'سعر التكلفة للوحدة'];
        const csvContent = [
            headers.join(','),
            ...filteredBatches.map(b => [
                \`"\${b.batchNumber}"\`,
                \`"\${b.productName}"\`,
                \`"\${b.supplierName}"\`,
                \`"\${b.branchName}"\`,
                b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-GB') : 'غير محدد',
                b.quantity,
                b.costPrice
            ].join(','))
        ].join('\\n');

        const blob = new Blob(['\\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = \`batches_inventory_\${new Date().toISOString().split('T')[0]}.csv\`;
        link.click();
    };

    // Metrics calculation
    const totalBatches = filteredBatches.length;
    const totalValue = filteredBatches.reduce((acc, b) => acc + (b.quantity * b.costPrice), 0);
    const expiringCount = batches.filter(b => getBatchStatus(b) === 'EXPIRING_SOON').length;
    const expiredCount = batches.filter(b => getBatchStatus(b) === 'EXPIRED').length;

    return (
        <div className="min-h-screen p-6 md:p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <PageHeader
                title="إدارة الدفعات / الوجبات (Batches)"
                subtitle="مراقبة كمية وصلاحيات المواد بشكل مفصل استناداً لمعرفات الشراء."
                icon={Database}
                actions={
                    <>
                        <button
                            onClick={handleExport}
                            className="bg-white hover:bg-green-50 text-green-700 px-4 py-2 border border-green-200 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors text-sm"
                        >
                            <FileSpreadsheet size={18} />
                            تصدير التقرير
                        </button>
                    </>
                }
            />

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0">
                    <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 min-w-[200px]">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Database size={24} /></div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">إجمالي الوجبات المتاحة</div>
                            <div className="text-xl font-extrabold text-blue-900">{totalBatches}</div>
                        </div>
                    </div>
                    <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 min-w-[200px]">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Package size={24} /></div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">القيمة الشرائية للمخزون</div>
                            <div className="text-xl font-extrabold text-green-700">{formatCurrency(totalValue)}</div>
                        </div>
                    </div>
                    {expiringCount > 0 && (
                        <div className="bg-orange-50 px-4 py-3 rounded-xl border border-orange-200 shadow-sm flex flex-col justify-center min-w-[150px]">
                            <div className="text-[10px] text-orange-600 font-bold uppercase">اقتربت من الانتهاء</div>
                            <div className="text-xl font-extrabold text-orange-700">{expiringCount} دفعات</div>
                        </div>
                    )}
                    {expiredCount > 0 && (
                        <div className="bg-red-50 px-4 py-3 rounded-xl border border-red-200 shadow-sm flex flex-col justify-center min-w-[150px] animate-pulse">
                            <div className="text-[10px] text-red-600 font-bold uppercase">مواد منتهية الصلاحية</div>
                            <div className="text-xl font-extrabold text-red-700">{expiredCount} دفعات</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap md:flex-nowrap gap-4 items-center">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="ابحث برقم التشغيلة، اسم المنتج، المورد..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pr-10 pl-4 text-black text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none hover:bg-white transition-colors"
                    />
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="text-gray-400 mr-2" size={18} />
                    {(['ALL', 'EXPIRED', 'EXPIRING_SOON', 'LOW_STOCK', 'GOOD'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={\`px-3 py-1.5 rounded-lg text-xs font-bold transition-all \${
                                statusFilter === f 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }\`}
                        >
                            {f === 'ALL' ? 'الكل' : 
                             f === 'EXPIRED' ? 'منتهي الصلاحية' : 
                             f === 'EXPIRING_SOON' ? 'قارب الانتهاء' : 
                             f === 'LOW_STOCK' ? 'رصيد منخفض' : 'ساري'}
                        </button>
                    ))}
                </div>
            </div>

            <main className="max-w-[1600px] mx-auto w-full">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-4 font-bold"># / رقم الدفعة</th>
                                    <th className="px-4 py-4 font-bold">المنتج المنتمي للمورد</th>
                                    <th className="px-4 py-4 font-bold whitespace-nowrap text-center">تاريخ الصلاحية</th>
                                    <th className="px-4 py-4 font-bold text-center">الرصيد المتاح</th>
                                    <th className="px-4 py-4 font-bold text-center">سعر التكلفة</th>
                                    <th className="px-4 py-4 font-bold text-center w-32">حالة الدفعة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400 font-bold">جاري تحميل بيانات المخزون...</td></tr>
                                ) : filteredBatches.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-gray-400 font-bold">لا توجد دفعات مطابقة لخيارات البحث</td></tr>
                                ) : (
                                    filteredBatches.map((batch, idx) => {
                                        const status = getBatchStatus(batch);
                                        return (
                                            <tr key={batch.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-4 py-4">
                                                    <span className="font-bold text-gray-400 text-[10px] block mb-0.5">#{idx + 1}</span>
                                                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded text-xs select-all border border-gray-200 block w-fit">
                                                        {batch.batchNumber}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-gray-800 text-base">{batch.productName}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">{batch.categoryName}</span>
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">المورد: <span className="font-bold text-gray-700">{batch.supplierName}</span></span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center align-middle">
                                                    <div className="flex justify-center items-center gap-1.5 w-full">
                                                        {batch.expiryDate ? (
                                                            <>
                                                                <Calendar size={14} className="text-gray-400" />
                                                                <span className={\`text-sm \${status === 'EXPIRED' ? 'text-red-600 font-bold' : status === 'EXPIRING_SOON' ? 'text-orange-600 font-bold' : 'text-gray-700 font-medium'}\`}>
                                                                    {new Date(batch.expiryDate).toLocaleDateString('en-GB')}
                                                                </span>
                                                            </>
                                                        ) : <span className="text-gray-400 text-xs bg-gray-50 px-2 py-1 rounded">بدون تاريخ</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center align-middle w-24">
                                                    <span className={\`inline-block px-3 py-1 font-extrabold text-base rounded-lg shadow-sm border \${batch.quantity === 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-blue-700 border-blue-200'}\`}>
                                                        {batch.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center font-extrabold text-green-700 align-middle">
                                                    {formatCurrency(batch.costPrice)}
                                                </td>
                                                <td className="px-4 py-4 align-middle">
                                                    <div className="flex justify-center">
                                                        <StatusBadge status={status} />
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
`;

fs.writeFileSync('app/(tenant)/inventory/batches/page.tsx', content);
console.log('Batches page created successfully');
