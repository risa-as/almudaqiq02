'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, AlertTriangle, PackageCheck, Activity, BarChart3, Package, Wallet, Users, LayoutDashboard, History } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useBranch } from '@/contexts/BranchContext';

// Dashboard Specific Stats Interface
interface DashboardStats {
    todaySales: number;
    monthProfit: number;
    lowStockCount: number;
    activeProductsCount: number;
}

export default function ReportsDashboard() {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (branchLoading) return;
        fetchDashboardStats();
    }, [selectedBranch, branchLoading]);

    const fetchDashboardStats = async () => {
        try {
            // In a real implementation, you might have a dedicated dashboard endpoint
            // For now, we can reuse existing endpoints or mock it to show the structure
            // Fetching a quick summary (this logic would ideally be in a single lightweight API)
            const branchQuery = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `&branchId=${selectedBranch.id}` : '';
            const salesRes = await fetch(`/api/reports/sales?period=daily${branchQuery}`);
            const salesData = await salesRes.json();

            const branchParam = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `?branchId=${selectedBranch.id}` : '';
            const productsRes = await fetch(`/api/products${branchParam}`);
            const productsData = await productsRes.json();
            const lowStock = productsData.filter((p: any) => p.baseStock <= 10).length;

            setStats({
                todaySales: salesData.totalSales || 0,
                monthProfit: salesData.netProfit || 0, // Caution: mixed periods here for demo
                lowStockCount: lowStock,
                activeProductsCount: productsData.length
            });
        } catch (error) {
            console.error('Failed to load dashboard', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center mb-10 w-full max-w-5xl animate-fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="bg-purple-100 text-purple-600 p-4 rounded-2xl shadow-sm">
                        <BarChart3 size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">التقارير والإحصائيات</h1>
                        <p className="text-gray-500 text-lg mt-1 font-medium">اختر التقرير الذي تريد استعراضه</p>
                    </div>
                </div>
            </div>  {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
                </div>
            ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <DashboardCard
                        title="مبيعات اليوم"
                        value={formatCurrency(stats.todaySales)}
                        icon={TrendingUp}
                        color="blue"
                    />
                    <DashboardCard
                        title="صافي ربح اليوم"
                        value={formatCurrency(stats.monthProfit)}
                        icon={DollarSign}
                        color="green"
                    />
                    <DashboardCard
                        title="تنبيهات المخزون"
                        value={`${stats.lowStockCount} منتج`}
                        icon={AlertTriangle}
                        color="red"
                    />
                    <DashboardCard
                        title="منتجات نشطة"
                        value={`${stats.activeProductsCount}`}
                        icon={PackageCheck}
                        color="purple"
                    />
                </div>
            ) : null}

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center">
                <h3 className="text-xl font-bold text-blue-900 mb-2">مرحباً بك في نظام التقارير المطور</h3>
                <p className="text-blue-700 max-w-2xl mx-auto mb-6">
                    يمكنك الآن التنقل عبر علامات التبويب في الأعلى للوصول إلى تقارير تفصيلية للمبيعات، المخزون، والقوائم المالية الدقيقة.
                </p>
                <div className="flex justify-center">
                    <Link href="/reports/analytics" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:-translate-y-1">
                        <Activity size={20} />
                        استعراض تقارير ذكاء الأعمال (BI)
                    </Link>
                </div>
            </div>
        </div>
    );
}

function DashboardCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
    const colors: any = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600',
        purple: 'bg-purple-50 text-purple-600'
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1">
            <div className={`p-4 rounded-full ${colors[color]}`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-sm font-bold text-gray-500 mb-1">{title}</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{value}</h3>
            </div>
        </div>
    );
}
