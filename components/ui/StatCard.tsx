import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    gradient?: string;       // CSS gradient for icon bg
    valueColor?: string;
    trend?: { direction: 'up' | 'down' | 'neutral'; label?: string };
    onClick?: () => void;
    highlight?: boolean;
}

export default function StatCard({
    label,
    value,
    icon: Icon,
    gradient = 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)',
    valueColor,
    trend,
    onClick,
    highlight = false,
}: StatCardProps) {
    const TrendIcon = trend?.direction === 'up'
        ? TrendingUp
        : trend?.direction === 'down'
            ? TrendingDown
            : Minus;

    const trendColor = trend?.direction === 'up'
        ? 'var(--value-positive)'
        : trend?.direction === 'down'
            ? 'var(--value-negative)'
            : 'var(--value-muted)';

    return (
        <div
            className={`stat-card flex items-start gap-4 ${onClick ? 'cursor-pointer' : ''}`}
            style={highlight ? { borderRight: '3px solid var(--color-primary)' } : {}}
            onClick={onClick}
        >
            {/* Icon */}
            <div
                className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center relative overflow-hidden"
                style={{ background: gradient, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
            >
                <div className="absolute inset-0 opacity-25"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 50%)' }} />
                <Icon size={22} className="text-white relative z-10" />
            </div>

            <div className="flex-1 min-w-0">
                <p className="stat-card-label">{label}</p>
                <p className="stat-card-value" style={valueColor ? { color: valueColor } : {}}>{value}</p>
                {trend && (
                    <div className="flex items-center gap-1 mt-1.5">
                        <TrendIcon size={12} style={{ color: trendColor }} />
                        <p className="text-xs font-bold" style={{ color: trendColor }}>
                            {trend.label}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
