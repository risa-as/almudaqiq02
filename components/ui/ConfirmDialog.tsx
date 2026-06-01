'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, Info, X, LogOut } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'logout';

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
    onConfirm: () => void;
    onCancel: () => void;
}

const variants: Record<ConfirmVariant, { icon: React.ElementType; iconBg: string; iconColor: string; btn: string }> = {
    danger:  { icon: Trash2,         iconBg: 'bg-red-100',    iconColor: 'text-red-600',    btn: 'bg-red-600 hover:bg-red-700 shadow-red-200/60' },
    warning: { icon: AlertTriangle,  iconBg: 'bg-blue-100',  iconColor: 'text-blue-600',  btn: 'bg-blue-500 hover:bg-blue-600 shadow-blue-200/60' },
    info:    { icon: Info,           iconBg: 'bg-blue-100', iconColor: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200/60' },
    logout:  { icon: LogOut,         iconBg: 'bg-slate-100',  iconColor: 'text-slate-600',  btn: 'bg-slate-700 hover:bg-slate-800 shadow-slate-200/60' },
};

export function ConfirmDialog({
    open, title, message,
    confirmLabel = 'تأكيد', cancelLabel = 'إلغاء',
    variant = 'warning',
    onConfirm, onCancel,
}: ConfirmDialogProps) {
    // Portal target is only available after mount (avoids SSR mismatch).
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!open || !mounted) return null;

    const cfg = variants[variant];
    const Icon = cfg.icon;

    const content = (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={onCancel}
        >
            <style>{`
                @keyframes confirmPop {
                    from { opacity:0; transform:scale(0.82) translateY(12px); }
                    to   { opacity:1; transform:scale(1)    translateY(0);     }
                }
            `}</style>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                style={{ animation: 'confirmPop 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }}
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Top accent line */}
                <div className={`h-1 w-full ${variant === 'danger' ? 'bg-red-500' : variant === 'logout' ? 'bg-slate-500' : variant === 'info' ? 'bg-blue-500' : 'bg-blue-400'}`} />

                {/* Body */}
                <div className="flex items-start gap-4 px-6 pt-5 pb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                        <Icon size={21} className={cfg.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="font-black text-gray-900 text-[15px] leading-snug">{title}</h3>
                        <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">{message}</p>
                    </div>
                    <button onClick={onCancel} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5">
                        <X size={17} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 px-6 pb-6 pt-1">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all active:scale-95"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${cfg.btn}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );

    // Render at <body> level so no ancestor's transform/overflow/opacity can
    // clip the fixed backdrop (was leaving an un-blurred strip at the bottom).
    return createPortal(content, document.body);
}
