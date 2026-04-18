'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Filter } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { useBranch } from '@/contexts/BranchContext';

// Import newly created analytics components
import KpiCards from './components/KpiCards';
import TrendAreaChart from './components/TrendAreaChart';
import CategoryPieChart from './components/CategoryPieChart';
import PeakHoursBarChart from './components/PeakHoursBarChart';
import ActionableInsights from './components/ActionableInsights';

export default function AdvancedAnalyticsPage() {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [dateFilter, setDateFilter] = useState('THIS_MONTH');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });

    useEffect(() => {
        if (branchLoading) return;
        if (dateFilter === 'CUSTOM' && (!customDates.start || !customDates.end)) return;
        fetchAnalyticsData();
    }, [dateFilter, customDates, selectedBranch, branchLoading]);

    const fetchAnalyticsData = async () => {
        setLoading(true);
        try {
            let url = '/api/reports/analytics';

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
            } else if (dateFilter === 'LAST_MONTH') {
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                end.setHours(23, 59, 59, 999);
            } else if (dateFilter === 'THIS_YEAR') {
                start = new Date(today.getFullYear(), 0, 1);
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
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderDateFilter = () => (
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 transition-shadow focus-within:ring-2 focus-within:ring-indigo-100">
                <Filter size={18} className="text-gray-400" />
                <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-gray-800 focus:ring-0 outline-none cursor-pointer w-full"
                >
                    <option value="TODAY">اليوم</option>
                    <option value="YESTERDAY">الأمس</option>
                    <option value="THIS_MONTH">هذا الشهر</option>
                    <option value="LAST_MONTH">الشهر الماضي</option>
                    <option value="THIS_YEAR">هذا العام</option>
                    <option value="CUSTOM">فترة مخصصة</option>
                </select>
            </div>

            {dateFilter === 'CUSTOM' && (
                <div className="flex items-center gap-2 animate-fade-in bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                    <input
                        type="date"
                        className="px-3 py-1.5 border-none bg-transparent rounded-lg text-sm text-gray-700 font-medium focus:ring-2 focus:ring-indigo-100 outline-none"
                        value={customDates.start}
                        onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                    />
                    <span className="text-gray-300">-</span>
                    <input
                        type="date"
                        className="px-3 py-1.5 border-none bg-transparent rounded-lg text-sm text-gray-700 font-medium focus:ring-2 focus:ring-indigo-100 outline-none"
                        value={customDates.end}
                        onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                    />
                </div>
            )}
        </div>
    );

    if (loading && !data) {
        return <div className="p-12 text-center text-indigo-500 font-bold bg-indigo-50 rounded-2xl border border-indigo-100 max-w-lg mx-auto mt-20 animate-pulse">جاري بناء لوحة القيادة...</div>;
    }

    if (!data && !loading) {
        return <div className="p-12 text-center text-red-500 font-bold bg-red-50 rounded-2xl border border-red-100 max-w-lg mx-auto mt-20">عفواً، فشل تحميل الإحصائيات التحليلية.</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            <PageHeader
                title="لوحة القيادة التحليلية"
                subtitle="ملخص تنفيذي لسلوك المبيعات، الأرباح، والمنتجات."
                icon={Activity}
                actions={renderDateFilter()}
            />

            <div className="animate-fade-in-up space-y-6">
                {/* Top Row: KPIs */}
                <KpiCards data={data.kpis} />

                {/* Dashboard Grid Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <TrendAreaChart data={data.trendData} />
                    </div>
                    <div className="lg:col-span-1">
                        <CategoryPieChart data={data.categoryData} />
                    </div>
                </div>

                {/* Third Row: Peak Hours */}
                <PeakHoursBarChart data={data.hourlyData} />

                {/* Bottom Row: Actionable Insights */}
                <ActionableInsights data={data.insights} />
            </div>
        </div>
    );
}
