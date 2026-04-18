'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    ShoppingCart, Clock, Search, CreditCard, Trash2, XCircle, RotateCcw,
    ScanLine, Package, Plus, Minus, Home, Settings, LogOut, Grid, List, Check, Wallet, Percent, StickyNote, Printer
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ReceiptPrint, ReceiptData } from '@/components/ReceiptPrint';

import toast from 'react-hot-toast';
import { useBranch, BranchProvider } from '@/contexts/BranchContext';
// Types
interface CartItem {
    productId: number;
    unitId: number;
    name: string;
    unitName: string;
    quantity: number;
    price: number;
    barcode?: string;
}

interface Offer {
    id: number;
    name: string;
    type: string;
    value: number;
    buyQuantity: number | null;
    getQuantity: number | null;
    productId: number | null;
    categoryId: number | null;
}

interface SearchResult {
    id: number;
    name: string;
    baseStock: number;
    units: {
        unitId: number;
        unitName: string;
        price: number;
        barcode: string;
        conversionFactor?: number;
    }[];
    matchType?: 'barcode' | 'name';
}

export default function POSPage() {
    const { selectedBranch, branches, setSelectedBranch, isOwner, loading: branchLoading } = useBranch();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [barcodeBuffer, setBarcodeBuffer] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const [filterCategory, setFilterCategory] = useState<number | string | null>(null);
    const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);

    // Enterprise POS features
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [heldTickets, setHeldTickets] = useState<{ cart: CartItem[], customerId: string | null, isCredit: boolean, time: string }[]>([]);
    const [isListView, setIsListView] = useState(false);

    // Manual Discount State
    const [manualDiscountType, setManualDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('FIXED');
    const [manualDiscountValue, setManualDiscountValue] = useState<number>(0);
    const [showDiscountModal, setShowDiscountModal] = useState(false);

    const [notes, setNotes] = useState('');
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [receivedAmount, setReceivedAmount] = useState<number | ''>('');
    const [showReceivedInput, setShowReceivedInput] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // Shift Management State
    const [activeShift, setActiveShift] = useState<any>(null);
    const [shiftLoading, setShiftLoading] = useState(true);
    const [isOpeningShift, setIsOpeningShift] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');
    const [closingShiftModal, setClosingShiftModal] = useState(false);
    const [closingAmount, setClosingAmount] = useState('');
    const [closingNotes, setClosingNotes] = useState('');

    // Refund System State
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [refundSearchId, setRefundSearchId] = useState('');
    const [refundTx, setRefundTx] = useState<any>(null);
    const [refundItems, setRefundItems] = useState<{ id: number, productId: number, productName: string, unitId: number, price: number, cost: number, originalQty: number, maxQty: number, refundQty: number }[]>([]);

    // Time State for Top Bar
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);


    const formatShiftDuration = () => {
        if (!activeShift?.openedAt || !currentTime) return '00:00:00';
        const start = new Date(activeShift.openedAt).getTime();
        const now = currentTime.getTime();
        const diff = Math.floor((now - start) / 1000);
        if (diff < 0) return '00:00:00';
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    // --- Fetch Offers, Categories & Shift ---
    const branchQuery = selectedBranch?.id && selectedBranch.id !== 'all' ? `?branchId=${selectedBranch.id}` : '';
    const branchQueryAmp = selectedBranch?.id && selectedBranch.id !== 'all' ? `&branchId=${selectedBranch.id}` : '';
    useEffect(() => {
        fetch(`/api/shifts${branchQuery}`)
            .then(res => res.json())
            .then(data => {
                if (data.activeShift) setActiveShift(data.activeShift);
                setShiftLoading(false);
            })
            .catch(() => setShiftLoading(false));

        fetch(`/api/offers?active=true${branchQueryAmp}`)
            .then(res => res.json())
            .then(data => setOffers(data))
            .catch(console.error);

        // Fetch categories for touch UI filtering
        fetch(`/api/categories${branchQuery}`)
            .then(res => res.json())
            .then(data => setCategories(Array.isArray(data) ? data : (data.categories ?? [])))
            .catch(console.error);
    }, []);

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F1') { e.preventDefault(); handlePay(); }
            if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
            if (e.key === 'F3') { e.preventDefault(); setIsCredit(prev => !prev); }
            if (e.key === 'F4') {
                e.preventDefault();
                if (cart.length > 0 && selectedIndex >= 0 && selectedIndex < cart.length) {
                    const newQty = window.prompt('أدخل الكمية الجديدة:', cart[selectedIndex].quantity.toString());
                    if (newQty && !isNaN(Number(newQty))) {
                        setCart(prev => prev.map((item, i) => i === selectedIndex ? { ...item, quantity: Math.max(1, Number(newQty)) } : item));
                    }
                }
            }
            if (e.key === 'F5') {
                e.preventDefault();
                if (cart.length > 0 && selectedIndex >= 0 && selectedIndex < cart.length) {
                    const newPrice = window.prompt('أدخل السعر الجديد للتعديل السريع:', cart[selectedIndex].price.toString());
                    if (newPrice && !isNaN(Number(newPrice))) {
                        setCart(prev => prev.map((item, i) => i === selectedIndex ? { ...item, price: Number(newPrice) } : item));
                    }
                }
            }
            if (e.key === 'Insert') { e.preventDefault(); document.getElementById('customer-select')?.focus(); }
            if (e.key === 'Escape') { e.preventDefault(); handleClear(); }

            // Cart Navigation (Up/Down/Delete)
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(0, prev - 1));
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(cart.length - 1, prev + 1));
            }
            if (e.key === 'Delete') {
                e.preventDefault();
                if (cart.length > 0 && selectedIndex >= 0) {
                    removeItem(selectedIndex);
                    setSelectedIndex(prev => Math.max(0, prev - 1));
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, selectedIndex]);

    // --- Global Barcode Listener ---
    useEffect(() => {
        const handleBarcodeScan = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;
            if (e.key === 'Enter') {
                if (barcodeBuffer) { handleScan(barcodeBuffer); setBarcodeBuffer(''); }
            } else if (e.key.length === 1) {
                setBarcodeBuffer((prev) => prev + e.key);
            }
        };
        window.addEventListener('keydown', handleBarcodeScan);
        return () => window.removeEventListener('keydown', handleBarcodeScan);
    }, [barcodeBuffer]);

    // --- Customer Screen Sync ---
    useEffect(() => {
        // Safe simplified sync
        const currentTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        localStorage.setItem('customerScreenCart', JSON.stringify({ cart, total: currentTotal }));
    }, [cart]);

    // --- Instant Search & Category Filter (Debounced) ---
    useEffect(() => {
        const fetchProducts = async () => {
            // Only skip fetching if we don't want to load all items by default.
            // But we actually DO want to see items when "All" is clicked.
            // So we remove the early return that blocked it.
            try {
                let url = `/api/products${branchQuery}`;
                if (searchQuery.length >= 2) {
                    url = `/api/products/search?q=${searchQuery}${branchQueryAmp}`;
                }
                const res = await fetch(url);
                let data = await res.json();

                // If filtering by category, filter the raw or searched data
                if (filterCategory !== null) {
                    if (filterCategory === 'QUICK_ITEMS') {
                        // Virtual category: Items with barcode '0' or empty
                        data = data.filter((p: any) => p.units.some((u: any) => u.barcode === '0' || u.barcode === 0 || !u.barcode));
                    } else {
                        data = data.filter((p: any) => p.categoryId === filterCategory);
                    }
                }
                setSearchResults(data);
            } catch (err) { console.error(err); }
        };
        const timeout = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery, filterCategory]);

    // --- Actions ---
    const handleScan = async (code: string) => {
        try {
            let searchCode = code;
            let qtyToAdd = 1;

            // Handle Weight Scale Barcodes (13 digits starting with 2)
            // Typical Format: 20 IIIII WWWWW C
            if (code.length === 13 && code.startsWith('2')) {
                const itemCodeStr = code.substring(2, 7);
                const weightInGramsStr = code.substring(7, 12);
                const weightInGrams = parseInt(weightInGramsStr);

                if (!isNaN(weightInGrams)) {
                    searchCode = itemCodeStr;
                    qtyToAdd = weightInGrams / 1000; // Convert grams to KG
                }
            }

            const res = await fetch(`/api/products/search?q=${searchCode}${branchQueryAmp}`);
            const data: SearchResult[] = await res.json();

            if (data && data.length > 0) {
                // Prefer exact barcode match
                const match = data.find(p => p.units.some(u => u.barcode === searchCode)) || data[0];
                if (match) {
                    if (match.baseStock <= 0) {
                        toast(`عذراً، المنتج "${match.name}" (نفد من المخزن);!`);
                        setSearchQuery('');
                        return;
                    }
                    const unit = match.units.find(u => u.barcode === searchCode) || match.units[0];
                    addToCart(match.id, unit.unitId, match.name, unit.unitName, unit.price, qtyToAdd);
                    setSearchQuery(''); // Clear search on direct scan match
                }
            } else {
                toast('المنتج غير موجود!');
            }
        } catch (err) { console.error('Scan failed', err); }
    };

    // --- Refund Functions ---
    const handleFetchRefundTx = async () => {
        if (!refundSearchId) return;
        try {
            const res = await fetch(`/api/transactions/${refundSearchId}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            if (data.type !== 'SALE') {
                toast('عذراً، لا يمكن استرجاع هذه الفاتورة.');
                return;
            }
            setRefundTx(data);
            setRefundItems(data.items.map((it: any) => ({
                id: it.id,
                productId: it.productId,
                productName: it.product?.name || 'منتج غير معروف',
                unitId: it.unitId,
                price: Number(it.price),
                cost: Number(it.cost || 0),
                originalQty: Number(it.quantity),
                maxQty: Number(it.quantity), // Later deduct already refunded qty if tracked
                refundQty: 0
            })));
        } catch (err) {
            toast('الفاتورة غير موجودة');
        }
    };

    const handleSubmitRefund = async () => {
        const itemsToRefund = refundItems.filter(i => i.refundQty > 0);
        if (itemsToRefund.length === 0) return toast('اختر المنتجات المراد إرجاعها وضع كمية الاسترجاع');

        const refundTotal = itemsToRefund.reduce((sum, item) => sum + (item.price * item.refundQty), 0);

        if (!confirm(`هل أنت متأكد من استرجاع بقيمة ${formatCurrency(refundTotal)}؟`)) return;

        try {
            const res = await fetch('/api/transactions/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalTxId: refundTx.id,
                    items: itemsToRefund.map(item => ({
                        productId: item.productId,
                        unitId: item.unitId,
                        quantity: item.refundQty,
                        price: item.price,
                        cost: item.cost
                    })),
                    totalAmount: refundTotal,
                    paymentMethod: 'CASH',
                    paidAmount: refundTotal
                })
            });

            if (res.ok) {
                toast.success('تم إرجاع الفاتورة بنجاح وإعادة المنتجات للمخزن!');
                setRefundModalOpen(false);
                setRefundSearchId('');
                setRefundTx(null);
                setRefundItems([]);
            } else {
                const data = await res.json();
                toast.error(data.error || 'فشل الإرجاع');
            }
        } catch (err) {
            toast.error('حدث خطأ أثناء الاتصال بالخادم');
        }
    };

    const addToCart = (productId: number, unitId: number, name: string, unitName: string, price: number, qtyToAdd: number = 1) => {
        setCart((prev) => {
            const existing = prev.find(item => item.productId === productId && item.unitId === unitId);
            if (existing) {
                return prev.map(item =>
                    item.productId === productId && item.unitId === unitId
                        ? { ...item, quantity: item.quantity + qtyToAdd }
                        : item
                );
            }
            const newCart = [...prev, { productId, unitId, name, unitName, quantity: qtyToAdd, price }];
            setSelectedIndex(newCart.length - 1); // Auto-select newly added item
            return newCart;
        });

        // Auto focus back to search to be ready for next scan without mouse
        setTimeout(() => searchInputRef.current?.focus(), 50);
    };

    const updateQuantity = (idx: number, delta: number) => {
        setCart(prev => prev.map((item, i) => {
            if (i === idx) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const setQuantity = (idx: number, qty: number) => {
        setCart(prev => prev.map((item, i) => {
            if (i === idx) {
                return { ...item, quantity: Math.max(1, qty) };
            }
            return item;
        }));
    };

    const [customers, setCustomers] = useState<{ id: string, name: string }[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isCredit, setIsCredit] = useState(false);

    // Fetch Customers on Mount
    useEffect(() => {
        fetch('/api/customers').then(res => res.json()).then(data => setCustomers(data)).catch(console.error);
    }, []);

    // Reset Credit Mode when customer is deselected
    useEffect(() => {
        if (!selectedCustomerId) setIsCredit(false);
    }, [selectedCustomerId]);

    // ... (rest of search/scan logic) ...

    const handlePay = async () => {
        if (!activeShift) {
            toast('يجب فتح الوردية أولاً');
            return;
        }
        if (cart.length === 0) return;

        const confirmMsg = isCredit
            ? `تسجيل دين بقيمة ${formatCurrency(cart.reduce((s, i) => s + i.price * i.quantity, 0))} على العميل؟`
            : 'إتمام عملية الدفع النقدي؟';

        if (!confirm(confirmMsg)) return;

        // the 'totalAmount' computed below takes discounts into account.
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    shiftId: activeShift.id,
                    totalAmount,
                    customerId: selectedCustomerId,
                    isCredit,
                    discount: discountAmount,
                    notes,
                    branchId: selectedBranch?.id && selectedBranch.id !== 'all' ? selectedBranch.id : undefined,
                    paidAmount: isCredit ? (typeof receivedAmount === 'number' ? receivedAmount : 0) : (typeof receivedAmount === 'number' ? receivedAmount : totalAmount),
                    paymentMethod: isCredit ? (typeof receivedAmount === 'number' && receivedAmount > 0 ? 'SPLIT' : 'CREDIT') : 'CASH'
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.error || 'فشل إتمام عملية الدفع');
            }
            const result = await res.json();

            setLastReceipt({
                transactionId: result.transactionId,
                receiptNumber: result.receiptNumber,
                date: new Date().toISOString(),
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    unitName: item.unitName
                })),
                totalAmount,
                isCredit,
                customerName: selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : undefined
            });

            setCart([]);
            setSelectedCustomerId(null);
            setIsCredit(false);
            setManualDiscountValue(0);
            setNotes('');
            setReceivedAmount('');
            setShowReceivedInput(false);

            // Show receipt preview modal instead of auto-printing
            setShowReceiptModal(true);

        } catch (err: any) { toast.error(`❌ فشل الدفع!\nالسبب: ${err.message}`); }
    };

    const handleClear = () => {
        if (confirm('تفريغ السلة؟')) setCart([]);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const handleHold = () => {
        if (cart.length === 0) return;
        setHeldTickets(prev => [...prev, {
            cart,
            customerId: selectedCustomerId,
            isCredit,
            time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
        }]);
        setCart([]);
        setSelectedCustomerId(null);
        setIsCredit(false);
        setReceivedAmount('');
        setShowReceivedInput(false);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const handleResume = (idx: number) => {
        if (cart.length > 0) {
            if (!confirm('سلة المبيعات الحالية غير فارغة، هل تريد استبدالها بالفاتورة المعلقة؟ ستفقد المنتجات الحالية.')) return;
        }
        const ticket = heldTickets[idx];
        setCart(ticket.cart);
        setSelectedCustomerId(ticket.customerId);
        setIsCredit(ticket.isCredit);
        setHeldTickets(prev => prev.filter((_, i) => i !== idx));
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const removeItem = (idx: number) => {
        setCart((prev) => prev.filter((_, i) => i !== idx));
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    // --- Shift Functions ---
    const handleOpenShift = async () => {
        if (!openingAmount) { toast('أدخل مبلغ العهدة الافتتاحي'); return; }
        if (!selectedBranch || selectedBranch.id === 'all') { toast.error('لفتح وردية، يجب اختيار فرع محدد من الشريط العلوي (لا يمكن فتح وردية لكل الفروع)'); return; }
        try {
            const res = await fetch('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ openingAmount: Number(openingAmount), branchId: selectedBranch?.id })
            });
            const data = await res.json();
            if (data.success) {
                setActiveShift(data.shift);
                setIsOpeningShift(false);
            } else { toast(data.error); }
        } catch (e) { toast.error('فشل فتح الوردية'); }
    };

    const handleCloseShift = async () => {
        if (!closingAmount) { toast('أدخل المبلغ الموجود في الصندوق'); return; }
        if (!confirm('هل أنت متأكد من إغلاق الوردية الحالية؟')) return;

        try {
            const res = await fetch('/api/shifts/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ closingAmount: Number(closingAmount), notes: closingNotes, branchId: selectedBranch?.id })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`تم إغلاق الوردية بنجاح!\nالمبلغ المتوقع: ${formatCurrency(data.expectedAmount)}\nالفرق: ${formatCurrency(Number(closingAmount) - data.expectedAmount)}`);
                setActiveShift(null);
                setClosingShiftModal(false);
            } else { toast(data.error); }
        } catch (e) { toast.error('فشل إغلاق الوردية'); }
    };

    // --- Discount Calculation ---
    const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discountAmount = 0;

    offers.forEach(offer => {
        let applicableItems = offer.productId
            ? cart.filter(i => i.productId === offer.productId)
            : cart;

        if (applicableItems.length === 0) return;

        const applicableSubtotal = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const applicableQty = applicableItems.reduce((sum, item) => sum + item.quantity, 0);

        if (offer.type === 'FIXED_DISCOUNT') {
            discountAmount += Number(offer.value);
        } else if (offer.type === 'PERCENTAGE_DISCOUNT') {
            discountAmount += applicableSubtotal * (Number(offer.value) / 100);
        } else if (offer.type === 'BUY_X_GET_Y' && offer.buyQuantity && offer.getQuantity) {
            const bundles = Math.floor(applicableQty / (offer.buyQuantity + offer.getQuantity));
            if (bundles > 0) {
                const unitPrice = applicableItems[0].price;
                discountAmount += (unitPrice * offer.getQuantity * bundles);
            }
        }
    });

    // Add manual discount
    if (manualDiscountType === 'FIXED') {
        discountAmount += manualDiscountValue;
    } else if (manualDiscountType === 'PERCENTAGE') {
        discountAmount += subTotal * (manualDiscountValue / 100);
    }

    if (discountAmount > subTotal) discountAmount = subTotal;
    const totalAmount = subTotal - discountAmount;

    const handleLogout = async () => {
        if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    return (
        <div className="h-screen bg-gray-100 flex flex-col overflow-hidden animate-fade-in-up" dir="rtl">

            {/* Top Status Bar */}
            <div className="bg-gray-900 text-white px-6 py-1 flex justify-between items-center text-xs font-medium z-30 relative">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1.5"><Wallet size={14} className={activeShift ? "text-green-400" : "text-gray-500"} /> {activeShift ? `وردية رقم #${activeShift.id}` : 'الصندوق مغلق'}</span>
                    {activeShift && <span className="flex items-center gap-1.5"><CreditCard size={14} className="text-blue-400" /> رصيد الافتتاح: {formatCurrency(Number(activeShift.openingAmount))}</span>}
                </div>
                <div className="flex gap-4 items-center">
                    <span className="font-bold tracking-widest text-sm text-yellow-300 drop-shadow-md">
                        {currentTime ? currentTime.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                    </span>
                </div>
            </div>

            {/* Shift Opening Modal (Triggered manually) */}
            {!shiftLoading && !activeShift && isOpeningShift && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in-up">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4 text-blue-600">
                                <Wallet size={32} />
                                <h2 className="text-2xl font-extrabold text-gray-900">فتح الوردية (الدرج)</h2>
                            </div>
                            <button onClick={() => setIsOpeningShift(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <p className="text-gray-500 mb-6 font-medium">الرجاء إدخال المبلغ النقدي (العهدة) المتوفر حالياً في الصندوق لفتح الوردية وبدء المبيعات.</p>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">الرصيد الافتتاحي (دينار)</label>
                            <input
                                type="number"
                                autoFocus
                                value={openingAmount}
                                onChange={(e) => setOpeningAmount(e.target.value)}
                                className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-xl text-xl font-bold text-center focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-black"
                                placeholder="0"
                            />
                        </div>
                        <button
                            onClick={handleOpenShift}
                            className="w-full text-white font-bold py-4 rounded-xl text-lg hover:shadow-lg hover:-translate-y-1 transition-all"
                            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                        >
                            فتح الوردية
                        </button>
                    </div>
                </div>
            )}

            {/* Shift Closing Modal */}
            {closingShiftModal && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3 text-red-600">
                                <LogOut size={28} />
                                <h2 className="text-xl font-extrabold text-gray-900">إغلاق الوردية</h2>
                            </div>
                            <button onClick={() => setClosingShiftModal(false)} className="text-gray-400 hover:text-red-500">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ الفعلي في الصندوق</label>
                                <input
                                    type="number"
                                    autoFocus
                                    value={closingAmount}
                                    onChange={(e) => setClosingAmount(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-xl text-xl font-bold text-center focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 text-black"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظات (اختياري)</label>
                                <textarea
                                    value={closingNotes}
                                    onChange={(e) => setClosingNotes(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl font-medium focus:outline-none focus:border-gray-500 text-black"
                                    placeholder="أي ملاحظات حول العجز أو الزيادة..."
                                    rows={3}
                                />
                            </div>

                            <button
                                onClick={handleCloseShift}
                                className="w-full bg-red-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-red-700 hover:shadow-lg transition-all"
                            >
                                تأكيد وإغلاق الوردية
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Refund Modal */}
            {refundModalOpen && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3 text-yellow-600">
                                <RotateCcw size={28} />
                                <h2 className="text-xl font-extrabold text-gray-900">إرجاع فاتورة سابقة</h2>
                            </div>
                            <button onClick={() => { setRefundModalOpen(false); setRefundTx(null); setRefundItems([]); }} className="text-gray-400 hover:text-red-500 transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>

                        {!refundTx ? (
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="رقم الفاتورة (مثال: 00000011)..."
                                    className="flex-1 bg-gray-50 border border-gray-200 p-3 rounded-xl font-bold text-center focus:outline-none focus:border-yellow-500"
                                    value={refundSearchId}
                                    onChange={e => setRefundSearchId(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleFetchRefundTx} className="bg-yellow-500 text-white px-6 font-bold rounded-xl hover:bg-yellow-600">بحث</button>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto mb-4 border border-gray-100 rounded-xl p-4 bg-gray-50">
                                <div className="mb-4 border-b pb-2 flex justify-between items-center">
                                    <p className="font-bold text-gray-800">فاتورة #{refundTx.receiptNumber || refundTx.id}</p>
                                    <p className="text-sm font-bold text-blue-600">الإجمالي: {formatCurrency(Number(refundTx.totalAmount))}</p>
                                </div>
                                <div className="space-y-3">
                                    {refundItems.map((item, idx) => (
                                        <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex-wrap gap-2">
                                            <div className="flex-1 min-w-[120px]">
                                                <p className="font-bold text-gray-800">{item.productName}</p>
                                                <p className="text-xs font-bold text-gray-500">مباع: {item.maxQty} | سعر: {formatCurrency(item.price)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs font-bold text-red-500">كمية الإرجاع:</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.maxQty}
                                                    value={item.refundQty || ''}
                                                    onChange={e => {
                                                        const v = Math.min(item.maxQty, Math.max(0, Number(e.target.value)));
                                                        const newArr = [...refundItems];
                                                        newArr[idx].refundQty = v;
                                                        setRefundItems(newArr);
                                                    }}
                                                    className="w-20 text-center font-bold bg-gray-100 p-2 rounded-lg outline-none focus:ring-2 focus:ring-red-400"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {refundTx && (
                            <div className="pt-4 border-t flex items-center justify-between">
                                <p className="font-bold text-red-600 text-lg">
                                    مرتجع: {formatCurrency(refundItems.reduce((sum, item) => sum + (item.price * item.refundQty), 0))}
                                </p>
                                <button onClick={handleSubmitRefund} className="bg-red-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-600 shadow-md">
                                    تأكيد الإرجاع
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Top Navbar */}
            <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-20">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-blue-600">
                        <img
                            src="/logo.png"
                            className="h-10 object-contain"
                            alt="Logo"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                document.getElementById('pos-logo-text')!.style.display = 'flex';
                            }}
                        />
                        <span id="pos-logo-text" className="text-xl font-extrabold tracking-tight hidden">CASHIER<span className="text-gray-400 font-light">Pro</span></span>
                    </div>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <nav className="flex items-center gap-4 text-sm font-bold text-gray-500">
                        <button onClick={() => router.push('/')} className="hover:text-blue-600 flex items-center gap-1 transition-colors">
                            <Home size={16} /> الرئيسية
                        </button>
                        <button onClick={() => router.push('/inventory')} className="hover:text-blue-600 flex items-center gap-1 transition-colors">
                            <Package size={16} /> المخزون
                        </button>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    {activeShift && (
                        <>
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm" title="مدة الوردية الكلية">
                                <Clock size={16} className="animate-pulse opacity-80" />
                                <span className="tracking-wider" dir="ltr">{formatShiftDuration()}</span>
                            </div>
                            <button
                                onClick={() => setRefundModalOpen(true)}
                                className="bg-yellow-50 text-yellow-600 px-3 py-1.5 rounded-lg text-sm font-bold border border-yellow-200 hover:bg-yellow-100 transition-colors"
                            >
                                إرجاع فاتورة
                            </button>
                            <button
                                onClick={() => setClosingShiftModal(true)}
                                className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-100 transition-colors"
                            >
                                إغلاق الوردية
                            </button>
                        </>
                    )}
                    {/* Customer Selection */}
                    <div className="relative">
                        <select
                            id="customer-select"
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-48 p-2.5 outline-none font-bold"
                            value={selectedCustomerId || ''}
                            onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                        >
                            <option value="">زبون عام (نقدي)</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <span className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        متصل بالخادم
                    </span>
                    <button onClick={handleLogout} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            {/* Main Workspace OR Standby Screen */}
            {activeShift ? (
                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT: Product Browser & Search (60%) */}
                    <div className="w-[60%] flex flex-col bg-gray-50/50 p-6 gap-6">

                        {/* Search Bar & Categories */}
                        <div className="flex flex-col gap-4">
                            <div className="relative group">
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                    <Search className="h-6 w-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="block w-full pr-12 pl-4 py-4 bg-white border-2 border-gray-200 rounded-2xl text-lg font-bold shadow-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:outline-none transition-all placeholder-gray-300 text-black"
                                    placeholder="بحث عن منتج (اسم / باركود) - F2"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleScan(searchQuery);
                                        }
                                    }}
                                />
                                <div className="absolute left-4 top-4 flex gap-2">
                                    <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-xs font-bold text-gray-400">F2</kbd>
                                </div>
                            </div>

                            {/* Touch-Friendly Category Filter */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                <button
                                    onClick={() => setFilterCategory(null)}
                                    className={`whitespace-nowrap px-6 py-3 rounded-full font-bold text-sm transition-all border-2 ${filterCategory === null ? 'text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                    style={filterCategory === null ? { background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' } : undefined}
                                >
                                    الكل
                                </button>
                                <button
                                    onClick={() => setFilterCategory('QUICK_ITEMS')}
                                    className={`whitespace-nowrap flex items-center gap-1.5 px-5 py-3 rounded-full font-bold text-sm transition-all border-2 ${filterCategory === 'QUICK_ITEMS' ? 'bg-yellow-500 text-white border-yellow-500 shadow-md' : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-100'}`}
                                >
                                    ⚡ عناصر سريعة
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setFilterCategory(cat.id)}
                                        className={`whitespace-nowrap px-6 py-3 rounded-full font-bold text-sm transition-all border-2 ${filterCategory === cat.id ? 'text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                        style={filterCategory === cat.id ? { background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' } : undefined}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Product Grid / Results */}
                        <div className="flex-1 overflow-y-auto pr-1 p-2">
                            {searchResults.length > 0 ? (
                                <div className={isListView ? "flex flex-col gap-2" : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"}>
                                    {searchResults.map((product) => {
                                        const defaultUnit = product.units && product.units.length > 0 ? product.units[0] : null;
                                        const convFactor = defaultUnit?.conversionFactor || 1;
                                        const displayStock = Math.floor((product.baseStock || 0) / convFactor);
                                        const cartItem = cart.find(i => i.productId === product.id && i.unitId === defaultUnit?.unitId);
                                        const cartQty = cartItem?.quantity || 0;
                                        const isOutOfStock = (product.baseStock ?? 0) <= 0;

                                        const handleCardClick = () => {
                                            if (!defaultUnit) return;
                                            if (isOutOfStock) {
                                                toast.error(`⚠️ "${product.name}" نفدت الكمية من المخزن!`);
                                                return;
                                            }
                                            if (cartQty >= displayStock) {
                                                toast.error(`⚠️ لا يمكن إضافة المزيد! الكمية المتوفرة من "${product.name}" هي ${displayStock} فقط.`);
                                                return;
                                            }
                                            addToCart(product.id, defaultUnit.unitId, product.name, defaultUnit.unitName, defaultUnit.price);
                                        };

                                        return (
                                            <button
                                                key={product.id}
                                                onClick={handleCardClick}
                                                className={isListView
                                                    ? `relative bg-white p-4 rounded-2xl shadow-sm border transition-all text-right group flex justify-between items-center ${isOutOfStock ? 'opacity-60 cursor-not-allowed border-gray-100' : cartQty > 0 ? 'border-blue-400 ring-2 ring-blue-100 hover:border-blue-500 hover:shadow-md' : 'border-gray-100 hover:border-blue-500 hover:shadow-md'}`
                                                    : `relative bg-white p-4 rounded-2xl shadow-sm border transition-all text-right group flex flex-col justify-between h-40 ${isOutOfStock ? 'opacity-60 cursor-not-allowed border-gray-100' : cartQty > 0 ? 'border-blue-400 ring-2 ring-blue-100 hover:border-blue-500 hover:shadow-md hover:-translate-y-1' : 'border-gray-100 hover:border-blue-500 hover:shadow-md hover:-translate-y-1'}`
                                                }
                                            >
                                                {/* Cart quantity badge */}
                                                {cartQty > 0 && (
                                                    <span className="absolute -top-2 -left-2 z-10 bg-blue-600 text-white text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                                                        {cartQty}
                                                    </span>
                                                )}

                                                <div className={isListView ? "flex items-center gap-4" : ""}>
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 line-clamp-2 leading-tight mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                                                    </div>
                                                    {isListView && (
                                                        <div className={`text-xs font-bold px-2 py-1 rounded-md ml-4 mr-auto ${displayStock <= 0 ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-100 text-gray-500'}`}>
                                                            {displayStock <= 0 ? 'نفد' : `${displayStock} متوفر`}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={isListView ? "flex items-center gap-4" : "flex items-end justify-between mt-4"}>
                                                    {!isListView && <div className={`text-xs font-bold px-2 py-1 rounded-md ${displayStock <= 0 ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-100 text-gray-500'}`}>{displayStock <= 0 ? 'نفد' : <>{displayStock} <span className="text-[10px]">متوفر</span></>}</div>}
                                                    <div className="text-xl font-bold text-blue-600">
                                                        {defaultUnit ? formatCurrency(defaultUnit.price) : <span className="text-sm text-red-400">لا يوجد سعر</span>}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : searchQuery || filterCategory ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <Package size={64} className="mb-4 text-gray-200" />
                                    <p className="text-lg font-medium">لا توجد نتائج مطابقة</p>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                    <Grid size={64} className="mb-4 text-gray-300" />
                                    <p className="text-lg font-medium">ابحث أو اختر قسماً لعرض المنتجات</p>
                                    <p className="text-sm">أو استخدم قارئ الباركود مباشرة</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Cart & Checkout (40%) */}
                    <div className="w-[40%] bg-white border-l border-gray-200 flex flex-col shadow-2xl relative z-10">

                        {/* Cart Header */}
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                                <ShoppingCart className="text-blue-600" />
                                سلة المبيعات
                                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                            </h2>
                            <div className="flex gap-2">
                                {heldTickets.length > 0 && (
                                    <button
                                        onClick={() => handleResume(0)}
                                        className="text-xs font-bold text-yellow-600 bg-yellow-50 hover:bg-yellow-100 flex items-center gap-1 border border-yellow-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                        title="استرجاع فاتورة معلقة"
                                    >
                                        <RotateCcw size={14} /> استعادة ({heldTickets.length})
                                    </button>
                                )}
                                <button
                                    onClick={handleHold}
                                    disabled={cart.length === 0}
                                    className="text-xs font-bold text-orange-600 hover:bg-orange-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                    تعليق الفاتورة
                                </button>
                                <button onClick={handleClear} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                                    تفريغ السلة
                                </button>
                            </div>
                        </div>

                        {/* Cart Items List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 select-none">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                        <ScanLine size={32} />
                                    </div>
                                    <p className="font-bold">السلة فارغة</p>
                                </div>
                            ) : (
                                cart.map((item, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 bg-white border p-2.5 rounded-xl transition-all group ${idx === selectedIndex ? 'border-blue-500 shadow-sm ring-1 ring-blue-100' : 'border-gray-100 hover:border-blue-200'}`}>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-bold text-sm line-clamp-1 ${idx === selectedIndex ? 'text-blue-700' : 'text-gray-800'}`}>{item.name}</h4>
                                            <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded font-medium">{item.unitName}</span>
                                                <span>{formatCurrency(item.price)}/وحدة</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 bg-gray-50 rounded p-1 border border-gray-200 shrink-0">
                                            <button onClick={() => updateQuantity(idx, 1)} className="p-1 hover:bg-white bg-white border border-gray-200 hover:border-green-500 hover:text-green-600 rounded text-xs shadow-sm transition-all"><Plus size={14} strokeWidth={3} /></button>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => setQuantity(idx, Number(e.target.value) || 1)}
                                                onFocus={(e) => e.target.select()}
                                                className="font-extrabold text-sm w-8 text-center text-black py-0 px-0 bg-transparent border-none focus:ring-0 outline-none select-all appearance-none m-0"
                                                style={{ MozAppearance: 'textfield' }}
                                            />
                                            <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:bg-white bg-white border border-gray-200 hover:border-red-500 hover:text-red-500 rounded text-xs shadow-sm transition-all"><Minus size={14} strokeWidth={3} /></button>
                                        </div>

                                        <div className="min-w-[65px] text-left shrink-0 pl-1">
                                            <span className="font-bold text-sm text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                                        </div>

                                        <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 bg-transparent hover:bg-red-50 transition-colors p-1.5 rounded-lg shrink-0">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer / Checkout */}
                        <div className="bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">

                            {/* Actions Row */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setShowDiscountModal(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-bold py-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors text-xs"
                                >
                                    <Percent size={14} /> الخصم والإضافات
                                </button>
                                <button
                                    onClick={() => setShowNotesModal(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-yellow-50 text-gray-700 hover:text-yellow-700 font-bold py-2 rounded-lg border border-gray-200 hover:border-yellow-200 transition-colors text-xs"
                                >
                                    <StickyNote size={14} /> ملاحظات الفاتورة
                                </button>
                            </div>

                            {!isCredit && !showReceivedInput && (
                                <button
                                    onClick={() => setShowReceivedInput(true)}
                                    className="w-full mb-3 text-sm font-bold text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-400 py-1.5 rounded-lg transition-colors"
                                >
                                    + حساب الباقي (المبلغ المستلم)
                                </button>
                            )}

                            {!isCredit && showReceivedInput && (
                                <div className="flex items-center justify-between mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <span className="font-bold text-gray-700 text-xs">المبلغ المستلم:</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={totalAmount}
                                            value={receivedAmount}
                                            onChange={(e) => setReceivedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder={totalAmount.toString()}
                                            className="w-20 bg-white border border-gray-300 rounded px-2 py-1 text-center font-bold text-sm outline-none focus:border-blue-500"
                                        />
                                        {typeof receivedAmount === 'number' && receivedAmount > totalAmount && (
                                            <span className="text-green-600 font-bold ml-1 text-xs text-center">باقي: {formatCurrency(receivedAmount - totalAmount)}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {discountAmount > 0 && (
                                <div className="flex justify-between items-center mb-2 px-3 py-2 bg-pink-50 text-pink-700 rounded-lg">
                                    <span className="font-bold">خصومات وعروض!</span>
                                    <span className="text-lg font-bold">-{formatCurrency(discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end mb-6 bg-gray-50 p-3 rounded-lg">
                                <span className="text-gray-500 font-bold">المجموع الكلي {discountAmount > 0 && '(بعد الخصم)'}</span>
                                <span className="text-2xl font-extrabold text-gray-900 tracking-tight">{formatCurrency(totalAmount)}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-3">
                                <button
                                    onClick={handleClear}
                                    className="col-span-1 border-2 border-red-100 text-red-600 rounded-xl font-bold flex flex-col items-center justify-center gap-1 hover:bg-red-50 transition-colors py-3"
                                >
                                    <XCircle size={20} />
                                    <span className="text-xs">إلغاء</span>
                                </button>
                                <button
                                    onClick={handlePay}
                                    disabled={cart.length === 0}
                                    className={`col-span-3 text-white rounded-xl font-bold flex items-center justify-between px-6 hover:-translate-y-1 shadow-lg transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none ${isCredit ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' : ''}`}
                                    style={!isCredit ? { background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' } : undefined}
                                >
                                    <div className="flex flex-col items-start py-3">
                                        <span className="text-lg">{isCredit ? 'تسجيل دين (آجل)' : 'دفع نقدي'}</span>
                                        <span className={`text-xs font-normal ${isCredit ? 'text-orange-200' : 'text-indigo-200'}`}>F1 - تنفيذ العملية</span>
                                    </div>
                                    {isCredit ? <Wallet size={28} /> : <CreditCard size={28} />}
                                </button>
                            </div>

                            {/* Credit Toggle & Split Payment */}
                            {selectedCustomerId && (
                                <div className="mt-4 flex flex-col gap-3 bg-orange-50 p-4 rounded-xl border border-orange-100">
                                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsCredit(!isCredit)}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isCredit ? 'bg-orange-500 border-orange-500' : 'bg-white border-orange-300'}`}>
                                            {isCredit && <Check size={14} className="text-white" />}
                                        </div>
                                        <span className="font-bold text-orange-800 text-sm select-none">تسجيل المبلغ كدين على العميل (آجل)</span>
                                    </div>

                                    {isCredit && (
                                        <div className="flex items-center justify-between mt-1 pt-3 border-t border-orange-200/50">
                                            <span className="font-bold text-orange-800 text-sm">مبلغ الدفعة المقدمة (نقداً):</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={totalAmount}
                                                    value={receivedAmount}
                                                    onChange={(e) => setReceivedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder="0"
                                                    className="w-24 bg-white border border-orange-300 rounded-lg px-2 py-1.5 text-center font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                                                />
                                                {typeof receivedAmount === 'number' && receivedAmount > 0 && receivedAmount < totalAmount && (
                                                    <span className="text-orange-600 font-bold ml-2 text-xs"> الباقي للدين: {formatCurrency(totalAmount - receivedAmount)}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center bg-gray-50 flex-col gap-6 animate-fade-in-up">
                    <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center max-w-md w-full text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                            <Wallet size={48} className="text-gray-400" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-800 mb-2">الصندوق مغلق</h2>
                        <p className="text-gray-500 mb-8 font-medium">الرجاء فتح وردية جديدة للبدء في تسجيل المبيعات واستقبال العملاء.</p>
                        <button
                            onClick={() => setIsOpeningShift(true)}
                            className="bg-blue-600 text-white w-full py-4 rounded-xl font-bold text-xl hover:bg-blue-700 shadow-lg shadow-blue-200 hover:-translate-y-1 transition-all"
                        >
                            فتح وردية جديدة
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden Popups for POS Actions */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Percent size={20} className="text-blue-500" /> إضافة خصم</h3>
                            <button onClick={() => { setShowDiscountModal(false); searchInputRef.current?.focus(); }} className="text-gray-400 hover:text-red-500"><XCircle size={20} /></button>
                        </div>
                        <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                            <button onClick={() => setManualDiscountType('FIXED')} className={`flex-1 py-2 rounded-md font-bold text-sm transition-all ${manualDiscountType === 'FIXED' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>مبلغ مقطوع</button>
                            <button onClick={() => setManualDiscountType('PERCENTAGE')} className={`flex-1 py-2 rounded-md font-bold text-sm transition-all ${manualDiscountType === 'PERCENTAGE' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>نسبة مئوية %</button>
                        </div>
                        <input
                            type="number" autoFocus min="0" value={manualDiscountValue || ''}
                            onChange={(e) => setManualDiscountValue(Number(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { setShowDiscountModal(false); searchInputRef.current?.focus(); } }}
                            placeholder="0"
                            className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-xl font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 mb-6 text-black"
                        />
                        <button onClick={() => { setShowDiscountModal(false); searchInputRef.current?.focus(); }} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">تأكيد الإدخال</button>
                    </div>
                </div>
            )}

            {showNotesModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><StickyNote size={20} className="text-yellow-500" /> ملاحظات الفاتورة</h3>
                            <button onClick={() => { setShowNotesModal(false); searchInputRef.current?.focus(); }} className="text-gray-400 hover:text-red-500"><XCircle size={20} /></button>
                        </div>
                        <textarea
                            autoFocus value={notes} onChange={(e) => setNotes(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowNotesModal(false); searchInputRef.current?.focus(); } }}
                            placeholder="اكتب الملاحظات هنا..." rows={3}
                            className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 mb-6 text-black"
                        />
                        <button onClick={() => { setShowNotesModal(false); searchInputRef.current?.focus(); }} className="w-full bg-yellow-500 text-white font-bold py-3 rounded-xl hover:bg-yellow-600">حفظ الملاحظة</button>
                    </div>
                </div>
            )}

            {/* Receipt Preview Modal */}
            {showReceiptModal && lastReceipt && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-100 p-2 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[95vh] animate-fade-in-up">
                        <div className="bg-white p-3 rounded-t-xl flex justify-between items-center border-b border-gray-200">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-green-600"><Check size={20} /> تمت المحاسبة</h3>
                            <button onClick={() => { setShowReceiptModal(false); setLastReceipt(null); setTimeout(() => searchInputRef.current?.focus(), 100); }} className="text-gray-400 hover:text-red-500"><XCircle size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            <ReceiptPrint receipt={lastReceipt} isPreview={true} />
                        </div>
                        <div className="bg-white p-3 rounded-b-xl border-t border-gray-200 flex gap-2">
                            <button
                                onClick={() => {
                                    setShowReceiptModal(false);
                                    setTimeout(() => {
                                        window.print();
                                        setLastReceipt(null);
                                        setTimeout(() => searchInputRef.current?.focus(), 100);
                                    }, 100);
                                }}
                                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2"
                            >
                                <Printer size={20} /> طباعة
                            </button>
                            <button
                                onClick={() => { setShowReceiptModal(false); setLastReceipt(null); setTimeout(() => searchInputRef.current?.focus(), 100); }}
                                className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden thermal print layout - renders only when not showing modal to prepare for actual print job */}
            {!showReceiptModal && lastReceipt && <ReceiptPrint receipt={lastReceipt} />}
        </div>
    );
}
