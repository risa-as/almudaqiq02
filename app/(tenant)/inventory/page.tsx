"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJsonOr } from "@/lib/query/fetcher";
import { useConfirm } from "@/hooks/useConfirm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Package,
  AlertCircle,
  DollarSign,
  Calendar,
  Filter,
  FolderTree,
  Trash2,
  Printer,
  ScanLine,
  X,
  Save,
  Zap,
  Upload,
  ArrowDownToLine,
  Tag,
  Pencil,
  History,
  Loader2,
  PackageX,
} from "lucide-react";
import { HowItWorks } from "@/components/ui/HowItWorks";
import { ImportModal } from "@/components/inventory/ImportModal";
import { formatCurrency } from "@/lib/format";
import { useUser } from "@/hooks/useUser";
import { useBranch } from "@/contexts/BranchContext";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";

import toast from "react-hot-toast";
// Interfaces
interface ProductUnit {
  id?: string;
  name: string;
  price: number;
  conversionFactor?: number;
  barcode?: string;
}

interface Product {
  id: number;
  name: string;
  baseStock: number;
  minimumStock: number;
  costPrice: number;
  isQuickSale: boolean;
  units: ProductUnit[];
  categoryId?: number;
  category?: { name: string };
  supplierId?: number;
  supplier?: { name: string };
}

/**
 * Compact icon-only toolbar button with a hover tooltip showing its name.
 * Renders a <Link> when `href` is given, otherwise a <button>. Keeps the header
 * actions on a single row instead of wrapping.
 */
