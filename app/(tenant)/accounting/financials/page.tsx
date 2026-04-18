'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PieChart, ArrowUp, Minus, Download, Printer, Filter, TrendingUp, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/lib/export';
import PageHeader from '@/components/ui/PageHeader';
import { useBranch } from '@/contexts/BranchContext';

interface FinancialData {
    financials: {
        revenue: number;
        cogs: number;
        grossProfit: number;
        operatingExpenses: number;
        netProfit: number;
        margin: number;
    };
    salesList: any[];
    expensesList: any[];
    chartData: any[];
}

export default function FinancialReportPage() {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [data, setData] = useState<FinancialData | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [dateFilter, setDateFilter] = useState('THIS_MONTH');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });

    useEffect(() => {
        if (branchLoading) return;
        if (dateFilter === 'CUSTOM' && (!customDates.start || !customDates.end)) return;
        fetchData();
    }, [dateFilter, customDates, selectedBranch, branchLoading]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/reports/financials';

            const today = new Date();
            let start = new Date();
            let end = new Date();

            if (dateFilter === 'TODAY') {
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'YESTERDAY') {
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'THIS_MONTH') {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'CUSTOM') {
                start = new Date(customDates.start);
                start.setHours(0, 0, 0, 0);
                end = new Date(customDates.end);
                end.setHours(23, 59, 59, 999);
            }

            url += `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
            if (selectedBranch?.id && selectedBranch.id !== 'all') {
                url += `&branchId=${selectedBranch.id}`;
            }

            const res = await fetch(url);
            if (res.ok) setData(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const isSingleDay = useMemo(() => {
        if (dateFilter === 'TODAY' || dateFilter === 'YESTERDAY') return true;
        if (dateFilter === 'CUSTOM' && customDates.start && customDates.end && customDates.start === customDates.end) return true;
        return false;
    }, [dateFilter, customDates]);

    if (!data && !loading) return <div className="p-12 text-center text-red-500 font-bold bg-red-50 rounded-2xl border border-red-100 max-w-lg mx-auto mt-20">خطأ في جلب البيانات المالية. يرجى المحاولة لاحقاً.</div>;

    const financials = data?.financials || { revenue: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0, margin: 0 };
    const chartData = data?.chartData || [];

    const handleExportExcel = () => {
        if (!data) return;
        const headers = ["البند", "القيمة (د.ع)"];
        const rows = [
            ["إجمالي الإيرادات (المبيعات)", financials.revenue],
            ["تكلفة البضاعة المباعة (COGS)", financials.cogs],
            ["مجمل الربح (Gross Profit)", financials.grossProfit],
            ["المصروفات التشغيلية", financials.operatingExpenses],
            ["صافي الربح / الخسارة (Net Profit)", financials.netProfit],
            ["هامش الربح (%)", financials.margin.toFixed(2)],
        ];
        exportToCSV(`Financial_Report_${new Date().toISOString().split('T')[0]}`, headers, rows);
    };

    const handlePrint = () => window.print();

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-gray-100 text-right" dir="rtl">
                    <p className="font-bold text-gray-800 mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }} className="text-sm font-semibold flex justify-between gap-4">
                            <span>{entry.name === 'revenue' ? 'الإيرادات' : 'صافي الربح'}:</span>
                            <span>{formatCurrency(entry.value)}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            <PageHeader
                title="قائمة الدخل (الأرباح والخسائر)"
                subtitle="تحليل شامل ونظرة عامة على الأداء المالي للفترة المحددة."
                icon={PieChart}
                gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                actions={
                    <div className="flex flex-wrap gap-3 items-center w-full md:w-auto no-print">
                        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 transition-shadow focus-within:ring-2 focus-within:ring-blue-100">
                            <Filter size={18} className="text-gray-400" />
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="bg-transparent border-none text-sm font-bold text-gray-800 focus:ring-0 outline-none cursor-pointer w-full"
                            >
                                <option value="TODAY">اليوم</option>
                                <option value="YESTERDAY">الأمس</option>
                                <option value="THIS_MONTH">هذا الشهر</option>
                                <option value="CUSTOM">فترة مخصصة</option>
                            </select>
                        </div>

                        {dateFilter === 'CUSTOM' && (
                            <div className="flex items-center gap-2 animate-fade-in bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                                <input
                                    type="date"
                                    className="px-3 py-1.5 border-none bg-transparent rounded-lg text-sm text-gray-700 font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={customDates.start}
                                    onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                />
                                <span className="text-gray-300">-</span>
                                <input
                                    type="date"
                                    className="px-3 py-1.5 border-none bg-transparent rounded-lg text-sm text-gray-700 font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={customDates.end}
                                    onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                />
                            </div>
                        )}

                        <button onClick={handleExportExcel} className="flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 rounded-xl font-bold transition-all shadow-sm">
                            <Download size={18} />
                            <span>تصدير Excel</span>
                        </button>
                        <button onClick={handlePrint} className="flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 border border-transparent rounded-xl font-bold transition-all shadow-md">
                            <Printer size={18} />
                            <span>طباعة PDF</span>
                        </button>
                    </div>
                }
            />

            {/* Dashboard Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up delay-75">
                {/* Revenue Card */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-card border border-gray-100 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500 ease-out z-0"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-gray-500 text-sm font-bold mb-1">الإيرادات (المبيعات)</p>
                                <p className="text-xs text-gray-400">Total Revenue</p>
                            </div>
                            <div className="p-3 bg-green-100 text-green-600 rounded-xl"><ArrowUp size={24} /></div>
                        </div>
                        <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{formatCurrency(financials.revenue)}</h3>
                    </div>
                </div>

                {/* COGS Card */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-card border border-gray-100 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500 ease-out z-0"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-gray-500 text-sm font-bold mb-1">تكلفة البضاعة (COGS)</p>
                                <p className="text-xs text-gray-400">Cost of Goods Sold</p>
                            </div>
                            <div className="p-3 bg-red-100 text-red-500 rounded-xl"><Minus size={24} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-red-600 tracking-tight">({formatCurrency(financials.cogs)})</h3>
                    </div>
                </div>

                {/* Expenses Card */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-card border border-gray-100 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500 ease-out z-0"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-gray-500 text-sm font-bold mb-1">المصروفات التشغيلية</p>
                                <p className="text-xs text-gray-400">Operating Expenses</p>
                            </div>
                            <div className="p-3 bg-orange-100 text-orange-500 rounded-xl"><Activity size={24} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-orange-600 tracking-tight">({formatCurrency(financials.operatingExpenses)})</h3>
                    </div>
                </div>

                {/* Net Profit Card - Gradient Highlights */}
                <div className={`relative overflow-hidden p-6 rounded-2xl border-none group text-white ${financials.netProfit >= 0 ? 'bg-gradient-to-br from-blue-600 to-indigo-800' : 'bg-gradient-to-br from-red-600 to-rose-800'}`} style={{ boxShadow: financials.netProfit >= 0 ? 'var(--shadow-md)' : 'var(--shadow-md)' }}>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 transition-transform group-hover:scale-125 duration-700 ease-out z-0"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-12 -mt-12 z-0"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-white/90 text-sm font-bold mb-1">صافي الربح / الخسارة</p>
                                <p className="text-xs text-white/70">Net Profit / Loss</p>
                            </div>
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl"><DollarSign size={24} /></div>
                        </div>
                        <h3 className="text-3xl font-extrabold tracking-tight mb-2" dir="ltr">{formatCurrency(financials.netProfit)}</h3>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-sm border border-white/10">
                            <TrendingUp size={14} />
                            <span>هامش الربح: {financials.margin.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recharts Profit Trend Line */}
            <div className="bg-white rounded-[20px] shadow-card border border-gray-100 p-6 md:p-8 animate-fade-in-up delay-150">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <TrendingUp size={24} className="text-blue-600" /> مسار الأرباح والإيرادات
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">يعرض تطور الإيرادات وصافي الأرباح خلال الفترة المحددة</p>
                    </div>
                    {/* Legend styling */}
                    <div className="flex gap-4 items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"></span>
                            <span className="text-xs font-bold text-gray-700">الإيرادات</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></span>
                            <span className="text-xs font-bold text-gray-700">صافي الربح</span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="h-[350px] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 animate-pulse text-gray-400 font-medium">جاري معالجة الرسم البياني...</div>
                ) : chartData.length > 0 ? (
                    <div className="h-[350px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                                    tickFormatter={(val) => {
                                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                        if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                        return val;
                                    }}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#3b82f6"
                                    strokeWidth={4}
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="profit"
                                    stroke="#10b981"
                                    strokeWidth={4}
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[350px] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 text-gray-400 font-medium text-sm flex-col gap-2">
                        <PieChart size={40} className="text-gray-300 opacity-50" />
                        <p>لا تتوافر بيانات مالية كافية لرسم المنحنى في هذه الفترة.</p>
                    </div>
                )}
            </div>

            {/* Daily Details Section */}
            {isSingleDay && data && (
                <div className="space-y-6 animate-fade-in-up">
                    <h3 className="text-2xl font-bold text-gray-800">تفاصيل الحركات اليومية</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Today's Sales Table */}
                        <div className="bg-white rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                            <div className="p-4 bg-green-50 border-b border-[var(--border-color)] flex items-center justify-between">
                                <h4 className="font-bold text-green-800 flex items-center gap-2"><ArrowUp size={18} /> مبيعات اليوم</h4>
                                <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold">{data.salesList?.length || 0} حركة</span>
                            </div>
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                <table className="w-full text-right data-table">
                                    <thead className="bg-gray-50/50 border-b border-[var(--border-color)] sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">المنتج</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">الكمية</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">السعر</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">التكلفة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {!data.salesList || data.salesList.length === 0 ? (
                                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">لا توجد مبيعات في هذا اليوم.</td></tr>
                                        ) : (
                                            data.salesList.map((sale: any, index: number) => (
                                                <tr key={index} className="hover:bg-green-50/30 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <span className="font-semibold text-gray-800 block">{sale.productName}</span>
                                                        <span className="text-xs text-gray-500">{sale.unitName}</span>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold">{sale.quantity}</td>
                                                    <td className="px-4 py-3 text-green-600">{formatCurrency(sale.price * sale.quantity)}</td>
                                                    <td className="px-4 py-3 text-red-500">{formatCurrency(sale.cost)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Today's Expenses Table */}
                        <div className="bg-white rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                            <div className="p-4 bg-orange-50 border-b border-[var(--border-color)] flex items-center justify-between">
                                <h4 className="font-bold text-orange-800 flex items-center gap-2"><Minus size={18} /> مصروفات اليوم</h4>
                                <span className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded-md font-bold">{data.expensesList?.length || 0} حركة</span>
                            </div>
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                <table className="w-full text-right data-table">
                                    <thead className="bg-gray-50/50 border-b border-[var(--border-color)] sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">البيان</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">القسم</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">المبلغ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {!data.expensesList || data.expensesList.length === 0 ? (
                                            <tr><td colSpan={3} className="p-8 text-center text-gray-400">لا توجد مصروفات مسجلة في هذا اليوم.</td></tr>
                                        ) : (
                                            data.expensesList.map((expense: any, index: number) => (
                                                <tr key={index} className="hover:bg-orange-50/30 transition-colors">
                                                    <td className="px-4 py-3 font-semibold text-gray-800">{expense.title}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">{expense.category || 'عام'}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-orange-600 font-bold">{formatCurrency(Number(expense.amount))}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <InventoryNote />
        </div>
    );
}

function InventoryNote() {
    return (
        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex gap-3 text-sm text-yellow-800">
            <AlertTriangle className="shrink-0" size={20} />
            <p>
                <strong>ملاحظة محاسبية:</strong> يتم حساب تكلفة البضاعة المباعة (COGS) بناءً على سعر التكلفة المسجل لكل منتج وقت البيع. المصروفات التشغيلية تشمل الرواتب، الإيجار، والفواتير المسجلة في قسم المصروفات.
            </p>
        </div>
    );
}

