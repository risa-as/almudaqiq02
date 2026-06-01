'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export interface DatePreset {
    key: string;
    label: string;
    getRange: () => { s: string; e: string };
}

const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

export const DEFAULT_PRESETS: DatePreset[] = [
    {
        key: 'today',
        label: 'اليوم',
        getRange: () => ({ s: today(), e: today() }),
    },
    {
        key: 'yesterday',
        label: 'الأمس',
        getRange: () => ({ s: daysAgo(1), e: daysAgo(1) }),
    },
    {
        key: 'this_week',
        label: 'هذا الأسبوع',
        getRange: () => ({ s: daysAgo(6), e: today() }),
    },
    {
        key: 'this_month',
        label: 'هذا الشهر',
        getRange: () => {
            const d = new Date();
            return { s: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0], e: today() };
        },
    },
    {
        key: 'last_month',
        label: 'الشهر الماضي',
        getRange: () => {
            const d = new Date();
            const f = new Date(d.getFullYear(), d.getMonth() - 1, 1);
            const t = new Date(d.getFullYear(), d.getMonth(), 0);
            return { s: f.toISOString().split('T')[0], e: t.toISOString().split('T')[0] };
        },
    },
    {
        key: 'this_year',
        label: 'هذا العام',
        getRange: () => ({ s: `${new Date().getFullYear()}-01-01`, e: today() }),
    },
];

interface Props {
    presets?: DatePreset[];
    defaultPreset?: string;
    accentColor?: string;
    onChange: (startDate: string, endDate: string) => void;
}

export function DateRangeFilter({
    presets = DEFAULT_PRESETS,
    defaultPreset = 'this_month',
    accentColor = 'indigo',
    onChange,
}: Props) {
    const initial = presets.find(p => p.key === defaultPreset) ?? presets[0];
    const [activeKey, setActiveKey] = useState(initial.key);
    const [custom,    setCustom]    = useState(false);
    const [startDate, setStartDate] = useState(() => initial.getRange().s);
    const [endDate,   setEndDate]   = useState(() => initial.getRange().e);

    useEffect(() => {
        onChange(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectPreset = (p: DatePreset) => {
        const r = p.getRange();
        setActiveKey(p.key);
        setCustom(false);
        setStartDate(r.s);
        setEndDate(r.e);
        onChange(r.s, r.e);
    };

    const applyCustom = (s: string, e: string) => {
        setStartDate(s);
        setEndDate(e);
        onChange(s, e);
    };

    // Active filter pill uses the system primary gold (#094B9F) with bold white text.
    // `accentColor` is kept for API compatibility but no longer changes the hue.
    void accentColor;
    const ACTIVE_STYLE = { background: '#094B9F', color: '#fff', fontWeight: 700 } as const;

    return (
        <div className="flex flex-wrap items-center gap-2" dir="rtl">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                {presets.map(p => {
                    const isActive = !custom && activeKey === p.key;
                    return (
                        <button type="button" key={p.key}
                            onClick={() => selectPreset(p)}
                            style={isActive ? ACTIVE_STYLE : undefined}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                isActive ? 'shadow-sm' : 'text-gray-500 hover:text-gray-800'
                            }`}>
                            {p.label}
                        </button>
                    );
                })}
                <button
                    type="button"
                    onClick={() => { setCustom(true); setActiveKey(''); }}
                    style={custom ? ACTIVE_STYLE : undefined}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        custom ? 'shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    <Calendar size={11} />
                    مخصص
                </button>
            </div>

            {custom && (
                <div className="flex items-center gap-2">
                    <input type="date" value={startDate}
                        onChange={e => applyCustom(e.target.value, endDate)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <span className="text-gray-400 text-xs">—</span>
                    <input type="date" value={endDate} min={startDate}
                        onChange={e => applyCustom(startDate, e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                </div>
            )}
        </div>
    );
}
