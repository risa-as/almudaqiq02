import React from 'react';
import { Search } from 'lucide-react';

interface FilterBarProps {
    search?: string;
    onSearch?: (v: string) => void;
    placeholder?: string;
    children?: React.ReactNode;  // extra filter controls (selects, date pickers, etc.)
    actions?: React.ReactNode;   // right-side action buttons
}

export default function FilterBar({
    search,
    onSearch,
    placeholder = 'بحث...',
    children,
    actions,
}: FilterBarProps) {
    return (
        <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 p-4 rounded-2xl"
            style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(226,232,240,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
        >
            {/* Search */}
            {onSearch !== undefined && (
                <div className="relative flex-1 min-w-48">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        placeholder={placeholder}
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm font-semibold outline-none transition-all duration-200"
                        style={{
                            background: '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            color: '#0f172a',
                        }}
                    />
                </div>
            )}

            {/* Extra filters */}
            {children && (
                <div className="flex items-center gap-3 flex-wrap">
                    {children}
                </div>
            )}

            {/* Actions */}
            {actions && (
                <div className="flex items-center gap-2 sm:mr-auto flex-wrap">
                    {actions}
                </div>
            )}
        </div>
    );
}
