"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Clock,
  Search,
  CreditCard,
  Trash2,
  XCircle,
  RotateCcw,
  ScanLine,
  Package,
  Plus,
  Minus,
  Home,
  Settings,
  LogOut,
  Grid,
  List,
  Check,
  Wallet,
  Percent,
  StickyNote,
  Printer,
  Store,
  ChevronDown,
  AlertTriangle,
  Sun,
  Moon,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  ReceiptPrint,
  ReceiptData,
  StoreSettings,
} from "@/components/ReceiptPrint";

import toast from "react-hot-toast";
import { useBranch } from "@/contexts/BranchContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConfirm } from "@/hooks/useConfirm";
// Types
interface CartItem {
  productId: number;
  unitId: number;
  name: string;
  unitName: string;
  quantity: number;
  price: number;
  stock: number; // max available qty in this unit (baseStock / conversionFactor)
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
  matchType?: "barcode" | "name";
}

export default function POSPage() {
  usePageTitle('نقطة البيع');
  const {
    selectedBranch,
    branches,
    setSelectedBranch,
    isOwner,
    loading: branchLoading,
  } = useBranch();
  const { theme, toggleTheme } = useTheme();
  const { confirm, dialog } = useConfirm();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Barcode scanner — ref-based (no state → no async race conditions)
  const scanBufRef = useRef(""); // accumulated chars
  const scanModeRef = useRef(false); // confirmed scanner input
  const pendingCharRef = useRef(""); // first char (let through to input, taken back if scan confirmed)
  const lastCharTimeRef = useRef(0);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScanRef = useRef<((code: string) => void) | null>(null);
  const allProductsCacheRef = useRef<SearchResult[]>([]); // full product list for instant barcode lookup
  const router = useRouter();

  const [filterCategory, setFilterCategory] = useState<number | string | null>(
    null,
  );
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );

  // Enterprise POS features
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [heldTickets, setHeldTickets] = useState<
    {
      cart: CartItem[];
      customerId: string | null;
      paymentMethod: "CASH" | "CARD" | "CREDIT";
      time: string;
    }[]
  >([]);
  const [isListView, setIsListView] = useState(false);

  // Manual Discount State
  const [manualDiscountType, setManualDiscountType] = useState<
    "PERCENTAGE" | "FIXED"
  >("FIXED");
  const [manualDiscountValue, setManualDiscountValue] = useState<number>(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const [notes, setNotes] = useState("");
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");
  const [showReceivedInput, setShowReceivedInput] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Shift Management State
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingShiftLoading, setOpeningShiftLoading] = useState(false);
  const [closingShiftModal, setClosingShiftModal] = useState(false);
  const [closingAmount, setClosingAmount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [closingShiftLoading, setClosingShiftLoading] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [shiftSummaryLoading, setShiftSummaryLoading] = useState(false);

  // Refund System State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSearchId, setRefundSearchId] = useState("");
  const [refundTx, setRefundTx] = useState<any>(null);
  const [refundItems, setRefundItems] = useState<
    {
      id: number;
      productId: number;
      productName: string;
      unitId: number;
      price: number;
      cost: number;
      originalQty: number;
      maxQty: number;
      refundQty: number;
    }[]
  >([]);

  // Time State for Top Bar
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Payment loading state
  const [isPaying, setIsPaying] = useState(false);

  // Store settings — fetched once so ReceiptPrint never flashes a default name
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null,
  );
  const autoPrintRef = React.useRef(false);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStoreSettings({
            storeName: data.storeName || "",
            storePhone: data.storePhone || "",
            storeAddress: data.storeAddress || "",
            footerMessage: data.footerMessage || "",
          });
          autoPrintRef.current = data.autoPrint ?? false;
        }
      })
      .catch(() => {});
  }, []);

  // Inline price editing in cart
  const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  // Quantity numpad popup
  const [qtyPopupIdx, setQtyPopupIdx] = useState<number | null>(null);
  const [qtyPopupValue, setQtyPopupValue] = useState("");

  const openQtyPopup = (idx: number, currentQty: number) => {
    setQtyPopupIdx(idx);
    setQtyPopupValue(String(currentQty));
  };
  const confirmQtyPopup = () => {
    if (qtyPopupIdx === null) return;
    const n = parseInt(qtyPopupValue, 10);
    if (!isNaN(n) && n > 0) {
      const item = cart[qtyPopupIdx];
      if (item && n > item.stock) {
        toast.error(`الكمية المتوفرة: ${item.stock} فقط`);
        return;
      }
      setCart((prev) =>
        prev.map((ci, i) => (i === qtyPopupIdx ? { ...ci, quantity: n } : ci)),
      );
    }
    setQtyPopupIdx(null);
    setQtyPopupValue("");
  };
  const numpadPress = (key: string) => {
    if (key === "del") {
      setQtyPopupValue((v) => v.slice(0, -1) || "0");
      return;
    }
    if (key === "clear") {
      setQtyPopupValue("");
      return;
    }
    setQtyPopupValue((v) => (v === "0" ? key : v.length >= 5 ? v : v + key));
  };

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatShiftDuration = () => {
    if (!activeShift?.openedAt || !currentTime) return "00:00:00";
    const start = new Date(activeShift.openedAt).getTime();
    const now = currentTime.getTime();
    const diff = Math.floor((now - start) / 1000);
    if (diff < 0) return "00:00:00";
    const h = Math.floor(diff / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((diff % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (diff % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // --- Fetch Offers, Categories & Shift ---
  const branchQuery =
    selectedBranch?.id && selectedBranch.id !== "all"
      ? `?branchId=${selectedBranch.id}`
      : "";
  const branchQueryAmp =
    selectedBranch?.id && selectedBranch.id !== "all"
      ? `&branchId=${selectedBranch.id}`
      : "";

  useEffect(() => {
    if (branchLoading) return;
    fetch(`/api/shifts${branchQuery}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.activeShift) setActiveShift(data.activeShift);
        setShiftLoading(false);
      })
      .catch(() => setShiftLoading(false));

    fetch(`/api/offers?active=true${branchQueryAmp}`)
      .then((res) => res.json())
      .then((data) => setOffers(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetch(`/api/categories${branchQuery}`)
      .then((res) => res.json())
      .then((data) =>
        setCategories(Array.isArray(data) ? data : (data.categories ?? [])),
      )
      .catch(console.error);
  }, [selectedBranch?.id, branchLoading]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handlePay();
      }
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "F3") {
        e.preventDefault();
        setPaymentMethod((prev) =>
          prev === "CASH" ? "CARD" : prev === "CARD" ? "CREDIT" : "CASH",
        );
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (
          cart.length > 0 &&
          selectedIndex >= 0 &&
          selectedIndex < cart.length
        ) {
          const newQty = window.prompt(
            "أدخل الكمية الجديدة:",
            cart[selectedIndex].quantity.toString(),
          );
          if (newQty && !isNaN(Number(newQty))) {
            const parsed = Math.max(1, Number(newQty));
            const maxStock = cart[selectedIndex].stock;
            if (parsed > maxStock) {
              toast.error(`الكمية المتوفرة: ${maxStock} فقط`);
            } else {
              setCart((prev) =>
                prev.map((item, i) =>
                  i === selectedIndex ? { ...item, quantity: parsed } : item,
                ),
              );
            }
          }
        }
      }
      if (e.key === "F5") {
        e.preventDefault();
        if (
          cart.length > 0 &&
          selectedIndex >= 0 &&
          selectedIndex < cart.length
        ) {
          const newPrice = window.prompt(
            "أدخل السعر الجديد للتعديل السريع:",
            cart[selectedIndex].price.toString(),
          );
          if (newPrice && !isNaN(Number(newPrice))) {
            setCart((prev) =>
              prev.map((item, i) =>
                i === selectedIndex
                  ? { ...item, price: Number(newPrice) }
                  : item,
              ),
            );
          }
        }
      }
      if (e.key === "Insert") {
        e.preventDefault();
        document.getElementById("customer-select")?.focus();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      }

      // Cart Navigation (Up/Down/Delete)
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(cart.length - 1, prev + 1));
      }
      if (e.key === "Delete") {
        e.preventDefault();
        if (cart.length > 0 && selectedIndex >= 0) {
          removeItem(selectedIndex);
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, selectedIndex]);

  // --- Global Barcode Listener (ref-based, timing detection) ---
  // Kept in a separate effect after handleScan is defined — see below

  // --- Customer Screen Sync ---
  useEffect(() => {
    // Safe simplified sync
    const currentTotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    localStorage.setItem(
      "customerScreenCart",
      JSON.stringify({ cart, total: currentTotal }),
    );
  }, [cart]);

  // --- Instant Search & Category Filter (Debounced) ---
  useEffect(() => {
    const currentBranchId =
      selectedBranch?.id && selectedBranch.id !== "all"
        ? selectedBranch.id
        : null;
    const bq = currentBranchId ? `?branchId=${currentBranchId}` : "";
    const bqa = currentBranchId ? `&branchId=${currentBranchId}` : "";

    const fetchProducts = async () => {
      try {
        let url = `/api/products${bq}`;
        const isFullFetch = searchQuery.length < 2;
        if (!isFullFetch) {
          url = `/api/products/search?q=${encodeURIComponent(searchQuery)}${bqa}`;
        }
        const res = await fetch(url);
        let data = await res.json();

        // Keep the unfiltered full list as barcode lookup cache
        if (isFullFetch) allProductsCacheRef.current = data;

        // Filter by category
        if (filterCategory !== null) {
          if (filterCategory === "QUICK_ITEMS") {
            // isQuickSale flag OR any unit with no/zero barcode
            data = data.filter(
              (p: any) =>
                p.isQuickSale ||
                p.units.some(
                  (u: any) =>
                    u.barcode === "0" || u.barcode === 0 || !u.barcode,
                ),
            );
          } else {
            data = data.filter(
              (p: any) => String(p.categoryId) === String(filterCategory),
            );
          }
        }
        setSearchResults(data);
      } catch (err) {
        console.error(err);
      }
    };

    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, filterCategory, selectedBranch?.id, productRefreshKey]);

  // --- Actions ---
  const handleScan = async (code: string) => {
    let searchCode = code;
    let qtyToAdd = 1;

    // Handle Weight Scale Barcodes (13 digits starting with 2)
    if (code.length === 13 && code.startsWith("2")) {
      const itemCodeStr = code.substring(2, 7);
      const weightInGrams = parseInt(code.substring(7, 12));
      if (!isNaN(weightInGrams)) {
        searchCode = itemCodeStr;
        qtyToAdd = weightInGrams / 1000;
      }
    }

    const tryAdd = (product: SearchResult) => {
      if (product.baseStock <= 0) {
        toast(`عذراً، المنتج "${product.name}" نفد من المخزن!`);
        return;
      }
      const unit =
        product.units.find((u) => u.barcode === searchCode) || product.units[0];
      const convFactor = unit.conversionFactor || 1;
      const unitStock = Math.floor(product.baseStock / convFactor);
      addToCart(
        product.id,
        unit.unitId,
        product.name,
        unit.unitName,
        unit.price,
        qtyToAdd,
        unitStock,
      );
      setSearchQuery("");
    };

    // 1. Instant local lookup — no network needed
    const cached = allProductsCacheRef.current;
    const localMatch = cached.find((p) =>
      p.units.some((u) => String(u.barcode) === searchCode),
    );
    if (localMatch) {
      tryAdd(localMatch);
      return;
    }

    // 2. Fallback: API search (for products not yet in cache)
    try {
      const bqa =
        selectedBranch?.id && selectedBranch.id !== "all"
          ? `&branchId=${selectedBranch.id}`
          : "";
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(searchCode)}${bqa}`,
      );
      const data: SearchResult[] = await res.json();
      const apiMatch =
        data?.find((p) =>
          p.units.some((u) => String(u.barcode) === searchCode),
        ) || data?.[0];
      if (apiMatch) {
        tryAdd(apiMatch);
      } else {
        toast("المنتج غير موجود!");
      }
    } catch (err) {
      console.error("Scan failed", err);
      toast("خطأ في البحث عن المنتج");
    }
  };

  // Keep handleScanRef pointing to the latest handleScan (avoids stale closures in the listener)
  useEffect(() => {
    handleScanRef.current = handleScan;
  });

  // --- Unified Barcode Scanner Listener ---
  // All printable chars are intercepted (never reach the input directly).
  // Chars arriving < SCANNER_MS apart = scanner → buffered until Enter or 150ms idle.
  // Chars arriving >= SCANNER_MS apart = manual typing → injected into searchQuery state.
  useEffect(() => {
    const SCANNER_MS = 80; // scanners send chars well under this threshold

    const flush = () => {
      const code = scanBufRef.current.trim();
      scanBufRef.current = "";
      pendingCharRef.current = "";
      scanModeRef.current = false;
      lastCharTimeRef.current = 0; // reset so next scan's first char always starts fresh
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (code.length >= 3) handleScanRef.current?.(code);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Pass through modifier combos (Ctrl+C, Ctrl+V, etc.) and non-printable keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 && e.key !== "Enter") return;
      // Let keypresses through if focus is on any input/textarea other than the search bar
      const active = document.activeElement;
      if (
        active &&
        active !== searchInputRef.current &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT")
      )
        return;

      const now = Date.now();
      const delta = now - lastCharTimeRef.current;
      lastCharTimeRef.current = now;

      // ── ENTER ─────────────────────────────────────────────────
      if (e.key === "Enter") {
        if (scanBufRef.current.length >= 3 || scanModeRef.current) {
          e.preventDefault();
          e.stopPropagation();
          flush();
        } else {
          // Manual Enter — clear any stale pending, let Enter reach input
          scanBufRef.current = "";
          pendingCharRef.current = "";
          scanModeRef.current = false;
          if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        }
        return;
      }

      // Always intercept printable chars so they never go to any input directly
      e.preventDefault();
      e.stopPropagation();

      // ── CONFIRMED SCAN MODE ────────────────────────────────────
      if (scanModeRef.current) {
        scanBufRef.current += e.key;
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(flush, 150);
        return;
      }

      // ── FAST SECOND CHAR → CONFIRM SCANNER ───────────────────
      if (pendingCharRef.current && delta < SCANNER_MS) {
        scanModeRef.current = true;
        scanBufRef.current = pendingCharRef.current + e.key;
        pendingCharRef.current = "";
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(flush, 150);
        return;
      }

      // ── SLOW / FIRST CHAR — might be manual typing ────────────
      if (pendingCharRef.current) {
        // Previous pending was slow enough to be manual — inject it to search
        const prev = pendingCharRef.current;
        setSearchQuery((q) => q + prev);
      }

      scanBufRef.current = "";
      scanModeRef.current = false;
      pendingCharRef.current = e.key;

      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => {
        const ch = pendingCharRef.current;
        pendingCharRef.current = "";
        if (ch) setSearchQuery((q) => q + ch); // inject as manual search char
      }, SCANNER_MS + 10);
    };

    window.addEventListener("keydown", onKeyDown, true); // capture phase
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []); // empty deps — state setters and refs are stable

  // --- Refund Functions ---
  const handleFetchRefundTx = async () => {
    if (!refundSearchId) return;
    try {
      const res = await fetch(`/api/transactions/${refundSearchId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      if (data.type !== "SALE") {
        toast("عذراً، لا يمكن استرجاع هذه الفاتورة.");
        return;
      }
      setRefundTx(data);
      setRefundItems(
        data.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          productName: it.product?.name || "منتج غير معروف",
          unitId: it.unitId,
          price: Number(it.price),
          cost: Number(it.cost || 0),
          originalQty: Number(it.quantity),
          maxQty: Number(it.quantity), // Later deduct already refunded qty if tracked
          refundQty: 0,
        })),
      );
    } catch (err) {
      toast("الفاتورة غير موجودة");
    }
  };

  const handleSubmitRefund = async () => {
    const itemsToRefund = refundItems.filter((i) => i.refundQty > 0);
    if (itemsToRefund.length === 0)
      return toast("اختر المنتجات المراد إرجاعها وضع كمية الاسترجاع");

    const refundTotal = itemsToRefund.reduce(
      (sum, item) => sum + item.price * item.refundQty,
      0,
    );

    if (
      !(await confirm({
        title: "تأكيد الاسترجاع",
        message: `هل أنت متأكد من استرجاع بقيمة ${formatCurrency(refundTotal)}؟`,
        variant: "warning",
        confirmLabel: "تأكيد الاسترجاع",
      }))
    )
      return;

    try {
      const res = await fetch("/api/transactions/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalTxId: refundTx.id,
          items: itemsToRefund.map((item) => ({
            productId: item.productId,
            unitId: item.unitId,
            quantity: item.refundQty,
            price: item.price,
            cost: item.cost,
          })),
          totalAmount: refundTotal,
          paymentMethod: "CASH",
          paidAmount: refundTotal,
        }),
      });

      if (res.ok) {
        toast.success("تم إرجاع الفاتورة بنجاح وإعادة المنتجات للمخزن!");
        setRefundModalOpen(false);
        setRefundSearchId("");
        setRefundTx(null);
        setRefundItems([]);
      } else {
        const data = await res.json();
        toast.error(data.error || "فشل الإرجاع");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء الاتصال بالخادم");
    }
  };

  const addToCart = (
    productId: number,
    unitId: number,
    name: string,
    unitName: string,
    price: number,
    qtyToAdd: number = 1,
    stock: number = 9999,
  ) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === productId && item.unitId === unitId,
      );
      if (existing) {
        const newQty = existing.quantity + qtyToAdd;
        if (newQty > existing.stock) {
          toast.error(`الكمية المتوفرة: ${existing.stock} فقط`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === productId && item.unitId === unitId
            ? { ...item, quantity: newQty }
            : item,
        );
      }
      const newCart = [
        ...prev,
        { productId, unitId, name, unitName, quantity: qtyToAdd, price, stock },
      ];
      setSelectedIndex(newCart.length - 1); // Auto-select newly added item
      return newCart;
    });

    // Auto focus back to search to be ready for next scan without mouse
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const updateQuantity = (idx: number, delta: number) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          const newQty = Math.max(1, item.quantity + delta);
          if (newQty > item.stock) {
            toast.error(`الكمية المتوفرة: ${item.stock} فقط`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  };

  const setQuantity = (idx: number, qty: number) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          return { ...item, quantity: Math.max(1, qty) };
        }
        return item;
      }),
    );
  };

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CARD" | "CREDIT"
  >("CASH");

  // Fetch Customers — scoped to selected branch
  useEffect(() => {
    const bq =
      selectedBranch?.id && selectedBranch.id !== "all"
        ? `?branchId=${selectedBranch.id}`
        : "";
    fetch(`/api/customers${bq}`)
      .then((res) => res.json())
      .then((data) => setCustomers(data))
      .catch(console.error);
    setSelectedCustomerId(null);
  }, [selectedBranch?.id]);

  // Reset to CASH when customer is deselected
  useEffect(() => {
    if (!selectedCustomerId && paymentMethod === "CREDIT")
      setPaymentMethod("CASH");
  }, [selectedCustomerId]);

  // ... (rest of search/scan logic) ...

  const handlePay = async (method?: "CASH" | "CARD" | "CREDIT") => {
    const m = method ?? paymentMethod;

    if (!activeShift) {
      toast("يجب فتح الوردية أولاً");
      return;
    }
    if (cart.length === 0) return;

    if (m === "CREDIT" && !selectedCustomerId) {
      toast.error("يجب اختيار عميل لتسجيل بيع آجل");
      return;
    }

    setPaymentMethod(m);
    setIsPaying(true);

    try {
      const paidAmount =
        m === "CREDIT"
          ? typeof receivedAmount === "number"
            ? receivedAmount
            : 0
          : totalAmount;
      const apiPaymentMethod =
        m === "CREDIT" &&
        typeof receivedAmount === "number" &&
        receivedAmount > 0
          ? "SPLIT"
          : m;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          shiftId: activeShift.id,
          totalAmount,
          customerId: selectedCustomerId,
          isCredit: m === "CREDIT",
          discount: discountAmount,
          notes,
          branchId:
            selectedBranch?.id && selectedBranch.id !== "all"
              ? selectedBranch.id
              : undefined,
          paidAmount,
          paymentMethod: apiPaymentMethod,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "فشل إتمام عملية الدفع");
      }
      const result = await res.json();

      setLastReceipt({
        transactionId: result.transactionId,
        receiptNumber: result.receiptNumber,
        date: new Date().toISOString(),
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          unitName: item.unitName,
        })),
        totalAmount,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        paymentMethod: apiPaymentMethod as "CASH" | "CARD" | "CREDIT" | "SPLIT",
        isCredit: m === "CREDIT",
        customerName: selectedCustomerId
          ? customers.find((c) => c.id === selectedCustomerId)?.name
          : undefined,
        cashierName:
          activeShift?.user?.username ??
          (activeShift?.userId ? String(activeShift.userId) : undefined),
      });

      setCart([]);
      setSelectedCustomerId(null);
      setPaymentMethod("CASH");
      setManualDiscountValue(0);
      setNotes("");
      setReceivedAmount("");
      setShowReceivedInput(false);
      setProductRefreshKey((k) => k + 1);

      if (autoPrintRef.current) {
        // Auto-print: skip modal, let hidden #printable-receipt render then print
        setTimeout(() => {
          window.print();
          setLastReceipt(null);
          setTimeout(() => searchInputRef.current?.focus(), 150);
        }, 250);
      } else {
        setShowReceiptModal(true);
      }
    } catch (err: any) {
      toast.error(`❌ فشل الدفع!\nالسبب: ${err.message}`);
    } finally {
      setIsPaying(false);
    }
  };

  const handleClear = async () => {
    if (
      !(await confirm({
        title: "تفريغ السلة",
        message: "هل أنت متأكد من تفريغ السلة؟ سيتم حذف جميع المنتجات المضافة.",
        variant: "warning",
        confirmLabel: "تفريغ",
      }))
    )
      return;
    setCart([]);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleHold = () => {
    if (cart.length === 0) return;
    setHeldTickets((prev) => [
      ...prev,
      {
        cart,
        customerId: selectedCustomerId,
        paymentMethod,
        time: new Date().toLocaleTimeString("ar-IQ", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setCart([]);
    setSelectedCustomerId(null);
    setPaymentMethod("CASH");
    setReceivedAmount("");
    setShowReceivedInput(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleResume = async (idx: number) => {
    if (cart.length > 0) {
      if (
        !(await confirm({
          title: "استبدال السلة",
          message:
            "السلة الحالية غير فارغة، هل تريد استبدالها بالفاتورة المعلقة؟ ستفقد المنتجات الحالية.",
          variant: "warning",
          confirmLabel: "استبدال",
        }))
      )
        return;
    }
    const ticket = heldTickets[idx];
    setCart(ticket.cart);
    setSelectedCustomerId(ticket.customerId);
    setPaymentMethod(ticket.paymentMethod);
    setHeldTickets((prev) => prev.filter((_, i) => i !== idx));
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const removeItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const updateItemPrice = (idx: number, newPrice: number) => {
    setCart((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, price: Math.max(0, newPrice) } : item,
      ),
    );
  };

  // --- Shift Functions ---
  const handleOpenShift = async () => {
    if (!openingAmount) {
      toast("أدخل مبلغ العهدة الافتتاحي");
      return;
    }
    if (!selectedBranch || selectedBranch.id === "all") {
      toast.error(
        "لفتح وردية، يجب اختيار فرع محدد من الشريط العلوي (لا يمكن فتح وردية لكل الفروع)",
      );
      return;
    }
    setOpeningShiftLoading(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingAmount: Number(openingAmount),
          branchId: selectedBranch?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveShift(data.shift);
        setIsOpeningShift(false);
      } else {
        toast(data.error);
      }
    } catch (e) {
      toast.error("فشل فتح الوردية");
    } finally {
      setOpeningShiftLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!closingAmount) {
      toast("أدخل المبلغ الموجود في الصندوق");
      return;
    }
    if (
      !(await confirm({
        title: "إغلاق الوردية",
        message:
          "هل أنت متأكد من إغلاق الوردية الحالية؟ تأكد من مراجعة المبالغ قبل الإغلاق.",
        variant: "warning",
        confirmLabel: "إغلاق الوردية",
      }))
    )
      return;

    setClosingShiftLoading(true);
    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingAmount: Number(closingAmount),
          notes: closingNotes,
          branchId: selectedBranch?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `تم إغلاق الوردية بنجاح!\nالمبلغ المتوقع: ${formatCurrency(data.expectedAmount)}\nالفرق: ${formatCurrency(Number(closingAmount) - data.expectedAmount)}`,
        );
        setActiveShift(null);
        setClosingShiftModal(false);
      } else {
        toast(data.error);
      }
    } catch (e) {
      toast.error("فشل إغلاق الوردية");
    } finally {
      setClosingShiftLoading(false);
    }
  };

  // --- Discount Calculation ---
  const subTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  let discountAmount = 0;
  let hasPercentageDiscount = false;

  offers.forEach((offer) => {
    let applicableItems = offer.productId
      ? cart.filter((i) => i.productId === offer.productId)
      : cart;

    if (applicableItems.length === 0) return;

    const applicableSubtotal = applicableItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const applicableQty = applicableItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    if (offer.type === "FIXED_DISCOUNT") {
      discountAmount += Number(offer.value);
    } else if (offer.type === "PERCENTAGE_DISCOUNT") {
      discountAmount += applicableSubtotal * (Number(offer.value) / 100);
      hasPercentageDiscount = true;
    } else if (
      offer.type === "BUY_X_GET_Y" &&
      offer.buyQuantity &&
      offer.getQuantity
    ) {
      const bundles = Math.floor(
        applicableQty / (offer.buyQuantity + offer.getQuantity),
      );
      if (bundles > 0) {
        const unitPrice = applicableItems[0].price;
        discountAmount += unitPrice * offer.getQuantity * bundles;
      }
    }
  });

  // Add manual discount
  if (manualDiscountType === "FIXED") {
    discountAmount += manualDiscountValue;
  } else if (manualDiscountType === "PERCENTAGE") {
    discountAmount += subTotal * (manualDiscountValue / 100);
    hasPercentageDiscount = true;
  }

  if (discountAmount > subTotal) discountAmount = subTotal;

  // Round percentage discount to nearest 250 IQD
  // remainder < 125 → floor | remainder > 125 → ceil to next 250
  let discountBeforeRounding = 0;
  let discountRounding = 0;
  if (hasPercentageDiscount && discountAmount > 0) {
    discountBeforeRounding = discountAmount;
    const remainder = discountAmount % 250;
    if (remainder > 0 && remainder < 125) {
      discountAmount = discountAmount - remainder; // round down
      discountRounding = -remainder;
    } else if (remainder >= 125) {
      discountAmount = discountAmount + (250 - remainder); // round up
      discountRounding = 250 - remainder;
    }
    if (discountAmount > subTotal) discountAmount = subTotal;
  }

  const totalAmount = subTotal - discountAmount;

  const handleLogout = async () => {
    if (
      !(await confirm({
        title: "تسجيل الخروج",
        message: "هل أنت متأكد من تسجيل الخروج من النظام؟",
        variant: "logout",
        confirmLabel: "خروج",
      }))
    )
      return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // ── Branch Guard: block POS if no specific branch selected ──
  const needsBranchSelection =
    !branchLoading &&
    (!selectedBranch || selectedBranch.id === "all") &&
    branches.length > 1;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden animate-fade-in-up bg-slate-100 dark:bg-slate-900"
      dir="rtl"
    >
      {dialog}

      {/* ── Branch Selection Overlay ── */}
      {needsBranchSelection && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)",
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute w-96 h-96 rounded-full opacity-10 top-0 right-0 -translate-y-1/2 translate-x-1/2"
            style={{
              background: "radial-gradient(circle,#094B9F,transparent)",
            }}
          />
          <div
            className="absolute w-80 h-80 rounded-full opacity-10 bottom-0 left-0 translate-y-1/2 -translate-x-1/2"
            style={{
              background: "radial-gradient(circle,#094B9F,transparent)",
            }}
          />

          <div className="relative z-10 text-center max-w-md w-full px-6">
            {/* Icon */}
            <div
              className="w-24 h-24 r-icon mx-auto mb-6 flex items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#094B9F,#063A8A)",
                boxShadow: "0 20px 60px rgba(9,75,159,.5)",
              }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg,rgba(255,255,255,.4) 0%,transparent 60%)",
                }}
              />
              <Store className="w-12 h-12 text-white relative z-10" />
            </div>

            <h1 className="text-3xl font-black text-white mb-2">نقطة البيع</h1>
            <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed">
              يجب تحديد فرع محدد قبل بدء العمل على الصندوق.
              <br />
              اختر الفرع من القائمة أدناه للمتابعة.
            </p>

            {/* Warning badge */}
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-bold px-4 py-2 rounded-full mb-6">
              <AlertTriangle size={13} />
              لم يتم تحديد فرع بعد
            </div>

            {/* Branch selector */}
            <div className="bg-white/5 border border-white/10 r-card p-1 mb-4">
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => setSelectedBranch(branch)}
                  className="w-full flex items-center justify-between px-5 py-4 r-container text-right transition-all hover:bg-white/10 group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 r-icon flex items-center justify-center shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#094B9F,#063A8A)",
                      }}
                    >
                      <Store className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-white text-sm">
                      {branch.name}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-slate-400 -rotate-90 group-hover:text-blue-400 transition-colors"
                  />
                </button>
              ))}
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="text-slate-500 hover:text-slate-400 text-xs font-medium transition-colors"
            >
              العودة للوحة التحكم
            </button>
          </div>
        </div>
      )}

      {/* Top Status Bar */}
      {/* Top Status Bar */}
      <div className="px-4 py-1.5 flex justify-between items-center text-xs font-medium z-30 relative shrink-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        {/* Left: shift + opening amount */}
        <div className="flex items-center gap-4">
          <span
            className={`flex items-center gap-1.5 font-bold ${activeShift ? "text-emerald-600 dark:text-green-400" : shiftLoading ? "text-slate-400 dark:text-slate-500" : "text-slate-400 dark:text-gray-500"}`}
          >
            <Wallet size={13} />
            {activeShift ? (
              `كاشير: ${activeShift.user?.username ?? activeShift.userId}`
            ) : shiftLoading ? (
              <span className="animate-pulse">جاري التحميل...</span>
            ) : (
              "الصندوق مغلق"
            )}
          </span>
          {activeShift && (
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-300">
              <CreditCard size={13} />
              رصيد الافتتاح: {formatCurrency(Number(activeShift.openingAmount))}
            </span>
          )}
        </div>

        {/* Center: Branch name */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-600/30 border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-white px-3 py-1 rounded-full font-black text-sm">
            <Store size={13} />
            {selectedBranch && selectedBranch.id !== "all" ? (
              selectedBranch.name
            ) : (
              <span className="text-blue-500 dark:text-blue-400 flex items-center gap-1">
                <AlertTriangle size={11} /> لم يُحدد فرع
              </span>
            )}
          </div>
        </div>

        {/* Right: time */}
        <span className="font-black tracking-widest text-sm text-slate-700 dark:text-slate-300 tabular-nums">
          {currentTime
            ? currentTime.toLocaleTimeString("ar-IQ", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "--:--:--"}
        </span>
      </div>

      {/* Shift Opening Modal (Triggered manually) */}
      {!shiftLoading && !activeShift && isOpeningShift && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 r-card shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 text-blue-600">
                <Wallet size={32} />
                <h2 className="text-2xl font-extrabold text-gray-900">
                  فتح الوردية (الدرج)
                </h2>
              </div>
              <button
                onClick={() => !openingShiftLoading && setIsOpeningShift(false)}
                disabled={openingShiftLoading}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle size={24} />
              </button>
            </div>
            <p className="text-gray-500 mb-6 font-medium">
              الرجاء إدخال المبلغ النقدي (العهدة) المتوفر حالياً في الصندوق لفتح
              الوردية وبدء المبيعات.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                الرصيد الافتتاحي (دينار)
              </label>
              <input
                type="number"
                autoFocus
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-200 p-4 r-container text-xl font-bold text-center focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-black"
                placeholder="0"
              />
            </div>
            <button
              onClick={handleOpenShift}
              disabled={openingShiftLoading}
              className="w-full text-white font-bold py-4 r-container text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              style={{
                background: "linear-gradient(135deg, #094B9F 0%, #063A8A 100%)",
              }}
            >
              {openingShiftLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري فتح الوردية...
                </>
              ) : (
                'فتح الوردية'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Shift Closing Modal */}
      {closingShiftModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white r-card shadow-2xl w-full max-w-sm animate-fade-in-up overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 r-icon bg-red-100 flex items-center justify-center">
                  <LogOut size={16} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    إغلاق الوردية
                  </h2>
                  {activeShift && (
                    <p className="text-xs text-gray-400">
                      وردية #{activeShift.id?.slice(-6)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setClosingShiftModal(false)}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Payment breakdown cards */}
              {shiftSummaryLoading ? (
                <div className="h-28 r-container bg-gray-50 animate-pulse" />
              ) : shiftSummary ? (
                <>
                  {/* 3-column payment grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-50 r-container p-3 text-center border border-emerald-100">
                      <p className="text-[11px] text-emerald-600 font-medium mb-1">
                        نقد
                      </p>
                      <p className="text-sm font-extrabold text-emerald-700">
                        {formatCurrency(shiftSummary.cashSales)}
                      </p>
                    </div>
                    <div className="bg-blue-50 r-container p-3 text-center border border-blue-100">
                      <p className="text-[11px] text-blue-600 font-medium mb-1">
                        بطاقة
                      </p>
                      <p className="text-sm font-extrabold text-blue-700">
                        {formatCurrency(shiftSummary.cardSales)}
                      </p>
                    </div>
                    <div className="bg-orange-50 r-container p-3 text-center border border-orange-100">
                      <p className="text-[11px] text-orange-600 font-medium mb-1">
                        آجل
                      </p>
                      <p className="text-sm font-extrabold text-orange-700">
                        {formatCurrency(shiftSummary.creditSales)}
                      </p>
                    </div>
                  </div>

                  {/* Details row */}
                  <div className="bg-gray-50 r-badge divide-y divide-gray-100 overflow-hidden text-xs">
                    <div className="flex justify-between items-center px-3.5 py-2.5">
                      <span className="text-gray-500">رصيد الافتتاح</span>
                      <span className="font-semibold text-gray-700">
                        {formatCurrency(shiftSummary.openingAmount)}
                      </span>
                    </div>
                    {shiftSummary.cashRefunds > 0 && (
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-red-500">مرتجعات نقدية</span>
                        <span className="font-semibold text-red-600">
                          −{formatCurrency(shiftSummary.cashRefunds)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center px-3.5 py-2.5 bg-emerald-50">
                      <span className="font-semibold text-gray-700">
                        النقد المتوقع في الصندوق
                      </span>
                      <span className="font-extrabold text-emerald-700">
                        {formatCurrency(shiftSummary.expectedCash)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-xs text-gray-400 py-4 bg-gray-50 r-badge">
                  تعذر تحميل بيانات الوردية
                </div>
              )}

              {/* Actual amount input */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  المبلغ الفعلي في الصندوق
                </label>
                <input
                  type="number"
                  autoFocus
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 r-container px-4 py-3 text-xl font-bold text-center focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-gray-900 transition-all"
                  placeholder="0"
                />
              </div>

              {/* Live difference banner */}
              {closingAmount !== "" &&
                shiftSummary &&
                (() => {
                  const diff =
                    Number(closingAmount) - shiftSummary.expectedCash;
                  const isExact = Math.abs(diff) < 0.01;
                  const isOver = diff > 0;
                  return (
                    <div
                      className={`flex justify-between items-center px-3.5 py-2.5 r-badge text-xs font-bold ${isExact ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : isOver ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-red-50 text-red-600 border border-red-200"}`}
                    >
                      <span>
                        {isExact
                          ? "✓ مطابق تماماً"
                          : isOver
                            ? "▲ زيادة في الصندوق"
                            : "▼ عجز في الصندوق"}
                      </span>
                      <span className="text-sm">
                        {isExact ? "" : isOver ? "+" : ""}
                        {formatCurrency(diff)}
                      </span>
                    </div>
                  );
                })()}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  ملاحظات{" "}
                  <span className="font-normal text-gray-400">(اختياري)</span>
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 r-container px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
                  placeholder="أي ملاحظات حول العجز أو الزيادة..."
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => !closingShiftLoading && setClosingShiftModal(false)}
                  disabled={closingShiftLoading}
                  className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 r-container text-sm hover:bg-gray-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCloseShift}
                  disabled={closingShiftLoading}
                  className="flex-2 bg-red-600 text-white font-bold py-3 px-6 r-container text-sm hover:bg-red-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {closingShiftLoading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      جاري الإغلاق...
                    </>
                  ) : (
                    'تأكيد الإغلاق'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalOpen && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 r-card shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3 text-yellow-600">
                <RotateCcw size={28} />
                <h2 className="text-xl font-extrabold text-gray-900">
                  إرجاع فاتورة سابقة
                </h2>
              </div>
              <button
                onClick={() => {
                  setRefundModalOpen(false);
                  setRefundTx(null);
                  setRefundItems([]);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            {!refundTx ? (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="رقم الفاتورة (مثال: 00000011)..."
                  className="flex-1 bg-gray-50 border border-gray-200 p-3 r-container font-bold text-center focus:outline-none focus:border-blue-500"
                  value={refundSearchId}
                  onChange={(e) => setRefundSearchId(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={handleFetchRefundTx}
                  className="bg-yellow-500 text-white px-6 font-bold r-btn hover:bg-yellow-600"
                >
                  بحث
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto mb-4 border border-gray-100 r-container p-4 bg-gray-50">
                <div className="mb-4 border-b pb-2 flex justify-between items-center">
                  <p className="font-bold text-gray-800">
                    فاتورة #{refundTx.receiptNumber || refundTx.id}
                  </p>
                  <p className="text-sm font-bold text-blue-600">
                    الإجمالي: {formatCurrency(Number(refundTx.totalAmount))}
                  </p>
                </div>
                <div className="space-y-3">
                  {refundItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 bg-white r-container shadow-sm border border-gray-100 flex-wrap gap-2"
                    >
                      <div className="flex-1 min-w-[120px]">
                        <p className="font-bold text-gray-800">
                          {item.productName}
                        </p>
                        <p className="text-xs font-bold text-gray-500">
                          مباع: {item.maxQty} | سعر:{" "}
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-red-500">
                          كمية الإرجاع:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={item.maxQty}
                          value={item.refundQty || ""}
                          onChange={(e) => {
                            const v = Math.min(
                              item.maxQty,
                              Math.max(0, Number(e.target.value)),
                            );
                            const newArr = [...refundItems];
                            newArr[idx].refundQty = v;
                            setRefundItems(newArr);
                          }}
                          className="w-20 text-center font-bold bg-gray-100 p-2 r-container outline-none focus:ring-2 focus:ring-red-400"
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
                  مرتجع:{" "}
                  {formatCurrency(
                    refundItems.reduce(
                      (sum, item) => sum + item.price * item.refundQty,
                      0,
                    ),
                  )}
                </p>
                <button
                  onClick={handleSubmitRefund}
                  className="bg-red-500 text-white px-8 py-3 r-btn font-bold hover:bg-red-600 shadow-md"
                >
                  تأكيد الإرجاع
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POS Navbar */}
      <header className="h-11 flex items-center justify-between px-4 z-20 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            className="h-7 object-contain"
            alt="Logo"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              (
                document.getElementById("pos-logo-text") as HTMLElement
              ).style.display = "flex";
            }}
          />
          <span
            id="pos-logo-text"
            className="text-sm font-extrabold text-blue-600 hidden items-center gap-1"
          >
            <ScanLine size={14} /> POS
          </span>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-600" />
          <nav className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            <button
              onClick={() => router.push("/")}
              className="hover:text-blue-600 flex items-center gap-1 transition-colors"
            >
              <Home size={12} /> الرئيسية
            </button>
            <button
              onClick={() => router.push("/inventory")}
              className="hover:text-blue-600 flex items-center gap-1 transition-colors"
            >
              <Package size={12} /> المخزون
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {activeShift && (
            <>
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 r-badge text-xs font-bold">
                <Clock size={11} className="animate-pulse" />
                <span dir="ltr">{formatShiftDuration()}</span>
              </div>
              <button
                onClick={() => setRefundModalOpen(true)}
                className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1 r-btn transition-colors flex items-center gap-1"
              >
                <RotateCcw size={11} />
                إرجاع
              </button>
              <button
                onClick={() => {
                  setClosingShiftModal(true);
                  setShiftSummaryLoading(true);
                  fetch("/api/shifts/close")
                    .then((r) => r.json())
                    .then((d) => setShiftSummary(d))
                    .catch(() => setShiftSummary(null))
                    .finally(() => setShiftSummaryLoading(false));
                }}
                className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 px-2.5 py-1 r-badge transition-colors flex items-center gap-1"
              >
                <LogOut size={11} />
                إغلاق الوردية
              </button>
            </>
          )}
          <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            متصل
          </span>
          <button
            onClick={toggleTheme}
            title={
              theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"
            }
            className="p-1.5 r-container transition-colors text-slate-400 hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 r-btn transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      {activeShift ? (
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Product Browser */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 dark:bg-slate-900">
            {/* Search + Category Bar */}
            <div className="border-b border-slate-200 dark:border-slate-700 px-3 py-2 shrink-0 space-y-2 bg-white dark:bg-slate-800">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="block w-full pr-9 pl-3 py-2 r-container text-sm font-bold focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all placeholder-slate-400 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  placeholder="ابحث بالاسم أو الباركود — F2"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim().length >= 2)
                      handleScan(searchQuery);
                  }}
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setFilterCategory(null)}
                  className={`whitespace-nowrap shrink-0 px-3 py-1 r-badge font-bold text-xs transition-all border ${filterCategory === null ? "text-white border-blue-500" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
                  style={
                    filterCategory === null
                      ? {
                          background: "linear-gradient(135deg,#094B9F,#063A8A)",
                        }
                      : undefined
                  }
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterCategory("QUICK_ITEMS")}
                  className={`whitespace-nowrap shrink-0 flex items-center gap-1 px-3 py-1 r-badge font-bold text-xs transition-all border ${filterCategory === "QUICK_ITEMS" ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400"}`}
                >
                  ⚡ سريعة
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id)}
                    className={`whitespace-nowrap shrink-0 px-3 py-1 r-badge font-bold text-xs transition-all border ${filterCategory === cat.id ? "text-white border-blue-500" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
                    style={
                      filterCategory === cat.id
                        ? {
                            background:
                              "linear-gradient(135deg,#094B9F,#063A8A)",
                          }
                        : undefined
                    }
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
                  {searchResults.map((product) => {
                    const defaultUnit = product.units?.[0] ?? null;
                    const convFactor = defaultUnit?.conversionFactor || 1;
                    const displayStock = Math.floor(
                      (product.baseStock || 0) / convFactor,
                    );
                    const cartItem = cart.find(
                      (i) =>
                        i.productId === product.id &&
                        i.unitId === defaultUnit?.unitId,
                    );
                    const cartQty = cartItem?.quantity || 0;
                    const isOutOfStock = (product.baseStock ?? 0) <= 0;
                    const isLowStock = !isOutOfStock && displayStock <= 5;

                    // Pick a stable accent color per product id (works with string cuid)
                    const accents = [
                      ["#094B9F", "#063A8A"], // indigo→violet
                      ["#0ea5e9", "#0284c7"], // sky
                      ["#10b981", "#059669"], // emerald
                      ["#f59e0b", "#d97706"], // amber
                      ["#ec4899", "#db2777"], // pink
                      ["#063A8A", "#063A8A"], // purple
                    ];
                    const idStr = String(product.id);
                    const colorIdx =
                      idStr
                        .split("")
                        .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
                      accents.length;
                    const [c1, c2] = accents[colorIdx];
                    const initial = (product.name || "؟")[0];

                    return (
                      <button
                        key={product.id}
                        onClick={() => {
                          if (!defaultUnit) return;
                          if (isOutOfStock) {
                            toast.error(`"${product.name}" نفدت الكمية`);
                            return;
                          }
                          if (cartQty >= displayStock) {
                            toast.error(`الكمية المتوفرة: ${displayStock} فقط`);
                            return;
                          }
                          addToCart(
                            product.id,
                            defaultUnit.unitId,
                            product.name,
                            defaultUnit.unitName,
                            defaultUnit.price,
                            1,
                            displayStock,
                          );
                        }}
                        dir="rtl"
                        className={`relative flex flex-col r-card border-2 text-right transition-all duration-150 select-none active:scale-95 group
                                                    ${
                                                      isOutOfStock
                                                        ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700"
                                                        : cartQty > 0
                                                          ? "border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/40 bg-white dark:bg-slate-800 cursor-pointer"
                                                          : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-md bg-white dark:bg-slate-800 cursor-pointer"
                                                    }`}
                      >
                        {/* Cart qty badge */}
                        {cartQty > 0 && (
                          <span className="absolute -top-2 -left-2 z-20 min-w-[22px] h-[22px] px-1 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-800">
                            {cartQty}
                          </span>
                        )}

                        {/* Color header strip */}
                        <div
                          className="flex items-center justify-between px-3 pt-3 pb-2"
                          style={{
                            background: `linear-gradient(135deg, ${c1}18 0%, ${c2}10 100%)`,
                          }}
                        >
                          {/* Initial avatar */}
                          <div
                            className="w-9 h-9 r-icon flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm"
                            style={{
                              background: `linear-gradient(135deg, ${c1}, ${c2})`,
                            }}
                          >
                            {initial}
                          </div>

                          {/* Stock badge */}
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none border ${
                              isOutOfStock
                                ? "bg-red-50 text-red-600 border-red-200"
                                : isLowStock
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {isOutOfStock ? "نفد" : `${displayStock}`}
                          </span>
                        </div>

                        {/* Product info */}
                        <div className="px-3 pb-3 flex flex-col gap-1.5 flex-1 justify-between">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
                            {product.name}
                          </p>

                          <div className="flex items-center justify-between gap-1">
                            {/* Unit name */}
                            {defaultUnit && (
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate">
                                {defaultUnit.unitName}
                              </span>
                            )}
                            {/* Price */}
                            <span
                              className="text-[13px] font-black leading-none shrink-0"
                              style={{ color: cartQty > 0 ? c1 : undefined }}
                            >
                              {defaultUnit ? (
                                formatCurrency(defaultUnit.price)
                              ) : (
                                <span className="text-red-400 text-[9px]">
                                  —
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Hover shimmer */}
                        {!isOutOfStock && (
                          <div
                            className="absolute inset-0 r-card opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                            style={{
                              background: `linear-gradient(135deg, ${c1}08 0%, transparent 60%)`,
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : searchQuery || filterCategory ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Package size={44} className="mb-3 text-slate-300" />
                  <p className="font-bold text-sm">لا توجد نتائج مطابقة</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 select-none">
                  <Grid size={52} className="mb-3" />
                  <p className="font-bold text-sm text-slate-400">
                    اختر قسماً أو ابحث عن منتج
                  </p>
                  <p className="text-xs mt-1 text-slate-400">
                    أو استخدم قارئ الباركود مباشرة
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Cart & Checkout */}
          <div
            className="w-[38%] flex flex-col relative z-10 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            style={{ minWidth: "320px" }}
          >
            {/* Cart Header */}
            <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-blue-600" />
                <span className="font-black text-slate-800 text-sm">السلة</span>
                <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {heldTickets.length > 0 && (
                  <button
                    onClick={() => handleResume(0)}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2 py-1 r-badge transition-colors"
                  >
                    <RotateCcw size={11} /> معلقة ({heldTickets.length})
                  </button>
                )}
                <button
                  onClick={handleHold}
                  disabled={cart.length === 0}
                  className="text-[10px] font-bold text-slate-400 hover:text-orange-500 hover:bg-orange-50 px-2 py-1 r-badge transition-colors disabled:opacity-30"
                >
                  تعليق
                </button>
                <button
                  onClick={handleClear}
                  className="text-[10px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 r-badge transition-colors"
                >
                  تفريغ
                </button>
              </div>
            </div>

            {/* Customer Selector */}
            <div className="px-3 py-2 border-b border-slate-100 shrink-0">
              <select
                id="customer-select"
                value={selectedCustomerId ?? ""}
                onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold r-badge px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
              >
                <option value="">— بدون عميل (زبون عام) —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 select-none">
                  <ScanLine size={36} className="text-slate-200" />
                  <p className="font-bold text-sm text-slate-400">
                    السلة فارغة
                  </p>
                  <p className="text-[11px] text-slate-400">
                    أضف منتجاً أو امسح باركود
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-2 px-3 py-2.5 transition-all cursor-default group
                                                ${idx === selectedIndex ? "bg-blue-50 dark:bg-blue-900/30 border-r-2 border-blue-500" : "hover:bg-slate-50 dark:hover:bg-slate-700/50 border-r-2 border-transparent"}`}
                    >
                      {/* Name + unit + price edit */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-bold line-clamp-1 ${idx === selectedIndex ? "text-blue-700" : "text-slate-800 dark:text-slate-100"}`}
                        >
                          {item.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1 py-0.5 rounded">
                            {item.unitName}
                          </span>
                          {editingPriceIdx === idx ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              onBlur={() => {
                                const p = parseFloat(editingPrice);
                                if (!isNaN(p)) updateItemPrice(idx, p);
                                setEditingPriceIdx(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const p = parseFloat(editingPrice);
                                  if (!isNaN(p)) updateItemPrice(idx, p);
                                  setEditingPriceIdx(null);
                                }
                                if (e.key === "Escape")
                                  setEditingPriceIdx(null);
                              }}
                              className="w-20 text-[10px] font-bold bg-blue-50 border border-blue-300 text-blue-800 rounded px-1.5 py-0.5 outline-none focus:border-blue-500"
                            />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPriceIdx(idx);
                                setEditingPrice(item.price.toString());
                              }}
                              className="text-[9px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors border border-transparent hover:border-blue-200"
                              title="اضغط لتعديل السعر"
                            >
                              {formatCurrency(item.price)}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-0.5 bg-white border border-slate-200 r-container p-0.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(idx, 1);
                          }}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 r-icon transition-colors"
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openQtyPopup(idx, item.quantity);
                          }}
                          className="w-8 text-center font-extrabold text-xs text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors py-0.5"
                          title="اضغط لتعديل الكمية"
                        >
                          {item.quantity}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(idx, -1);
                          }}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 r-icon transition-colors"
                        >
                          <Minus size={12} strokeWidth={3} />
                        </button>
                      </div>

                      {/* Line total */}
                      <div className="w-16 text-right shrink-0">
                        <span className="text-xs font-black text-slate-800 tabular-nums">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(idx);
                        }}
                        className="text-slate-200 hover:text-red-500 hover:bg-red-50 p-1 r-container transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout Footer */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-2.5 shrink-0 bg-white dark:bg-slate-800">
              {/* Discount + Notes */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setShowDiscountModal(true)}
                  className={`flex items-center justify-center gap-1 py-1.5 r-container font-bold text-[11px] border transition-all
                                        ${manualDiscountValue > 0 ? "bg-pink-50 border-pink-300 text-pink-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"}`}
                >
                  <Percent size={12} />
                  {manualDiscountValue > 0
                    ? `خصم: ${manualDiscountType === "PERCENTAGE" ? manualDiscountValue + "%" : formatCurrency(manualDiscountValue)}`
                    : "خصم / إضافات"}
                </button>
                <button
                  onClick={() => setShowNotesModal(true)}
                  className={`flex items-center justify-center gap-1 py-1.5 r-container font-bold text-[11px] border transition-all
                                        ${notes ? "bg-yellow-50 border-yellow-300 text-yellow-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-yellow-300 hover:text-yellow-600 hover:bg-yellow-50"}`}
                >
                  <StickyNote size={12} />
                  {notes ? "ملاحظة مضافة ✓" : "ملاحظات"}
                </button>
              </div>

              {/* Discount badge */}
              {discountAmount > 0 && (
                <div className="px-3 py-1.5 bg-pink-50 border border-pink-200 r-container space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-pink-700 font-bold text-xs">
                      خصم مطبق
                    </span>
                    <span className="text-pink-700 font-black text-sm">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                  {discountRounding !== 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-pink-400 text-[10px]">
                        {discountRounding > 0
                          ? `↑ تم تقريبه لأعلى بـ ${discountRounding} د.ع`
                          : `↓ تم تقريبه لأسفل بـ ${Math.abs(discountRounding)} د.ع`}{" "}
                        (من {formatCurrency(discountBeforeRounding)})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Credit: advance payment input — shown once a customer is selected so
                  the cashier can enter it BEFORE pressing "آجل" (only applied to credit sales). */}
              {selectedCustomerId && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-2 r-container">
                  <span className="text-blue-700 font-bold text-[11px] shrink-0">
                    دفعة مقدمة للبيع الآجل (اختياري):
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={totalAmount}
                      value={receivedAmount}
                      onChange={(e) =>
                        setReceivedAmount(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="0"
                      className="w-20 bg-white border border-blue-300 r-badge px-2 py-1 text-center font-bold text-sm outline-none focus:border-blue-500"
                      style={{ color: "#92400e" }}
                    />
                    {typeof receivedAmount === "number" &&
                      receivedAmount > 0 &&
                      receivedAmount < totalAmount && (
                        <span className="text-blue-700 font-bold text-[10px]">
                          دين: {formatCurrency(totalAmount - receivedAmount)}
                        </span>
                      )}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between px-4 py-3 r-container bg-blue-600 dark:bg-slate-800">
                <span className="text-blue-200 dark:text-slate-400 font-bold text-xs">
                  {discountAmount > 0 ? "الإجمالي (بعد الخصم)" : "الإجمالي"}
                </span>
                <span className="text-white font-black text-2xl tracking-tight tabular-nums">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              {/* Payment buttons — each executes immediately */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    method: "CASH" as const,
                    label: "نقدي",
                    icon: <Wallet size={18} />,
                    base: "bg-emerald-500 border-emerald-500 hover:bg-emerald-600 hover:shadow-emerald-200",
                  },
                  {
                    method: "CARD" as const,
                    label: "بطاقة",
                    icon: <CreditCard size={18} />,
                    base: "bg-blue-500 border-blue-500 hover:bg-blue-600 hover:shadow-blue-200",
                  },
                  {
                    method: "CREDIT" as const,
                    label: "آجل",
                    icon: <StickyNote size={18} />,
                    base: "bg-blue-500 border-blue-500 hover:bg-blue-600 hover:shadow-blue-200",
                  },
                ].map(({ method, label, icon, base }) => (
                  <button
                    key={method}
                    disabled={cart.length === 0 || isPaying}
                    onClick={() => handlePay(method)}
                    className={`relative flex flex-col items-center justify-center gap-1 py-3.5 r-container font-black text-sm border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md ${base}`}
                  >
                    {isPaying ? (
                      <svg
                        className="animate-spin w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                    ) : (
                      icon
                    )}
                    {isPaying ? "جاري..." : label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : shiftLoading ? (
        /* ── Loading Screen ── */
        <div className="flex flex-1 items-center justify-center relative overflow-hidden bg-white dark:bg-slate-950">
          {/* Very soft background bloom */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 55% 55% at 50% 48%, rgba(9,75,159,0.06) 0%, transparent 100%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-10">
            {/* Icon — soft breathing glow, no spinning */}
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-36 h-36 rounded-full animate-pulse"
                style={{
                  background:
                    "radial-gradient(circle, rgba(9,75,159,0.18) 0%, transparent 70%)",
                  animationDuration: "2.4s",
                }}
              />
              <div
                className="relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,#094B9F 0%,#063A8A 100%)",
                  boxShadow: "0 8px 32px rgba(9,75,159,0.22)",
                }}
              >
                <Wallet size={32} className="text-white" />
              </div>
            </div>

            {/* Text */}
            <div className="text-center space-y-1.5">
              <p className="text-slate-700 dark:text-slate-200 font-semibold text-base tracking-tight">
                جاري التحقق من الوردية
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                لحظة واحدة...
              </p>
            </div>

            {/* Three calm dots */}
            <div className="flex items-center gap-2">
              {[0, 200, 400].map((delay, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 animate-pulse"
                  style={{
                    animationDelay: `${delay}ms`,
                    animationDuration: "1.4s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Standby / Closed Shift Screen ── */
        <div className="flex flex-1 items-center justify-center flex-col gap-6 animate-fade-in-up relative overflow-hidden bg-slate-100 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
          {/* Glow rings — only visible in dark */}
          <div
            className="absolute w-96 h-96 rounded-full opacity-10 pointer-events-none hidden dark:block"
            style={{
              background: "radial-gradient(circle,#094B9F,transparent)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          />

          <div className="relative z-10 text-center max-w-sm w-full px-6">
            <div
              className="w-24 h-24 r-icon mx-auto mb-6 flex items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#094B9F,#063A8A)",
                boxShadow: "0 24px 64px rgba(9,75,159,0.4)",
              }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg,rgba(255,255,255,.4) 0%,transparent 60%)",
                }}
              />
              <Wallet size={44} className="text-white relative z-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">
              الصندوق مغلق
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm font-medium leading-relaxed">
              افتح وردية جديدة للبدء في تسجيل المبيعات واستقبال العملاء.
            </p>
            <button
              onClick={() => setIsOpeningShift(true)}
              className="w-full py-4 r-card font-black text-white text-lg hover:-translate-y-1 transition-all shadow-lg"
              style={{
                background: "linear-gradient(135deg,#094B9F,#063A8A)",
                boxShadow: "0 12px 40px rgba(9,75,159,0.4)",
              }}
            >
              فتح وردية جديدة
            </button>
            <button
              onClick={() => router.push("/")}
              className="mt-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 text-sm font-medium transition-colors"
            >
              العودة للوحة التحكم
            </button>
          </div>
        </div>
      )}

      {/* Hidden Popups for POS Actions */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 r-card shadow-2xl w-full max-w-sm animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Percent size={20} className="text-blue-500" /> إضافة خصم
              </h3>
              <button
                onClick={() => {
                  setShowDiscountModal(false);
                  searchInputRef.current?.focus();
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="flex bg-gray-100 r-container p-1 mb-4">
              <button
                onClick={() => setManualDiscountType("FIXED")}
                className={`flex-1 py-2 r-btn font-bold text-sm transition-all ${manualDiscountType === "FIXED" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                مبلغ مقطوع
              </button>
              <button
                onClick={() => setManualDiscountType("PERCENTAGE")}
                className={`flex-1 py-2 r-btn font-bold text-sm transition-all ${manualDiscountType === "PERCENTAGE" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                نسبة مئوية %
              </button>
            </div>
            <input
              type="number"
              autoFocus
              min="0"
              value={manualDiscountValue || ""}
              onChange={(e) =>
                setManualDiscountValue(Number(e.target.value) || 0)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowDiscountModal(false);
                  searchInputRef.current?.focus();
                }
              }}
              placeholder="0"
              className="w-full bg-gray-50 border-2 border-gray-200 r-container px-4 py-3 text-center text-xl font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 mb-6 text-black"
            />
            <button
              onClick={() => {
                setShowDiscountModal(false);
                searchInputRef.current?.focus();
              }}
              className="w-full bg-blue-600 text-white font-bold py-3 r-btn hover:bg-blue-700"
            >
              تأكيد الإدخال
            </button>
          </div>
        </div>
      )}

      {/* ── Quantity Numpad Popup ─────────────────────────────────────── */}
      {qtyPopupIdx !== null && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setQtyPopupIdx(null)}
        >
          <div
            className="bg-white r-card shadow-2xl w-72 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-blue-600 px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-white font-bold text-sm block">
                  {cart[qtyPopupIdx]?.name}
                </span>
                <span className="text-blue-200 text-xs">
                  المتوفر: {cart[qtyPopupIdx]?.stock ?? "—"}{" "}
                  {cart[qtyPopupIdx]?.unitName}
                </span>
              </div>
              <button
                onClick={() => setQtyPopupIdx(null)}
                className="text-blue-200 hover:text-white"
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* Display */}
            <div className="px-5 pt-4 pb-2">
              <div className="bg-slate-50 border-2 border-blue-200 r-container px-4 py-3 text-center">
                <p className="text-3xl font-black text-blue-700 tabular-nums tracking-wide">
                  {qtyPopupValue || "0"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {cart[qtyPopupIdx]?.unitName}
                </p>
              </div>
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 px-5 pb-3 pt-1">
              {[
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "clear",
                "0",
                "del",
              ].map((k) => (
                <button
                  key={k}
                  onClick={() => numpadPress(k)}
                  className={`h-12 r-container font-bold text-lg transition-all active:scale-95
                                        ${
                                          k === "del"
                                            ? "bg-red-50 text-red-500 hover:bg-red-100 text-sm"
                                            : k === "clear"
                                              ? "bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs"
                                              : "bg-slate-100 text-slate-800 hover:bg-blue-50 hover:text-blue-700"
                                        }`}
                >
                  {k === "del" ? "⌫" : k === "clear" ? "مسح" : k}
                </button>
              ))}
            </div>

            {/* Confirm */}
            <div className="px-5 pb-5">
              <button
                onClick={confirmQtyPopup}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 r-container transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check size={16} /> تأكيد الكمية
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotesModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 r-card shadow-2xl w-full max-w-sm animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <StickyNote size={20} className="text-yellow-500" /> ملاحظات
                الفاتورة
              </h3>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  searchInputRef.current?.focus();
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <XCircle size={20} />
              </button>
            </div>
            <textarea
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  setShowNotesModal(false);
                  searchInputRef.current?.focus();
                }
              }}
              placeholder="اكتب الملاحظات هنا..."
              rows={3}
              className="w-full bg-gray-50 border-2 border-gray-200 r-container px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 mb-6 text-black"
            />
            <button
              onClick={() => {
                setShowNotesModal(false);
                searchInputRef.current?.focus();
              }}
              className="w-full bg-yellow-500 text-white font-bold py-3 r-btn hover:bg-yellow-600"
            >
              حفظ الملاحظة
            </button>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {showReceiptModal && lastReceipt && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-gray-100 p-2 shadow-2xl w-full max-w-sm flex flex-col max-h-[95vh] animate-fade-in-up"
            style={{ borderRadius: 5 }}
          >
            <div
              className="bg-white p-3 flex justify-between items-center border-b border-gray-200"
              style={{ borderRadius: "5px 5px 0 0" }}
            >
              <h3 className="font-bold text-lg flex items-center gap-2 text-green-600">
                <Check size={20} /> تمت المحاسبة
              </h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setLastReceipt(null);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <ReceiptPrint
                receipt={lastReceipt}
                isPreview={true}
                storeSettings={storeSettings}
              />
            </div>
            <div
              className="bg-white p-3 border-t border-gray-200 flex gap-2"
              style={{ borderRadius: "0 0 5px 5px" }}
            >
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setTimeout(() => {
                    window.print();
                    setLastReceipt(null);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }, 100);
                }}
                className="flex-1 bg-blue-600 text-white font-bold py-3 r-container hover:bg-blue-700 flex justify-center items-center gap-2"
              >
                <Printer size={20} /> طباعة
              </button>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setLastReceipt(null);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 r-container hover:bg-gray-300"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden thermal print layout - renders only when not showing modal to prepare for actual print job */}
      {!showReceiptModal && lastReceipt && (
        <ReceiptPrint receipt={lastReceipt} storeSettings={storeSettings} />
      )}
    </div>
  );
}
