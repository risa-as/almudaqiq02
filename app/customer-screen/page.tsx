'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, PackageSearch, CheckCircle, XCircle, Tag, Layers, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

/* ── Types ──────────────────────────────────────────────────────────── */
type State = 'idle' | 'loading' | 'found' | 'notfound';

interface ProductResult {
    name: string;
    price: number;
    unitName: string;
    baseStock: number;
    conversionFactor: number;
    categoryName?: string;
}

const RESET_AFTER_MS = 5000; // 5 ثواني ثم عودة للشاشة الاستراحة

export default function PriceCheckerPage() {
  usePageTitle('شاشة العميل');
    const router = useRouter();
    const [state, setState]     = useState<State>('idle');
    const [result, setResult]   = useState<ProductResult | null>(null);
    const [barcode, setBarcode] = useState('');
    const [countdown, setCountdown] = useState(RESET_AFTER_MS / 1000);
    const [backHover, setBackHover] = useState(false);

    // Refs for scanner detection
    const bufRef        = useRef('');
    const lastTimeRef   = useRef(0);
    const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /* ── Lookup ──────────────────────────────────────────────────────── */
    const lookup = useCallback(async (code: string) => {
        if (!code.trim()) return;
        setBarcode(code);
        setState('loading');
        cancelReset();

        try {
            const res  = await fetch(`/api/inventory/check-barcode?code=${encodeURIComponent(code)}`);
            const data = await res.json();

            if (data.found) {
                // Find the scanned unit price
                const scannedUnit = data.product.units.find((u: any) => u.barcode === code) ?? data.product.units[0];
                const stockInUnit = Math.floor(data.product.baseStock / (scannedUnit?.conversionFactor ?? 1));

                setResult({
                    name:             data.product.name,
                    price:            Number(scannedUnit?.price ?? 0),
                    unitName:         scannedUnit?.name ?? '',
                    baseStock:        stockInUnit,
                    conversionFactor: scannedUnit?.conversionFactor ?? 1,
                    categoryName:     data.product.categoryName,
                });
                setState('found');
            } else {
                setResult(null);
                setState('notfound');
            }
        } catch {
            setResult(null);
            setState('notfound');
        }

        scheduleReset();
    }, []);

    /* ── Auto-reset ─────────────────────────────────────────────────── */
    const cancelReset = () => {
        if (resetTimerRef.current) { clearTimeout(resetTimerRef.current);  resetTimerRef.current = null; }
        if (cdIntervalRef.current) { clearInterval(cdIntervalRef.current); cdIntervalRef.current = null; }
        setCountdown(RESET_AFTER_MS / 1000);
    };

    const scheduleReset = () => {
        cancelReset();
        setCountdown(RESET_AFTER_MS / 1000);

        cdIntervalRef.current = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { if (cdIntervalRef.current) clearInterval(cdIntervalRef.current); return 0; }
                return c - 1;
            });
        }, 1000);

        resetTimerRef.current = setTimeout(() => {
            setState('idle');
            setResult(null);
            setBarcode('');
            setCountdown(RESET_AFTER_MS / 1000);
        }, RESET_AFTER_MS);
    };

    /* ── Scanner Listener ───────────────────────────────────────────── */
    useEffect(() => {
        const SCANNER_MS = 80;

        const flush = () => {
            const code = bufRef.current.trim();
            bufRef.current  = '';
            lastTimeRef.current = 0;
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            if (code.length >= 3) lookup(code);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.length !== 1 && e.key !== 'Enter') return;

            if (e.key === 'Enter') {
                if (bufRef.current.length >= 3) { e.preventDefault(); flush(); }
                return;
            }

            e.preventDefault();
            const now   = Date.now();
            const delta = now - lastTimeRef.current;
            lastTimeRef.current = now;

            // Fast consecutive chars → scanner
            if (delta < SCANNER_MS || bufRef.current.length > 0) {
                bufRef.current += e.key;
            } else {
                bufRef.current = e.key;
            }

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(flush, 200);
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            if (timerRef.current)      clearTimeout(timerRef.current);
            cancelReset();
        };
    }, [lookup]);

    /* ── Stock indicator ─────────────────────────────────────────────── */
    const stockLevel = result
        ? result.baseStock <= 0  ? 'empty'
        : result.baseStock <= 5  ? 'low'
        : 'ok'
        : 'ok';

    const stockConfig = {
        empty: { label: 'نفد من المخزون', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
        low:   { label: `متوفر — ${result?.baseStock} فقط`, cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
        ok:    { label: `متوفر — ${result?.baseStock} وحدة`, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    };

    /* ── UI ──────────────────────────────────────────────────────────── */
    return (
        <div
            className="min-h-screen flex flex-col items-center justify-between overflow-hidden select-none"
            style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)' }}
            dir="rtl"
        >
            <style>{`
                @keyframes scanPulse {
                    0%,100% { opacity:.4; transform:scaleX(1);    }
                    50%     { opacity:1;  transform:scaleX(1.04); }
                }
                @keyframes resultIn {
                    from { opacity:0; transform:translateY(20px) scale(.96); }
                    to   { opacity:1; transform:translateY(0)     scale(1);  }
                }
                @keyframes spin360 { to { transform:rotate(360deg); } }
                @keyframes idleFloat {
                    0%,100% { transform:translateY(0); }
                    50%     { transform:translateY(-12px); }
                }
                @keyframes glowPulse {
                    0%,100% { box-shadow: 0 0 40px rgba(9,75,159,.25); }
                    50%     { box-shadow: 0 0 80px rgba(9,75,159,.55); }
                }
            `}</style>

            {/* ── Top Bar ─────────────────────────────────────────── */}
            <div className="w-full flex items-center justify-between px-10 pt-8">
                <div className="flex items-center gap-4">
                    <img
                        src="/logo.png" alt="logo"
                        className="h-12 object-contain opacity-90"
                        onError={e => e.currentTarget.style.display = 'none'}
                    />
                    <div>
                        <p className="text-white/90 font-black text-xl tracking-wide">فاحص الأسعار</p>
                        <p className="text-blue-300/70 text-xs font-medium">Price Checker</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Back button */}
                    <button
                        onClick={() => router.back()}
                        onMouseEnter={() => setBackHover(true)}
                        onMouseLeave={() => setBackHover(false)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold transition-all duration-200"
                        style={{
                            background: backHover ? 'rgba(9,75,159,.28)' : 'rgba(9,75,159,.10)',
                            borderColor: backHover ? 'rgba(9,75,159,.6)' : 'rgba(9,75,159,.25)',
                            color: backHover ? '#c7d2fe' : '#818cf8',
                            boxShadow: backHover ? '0 0 20px rgba(9,75,159,.25)' : 'none',
                            transform: backHover ? 'translateY(-1px)' : 'none',
                        }}
                    >
                        <ArrowRight size={15} />
                        رجوع
                    </button>

                    {/* Scan indicator */}
                    <div
                        className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-bold"
                        style={{ background: 'rgba(9,75,159,.15)', borderColor: 'rgba(9,75,159,.35)', color: '#93C5FD' }}
                    >
                        <ScanLine size={16} style={{ animation: 'scanPulse 2s ease-in-out infinite' }} />
                        امسح الباركود
                    </div>
                </div>
            </div>

            {/* ── Center Stage ────────────────────────────────────── */}
            <div className="flex-1 w-full flex items-center justify-center px-10 py-8">

                {/* IDLE */}
                {state === 'idle' && (
                    <div className="text-center" style={{ animation: 'resultIn .4s ease both' }}>
                        <div
                            className="w-44 h-44 rounded-[2.5rem] mx-auto mb-10 flex items-center justify-center relative"
                            style={{
                                background: 'linear-gradient(135deg,rgba(9,75,159,.25),rgba(14,99,212,.25))',
                                border: '2px solid rgba(9,75,159,.3)',
                                animation: 'idleFloat 4s ease-in-out infinite, glowPulse 4s ease-in-out infinite',
                            }}
                        >
                            <div
                                className="absolute inset-0 rounded-[2.5rem] opacity-20"
                                style={{ background: 'linear-gradient(135deg,rgba(255,255,255,.3) 0%,transparent 60%)' }}
                            />
                            <ScanLine size={72} className="text-blue-300 relative z-10" />
                        </div>
                        <p className="text-white/80 font-black text-4xl mb-3">قرّب المنتج من القارئ</p>
                        <p className="text-blue-300/60 text-lg font-medium">سيظهر السعر والتفاصيل فوراً</p>
                    </div>
                )}

                {/* LOADING */}
                {state === 'loading' && (
                    <div className="text-center" style={{ animation: 'resultIn .25s ease both' }}>
                        <div
                            className="w-24 h-24 rounded-full border-4 border-blue-500/30 border-t-blue-400 mx-auto mb-8"
                            style={{ animation: 'spin360 .8s linear infinite' }}
                        />
                        <p className="text-white/70 font-bold text-2xl">جاري البحث...</p>
                        <p className="text-blue-300/50 text-base mt-2 font-mono">{barcode}</p>
                    </div>
                )}

                {/* FOUND */}
                {state === 'found' && result && (
                    <div
                        className="w-full max-w-3xl rounded-3xl p-1 relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg,rgba(9,75,159,.15),rgba(14,99,212,.15))',
                            border: '2px solid rgba(9,75,159,.35)',
                            animation: 'resultIn .4s cubic-bezier(0.34,1.56,0.64,1) both',
                            boxShadow: '0 0 80px rgba(9,75,159,.2)',
                        }}
                    >
                        {/* Shimmer top */}
                        <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(165,180,252,.6),transparent)' }} />

                        <div className="p-10">
                            {/* Category + stock */}
                            <div className="flex items-center gap-3 mb-7 flex-wrap">
                                {result.categoryName && (
                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border" style={{ background: 'rgba(9,75,159,.2)', borderColor: 'rgba(9,75,159,.4)', color: '#93C5FD' }}>
                                        <Layers size={11} /> {result.categoryName}
                                    </span>
                                )}
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${stockConfig[stockLevel].cls}`}>
                                    {stockLevel === 'empty'
                                        ? <XCircle size={11} />
                                        : <CheckCircle size={11} />}
                                    {stockConfig[stockLevel].label}
                                </span>
                            </div>

                            {/* Product name */}
                            <h1 className="text-white font-black leading-tight mb-8"
                                style={{ fontSize: result.name.length > 30 ? '2.8rem' : '3.5rem', lineHeight: 1.15 }}>
                                {result.name}
                            </h1>

                            {/* Price */}
                            <div className="flex items-end gap-6 flex-wrap">
                                <div>
                                    <p className="text-blue-300/70 text-sm font-bold mb-1 flex items-center gap-1.5">
                                        <Tag size={13} /> السعر للـ {result.unitName}
                                    </p>
                                    <p
                                        className="font-black text-white"
                                        style={{
                                            fontSize: '5.5rem',
                                            lineHeight: 1,
                                            textShadow: '0 0 40px rgba(165,180,252,.5)',
                                        }}
                                    >
                                        {formatCurrency(result.price)}
                                    </p>
                                </div>

                                {/* Barcode display */}
                                <div className="pb-2 mr-auto">
                                    <p className="text-white/20 text-xs font-mono mb-1">باركود</p>
                                    <p className="text-white/40 font-mono text-xl tracking-widest">{barcode}</p>
                                </div>
                            </div>
                        </div>

                        {/* Countdown bar */}
                        <div className="mx-6 mb-6 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                            <div
                                className="h-full rounded-full"
                                style={{
                                    background: 'linear-gradient(90deg,#094B9F,#063A8A)',
                                    width: `${(countdown / (RESET_AFTER_MS / 1000)) * 100}%`,
                                    transition: 'width 1s linear',
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* NOT FOUND */}
                {state === 'notfound' && (
                    <div
                        className="w-full max-w-2xl rounded-3xl p-10 text-center"
                        style={{
                            background: 'rgba(239,68,68,.08)',
                            border: '2px solid rgba(239,68,68,.25)',
                            animation: 'resultIn .35s cubic-bezier(0.34,1.56,0.64,1) both',
                        }}
                    >
                        <div className="w-24 h-24 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-7">
                            <PackageSearch size={48} className="text-red-400" />
                        </div>
                        <p className="text-white font-black text-4xl mb-3">المنتج غير موجود</p>
                        <p className="text-white/50 text-lg font-medium mb-4">لم يتم العثور على باركود:</p>
                        <p className="text-red-400/80 font-mono text-2xl tracking-widest">{barcode}</p>

                        {/* Countdown bar */}
                        <div className="mt-8 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                            <div
                                className="h-full rounded-full bg-red-500/60"
                                style={{
                                    width: `${(countdown / (RESET_AFTER_MS / 1000)) * 100}%`,
                                    transition: 'width 1s linear',
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom Bar ───────────────────────────────────────── */}
            <div className="w-full px-10 pb-8 flex items-center justify-between">
                <p className="text-white/20 text-xs font-medium">
                    {new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                {(state === 'found' || state === 'notfound') && (
                    <p className="text-white/30 text-xs font-medium">
                        إعادة تعيين خلال {countdown} ثانية
                    </p>
                )}
                <p className="text-white/20 text-xs font-medium">Albayan ERP</p>
            </div>
        </div>
    );
}
