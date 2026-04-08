'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Filter, User, Download, TrendingUp, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/export';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBranch } from '@/contexts/BranchContext';

interface SalesData {
    totalSales: number;
    transactionCount: number;
    transactions: any[];
    chartData: { name: string, value: number }[];
    salesByCategory?: { name: string, value: number }[];
}

export default function SalesReportPage() {
    const { selectedBranch } = useBranch();
    const [period, setPeriod] = useState('daily');
    const [userId, setUserId] = useState('ALL');
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<{ id: number, username: string }[]>([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!selectedBranch) return;
        fetchSales();
    }, [period, userId, selectedBranch]);

    const fetchUsers = async () => {
        const res = await fetch('/api/users');
        if (res.ok) setUsers(await res.json());
    };

    const fetchSales = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ period, userId });
            if (selectedBranch?.id && selectedBranch.id !== 'all') {
                params.append('branchId', selectedBranch.id);
            }
            const res = await fetch(`/api/reports/sales?${params}`);
            if (res.ok) setData(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (!data) return;
        const headers = ["رقم الفاتورة", "التوقيت", "الكاشير", "الإجمالي"];
        const rows = data.transactions.map(tx => [
            `#${tx.id}`,
            new Date(tx.date).toLocaleString('ar-EG'),
            tx.user?.username || 'System',
            tx.totalAmount
        ]);
        exportToCSV(`Sales_Report_${period}`, headers, rows);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 report-container" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
                        <TrendingUp size={22} className="text-white relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            تقرير المبيعات
                        </h1>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>سجل حركة البيع والرسوم البيانية</p>
                    </div>
                </div>

                <div className="flex gap-2 no-print">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                        style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Download size={16} />
                        تصدير Excel
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, #374151, #111827)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <Printer size={16} />
                        طباعة PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center p-4 rounded-2xl no-print"
                style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                    <Filter size={16} />
                    <span className="text-sm">تصفية:</span>
                </div>

                <select value={period} onChange={e => setPeriod(e.target.value)}
                    className="px-4 py-2 rounded-xl text-sm font-bold outline-none"
                    style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a' }}>
                    <option value="daily">اليوم</option>
                    <option value="weekly">هذا الأسبوع</option>
                    <option value="monthly">هذا الشهر</option>
                </select>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
                    <User size={15} className="text-slate-400" />
                    <select value={userId} onChange={e => setUserId(e.target.value)}
                        className="bg-transparent text-sm font-bold outline-none min-w-[120px]" style={{ color: '#0f172a' }}>
                        <option value="ALL">كل الكاشيرات</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 font-bold">
                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    جاري تحميل البيانات...
                </div>
            ) : data ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl p-6 text-white relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
                            <div className="absolute inset-0 opacity-10" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)' }} />
                            <p className="text-white/70 font-medium mb-1 text-sm relative z-10">إجمالي المبيعات</p>
                            <h3 className="text-3xl font-black relative z-10">{formatCurrency(data.totalSales)}</h3>
                        </div>
                        <div className="rounded-2xl p-6 relative overflow-hidden"
                            style={{ background: 'white', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
                            <p className="font-bold mb-1 text-sm" style={{ color: 'var(--text-secondary)' }}>عدد الفواتير</p>
                            <h3 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{data.transactionCount}</h3>
                        </div>
                    </div>

                    {/* Sales Visualizations */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Sales Chart */}
                        <div className="lg:col-span-2 p-6 rounded-2xl"
                            style={{ background: 'white', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
                            <h3 className="font-bold mb-6 flex items-center gap-2.5" style={{ color: 'var(--text-primary)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                    <TrendingUp size={14} className="text-white" />
                                </div>
                                الرسم البياني للمبيعات
                            </h3>
                            <div className="h-72 w-full" dir="ltr">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value: number) => value === 0 ? '0' : (value / 1000) + 'k'} dx={-10} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value: any) => [formatCurrency(Number(value) || 0), 'المبيعات']}
                                        />
                                        <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Sales By Category */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-y-auto max-h-[380px]">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                مبيعات الأقسام
                            </h3>
                            <div className="space-y-4">
                                {data.salesByCategory?.map((cat, idx) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{cat.name}</span>
                                            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(cat.value)}</span>
                                        </div>
                                        <div className="w-full rounded-full h-2" style={{ background: '#f1f5f9' }}>
                                            <div className="h-2 rounded-full"
                                                style={{
                                                    width: `${data.totalSales > 0 ? (cat.value / data.totalSales) * 100 : 0}%`,
                                                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                                }} />
                                        </div>
                                    </div>
                                ))}
                                {(!data.salesByCategory || data.salesByCategory.length === 0) && (
                                    <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>لا توجد بيانات للأقسام</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sales Table */}
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'white', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
                        <div className="p-5 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #64748b, #475569)' }}>
                                <Calendar size={14} className="text-white" />
                            </div>
                            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>سجل العمليات</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>التاريخ</th>
                                        <th>الكاشير</th>
                                        <th>الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.transactions.map((tx: any, idx: number) => (
                                        <tr key={tx.id}>
                                            <td className="font-semibold" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                                            <td className="text-sm font-medium" dir="ltr">
                                                {new Date(tx.date).toLocaleString('en-US', { hour12: true })}
                                            </td>
                                            <td>
                                                <span className="badge badge-primary">{tx.user?.username || 'System'}</span>
                                            </td>
                                            <td className="font-black" style={{ color: 'var(--color-primary)' }}>
                                                {formatCurrency(Number(tx.totalAmount))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.transactions.length === 0 && (
                                <div className="p-12 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>لا توجد مبيعات في هذه الفترة</div>
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
