'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/query/fetcher';
import { Activity } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { useBranch } from '@/contexts/BranchContext';

// Import newly created analytics components
import KpiCards from './components/KpiCards';
import TrendAreaChart from './components/TrendAreaChart';
import CategoryPieChart from './components/CategoryPieChart';
import PeakHoursBarChart from './components/PeakHoursBarChart';
import ActionableInsights from './components/ActionableInsights';

export default function AdvancedAnalyticsPage() {
  usePageTitle('التحليلات المتقدمة');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate,   setEndDate]   = useState(() => new Date().toISOString().split('T')[0]);

    const bId = selectedBranch?.id ?? 'all';
    const analyticsQuery = useQuery({
        queryKey: ['report-analytics', bId, startDate, endDate],
        queryFn: () => {
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end   = new Date(endDate);   end.setHours(23, 59, 59, 999);
            let url = `/api/reports/analytics?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
            if (selectedBranch?.id && selectedBranch.id !== 'all') {
                url += `&branchId=${selectedBranch.id}`;
            }
            return fetchJson<any>(url);
        },
        enabled: !branchLoading,
        placeholderData: (prev) => prev,
    });
    const data = analyticsQuery.data ?? null;
    const loading = analyticsQuery.isFetching;
    const initialized = !(branchLoading || analyticsQuery.isPending);

    if (!initialized) {
        return (
            <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 min-h-screen" dir="rtl">
                <style>{`
                    @keyframes shimmer {
                        0%   { background-position: -600px 0; }
                        100% { background-position:  600px 0; }
                    }
                    @keyframes dashPulse {
                        0%, 100% { opacity: 1; }
                        50%       { opacity: 0.3; }
                    }
                    @keyframes iconSpin {
                        0%   { transform: rotate(0deg)   scale(1);    }
                        50%  { transform: rotate(180deg) scale(1.08); }
                        100% { transform: rotate(360deg) scale(1);    }
                    }
                    .sk {
                        background: linear-gradient(90deg, #f1f5f9 25%, #e8edf5 50%, #f1f5f9 75%);
                        background-size: 600px 100%;
                        animation: shimmer 1.6s infinite linear;
                        border-radius: 0.75rem;
                    }
                `}</style>

                {/* ── Hero loader ── */}
                <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 12px 40px rgba(9,75,159,0.4)' }}>
                            <div className="absolute inset-0 opacity-25"
                                style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                            <Activity size={36} className="text-white relative z-10"
                                style={{ animation: 'iconSpin 2.4s ease-in-out infinite' }} />
                        </div>
                        {/* Orbiting dot */}
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 2px 8px rgba(14,99,212,0.5)', animation: 'dashPulse 1.2s ease-in-out infinite' }} />
                    </div>

                    <div className="text-center space-y-1.5">
                        <p className="text-xl font-black text-slate-800">جاري بناء لوحة القيادة</p>
                        <div className="flex items-center justify-center gap-1.5">
                            {[0, 0.2, 0.4].map((delay, i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                    style={{ animation: `dashPulse 1.2s ease-in-out ${delay}s infinite` }} />
                            ))}
                        </div>
                        <p className="text-sm text-slate-400 font-medium">يتم تحليل البيانات وإعداد التقارير</p>
                    </div>
                </div>

                {/* ── KPI cards skeleton ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-2xl p-5 space-y-3 overflow-hidden"
                            style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                            <div className="flex items-center justify-between">
                                <div className="sk h-3 w-24" />
                                <div className="sk w-9 h-9 rounded-xl" />
                            </div>
                            <div className="sk h-8 w-28" />
                            <div className="sk h-2.5 w-20" />
                        </div>
                    ))}
                </div>

                {/* ── Chart row skeleton ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 rounded-2xl p-5 space-y-4"
                        style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                        <div className="flex items-center justify-between">
                            <div className="sk h-4 w-32" />
                            <div className="sk h-7 w-24 rounded-lg" />
                        </div>
                        {/* Chart area */}
                        <div className="relative h-56 rounded-xl overflow-hidden sk" />
                    </div>
                    <div className="lg:col-span-1 rounded-2xl p-5 space-y-4"
                        style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                        <div className="sk h-4 w-24" />
                        <div className="sk h-44 w-44 rounded-full mx-auto" />
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="sk w-2.5 h-2.5 rounded-full" />
                                    <div className="sk h-3 flex-1" />
                                    <div className="sk h-3 w-10" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Bar chart skeleton ── */}
                <div className="rounded-2xl p-5 space-y-4"
                    style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                    <div className="sk h-4 w-36" />
                    <div className="flex items-end gap-2 h-36">
                        {[60, 85, 45, 70, 95, 55, 78, 40, 88, 62, 73, 50].map((h, i) => (
                            <div key={i} className="sk flex-1 rounded-t-lg"
                                style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
                        ))}
                    </div>
                </div>

                {/* ── Insights skeleton ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-2xl p-5 space-y-3"
                            style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                            <div className="flex items-center gap-2">
                                <div className="sk w-8 h-8 rounded-lg" />
                                <div className="sk h-3.5 flex-1" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="sk h-3 w-full" />
                                <div className="sk h-3 w-4/5" />
                                <div className="sk h-3 w-3/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data && !loading) {
        return <div className="p-12 text-center text-red-500 font-bold bg-red-50 rounded-2xl border border-red-100 max-w-lg mx-auto mt-20">عفواً، فشل تحميل الإحصائيات التحليلية.</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 min-h-screen" style={{ background: 'var(--bg-page)' }} dir="rtl">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}
            <PageHeader
                title="لوحة القيادة التحليلية"
                subtitle="ملخص تنفيذي لسلوك المبيعات، الأرباح، والمنتجات."
                icon={Activity}
                actions={<DateRangeFilter accentColor="indigo" defaultPreset="this_month" onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />}
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
