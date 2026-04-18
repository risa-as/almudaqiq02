'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Printer, Search, Plus, Minus, FileText, Tag, Filter, ArrowRight } from 'lucide-react';
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
    categoryId?: number;
    category?: { name: string };
}

interface LabelToPrint {
    productName: string;
    price: number;
    barcode: string;
    quantity: number;
}

export default function PrintLabelsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedLabels, setSelectedLabels] = useState<LabelToPrint[]>([]);
    const printAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchProducts();

        // Dynamically load bwip-js for barcode generation
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/bwip-js/3.0.5/bwip-js-min.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLabel = (productName: string, price: number, barcode: string | null) => {
        if (!barcode) {
            toast.success('هذه الوحدة لا تملك باركود مسجل.');
            return;
        }

        setSelectedLabels(prev => {
            const existing = prev.find(l => l.barcode === barcode);
            if (existing) {
                return prev.map(l => l.barcode === barcode ? { ...l, quantity: l.quantity + 1 } : l);
            }
            return [...prev, { productName, price, barcode, quantity: 1 }];
        });
    };

    const handleQuantityChange = (barcode: string, quantity: number) => {
        if (quantity < 1) return;
        setSelectedLabels(prev => prev.map(l => l.barcode === barcode ? { ...l, quantity } : l));
    };

    const handleRemoveLabel = (barcode: string) => {
        setSelectedLabels(prev => prev.filter(l => l.barcode !== barcode));
    };

    const handlePrint = () => {
        if (selectedLabels.length === 0) return;

        // Ensure bwipjs is loaded
        if (typeof window !== 'undefined' && (window as any).bwipjs) {
            // Draw all barcodes
            selectedLabels.forEach(label => {
                for (let i = 0; i < label.quantity; i++) {
                    try {
                        let canvasId = `barcode-${label.barcode}-${i}`;
                        (window as any).bwipjs.toCanvas(canvasId, {
                            bcid: 'code128',       // Barcode type
                            text: label.barcode,    // Text to encode
                            scale: 2,               // 2x scaling factor
                            height: 10,              // Bar height, in millimeters
                            includetext: true,            // Show human-readable text
                            textxalign: 'center',        // Always good to set this
                        });
                    } catch (e) {
                        console.error('Barcode generation error', e);
                    }
                }
            });

            // Call print after a short delay to allow rendering
            setTimeout(() => {
                window.print();
            }, 500);
        } else {
            toast.success('انتظر قليلاً حتى يتم تحميل مكتبة الباركود.');
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    // Explode labels based on quantity for rendering the print grid
    const labelsGrid = selectedLabels.flatMap(label =>
        Array.from({ length: label.quantity }).map((_, i) => ({ ...label, instanceId: i }))
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden" dir="rtl">
            <div className="bg-white border-b border-gray-200 h-16 flex items-center px-6 shadow-sm z-20 no-print gap-4">
                <button
                    onClick={() => router.push('/inventory')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg font-bold transition-colors"
                >
                    <ArrowRight size={18} />
                    المخزون
                </button>
                <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                    <Printer className="text-blue-600" />
                    طباعة ملصقات الباركود
                </h1>
            </div>

            <div className="flex flex-1 overflow-hidden no-print p-6 gap-6">

                {/* Left Side: Product Selection */}
                <div className="w-1/2 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <input
                            type="text"
                            placeholder="بحث عن منتج..."
                            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {loading ? (
                            <p className="text-center p-4 text-gray-400">جاري التحميل...</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {filteredProducts.map(product => (
                                    <div key={product.id} className="border border-gray-100 p-3 rounded-xl hover:border-blue-200 transition-colors">
                                        <h3 className="font-bold text-gray-800 mb-2">{product.name}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {product.units.map(unit => (
                                                <button
                                                    key={unit.barcode}
                                                    onClick={() => handleAddLabel(product.name, unit.price, unit.barcode)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${unit.barcode ? 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'}`}
                                                    title={!unit.barcode ? 'لا يوجد باركود' : 'إضافة للطباعة'}
                                                    disabled={!unit.barcode}
                                                >
                                                    {unit.name} ({formatCurrency(unit.price)})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Selected Labels & Print Controls */}
                <div className="w-1/2 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-gray-800">الملصقات المحددة ({labelsGrid.length})</h2>
                        <button
                            onClick={handlePrint}
                            disabled={selectedLabels.length === 0}
                            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-colors disabled:opacity-50"
                        >
                            <Printer size={18} /> طباعة
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedLabels.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                <Tag size={48} className="mb-4 text-gray-200" />
                                <p>لم يتم تحديد باركودات للطباعة</p>
                            </div>
                        ) : (
                            selectedLabels.map(label => (
                                <div key={label.barcode} className="flex items-center justify-between border border-gray-200 p-3 rounded-xl bg-gray-50">
                                    <div>
                                        <h4 className="font-bold text-gray-800">{label.productName}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{label.barcode} | {formatCurrency(label.price)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                                            <button onClick={() => handleQuantityChange(label.barcode, label.quantity - 1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 font-bold">-</button>
                                            <span className="w-10 text-center font-bold">{label.quantity}</span>
                                            <button onClick={() => handleQuantityChange(label.barcode, label.quantity + 1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 font-bold">+</button>
                                        </div>
                                        <button onClick={() => handleRemoveLabel(label.barcode)} className="text-red-500 hover:text-red-700 text-sm font-bold bg-red-50 px-2 py-1 rounded">حذف</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden Print Container */}
            <div className="hidden print:block bg-white text-black" ref={printAreaRef}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            /* Standard A4 Label sheet setup (e.g., 3x8 or similar depending on label size) */
                            /* Using standard generic A4 size */
                            size: A4;
                            margin: 10mm;
                        }
                        body * {
                            visibility: hidden;
                        }
                        .print-labels-container, .print-labels-container * {
                            visibility: visible;
                        }
                        .print-labels-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            display: grid !important;
                            grid-template-columns: repeat(3, 1fr) !important;
                            gap: 5mm !important;
                            background: white;
                        }
                        .label-box {
                            border: 1px dashed #ccc;
                            padding: 10px;
                            text-align: center;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 38.1mm; /* Standard label height */
                            width: 63.5mm; /* Standard label width */
                            box-sizing: border-box;
                            page-break-inside: avoid;
                        }
                    }
                `}} />

                <div className="print-labels-container p-0 m-0">
                    {labelsGrid.map((label) => (
                        <div key={`${label.barcode}-${label.instanceId}`} className="label-box">
                            <span className="text-sm font-bold mb-1 line-clamp-1">{label.productName}</span>
                            <canvas id={`barcode-${label.barcode}-${label.instanceId}`} className="mb-1"></canvas>
                            <span className="text-sm font-black text-gray-900">{formatCurrency(label.price)}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
