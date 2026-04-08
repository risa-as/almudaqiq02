import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon: LucideIcon;
    gradient?: string;   // Tailwind gradient classes or CSS gradient string
    actions?: React.ReactNode;
}

export default function PageHeader({
    title,
    subtitle,
    icon: Icon,
    gradient = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    actions
}: PageHeaderProps) {
    const isCSS = gradient.includes('(');

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
                {/* Icon badge */}
                <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                    style={{
                        background: isCSS ? gradient : undefined,
                        boxShadow: '0 8px 24px rgba(99,102,241,0.25)',
                    }}
                >
                    {!isCSS && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                    )}
                    <div className="absolute inset-0 opacity-30"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
                    <Icon size={22} className="text-white relative z-10" />
                </div>

                <div>
                    <h1
                        className="text-2xl font-black"
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-sm mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            {actions && (
                <div className="flex items-center gap-3 flex-wrap">
                    {actions}
                </div>
            )}
        </div>
    );
}
