import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { TrendingUp } from 'lucide-react';

interface TrendAreaChartProps {
    data: any[];
}

export default function TrendAreaChart({ data }: TrendAreaChartProps) {
    if (!data || data.length === 0) return null;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-gray-100 text-right" dir="rtl">
                    <p className="font-bold text-gray-800 mb-2 border-b pb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }} className="text-sm font-semibold flex justify-between gap-6 py-1">
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
        <div className="bg-white rounded-[20px] shadow-card border border-gray-100 p-6 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-500" />
                        مسار المبيعات والأرباح (Trend)
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">يعكس التقلبات خلال الفترة المحددة</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="text-xs font-bold text-gray-600">إيرادات</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span><span className="text-xs font-bold text-gray-600">أرباح</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                        <YAxis
                            axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)} مليون` : val >= 1000 ? `${(val / 1000).toFixed(0)} الف` : val}
                            dx={-10}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
