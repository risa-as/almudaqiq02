'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useRef } from 'react';
import { Printer, Search, Tag, X, Plus, Minus, Package, Ruler, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import toast from 'react-hot-toast';

interface ProductUnit {
    name: string;
    price: number;
    barcode: string | null;
}
interface Product {
    id: number;
    name: string;
    units: ProductUnit[];
    category?: { name: string };
}
interface LabelToPrint {
    productName: string;
    price: number;
    barcode: string;
    quantity: number;
}

const LABEL_SIZES = {
    SMALL:    { label: 'صغير',       sub: '38 × 25 mm',   width: '38mm',    height: '25mm',   cols: 4, barcodeH: 6  },
    MEDIUM:   { label: 'متوسط',      sub: '57 × 32 mm',   width: '57mm',    height: '32mm',   cols: 3, barcodeH: 8  },
    STANDARD: { label: 'قياسي A4',   sub: '63.5 × 38 mm', width: '63.5mm',  height: '38.1mm', cols: 3, barcodeH: 10 },
    LARGE:    { label: 'كبير A4',    sub: '99.1 × 38 mm', width: '99.1mm',  height: '38.1mm', cols: 2, barcodeH: 10 },
    XLARGE:   { label: 'كبير جداً',  sub: '100 × 50 mm',  width: '100mm',   height: '50mm',   cols: 2, barcodeH: 14 },
} as const;

type SizeKey = keyof typeof LABEL_SIZES;

export default function PrintLabelsPage() {
  usePageTitle('طباعة الملصقات');
    const router = useRouter();
    const [products, setProducts]           = useState<Product[]>([]);
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]               = useState('');
    const [selectedLabels, setSelectedLabels] = useState<LabelToPrint[]>([]);
    const [labelSize, setLabelSize]         = useState<SizeKey>('STANDARD');
    const [bwipReady, setBwipReady]         = useState(false);

    useEffect(() => {
        fetch('/api/products').then(r => r.json()).then(d => setProducts(d)).catch(console.error).finally(() => setLoading(false));

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/bwip-js/3.0.5/bwip-js-min.js';
        script.async = true;
        script.onload = () => setBwipReady(true);
        document.body.appendChild(script);
        return () => { try { document.body.removeChild(script); } catch {} };
    }, []);

    const handleAddLabel = (productName: string, price: number, barcode: string | null) => {
        if (!barcode) { toast.error('هذه الوحدة لا تملك باركود مسجل.'); return; }
        setSelectedLabels(prev => {
            const ex = prev.find(l => l.barcode === barcode);
            if (ex) return prev.map(l => l.barcode === barcode ? { ...l, quantity: l.quantity + 1 } : l);
            return [...prev, { productName, price, barcode, quantity: 1 }];
        });
    };

    const handleQty = (barcode: string, qty: number) => {
        if (qty < 1) return;
        setSelectedLabels(prev => prev.map(l => l.barcode === barcode ? { ...l, quantity: qty } : l));
    };

    const handleRemove = (barcode: string) => setSelectedLabels(prev => prev.filter(l => l.barcode !== barcode));

    const totalLabels = selectedLabels.reduce((s, l) => s + l.quantity, 0);

    const labelsGrid = selectedLabels.flatMap(l =>
        Array.from({ length: l.quantity }).map((_, i) => ({ ...l, instanceId: i }))
    );

    const handlePrint = () => {
        if (!selectedLabels.length) return;
        if (!bwipReady || !(window as any).bwipjs) {
            toast.error('مكتبة الباركود لم تُحمَّل بعد، انتظر لحظة.'); return;
        }
        const size = LABEL_SIZES[labelSize];
        labelsGrid.forEach((label) => {
            try {
                (window as any).bwipjs.toCanvas(`bc-${label.barcode}-${label.instanceId}`, {
                    bcid: 'code128',
                    text: label.barcode,
                    scale: 2,
                    height: size.barcodeH,
                    includetext: true,
                    textxalign: 'center',
                });
            } catch (e) { console.error('Barcode error', e); }
        });
        setTimeout(() => window.print(), 500);
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    const size = LABEL_SIZES[labelSize];

    return (
        <>
            {/* ─── Print CSS ─── */}
            <style>{`
                /* ── Screen: hide print area off-screen (NOT display:none so canvas renders) ── */
                #print-area {
                    position: fixed;
                    left: -9999px;
                    top: 0;
                    pointer-events: none;
                    z-index: -1;
                }

                /* ── Print mode ── */
                @media print {
                    @page { size: A4; margin: 8mm; }

                    /* Hide ALL elements (works for any nesting depth) */
                    body * { visibility: hidden !important; }

                    /* Show only the print area and its children */
                    #print-area,
                    #print-area * { visibility: visible !important; }

                    /* Position the grid at top-left of the page */
                    #print-area {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        z-index: 99999 !important;
                        display: grid !important;
                        grid-template-columns: repeat(${size.cols}, ${size.width}) !important;
                        gap: 2mm !important;
                        align-content: start !important;
                        background: white !important;
                        padding: 0 !important;
                    }

                    .label-box {
                        border: 0.4px dashed #aaa;
                        width: ${size.width};
                        height: ${size.height};
                        box-sizing: border-box;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        padding: 1.5mm;
                        page-break-inside: avoid;
                        overflow: hidden;
                    }
                    .label-name {
                        font-size: 6.5pt;
                        font-weight: 700;
                        text-align: center;
                        margin-bottom: 0.5mm;
                        line-height: 1.2;
                        word-break: break-word;
                    }
                    .label-price {
                        font-size: 8pt;
                        font-weight: 900;
                        margin-top: 0.5mm;
                    }
                    canvas { max-width: 100%; display: block; }
                }
            `}</style>

            {/* ─── Print area: off-screen on screen, visible on print ─── */}
            <div id="print-area">
                {labelsGrid.map(label => (
                    <div key={`${label.barcode}-${label.instanceId}`} className="label-box">
                        <div className="label-name">{label.productName}</div>
                        <canvas id={`bc-${label.barcode}-${label.instanceId}`} />
                        <div className="label-price">{formatCurrency(label.price)}</div>
                    </div>
                ))}
            </div>

            {/* ─── Main UI ─── */}
            <div className="flex flex-col gap-4 h-[calc(100vh-5rem)]" dir="rtl">

                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 8px 20px rgba(9,75,159,.3)' }}>
                            <Printer className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900">طباعة ملصقات الباركود</h1>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">اختر المنتجات وحجم الملصق ثم اطبع</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/inventory')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <X size={15} />إلغاء
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={!selectedLabels.length}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 6px 20px rgba(9,75,159,.35)' }}
                        >
                            <Printer size={15} />
                            طباعة {totalLabels > 0 && `(${totalLabels})`}
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 grid grid-cols-5 gap-4 min-h-0">

                    {/* ── LEFT: Products (2 cols) ── */}
                    <div className="col-span-2 glass-panel flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/40 shrink-0"
                            style={{ background: 'linear-gradient(135deg,rgba(9,75,159,.05) 0%,transparent 60%)' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,.3)' }}>
                                <Search className="w-4 h-4 text-white" />
                            </div>
                            <h2 className="font-bold text-slate-700 text-sm">قائمة المنتجات</h2>
                        </div>

                        <div className="px-4 pt-3 pb-2 shrink-0">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="بحث عن منتج..."
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm placeholder-slate-300"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                            {loading ? (
                                <p className="text-center py-8 text-slate-300 text-sm font-bold animate-pulse">جاري التحميل...</p>
                            ) : filteredProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-200">
                                    <Package size={32} /><p className="text-xs font-bold mt-2 text-slate-300">لا توجد نتائج</p>
                                </div>
                            ) : filteredProducts.map(product => (
                                <div key={product.id} className="bg-white border border-slate-100 rounded-xl p-3 hover:border-blue-100 transition-colors">
                                    <p className="font-bold text-slate-800 text-sm mb-2">{product.name}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {product.units.map(unit => (
                                            <button
                                                key={unit.barcode ?? unit.name}
                                                onClick={() => handleAddLabel(product.name, unit.price, unit.barcode)}
                                                disabled={!unit.barcode}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                                    unit.barcode
                                                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-100'
                                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                }`}
                                                title={unit.barcode ? `إضافة: ${unit.barcode}` : 'لا يوجد باركود'}
                                            >
                                                <Tag size={10} />
                                                {unit.name} — {formatCurrency(unit.price)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── RIGHT: Settings + Queue (3 cols) ── */}
                    <div className="col-span-3 glass-panel flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/40 shrink-0"
                            style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.05) 0%,transparent 60%)' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 12px rgba(16,185,129,.3)' }}>
                                <Ruler className="w-4 h-4 text-white" />
                            </div>
                            <h2 className="font-bold text-slate-700 text-sm">حجم الملصق والقائمة</h2>
                            {totalLabels > 0 && (
                                <span className="mr-auto text-[11px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                    {totalLabels} ملصق
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">

                            {/* ── Size picker ── */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)' }}>
                                        <Ruler size={11} className="text-white" />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">حجم الملصق</span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {(Object.keys(LABEL_SIZES) as SizeKey[]).map(key => {
                                        const s = LABEL_SIZES[key];
                                        const active = labelSize === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setLabelSize(key)}
                                                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 transition-all text-center ${
                                                    active
                                                        ? 'border-blue-400 bg-blue-50'
                                                        : 'border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                                                }`}
                                            >
                                                {/* Mini label visual */}
                                                <div className={`rounded border flex items-center justify-center transition-all ${
                                                    active ? 'border-blue-300 bg-blue-100' : 'border-slate-200 bg-slate-50'
                                                }`} style={{
                                                    width: key === 'SMALL' ? 20 : key === 'MEDIUM' ? 24 : key === 'STANDARD' ? 28 : key === 'LARGE' ? 36 : 32,
                                                    height: key === 'SMALL' ? 14 : key === 'MEDIUM' ? 14 : key === 'STANDARD' ? 17 : key === 'LARGE' ? 17 : 18,
                                                }}>
                                                    {active && <CheckCircle2 size={10} className="text-blue-500" />}
                                                </div>
                                                <span className={`text-[10px] font-black leading-tight ${active ? 'text-blue-700' : 'text-slate-600'}`}>
                                                    {s.label}
                                                </span>
                                                <span className={`text-[9px] font-medium leading-none ${active ? 'text-blue-400' : 'text-slate-400'}`}>
                                                    {s.sub}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Size info strip */}
                                <div className="mt-3 flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                                    <Tag size={13} className="text-blue-400 shrink-0" />
                                    <div className="text-xs text-slate-600 font-semibold">
                                        الحجم المحدد: <span className="font-black text-blue-600">{size.label} ({size.sub})</span>
                                        <span className="mx-2 text-slate-300">|</span>
                                        {size.cols} أعمدة في الصفحة
                                        <span className="mx-2 text-slate-300">|</span>
                                        ≈ {size.cols * Math.floor(257 / parseInt(size.height))} ملصق/ورقة
                                    </div>
                                </div>
                            </div>

                            {/* ── Label queue ── */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                                        <Tag size={11} className="text-white" />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">قائمة الطباعة</span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                    {selectedLabels.length > 0 && (
                                        <button
                                            onClick={() => setSelectedLabels([])}
                                            className="text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            مسح الكل
                                        </button>
                                    )}
                                </div>

                                {selectedLabels.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-200">
                                        <Tag size={36} />
                                        <p className="text-xs font-bold mt-2 text-slate-300">أضف ملصقات من القائمة على اليمين</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedLabels.map(label => (
                                            <div key={label.barcode}
                                                className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 hover:border-blue-100 transition-colors">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <Tag size={14} className="text-blue-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 text-sm truncate">{label.productName}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] font-mono text-slate-400">{label.barcode}</span>
                                                        <span className="text-slate-200">|</span>
                                                        <span className="text-[11px] font-bold text-emerald-600">{formatCurrency(label.price)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shrink-0">
                                                    <button
                                                        onClick={() => handleQty(label.barcode, label.quantity - 1)}
                                                        className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={label.quantity}
                                                        onChange={e => {
                                                            const v = parseInt(e.target.value);
                                                            if (!isNaN(v) && v >= 1) handleQty(label.barcode, v);
                                                        }}
                                                        className="w-12 text-center text-sm font-black text-slate-700 bg-transparent outline-none border-none py-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    />
                                                    <button
                                                        onClick={() => handleQty(label.barcode, label.quantity + 1)}
                                                        className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => handleRemove(label.barcode)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
