'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import { Package, Search, Calendar, Filter, Database, FileSpreadsheet, AlertTriangle, CheckCircle2, Clock, Pencil, X, Save, Loader2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

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

interface EditForm {
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    costPrice: number;
}

export default function BatchesManagementPage() {
  usePageTitle('إدارة الدُفعات');
    const router = useRouter();
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [batches, setBatches] = useState<BatchItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'LOW_STOCK' | 'GOOD'>('ALL');

    // Edit modal
    const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ batchNumber: '', expiryDate: '', quantity: 0, costPrice: 0 });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (branchLoading) return;
        fetchBatches();
    }, [selectedBranch, branchLoading]);

    const fetchBatches = async () => {
        try {
            setLoading(true);
            const branchQuery = selectedBranch?.id ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/inventory/batches${branchQuery}`);
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

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(b =>
                b.productName.toLowerCase().includes(term) ||
                b.batchNumber.toLowerCase().includes(term) ||
                b.supplierName.toLowerCase().includes(term)
            );
        }

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

    const handleExport = async () => {
        const XLSX = await import('xlsx');

        const now = new Date();
        const exportDate = now.toLocaleString('ar-IQ');
        const fileName = `تقرير_الدفعات_${now.toISOString().split('T')[0]}.xlsx`;

        const STATUS_LABEL: Record<string, string> = {
            GOOD:          'سارية وصالحة',
            EXPIRING_SOON: 'قاربت الانتهاء',
            EXPIRED:       'منتهية الصلاحية',
            LOW_STOCK:     'رصيد منخفض',
            OUT_OF_STOCK:  'نفاد الكمية',
        };

        const daysLabel = (expiryDate: string | null): string => {
            if (!expiryDate) return 'غير محدد';
            const diff = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
            if (diff < 0) return `منتهي منذ ${Math.abs(diff)} يوم`;
            if (diff === 0) return 'ينتهي اليوم';
            return `${diff} يوم`;
        };

        const filterLabel =
            statusFilter === 'ALL'          ? 'الكل' :
            statusFilter === 'EXPIRED'      ? 'منتهية الصلاحية' :
            statusFilter === 'EXPIRING_SOON'? 'قاربت الانتهاء'  :
            statusFilter === 'LOW_STOCK'    ? 'رصيد منخفض'      : 'سارية';

        // ════ SHEET 1: تقرير الدفعات التفصيلي ════
        const sheet1: (string | number)[][] = [
            ['تقرير الدفعات / الوجبات — إدارة المخزون'],
            [`تاريخ التصدير: ${exportDate}`, '', `الفلتر: ${filterLabel}`, '', `العدد: ${filteredBatches.length} دفعة`],
            [],
            [
                '#', 'رقم الدفعة', 'المنتج', 'القسم', 'المورد', 'الفرع',
                'الكمية المتاحة', 'سعر التكلفة/الوحدة', 'إجمالي قيمة الدفعة',
                'تاريخ الصلاحية', 'الأيام المتبقية', 'حالة الدفعة', 'تاريخ الإدخال',
            ],
            ...filteredBatches.map((b, i) => [
                i + 1,
                b.batchNumber,
                b.productName,
                b.categoryName,
                b.supplierName || 'غير محدد',
                b.branchName,
                b.quantity,
                b.costPrice,
                b.quantity * b.costPrice,
                b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('ar-IQ') : 'غير محدد',
                daysLabel(b.expiryDate),
                STATUS_LABEL[getBatchStatus(b)] ?? getBatchStatus(b),
                new Date(b.createdAt).toLocaleString('ar-IQ'),
            ]),
            [],
            [
                '', '', '', '', '',
                'الإجمالي:',
                filteredBatches.reduce((s, b) => s + b.quantity, 0),
                '',
                filteredBatches.reduce((s, b) => s + b.quantity * b.costPrice, 0),
                '', '', '', '',
            ],
        ];

        const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
        ws1['!cols'] = [
            { wch: 5  }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 20 },
            { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 16 },
            { wch: 22 }, { wch: 22 }, { wch: 22 },
        ];

        // ════ SHEET 2: الملخص الإحصائي ════
        const totalValue = filteredBatches.reduce((s, b) => s + b.quantity * b.costPrice, 0);
        const totalQty   = filteredBatches.reduce((s, b) => s + b.quantity, 0);

        const statusCounts: Record<string, number> = {
            GOOD: 0, EXPIRING_SOON: 0, EXPIRED: 0, LOW_STOCK: 0, OUT_OF_STOCK: 0,
        };
        filteredBatches.forEach(b => {
            const s = getBatchStatus(b);
            if (s in statusCounts) statusCounts[s]++;
        });

        const supplierMap: Record<string, { count: number; value: number }> = {};
        filteredBatches.forEach(b => {
            const n = b.supplierName || 'غير محدد';
            if (!supplierMap[n]) supplierMap[n] = { count: 0, value: 0 };
            supplierMap[n].count++;
            supplierMap[n].value += b.quantity * b.costPrice;
        });
        const topSuppliers = Object.entries(supplierMap)
            .sort((a, b) => b[1].value - a[1].value).slice(0, 7);

        const catMap: Record<string, { count: number; value: number }> = {};
        filteredBatches.forEach(b => {
            const n = b.categoryName || 'غير مصنف';
            if (!catMap[n]) catMap[n] = { count: 0, value: 0 };
            catMap[n].count++;
            catMap[n].value += b.quantity * b.costPrice;
        });
        const topCats = Object.entries(catMap)
            .sort((a, b) => b[1].value - a[1].value).slice(0, 7);

        const sheet2: (string | number)[][] = [
            ['الملخص الإحصائي — تقرير الدفعات'],
            [`تاريخ التصدير: ${exportDate}`],
            [],
            ['المؤشرات الرئيسية', ''],
            ['إجمالي الدفعات',               filteredBatches.length],
            ['إجمالي الكمية (وحدات)',         totalQty],
            ['إجمالي قيمة المخزون الشرائية', totalValue],
            ['متوسط قيمة الدفعة الواحدة',    filteredBatches.length ? +(totalValue / filteredBatches.length).toFixed(2) : 0],
            ['متوسط كمية الدفعة الواحدة',    filteredBatches.length ? +(totalQty   / filteredBatches.length).toFixed(1) : 0],
            [],
            ['توزيع الدفعات حسب الحالة', '', ''],
            ['الحالة', 'عدد الدفعات', 'النسبة %'],
            ...Object.entries(statusCounts).map(([s, c]) => [
                STATUS_LABEL[s] ?? s,
                c,
                filteredBatches.length ? `${((c / filteredBatches.length) * 100).toFixed(1)}%` : '0%',
            ]),
            [],
            ['أبرز الموردين (حسب قيمة المخزون)', '', ''],
            ['المورد', 'عدد الدفعات', 'إجمالي القيمة'],
            ...topSuppliers.map(([name, { count, value }]) => [name, count, +value.toFixed(2)]),
            [],
            ['أبرز الأقسام (حسب قيمة المخزون)', '', ''],
            ['القسم', 'عدد الدفعات', 'إجمالي القيمة'],
            ...topCats.map(([name, { count, value }]) => [name, count, +value.toFixed(2)]),
        ];

        const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
        ws2['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 20 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'تقرير الدفعات');
        XLSX.utils.book_append_sheet(wb, ws2, 'الملخص الإحصائي');
        XLSX.writeFile(wb, fileName);
    };

    const openEdit = (batch: BatchItem) => {
        setEditingBatch(batch);
        setEditForm({
            batchNumber: batch.batchNumber === 'N/A' ? '' : batch.batchNumber,
            expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().split('T')[0] : '',
            quantity: batch.quantity,
            costPrice: batch.costPrice,
        });
    };

    const handleSave = async () => {
        if (!editingBatch) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/inventory/batches/${editingBatch.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchNumber: editForm.batchNumber || null,
                    expiryDate: editForm.expiryDate || null,
                    quantity: editForm.quantity,
                    costPrice: editForm.costPrice,
                }),
            });

            if (res.ok) {
                const updated = await res.json();
                setBatches(prev => prev.map(b => b.id === updated.id ? updated : b));
                setEditingBatch(null);
                toast.success('تم تعديل الدفعة بنجاح');
            } else {
                const err = await res.json();
                toast.error(err.error || 'فشل التعديل');
            }
        } catch {
            toast.error('حدث خطأ أثناء الحفظ');
        } finally {
            setSaving(false);
        }
    };

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const date = d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const time = d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        return { date, time };
    };

    // Metrics calculation
    const totalBatches = filteredBatches.length;
    const totalValue = filteredBatches.reduce((acc, b) => acc + (b.quantity * b.costPrice), 0);
    const expiringCount = batches.filter(b => getBatchStatus(b) === 'EXPIRING_SOON').length;
    const expiredCount = batches.filter(b => getBatchStatus(b) === 'EXPIRED').length;

    if (loading) return (
        <div className="min-h-screen p-6 md:p-8 space-y-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            {/* Hero */}
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <Database size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)' }} />
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل إدارة الدفعات</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400 font-medium">يتم تحميل الدفعات وبيانات الصلاحيات والمخزون</p>
                </div>
            </div>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                        <div className="flex items-center justify-between">
                            <div className="skeleton h-3 w-20" />
                            <div className="skeleton w-9 h-9 rounded-xl" />
                        </div>
                        <div className="skeleton h-7 w-24" />
                        <div className="skeleton h-2.5 w-16" />
                    </div>
                ))}
            </div>
            {/* Filter bar */}
            <div className="flex gap-3 flex-wrap">
                <div className="skeleton h-10 flex-1 min-w-[200px] rounded-xl" />
                <div className="skeleton h-10 w-36 rounded-xl" />
                <div className="skeleton h-10 w-32 rounded-xl" />
                <div className="skeleton h-10 w-28 rounded-xl" />
            </div>
            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className="grid grid-cols-8 gap-2 px-6 py-3.5 border-b border-slate-100">
                    {[8, 20, 16, 12, 12, 12, 12, 8].map((w, i) => (
                        <div key={i} className="skeleton h-3" style={{ width: `${w}%` }} />
                    ))}
                </div>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-8 gap-2 px-6 py-4 items-center">
                            <div className="skeleton h-6 w-14 rounded-lg" />
                            <div className="space-y-1.5">
                                <div className="skeleton h-3.5 w-28" />
                                <div className="skeleton h-2.5 w-18" />
                            </div>
                            <div className="skeleton h-3.5 w-16" />
                            <div className="skeleton h-3.5 w-12" />
                            <div className="skeleton h-6 w-16 rounded-full" />
                            <div className="skeleton h-3.5 w-14" />
                            <div className="skeleton h-3.5 w-20" />
                            <div className="skeleton h-7 w-16 rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen p-6 md:p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <PageHeader
                title="إدارة الدفعات / الوجبات (Batches)"
                subtitle="مراقبة كمية وصلاحيات المواد بشكل مفصل استناداً لمعرفات الشراء."
                icon={Database}
                gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
                actions={
                    <>
                        <button onClick={handleExport} className="btn-success">
                            <FileSpreadsheet size={18} />
                            تصدير التقرير
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#eef2ff' }}>
                        <Database size={18} style={{ color: '#094B9F' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">إجمالي الدفعات المتاحة</p>
                        <p className="kpi-value">{totalBatches}</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#ecfdf5' }}>
                        <Package size={18} style={{ color: '#10b981' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">القيمة الشرائية للمخزون</p>
                        <p className="kpi-value">{formatCurrency(totalValue)}</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#fff7ed' }}>
                        <Clock size={18} style={{ color: '#f97316' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">اقتربت من الانتهاء</p>
                        <p className="kpi-value">{expiringCount} دفعات</p>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#fef2f2' }}>
                        <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="kpi-label">منتهية الصلاحية</p>
                        <p className="kpi-value">{expiredCount} دفعات</p>
                    </div>
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
                            style={statusFilter === f ? { background: '#094B9F', color: '#fff', fontWeight: 700 } : undefined}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                statusFilter === f
                                ? 'shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
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
                <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right data-table">
                            <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider"># / رقم الدفعة</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المنتج المنتمي للمورد</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap text-center">تاريخ الصلاحية</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">الرصيد المتاح</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">سعر التكلفة</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">تاريخ الادخال</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-32">حالة الدفعة</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">تعديل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">جاري تحميل بيانات المخزون...</td></tr>
                                ) : filteredBatches.length === 0 ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">لا توجد دفعات مطابقة لخيارات البحث</td></tr>
                                ) : (
                                    filteredBatches.map((batch, idx) => {
                                        const status = getBatchStatus(batch);
                                        const { date, time } = formatDateTime(batch.createdAt);
                                        return (
                                            <tr key={batch.id} className="hover:bg-blue-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <span className="font-bold text-gray-400 text-[10px] block mb-0.5">#{idx + 1}</span>
                                                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded text-xs select-all border border-gray-200 block w-fit">
                                                        {batch.batchNumber}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-800 text-base">{batch.productName}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">{batch.categoryName}</span>
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">المورد: <span className="font-bold text-gray-700">{batch.supplierName}</span></span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center align-middle">
                                                    <div className="flex justify-center items-center gap-1.5 w-full">
                                                        {batch.expiryDate ? (
                                                            <>
                                                                <Calendar size={14} className="text-gray-400" />
                                                                <span className={`text-sm ${status === 'EXPIRED' ? 'text-red-600 font-bold' : status === 'EXPIRING_SOON' ? 'text-orange-600 font-bold' : 'text-gray-700 font-medium'}`}>
                                                                    {new Date(batch.expiryDate).toLocaleDateString('en-GB')}
                                                                </span>
                                                            </>
                                                        ) : <span className="text-gray-400 text-xs bg-gray-50 px-2 py-1 rounded">بدون تاريخ</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center align-middle w-24">
                                                    <span className={`inline-block px-3 py-1 font-extrabold text-base rounded-lg shadow-sm border ${batch.quantity === 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-blue-700 border-blue-200'}`}>
                                                        {batch.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-extrabold text-green-700 align-middle">
                                                    {formatCurrency(batch.costPrice)}
                                                </td>
                                                <td className="px-6 py-4 text-center align-middle">
                                                    <span className="block text-xs font-bold text-gray-700">{date}</span>
                                                    <span className="block text-[11px] text-gray-400 mt-0.5">{time}</span>
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="flex justify-center">
                                                        <StatusBadge status={status} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center align-middle">
                                                    <button
                                                        onClick={() => openEdit(batch)}
                                                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                        title="تعديل الدفعة"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Edit Modal */}
            {editingBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingBatch(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" dir="rtl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-extrabold text-gray-900">تعديل الدفعة</h2>
                            <button onClick={() => setEditingBatch(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <p className="text-xs text-gray-500 font-bold">المنتج</p>
                            <p className="font-extrabold text-gray-800">{editingBatch.productName}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">رقم الدفعة</label>
                                <input
                                    type="text"
                                    value={editForm.batchNumber}
                                    onChange={e => setEditForm(f => ({ ...f, batchNumber: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="رقم الدفعة"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ الصلاحية</label>
                                <input
                                    type="date"
                                    value={editForm.expiryDate}
                                    onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الكمية</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={editForm.quantity}
                                    onChange={e => setEditForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">سعر التكلفة</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={editForm.costPrice}
                                    onChange={e => setEditForm(f => ({ ...f, costPrice: Number(e.target.value) }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                            </button>
                            <button
                                onClick={() => setEditingBatch(null)}
                                className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-bold transition-colors"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