function ToolbarIconButton({
  label,
  icon: Icon,
  href,
  onClick,
  hover,
}: {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  hover: string; // e.g. 'hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700'
}) {
  const cls = `w-10 h-10 flex items-center justify-center bg-white border border-gray-200 text-gray-600 rounded-xl shadow-sm transition-all ${hover}`;
  const inner = <Icon size={19} />;
  return (
    <div className="relative group/tip">
      {href ? (
        <Link href={href} aria-label={label} className={cls}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cls}
        >
          {inner}
        </button>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-bold whitespace-nowrap opacity-0 -translate-y-1 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 transition-all duration-150 z-40 shadow-lg"
      >
        {label}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-[5px] border-transparent border-b-gray-900" />
      </span>
    </div>
  );
}

/**
 * Icon-only action for a table row, with a hover tooltip shown ABOVE the button
 * (stays within the table bounds so the overflow container doesn't clip it).
 * Renders a <Link> when `href` is given, otherwise a <button>.
 */
function RowAction({
  label,
  icon: Icon,
  href,
  onClick,
  color,
  loading = false,
  disabled = false,
}: {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  color: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const cls = `w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${color}`;
  const inner = loading ? (
    <Loader2 size={16} className="animate-spin" />
  ) : (
    <Icon size={16} />
  );
  return (
    <div className="relative group/tip">
      {href ? (
        <Link href={href} aria-label={label} className={cls}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          disabled={disabled || loading}
          className={cls}
        >
          {inner}
        </button>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-bold whitespace-nowrap opacity-0 translate-y-1 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 transition-all duration-150 z-30 shadow-lg"
      >
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-[5px] border-transparent border-t-gray-900" />
      </span>
    </div>
  );
}

export default function InventoryPage() {
  usePageTitle('المخزون');
  const { isAdmin, loading: userLoading } = useUser();
  const {
    selectedBranch,
    isOwner,
    branches,
    loading: branchLoading,
  } = useBranch();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  // ... (State remains same)
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterSupplier, setFilterSupplier] = useState<string>("ALL");
  const [filterStock, setFilterStock] = useState<string>("ALL"); // ALL, LOW, OUT
  const [sortBy, setSortBy] = useState<string>("NEWEST");

  // --- Barcode Scanner State ---
  const barcodeBuffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);
  const SCANNER_SPEED_THRESHOLD_MS = 50; // Scanners type each char in < 50ms

  // Stock-In Quick Modal State
  const [stockInModal, setStockInModal] = useState<{
    open: boolean;
    productId: string | null;
    productName: string;
    unitId: string;
    units: { id: string; name: string; conversionFactor: number }[];
    barcode: string;
  }>({
    open: false,
    productId: null,
    productName: "",
    unitId: "",
    units: [],
    barcode: "",
  });
  const [stockInQty, setStockInQty] = useState("");
  const [stockInCost, setStockInCost] = useState("");
  const [stockInBaseCost, setStockInBaseCost] = useState(0); // سعر الوحدة الأساسية
  const [stockInSupplierId, setStockInSupplierId] = useState("");
  const [stockInExpiryDate, setStockInExpiryDate] = useState("");
  const [stockInPaidAmount, setStockInPaidAmount] = useState("");
  const [stockInIsPrepaid, setStockInIsPrepaid] = useState(false);
  const [stockInLoading, setStockInLoading] = useState(false);
  const [barcodeToast, setBarcodeToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [stockInRowLoadingId, setStockInRowLoadingId] = useState<number | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const branchKey = selectedBranch?.id ?? "all";
  const branchParam = selectedBranch?.id && selectedBranch.id !== "all"
    ? `?branchId=${selectedBranch.id}` : "";

  const productsQuery = useQuery({
    queryKey: ["products", branchKey],
    queryFn: () => fetchJsonOr<Product[]>(`/api/products${branchParam}`, []),
    enabled: !branchLoading,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchJsonOr<{ id: number; name: string }[]>("/api/categories", []),
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetchJsonOr<{ id: number; name: string }[]>("/api/suppliers", []),
  });

  const products = Array.isArray(productsQuery.data) ? productsQuery.data : [];
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];
  const suppliers = Array.isArray(suppliersQuery.data) ? suppliersQuery.data : [];
  const loading =
    productsQuery.isPending || categoriesQuery.isPending || suppliersQuery.isPending;

  useEffect(() => {
    if (!isFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isFilterOpen]);

  // --- Global Barcode Scanner Listener ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const now = Date.now();
      const timeSinceLast = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (e.key === "Enter") {
        const code = barcodeBuffer.current.trim();
        barcodeBuffer.current = "";

        if (code.length >= 3) {
          // It looks like a barcode was scanned - check it
          handleBarcodeScanned(code);
        }
        return;
      }

      // If delay between keystrokes is large (manual typing), reset buffer
      if (
        timeSinceLast > SCANNER_SPEED_THRESHOLD_MS * 3 &&
        barcodeBuffer.current.length > 0
      ) {
        barcodeBuffer.current = "";
      }

      // Append character to buffer
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleBarcodeScanned = useCallback(
    async (code: string) => {
      setBarcodeToast(`🔍 جاري البحث عن باركود: ${code}`);
      try {
        const res = await fetch(
          `/api/inventory/check-barcode?code=${encodeURIComponent(code)}`,
        );
        if (res.status === 404) {
          // Product not found — redirect to new product page with barcode pre-filled
          setBarcodeToast(`➕ باركود جديد! جاري فتح نموذج إضافة منتج...`);
          setTimeout(() => {
            setBarcodeToast(null);
            router.push(`/inventory/new?barcode=${encodeURIComponent(code)}`);
          }, 800);
        } else if (res.ok) {
          const data = await res.json();
          // Product found — open stock-in modal with details pre-filled
          setBarcodeToast(`✅ تم العثور على: ${data.product.name}`);
          // Find the unit matching this barcode
          const matchedUnit = data.product.units.find(
            (u: any) => u.barcode === code,
          ) ?? data.product.units[0];
          const baseCost = Number(data.product.costPrice) || 0;
          const initialConversion = Number(matchedUnit?.conversionFactor) || 1;
          setTimeout(() => {
            setBarcodeToast(null);
            setStockInQty("");
            setStockInBaseCost(baseCost);
            setStockInCost(baseCost > 0 ? String(baseCost * initialConversion) : "");
            setStockInSupplierId(
              data.product.supplierId ? String(data.product.supplierId) : "",
            );
            setStockInExpiryDate("");
            setStockInPaidAmount("");
            setStockInModal({
              open: true,
              productId: data.product.id,
              productName: data.product.name,
              unitId: matchedUnit?.id ?? "",
              units: data.product.units,
              barcode: code,
            });
          }, 600);
        } else {
          setBarcodeToast(`❌ خطأ في البحث عن الباركود`);
          setTimeout(() => setBarcodeToast(null), 3000);
        }
      } catch (err) {
        console.error(err);
        setBarcodeToast(`❌ تعذر الاتصال بالخادم`);
        setTimeout(() => setBarcodeToast(null), 3000);
      }
    },
    [router],
  );

  const openRowStockIn = async (product: Product) => {
    setStockInRowLoadingId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`);
      const data = res.ok ? await res.json() : null;
      const rawUnits: any[] = data?.units ?? product.units ?? [];
      const units = rawUnits.map((u: any, i: number) => ({
        id: u.id ?? String(i),
        name: u.name,
        conversionFactor: Number(u.conversionFactor) || 1,
      }));
      const firstUnit = units[0];
      const baseCost = Number(data?.costPrice ?? product.costPrice) || 0;
      setStockInQty("");
      setStockInBaseCost(baseCost);
      setStockInCost(baseCost > 0 ? String(baseCost * (firstUnit?.conversionFactor ?? 1)) : "");
      setStockInSupplierId(data?.supplierId ? String(data.supplierId) : "");
      setStockInExpiryDate("");
      setStockInPaidAmount("");
      setStockInIsPrepaid(false);
      setStockInModal({
        open: true,
        productId: String(product.id),
        productName: product.name,
        unitId: firstUnit?.id ?? "",
        units,
        barcode: "",
      });
    } catch {
      toast.error("تعذر تحميل بيانات المنتج");
    } finally {
      setStockInRowLoadingId(null);
    }
  };

  const handleStockInSubmit = async () => {
    if (!stockInModal.productId || !stockInModal.unitId || !stockInQty) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }

    if (isOwner && selectedBranch?.id === "all" && branches.length > 1) {
      toast.error(
        "يرجى اختيار فرع محدد من الشريط العلوي أولاً لتعيين المخزون فيه",
      );
      return;
    }

    setStockInLoading(true);
    const stockInTotal = Number(stockInQty) * (Number(stockInCost) || 0);
    const resolvedPaidAmount = stockInSupplierId
      ? stockInIsPrepaid
        ? String(stockInTotal)
        : stockInPaidAmount || null
      : null;
    try {
      const res = await fetch("/api/inventory/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: stockInModal.productId,
          unitId: stockInModal.unitId,
          quantity: Number(stockInQty),
          costPrice: Number(stockInCost) || 0,
          expiryDate: stockInExpiryDate || null,
          supplierId: stockInSupplierId || null,
          paidAmount: resolvedPaidAmount,
          branchId:
            selectedBranch?.id !== "all"
              ? selectedBranch?.id
              : branches.length === 1
                ? branches[0].id
                : undefined,
        }),
      });
      if (res.ok) {
        setStockInModal((prev) => ({ ...prev, open: false }));
        setStockInIsPrepaid(false);
        fetchProducts(); // Refresh table
        queryClient.invalidateQueries({ queryKey: ["batches"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-expiry"] });
        queryClient.invalidateQueries({ queryKey: ["product-history"] });
      } else {
        const err = await res.json();
        toast.error(`خطأ: ${err.error || "فشل إدخال المخزون"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء إدخال المخزون");
    } finally {
      setStockInLoading(false);
    }
  };

  const fetchProducts = async () => {
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const handleDelete = async (id: number) => {
    if (
      !(await confirm({
        title: "حذف المنتج",
        message:
          "هل أنت متأكد من حذف هذا المنتج؟ سيتم حذف جميع الوحدات المرتبطة به.",
        variant: "danger",
        confirmLabel: "حذف",
      }))
    )
      return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingId(null);
        setRemovingId(id);
        setTimeout(async () => {
          await queryClient.invalidateQueries({ queryKey: ["products"] });
          setRemovingId(null);
          toast.success("تم حذف المنتج بنجاح ✅");
        }, 480);
      } else {
        const error = await res.json();
        toast.error(`خطأ: ${error.error || "فشل الحذف"}`);
        setDeletingId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحذف");
      setDeletingId(null);
    }
  };

  const handleToggleQuickSale = async (product: Product) => {
    const newValue = !product.isQuickSale;
    // Optimistic update
    queryClient.setQueryData<Product[]>(["products", branchKey], (prev) =>
      prev?.map((p) =>
        p.id === product.id ? { ...p, isQuickSale: newValue } : p,
      ),
    );
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isQuickSale: newValue }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        newValue
          ? `⚡ "${product.name}" أصبح في قسم البيع السريع`
          : `"${product.name}" أُزيل من البيع السريع`,
      );
    } catch {
      // Revert on error
      queryClient.setQueryData<Product[]>(["products", branchKey], (prev) =>
        prev?.map((p) =>
          p.id === product.id ? { ...p, isQuickSale: !newValue } : p,
        ),
      );
      toast.error("فشل تحديث حالة البيع السريع");
    }
  };

  const filteredProducts = products
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        filterCategory === "ALL" || String(p.categoryId) === filterCategory;
      const matchesSupplier =
        filterSupplier === "ALL" || String(p.supplierId) === filterSupplier;

      let matchesStock = true;
      const threshold = p.minimumStock > 0 ? p.minimumStock : 10;
      if (filterStock === "LOW")
        matchesStock = p.baseStock > 0 && p.baseStock <= threshold;
      if (filterStock === "OUT") matchesStock = p.baseStock === 0;

      return (
        matchesSearch && matchesCategory && matchesStock && matchesSupplier
      );
    })
    .sort((a, b) => {
      if (sortBy === "ID_ASC") return a.id - b.id;
      if (sortBy === "ID_DESC") return b.id - a.id;
      if (sortBy === "PRICE_HIGH") return b.costPrice - a.costPrice;
      if (sortBy === "PRICE_LOW") return a.costPrice - b.costPrice;
      if (sortBy === "STOCK_HIGH") return b.baseStock - a.baseStock;
      if (sortBy === "STOCK_LOW") return a.baseStock - b.baseStock;
      return 0; // Default (API sends ID DESC)
    });

  // Calculate Stats
  const totalProducts = products.length;
  const outOfStockCount = products.filter(p => p.baseStock === 0).length;
  const lowStockCount = products.filter((p) => {
    const threshold = p.minimumStock > 0 ? p.minimumStock : 10;
    return p.baseStock > 0 && p.baseStock <= threshold;
  }).length;
  const totalValue = products.reduce(
    (sum, p) => sum + p.costPrice * p.baseStock,
    0,
  );

  if (loading)
    return (
      <div
        className="min-h-screen p-6 md:p-8 space-y-8"
        dir="rtl"
        style={{ background: "var(--bg-page)" }}
      >
        {/* Hero */}
        <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#094B9F,#063A8A)",
                boxShadow: "0 12px 40px rgba(9,75,159,0.4)",
              }}
            >
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  background:
                    "linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)",
                }}
              />
              <Package size={36} className="text-white relative z-10 sk-spin" />
            </div>
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white sk-pulse"
              style={{
                background: "linear-gradient(135deg,#094B9F,#063A8A)",
                boxShadow: "0 2px 8px rgba(14,99,212,0.5)",
              }}
            />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-xl font-black text-slate-800">
              جاري تحميل المخزون
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400 sk-pulse"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
            <p className="text-sm text-slate-400 font-medium">
              يتم تحميل قائمة المنتجات والمخزون
            </p>
          </div>
        </div>
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton w-8 h-8 rounded-xl" />
              </div>
              <div className="skeleton h-7 w-20" />
            </div>
          ))}
        </div>
        {/* Search + filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="skeleton h-10 flex-1 min-w-[200px] rounded-xl" />
          <div className="skeleton h-10 w-32 rounded-xl" />
          <div className="skeleton h-10 w-32 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div className="grid grid-cols-6 gap-3 px-5 py-3.5 border-b border-slate-100">
            {[8, 30, 18, 15, 15, 14].map((w, i) => (
              <div
                key={i}
                className="skeleton h-3"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-6 gap-3 px-5 py-4 items-center"
              >
                <div className="skeleton w-9 h-9 rounded-xl" />
                <div className="space-y-1.5">
                  <div className="skeleton h-3.5 w-36" />
                  <div className="skeleton h-2.5 w-20" />
                </div>
                {[20, 15, 15, 18].map((w, j) => (
                  <div
                    key={j}
                    className="skeleton h-3.5"
                    style={{ width: `${w - ((i * 4 + j * 3) % 10)}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <div
      className="min-h-screen p-6 md:p-8"
      dir="rtl"
      style={{ background: "var(--bg-page)" }}
    >
      {dialog}
      <style>{`
        @keyframes rowDeletingPulse {
          0%, 100% { background-color: rgba(254, 226, 226, 0.45); }
          50%      { background-color: rgba(254, 202, 202, 0.75); }
        }
        .row-deleting {
          animation: rowDeletingPulse 1.1s ease-in-out infinite;
          box-shadow: inset 3px 0 0 0 #ef4444;
        }
        @keyframes rowRemoving {
          0%   { transform: translateX(0);    opacity: 1; background-color: rgba(254, 202, 202, 0.75); }
          35%  { transform: translateX(0);    opacity: 1; background-color: rgba(254, 202, 202, 0.95); }
          100% { transform: translateX(40px); opacity: 0; background-color: rgba(254, 202, 202, 0);    }
        }
        .row-removing {
          animation: rowRemoving 0.48s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .row-removing > td > * { transition: opacity 0.3s; opacity: 0.35; }
      `}</style>

      {/* Import Modal */}
      {importOpen && (
        <ImportModal
          onClose={() => {
            setImportOpen(false);
            setFilterStock("ALL");
            setSearch("");
            fetchProducts();
          }}
          onImported={fetchProducts}
        />
      )}

      {/* Barcode Toast Notification */}
      {barcodeToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 animate-fade-in-up">
          <ScanLine size={20} className="text-blue-400 animate-pulse" />
          {barcodeToast}
        </div>
      )}

      {/* Stock-In Quick Modal */}
      {stockInModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          dir="rtl"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100"
            style={{
              boxShadow:
                "0 25px 60px rgba(9,75,159,.15), 0 8px 24px rgba(0,0,0,.08)",
            }}
          >
            {/* ── Header ── */}
            <div
              className="relative px-5 py-4 shrink-0 overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#094B9F 0%,#063A8A 100%)",
              }}
            >
              {/* subtle grid pattern */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,.3) 20px,rgba(255,255,255,.3) 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,.3) 20px,rgba(255,255,255,.3) 21px)",
                }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <ScanLine size={20} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-blue-200 text-[10px] font-bold uppercase tracking-wider">
                        باركود
                      </span>
                      <span className="text-white/80 text-[11px] font-mono">
                        {stockInModal.barcode}
                      </span>
                    </div>
                    <h3 className="text-white font-black text-base leading-tight truncate">
                      {stockInModal.productName}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setStockInModal((prev) => ({ ...prev, open: false }))
                  }
                  className="w-8 h-8 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-lg transition-colors shrink-0"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="p-5 space-y-4">
              {/* Section label */}
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg,#094B9F,#063A8A)",
                  }}
                >
                  <Package size={11} className="text-white" />
                </div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  بيانات الإدخال
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Row 1: Unit + Quantity + Cost */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1.5">
                    الوحدة
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all appearance-none cursor-pointer"
                    value={stockInModal.unitId}
                    onChange={(e) => {
                      const selectedUnit = stockInModal.units.find(u => u.id === e.target.value);
                      const conversion = Number(selectedUnit?.conversionFactor) || 1;
                      setStockInModal((prev) => ({ ...prev, unitId: e.target.value }));
                      if (stockInBaseCost > 0) {
                        setStockInCost(String(stockInBaseCost * conversion));
                      }
                    }}
                  >
                    {stockInModal.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (x{u.conversionFactor})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1.5">
                    الكمية <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    autoFocus
                    required
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all text-center"
                    placeholder="0"
                    value={stockInQty}
                    onChange={(e) => setStockInQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1.5">
                    سعر الشراء
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 pl-8 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all text-left"
                      placeholder="0"
                      value={stockInCost}
                      onChange={(e) => setStockInCost(e.target.value)}
                    />
                    <DollarSign
                      className="absolute left-2.5 top-3 text-slate-400"
                      size={13}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Expiry Date */}
              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1.5">
                  <Calendar size={11} className="text-slate-400" />
                  تاريخ الانتهاء{" "}
                  <span className="text-slate-300 font-normal">(اختياري)</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 pl-9 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                    value={stockInExpiryDate}
                    onChange={(e) => setStockInExpiryDate(e.target.value)}
                  />
                  <Calendar
                    className="absolute left-3 top-3 text-slate-400"
                    size={13}
                  />
                </div>
              </div>

              {/* Section label — invoice */}
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg,#10b981,#059669)",
                  }}
                >
                  <DollarSign size={11} className="text-white" />
                </div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  فاتورة الشراء
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Row 3: Supplier + Paid Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1.5">
                    المورد
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all appearance-none cursor-pointer"
                    value={stockInSupplierId}
                    onChange={(e) => {
                      setStockInSupplierId(e.target.value);
                      setStockInPaidAmount("");
                      setStockInIsPrepaid(false);
                    }}
                  >
                    <option value="">نقدي عام</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1.5">
                    المبلغ المدفوع
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!stockInSupplierId || stockInIsPrepaid}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    placeholder={!stockInSupplierId ? "اختر المورد أولاً" : stockInIsPrepaid ? "مدفوع بالكامل" : "0"}
                    value={stockInIsPrepaid ? "" : stockInPaidAmount}
                    onChange={(e) => setStockInPaidAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Prepaid checkbox — يظهر فقط عند اختيار مورد */}
              {stockInSupplierId && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={stockInIsPrepaid}
                      onChange={(e) => {
                        setStockInIsPrepaid(e.target.checked);
                        if (e.target.checked) setStockInPaidAmount("");
                      }}
                    />
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${stockInIsPrepaid ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white group-hover:border-blue-400"}`}>
                      {stockInIsPrepaid && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-600">
                    تم شراء هذا المخزون مسبقاً
                    <span className="text-slate-400 font-normal mr-1">(مدفوع بالكامل — لا دين على المورد)</span>
                  </span>
                </label>
              )}

              {/* Financial summary */}
              {stockInSupplierId &&
                (() => {
                  const total =
                    Number(stockInQty || 0) * Number(stockInCost || 0);
                  const paid = Number(stockInPaidAmount || 0);
                  const remaining = total - paid;
                  return (
                    <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-slate-100">
                      <div className="px-3 py-2.5 bg-slate-50 text-center border-l border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">
                          الإجمالي
                        </div>
                        <div className="text-sm font-black text-slate-700">
                          {formatCurrency(total)}
                        </div>
                      </div>
                      <div className="px-3 py-2.5 bg-emerald-50 text-center border-l border-slate-100">
                        <div className="text-[10px] font-bold text-emerald-500 mb-0.5">
                          المدفوع
                        </div>
                        <div className="text-sm font-black text-emerald-600">
                          {formatCurrency(paid)}
                        </div>
                      </div>
                      <div
                        className={`px-3 py-2.5 text-center ${remaining > 0 ? "bg-red-50" : remaining < 0 ? "bg-orange-50" : "bg-emerald-50"}`}
                      >
                        <div
                          className={`text-[10px] font-bold mb-0.5 ${remaining > 0 ? "text-red-400" : remaining < 0 ? "text-orange-400" : "text-emerald-500"}`}
                        >
                          {remaining > 0
                            ? "الدين"
                            : remaining < 0
                              ? "زيادة"
                              : "مسدد"}
                        </div>
                        <div
                          className={`text-sm font-black ${remaining > 0 ? "text-red-600" : remaining < 0 ? "text-orange-600" : "text-emerald-600"}`}
                        >
                          {formatCurrency(Math.abs(remaining))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* ── Footer ── */}
            <div className="px-5 pb-5 pt-0 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setStockInModal((prev) => ({ ...prev, open: false }))
                }
                className="px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleStockInSubmit}
                disabled={stockInLoading}
                className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-lg"
                style={{
                  background: "linear-gradient(135deg,#094B9F 0%,#063A8A 100%)",
                  boxShadow: "0 6px 20px rgba(9,75,159,.35)",
                }}
              >
                {stockInLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {stockInLoading ? "جاري الحفظ..." : "حفظ المخزون"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader
          title="إدارة المخزون"
          subtitle="إضافة وتعديل وحذف المنتجات وإدارة الأصناف والموردين."
          icon={Package}
          actions={
            <div className="flex flex-wrap gap-3">
              <HowItWorks
                label="كيف يعمل المخزون؟"
                title="كيف تعمل إدارة المخزون؟"
                steps={[
                  {
                    icon: Search,
                    title: "البحث والتصفية",
                    description:
                      "استخدم خانة البحث للعثور على منتج بالاسم، أو فلتر القائمة حسب الفئة، المورد، أو حالة المخزون (منخفض / نافد).",
                    gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
                    shadow: "rgba(9,75,159,0.3)",
                  },
                  {
                    icon: Package,
                    title: "إدخال مخزون",
                    description:
                      'عند استلام بضاعة جديدة اضغط زر "إدخال مخزون"، أدخل الكمية وسعر الشراء وتاريخ الانتهاء — يُسجَّل كدفعة مستقلة لمتابعة تكلفة المخزون.',
                    gradient: "linear-gradient(135deg,#10b981,#059669)",
                    shadow: "rgba(16,185,129,0.3)",
                  },
                  {
                    icon: AlertCircle,
                    title: "الحد الأدنى للتنبيه",
                    description:
                      "كل منتج له حد أدنى للمخزون. عند الوصول إليه يظهر تنبيه في لوحة القيادة وفي قائمة النواقص بمستشار المشتريات.",
                    gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
                    shadow: "rgba(245,158,11,0.3)",
                  },
                  {
                    icon: Tag,
                    title: "وحدات البيع المتعددة",
                    description:
                      "يمكن لكل منتج أن يُباع بوحدات مختلفة (قطعة / كرتون / باكيت). أضف وحداتها وأسعارها من صفحة تعديل المنتج.",
                    gradient: "linear-gradient(135deg,#094B9F,#063A8A)",
                    shadow: "rgba(14,99,212,0.3)",
                  },
                  {
                    icon: Upload,
                    title: "استيراد جماعي من Excel",
                    description:
                      'لديك قائمة منتجات؟ استخدم زر "استيراد Excel" لتحميلها دفعةً واحدة بدلاً من الإدخال اليدوي.',
                    gradient: "linear-gradient(135deg,#06b6d4,#0891b2)",
                    shadow: "rgba(6,182,212,0.3)",
                  },
                ]}
              />
              {userLoading ? (
                <div className="flex gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-9 w-24 rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <ToolbarIconButton
                    label="طباعة ملصقات"
                    icon={Printer}
                    href="/inventory/print-labels"
                    hover="hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700"
                  />
                  <ToolbarIconButton
                    label="الأقسام"
                    icon={FolderTree}
                    href="/inventory/categories"
                    hover="hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                  />
                  {isAdmin && (
                    <ToolbarIconButton
                      label="إدخال مخزون"
                      icon={Package}
                      href="/inventory/stock-in"
                      hover="hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
                    />
                  )}
                  {isAdmin && (
                    <ToolbarIconButton
                      label="استيراد Excel"
                      icon={Upload}
                      onClick={() => setImportOpen(true)}
                      hover="hover:bg-cyan-50 hover:border-cyan-200 hover:text-cyan-700"
                    />
                  )}
                  {isAdmin && (
                    <Link href="/inventory/new" className="btn-primary group">
                      <Plus
                        size={20}
                        className="group-hover:rotate-90 transition-transform"
                      />
                      <span>إضافة منتج جديد</span>
                    </Link>
                  )}
                </>
              )}
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="إجمالي المنتجات"
            value={totalProducts}
            icon={Package}
            gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
            onClick={() => { setFilterStock("ALL"); setFilterCategory("ALL"); setFilterSupplier("ALL"); setSearch(""); }}
          />
          <StatCard
            label="مخزون منخفض"
            value={lowStockCount}
            icon={AlertCircle}
            gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            valueColor={lowStockCount > 0 ? "var(--value-negative)" : undefined}
            onClick={() => setFilterStock("LOW")}
          />
          <StatCard
            label="نافذ من المخزون"
            value={outOfStockCount}
            icon={PackageX}
            gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
            valueColor={outOfStockCount > 0 ? "var(--value-negative)" : undefined}
            onClick={() => setFilterStock("OUT")}
          />
          <StatCard
            label="القيمة التقديرية"
            value={formatCurrency(totalValue)}
            icon={DollarSign}
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
            valueColor="var(--value-positive)"
          />
        </div>

        {/* Filters & Search */}
        <div className="bg-[var(--bg-card)] p-4 rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] flex flex-col md:flex-row gap-4 items-center justify-between relative z-20">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="بحث عن منتج بالاسم..."
                className="block w-full pr-10 pl-4 py-3 border border-[var(--border-color)] rounded-xl focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-[var(--bg-page)] hover:bg-[var(--bg-card)] transition-colors text-right"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span
              className="hidden md:flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-2 rounded-xl flex-shrink-0"
              title="وضع المسح بالباركود نشط — امسح أي باركود لفتح نافذة إدخال المخزون تلقائياً"
            >
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <ScanLine size={13} />
              باركود
            </span>
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border ${isFilterOpen ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
            >
              <Filter size={18} />
              <span>تصفية متقدمة</span>
              {(filterCategory !== "ALL" ||
                filterStock !== "ALL" ||
                filterSupplier !== "ALL" ||
                sortBy !== "NEWEST") && (
                <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2"></span>
              )}
            </button>

            {/* Filter Dropdown */}
            {isFilterOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-30 animate-fade-in-up">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      ترتيب حسب
                    </label>
                    <select
                      className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="NEWEST">الأحدث إضافة (الافتراضي)</option>
                      <option value="ID_ASC">
                        الرقم التسلسلي (تصاعدي 1-10)
                      </option>
                      <option value="ID_DESC">
                        الرقم التسلسلي (تنازلي 10-1)
                      </option>
                      <option value="STOCK_HIGH">الأكثر مخزوناً</option>
                      <option value="STOCK_LOW">الأقل مخزوناً</option>
                      <option value="PRICE_HIGH">الأعلى سعراً (تكلفة)</option>
                      <option value="PRICE_LOW">الأقل سعراً (تكلفة)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      حالة المخزون
                    </label>
                    <select
                      className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterStock}
                      onChange={(e) => setFilterStock(e.target.value)}
                    >
                      <option value="ALL">الكل</option>
                      <option value="LOW">مخزون منخفض (دون الحد الأدنى)</option>
                      <option value="OUT">نافذ من المخزون (0)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      القسم
                    </label>
                    <select
                      className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="ALL">جميع الأقسام</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      المورد
                    </label>
                    <select
                      className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filterSupplier}
                      onChange={(e) => setFilterSupplier(e.target.value)}
                    >
                      <option value="ALL">جميع الموردين</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setFilterCategory("ALL");
                      setFilterStock("ALL");
                      setFilterSupplier("ALL");
                      setSortBy("NEWEST");
                      setIsFilterOpen(false);
                    }}
                    className="w-full text-center text-sm text-red-500 font-bold hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    إزالة التصفية
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results counter */}
        {!loading && (
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              {filteredProducts.length === products.length
                ? `${products.length} منتج`
                : `يعرض ${filteredProducts.length} من ${products.length} منتج`}
            </p>
            {(filterStock !== "ALL" || filterCategory !== "ALL" || filterSupplier !== "ALL" || search) && (
              <button
                onClick={() => { setFilterStock("ALL"); setFilterCategory("ALL"); setFilterSupplier("ALL"); setSearch(""); }}
                className="text-xs font-bold text-red-500 hover:text-red-600 hover:underline transition-colors"
              >
                إزالة كل الفلاتر
              </button>
            )}
          </div>
        )}

        {/* Products Table */}
        <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right data-table">
              {/* ستة أعمدة بدل عشرة: القسم والمورد ضُمّا إلى خلية المنتج، والحد
                  الأدنى إلى المخزون، والتكلفة إلى الأسعار. الحشوة px-3 بدل px-6
                  (كانت وحدها تستهلك ~480px). الهدف: لا تمرير أفقي على شاشة عادية. */}
              <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-10">
                    #
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    المنتج
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    المخزون
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    التكلفة والأسعار
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Zap size={13} className="text-blue-500" />
                      سريع
                    </span>
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-12 text-center text-gray-400 animate-pulse"
                    >
                      جاري تحميل البيانات...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Package size={48} className="text-gray-200" />
                        <p>لا توجد منتجات مطابقة للبحث أو التصفية.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, idx) => {
                    const isRowDeleting = deletingId === product.id;
                    const isRowRemoving = removingId === product.id;
                    return (
                      <tr
                        key={product.id}
                        className={`group transition-colors ${isRowRemoving ? "row-removing" : isRowDeleting ? "row-deleting" : "hover:bg-blue-50/50"}`}
                      >
                        <td className="px-3 py-3 text-center align-top">
                          <span className="text-sm font-bold text-gray-600">
                            {idx + 1}
                          </span>
                        </td>
                        {/* المنتج + القسم + المورد في خلية واحدة (كانت ثلاثة أعمدة) */}
                        <td className="px-3 py-3 align-top">
                          <span className="font-semibold text-gray-800 text-sm block leading-snug">
                            {product.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[11px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                              {product.category?.name || "بدون قسم"}
                            </span>
                            {product.supplier?.name && (
                              <span className="text-[11px] font-bold text-blue-600">
                                {product.supplier.name}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* المخزون + الحد الأدنى (كانا عمودين) */}
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          {(() => {
                            const threshold =
                              product.minimumStock > 0
                                ? product.minimumStock
                                : 10;
                            const isLow = product.baseStock <= threshold;
                            const isOut = product.baseStock === 0;
                            return (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-bold ${
                                  isOut
                                    ? "bg-red-50 text-red-600 border border-red-200"
                                    : isLow
                                      ? "bg-amber-50 text-amber-600 border border-amber-200"
                                      : "bg-green-50 text-green-700 border border-green-200"
                                }`}
                              >
                                {product.baseStock}
                                <span className="text-xs font-medium opacity-70">
                                  وحدة
                                </span>
                              </span>
                            );
                          })()}
                          <p className="text-[11px] text-gray-400 mt-1">
                            الحد الأدنى:{" "}
                            {product.minimumStock > 0
                              ? product.minimumStock
                              : "—"}
                          </p>
                        </td>
                        {/* التكلفة + وحدات البيع وأسعارها (كانا عمودين) */}
                        <td className="px-3 py-3 align-top">
                          <p className="text-[11px] text-gray-400 mb-1 whitespace-nowrap">
                            التكلفة:{" "}
                            <span className="text-gray-600 font-medium">
                              {formatCurrency(Number(product.costPrice))}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {product.units.map((u, idx) => (
                              <span
                                key={idx}
                                className="bg-gray-100 text-gray-700 text-[11px] px-1.5 py-0.5 rounded border border-gray-200 font-medium whitespace-nowrap"
                              >
                                {u.name}:{" "}
                                <span className="text-blue-600 font-bold">
                                  {formatCurrency(Number(u.price))}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        {/* زرّ مضغوط (36px) بدل مفتاح بعرض 96px — الحالة يحملها
                            اللون والأيقونة، والنص انتقل إلى title/aria. */}
                        <td className="px-3 py-3 text-center align-top">
                          <button
                            onClick={() => handleToggleQuickSale(product)}
                            aria-pressed={!!product.isQuickSale}
                            title={
                              product.isQuickSale
                                ? "بيع سريع: مفعّل — انقر للإلغاء"
                                : "بيع سريع: معطّل — انقر للتفعيل"
                            }
                            className={`w-9 h-9 inline-flex items-center justify-center rounded-lg transition-all active:scale-90 ${
                              product.isQuickSale
                                ? "bg-gradient-to-l from-blue-400 to-blue-500 text-white shadow-md shadow-blue-200"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500"
                            }`}
                          >
                            <Zap
                              size={15}
                              className={
                                product.isQuickSale
                                  ? "fill-white drop-shadow"
                                  : ""
                              }
                            />
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center align-top">
                          <div className="flex items-center justify-center gap-1">
                            {isAdmin && (
                              <RowAction
                                label="إدخال مخزون"
                                icon={ArrowDownToLine}
                                onClick={() => openRowStockIn(product)}
                                color="text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                loading={stockInRowLoadingId === product.id}
                                disabled={stockInRowLoadingId === product.id}
                              />
                            )}
                            {isAdmin && (
                              <RowAction
                                label="تعديل المنتج"
                                icon={Pencil}
                                href={`/inventory/edit/${product.id}`}
                                color="text-blue-600 bg-blue-50 hover:bg-blue-100"
                              />
                            )}
                            <RowAction
                              label="سجل الحركة"
                              icon={History}
                              href={`/inventory/history/${product.id}`}
                              color="text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700"
                            />
                            {isAdmin && (
                              <RowAction
                                label="حذف المنتج"
                                icon={Trash2}
                                onClick={() => handleDelete(product.id)}
                                color={
                                  isRowDeleting
                                    ? "text-red-600 bg-red-50"
                                    : "text-gray-400 bg-gray-50 hover:bg-red-50 hover:text-red-600"
                                }
                                loading={isRowDeleting}
                                disabled={isRowDeleting || isRowRemoving}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
