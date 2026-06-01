'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, ChevronDown, X, LucideIcon } from 'lucide-react';

export interface HowItWorksStep {
    icon: LucideIcon;
    title: string;
    description: string;
    gradient?: string;
    shadow?: string;
}

interface HowItWorksProps {
    steps: HowItWorksStep[];
    title?: string;
    label?: string;
}

export function HowItWorks({
    steps,
    title = 'كيف يعمل هذا القسم؟',
    label = 'طريقة الاستخدام',
}: HowItWorksProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    return (
        <div className="relative" ref={ref} dir="rtl">
            {/* ── Trigger button ── */}
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 select-none border"
                style={{
                    background: open
                        ? 'linear-gradient(135deg,#094B9F,#063A8A)'
                        : 'rgba(9,75,159,0.06)',
                    borderColor: open ? 'transparent' : 'rgba(9,75,159,0.18)',
                    color: open ? '#fff' : '#094B9F',
                    boxShadow: open ? '0 4px 16px rgba(9,75,159,0.3)' : 'none',
                }}
            >
                <HelpCircle size={15} />
                <span>{label}</span>
                <ChevronDown
                    size={14}
                    className="transition-transform duration-200"
                    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </button>

            {/* ── Dropdown panel ── */}
            {open && (
                <div
                    className="absolute top-[calc(100%+10px)] left-0 z-50 w-[520px] max-w-[calc(100vw-2rem)]"
                    style={{
                        animation: 'hiw-drop 0.22s cubic-bezier(0.16,1,0.3,1) both',
                    }}
                >
                    {/* Arrow */}
                    <div
                        className="absolute -top-[7px] left-7 w-3.5 h-3.5 rotate-45"
                        style={{
                            background: 'var(--bg-card, #fff)',
                            border: '1px solid rgba(9,75,159,0.15)',
                            borderRight: 'none',
                            borderBottom: 'none',
                        }}
                    />

                    {/* Card */}
                    <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                            background: 'var(--bg-card, #fff)',
                            border: '1px solid rgba(9,75,159,0.15)',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(9,75,159,0.08)',
                        }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-5 py-4"
                            style={{
                                background: 'linear-gradient(135deg,rgba(9,75,159,0.07) 0%,rgba(139,92,246,0.05) 100%)',
                                borderBottom: '1px solid rgba(9,75,159,0.1)',
                            }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 4px 10px rgba(9,75,159,0.3)' }}
                                >
                                    <HelpCircle size={14} className="text-white" />
                                </div>
                                <h3 className="font-black text-sm" style={{ color: 'var(--text-primary,#0f172a)' }}>
                                    {title}
                                </h3>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X size={14} style={{ color: 'var(--text-muted,#94a3b8)' }} />
                            </button>
                        </div>

                        {/* Steps */}
                        <div className="p-5 flex flex-col gap-3">
                            {steps.map((step, i) => {
                                const Icon = step.icon;
                                const gradient = step.gradient ?? 'linear-gradient(135deg,#094B9F,#063A8A)';
                                const shadow = step.shadow ?? 'rgba(9,75,159,0.25)';
                                return (
                                    <div
                                        key={i}
                                        className="flex items-start gap-4 p-3.5 rounded-xl transition-colors"
                                        style={{
                                            background: 'var(--bg-page,rgba(248,250,252,0.7))',
                                            border: '1px solid rgba(0,0,0,0.04)',
                                        }}
                                    >
                                        {/* Step number + icon */}
                                        <div className="relative shrink-0">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ background: gradient, boxShadow: `0 6px 16px ${shadow}` }}
                                            >
                                                <Icon size={18} className="text-white" />
                                            </div>
                                            {/* Step badge */}
                                            <span
                                                className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 text-[9px] font-black rounded-full flex items-center justify-center text-white leading-none"
                                                style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    background: gradient,
                                                    border: '2px solid var(--bg-card,#fff)',
                                                    boxShadow: `0 2px 6px ${shadow}`,
                                                }}
                                            >
                                                {i + 1}
                                            </span>
                                        </div>

                                        {/* Text */}
                                        <div className="min-w-0 flex-1 pt-0.5">
                                            <p
                                                className="text-sm font-black leading-snug mb-1"
                                                style={{ color: 'var(--text-primary,#0f172a)' }}
                                            >
                                                {step.title}
                                            </p>
                                            <p
                                                className="text-xs leading-relaxed font-medium"
                                                style={{ color: 'var(--text-muted,#64748b)' }}
                                            >
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer tip */}
                        <div
                            className="px-5 pb-4 flex items-center gap-2"
                        >
                            <div
                                className="flex-1 h-px"
                                style={{ background: 'linear-gradient(90deg,rgba(9,75,159,0.2),transparent)' }}
                            />
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted,#94a3b8)' }}>
                                💡 انقر خارج النافذة للإغلاق
                            </span>
                            <div
                                className="flex-1 h-px"
                                style={{ background: 'linear-gradient(270deg,rgba(9,75,159,0.2),transparent)' }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Animation keyframe injected once ── */}
            <style>{`
                @keyframes hiw-drop {
                    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)    scale(1);    }
                }
            `}</style>
        </div>
    );
}
