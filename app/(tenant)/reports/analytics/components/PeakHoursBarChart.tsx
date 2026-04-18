import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface PeakHoursBarChartProps {
    data: { hour: string; sales: number }[];
}

export default function PeakHoursBarChart({ data }: PeakHoursBarChartProps) {
    if (!data || data.length === 0) return null;

    // Find the max value to highlight the peak hour
    const maxSales = Math.max(...data.map(d => d.sales));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 text-right" dir="rtl">
                    <p className="font-bold text-gray-800 mb-1">الساعة: <span dir="ltr">{label}</span></p>
                    <p className="text-sm font-semibold text-gray-600">
                        حجم المبيعات: {formatCurrency(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-[20px] shadow-card border border-gray-100 p-6 flex flex-col h-[400px]">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Clock size={20} className="text-orange-500" />
                    أوقات الذروة (حسب الساعة)
                </h3>
                <p className="text-xs text-gray-500 mt-1">توزيع حجم المبيعات على ساعات اليوم لتنظيم العمليات</p>
            </div>

            <div className="flex-1 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="hour"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                            dy={10}
                            interval={2} // Show every 2nd hour for cleaner UI
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                            dx={-10}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.sales === maxSales ? '#f97316' : '#fdba74'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
