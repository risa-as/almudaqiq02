import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface CategoryPieChartProps {
    data: { name: string; value: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
    if (!data || data.length === 0) return null;

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 text-right" dir="rtl">
                    <p className="font-bold text-gray-800 mb-1">{payload[0].name}</p>
                    <p className="text-sm font-semibold text-gray-600">
                        {formatCurrency(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-[20px] shadow-card border border-gray-100 p-6 flex flex-col h-[400px]">
            <div className="mb-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <PieChartIcon size={20} className="text-purple-500" />
                    المبيعات حسب القسم
                </h3>
                <p className="text-xs text-gray-500 mt-1">توزيع الإيرادات على الأقسام المختلفة</p>
            </div>

            <div className="flex-1 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', right: '-10px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
