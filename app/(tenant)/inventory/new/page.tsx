"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Layers,
  DollarSign,
  Scan,
  Save,
  X,
  Loader2,
  Plus,
  Search,
  ChevronDown,
  Package,
  Tag,
  Truck,
  Hash,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import toast from "react-hot-toast";

interface UnitInput {
  name: string;
  conversion: number;
  barcode: string;
  price: number;
  initialQty: number;
}

export default function NewProductPage() {
  usePageTitle('إضافة منتج');
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledBarcode = searchParams.get("barcode") || "";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseCost, setBaseCost] = useState(0);
  const [minimumStock, setMinimumStock] = useState(0);
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<
    { id: number; name: string; parentId: number | null }[]
  >([]);
  const [categoryId, setCategoryId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [supplierId, setSupplierId] = useState("");
  const [isPrepaid, setIsPrepaid] = useState(false);

  const [units, setUnits] = useState<UnitInput[]>([
    {
      name: "قطعة",
      conversion: 1,
      barcode: prefilledBarcode,
      price: 0,
      initialQty: 0,
    },
  ]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        categoryRef.current &&
        !categoryRef.current.contains(e.target as Node)
      )
        setCategoryOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCategories(d))
      .catch(() => {});
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setSuppliers(d))
      .catch(() => {});
  }, []);

  const addUnit = () =>
    setUnits((u) => [
      ...u,
      {
        name: "وحدة جديدة",
        conversion: 1,
        barcode: "",
        price: 0,
        initialQty: 0,
      },
    ]);
  const removeUnit = (i: number) =>
    units.length > 1 && setUnits((u) => u.filter((_, idx) => idx !== i));
  const updateUnit = (
    i: number,
    field: keyof UnitInput,
    value: string | number,
  ) =>
    setUnits((u) =>
      u.map((unit, idx) => (idx === i ? { ...unit, [field]: value } : unit)),
    );

  // Total base qty preview
  const totalBaseQty = units.reduce(
    (sum, u) => sum + (Number(u.initialQty) || 0) * Number(u.conversion),
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          baseCost,
          minimumStock,
          units,
          categoryId: categoryId || null,
          supplierId: supplierId || null,
          expiryDate: expiryDate || null,
          isPrepaid: supplierId ? isPrepaid : false,
        }),
      });
      if (!res.ok) throw new Error("فشل إنشاء المنتج");
      toast.success("تم إنشاء المنتج بنجاح!");
      router.push("/inventory");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
      setSaving(false);
    }
  };

  const selectedCategoryName = categories.find(
    (c) => String(c.id) === categoryId,
  )?.name;

  return (
    <form
      onSubmit={handleSubmit}
      dir="rtl"
      className="flex flex-col gap-4 h-[calc(100vh-5rem)]"
    >
      {/* ─── Header bar ─── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg,#094B9F 0%,#063A8A 100%)",
              boxShadow: "0 8px 20px rgba(9,75,159,.3)",
            }}
          >
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              إضافة منتج جديد
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              أدخل بيانات المنتج ووحداته
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/inventory")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
          >
            <X size={15} />
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {saving ? "جاري الحفظ..." : "حفظ المنتج"}
          </button>
        </div>
      </div>

      {/* ─── Two-column body ─── */}
      <div className="flex-1 grid grid-cols-5 gap-4 min-h-0">
        {/* ── LEFT: Basic Details (2 cols) ── */}
        <div className="col-span-2 glass-panel flex flex-col overflow-hidden">
          <div
            className="flex items-center gap-3 px-5 py-4 border-b border-white/40 shrink-0"
            style={{
              background:
                "linear-gradient(135deg,rgba(9,75,159,.05) 0%,transparent 60%)",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg,#094B9F,#063A8A)",
                boxShadow: "0 4px 12px rgba(9,75,159,.3)",
              }}
            >
              <Box className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-bold text-slate-700 text-sm">
              البيانات الأساسية
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Name */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Package size={12} className="text-blue-400" />
                اسم المنتج <span className="text-red-400">*</span>
              </label>
              <input
                required
                autoFocus
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder-slate-300 shadow-sm"
                placeholder="مثال: بيبسي 330 مل"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Hash size={12} className="text-blue-400" />
                الوصف{" "}
                <span className="text-slate-300 font-normal">(اختياري)</span>
              </label>
              <input
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder-slate-300 shadow-sm"
                placeholder="وصف مختصر..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Category */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Tag size={12} className="text-blue-400" />
                القسم / التصنيف
              </label>
              <div className="relative" ref={categoryRef}>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryOpen((o) => !o);
                    setCategorySearch("");
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-between gap-2 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm"
                >
                  <span
                    className={
                      selectedCategoryName ? "text-slate-800" : "text-slate-300"
                    }
                  >
                    {selectedCategoryName ?? "-- اختر القسم --"}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-slate-400 transition-transform ${categoryOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {categoryOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <div className="relative">
                        <input
                          autoFocus
                          className="w-full bg-slate-50 border border-slate-200 py-2 px-3 pr-8 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 text-slate-800 placeholder-slate-300"
                          placeholder="ابحث..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Escape" && setCategoryOpen(false)
                          }
                        />
                        <Search
                          size={13}
                          className="absolute right-3 top-2.5 text-slate-400"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryId("");
                          setCategoryOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 text-xs text-slate-400 hover:bg-slate-50 transition-colors"
                      >
                        -- بدون قسم --
                      </button>
                      {(() => {
                        const q = categorySearch.toLowerCase();
                        const list = q
                          ? categories.filter((c) =>
                              c.name.toLowerCase().includes(q),
                            )
                          : categories;
                        return list.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategoryId(String(cat.id));
                              setCategoryOpen(false);
                            }}
                            className={`w-full text-right px-4 py-2.5 text-sm transition-colors font-semibold ${String(cat.id) === categoryId ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
                          >
                            {cat.parentId && (
                              <span className="text-slate-300 ml-1">↳</span>
                            )}
                            {cat.name}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Supplier */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Truck size={12} className="text-blue-400" />
                المورد المعتاد{" "}
                <span className="text-slate-300 font-normal">(اختياري)</span>
              </label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer"
                value={supplierId}
                onChange={(e) => { setSupplierId(e.target.value); setIsPrepaid(false); }}
              >
                <option value="">-- اختر المورد --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Prepaid checkbox — يظهر عند اختيار مورد وكمية ابتدائية */}
              {supplierId && totalBaseQty > 0 && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none group mt-2.5">
                  <div className="relative flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isPrepaid}
                      onChange={(e) => setIsPrepaid(e.target.checked)}
                    />
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isPrepaid ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white group-hover:border-blue-400"}`}>
                      {isPrepaid && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-600">
                    تم شراء الكمية الابتدائية مسبقاً
                    <span className="text-slate-400 font-normal mr-1">(مدفوع بالكامل — لا دين على المورد)</span>
                  </span>
                </label>
              )}
            </div>

            {/* Base Cost */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <DollarSign size={12} className="text-blue-400" />
                تكلفة الشراء{" "}
                <span className="text-slate-400 font-normal">
                  (للوحدة الأصغر)
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  dir="ltr"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm text-left"
                  value={baseCost}
                  onChange={(e) => setBaseCost(Number(e.target.value))}
                />
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                السعر الذي تدفعه للمورد مقابل أصغر وحدة
              </p>
            </div>

            {/* Minimum Stock */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <AlertTriangle size={12} className="text-blue-400" />
                الحد الأدنى للمخزون
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  dir="ltr"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-sm text-left"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(Number(e.target.value))}
                />
                <AlertTriangle className="absolute left-3 top-2.5 w-4 h-4 text-blue-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                عند انخفاض المخزون لهذا الرقم يُعتبر المنتج ناقصاً في التقارير
                والتنبيهات
              </p>
            </div>

            {/* Expiry Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <CalendarClock size={12} className="text-rose-400" />
                تاريخ الصلاحية{" "}
                <span className="text-slate-300 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  dir="ltr"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 transition-all shadow-sm text-left"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                <CalendarClock className="absolute left-3 top-2.5 w-4 h-4 text-rose-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                يُطبَّق على دفعة المخزون الأولية ويُستخدم في تنبيهات قرب انتهاء
                الصلاحية
              </p>
            </div>

            {/* Initial stock summary */}
            {totalBaseQty > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <p className="text-xs font-bold text-emerald-700 mb-0.5">
                  المخزون الأولي الإجمالي
                </p>
                <p className="text-lg font-black text-emerald-600">
                  {totalBaseQty.toLocaleString()}{" "}
                  <span className="text-sm font-bold">قطعة (وحدة أساسية)</span>
                </p>
                <p className="text-[10px] text-emerald-500 mt-0.5">
                  = مجموع (الكمية × المعامل) لكل وحدة
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Units & Pricing (3 cols) ── */}
        <div className="col-span-3 glass-panel flex flex-col overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b border-white/40 shrink-0"
            style={{
              background:
                "linear-gradient(135deg,rgba(16,185,129,.05) 0%,transparent 60%)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  boxShadow: "0 3px 8px rgba(16,185,129,.3)",
                }}
              >
                <Layers className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-700 text-sm">
                  الوحدات والتسعير
                </h2>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                  {units.length} وحدة
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={addUnit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                boxShadow: "0 3px 8px rgba(16,185,129,.25)",
                color: "white",
              }}
            >
              <Plus size={11} />
              إضافة وحدة
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-50/60 border-b border-slate-100 shrink-0">
            {[
              { label: "اسم الوحدة", cols: "col-span-3" },
              { label: "المعامل", cols: "col-span-2" },
              { label: "الباركود", cols: "col-span-2" },
              { label: "الكمية الأولية", cols: "col-span-2" },
              { label: "سعر البيع", cols: "col-span-3" },
            ].map((h) => (
              <div
                key={h.label}
                className={`${h.cols} text-[10px] font-bold text-slate-400 uppercase tracking-wide`}
              >
                {h.label}
              </div>
            ))}
          </div>

          {/* Units list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {units.map((unit, i) => (
              <div
                key={i}
                className={`grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg border transition-all ${i === 0 ? "bg-emerald-50/40 border-emerald-100" : "bg-white border-slate-100 hover:border-slate-200"}`}
              >
                {/* Name */}
                <div className="col-span-3 relative">
                  <input
                    required
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all placeholder-slate-300"
                    value={unit.name}
                    onChange={(e) => updateUnit(i, "name", e.target.value)}
                    placeholder="قطعة"
                  />
                  {i === 0 && (
                    <span className="absolute -top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full leading-none">
                      افتراضية
                    </span>
                  )}
                </div>

                {/* Conversion */}
                <div className="col-span-2">
                  <input
                    type="number"
                    required
                    min="1"
                    disabled={i === 0}
                    className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none transition-all ${i === 0 ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400"}`}
                    value={unit.conversion}
                    onChange={(e) =>
                      updateUnit(i, "conversion", Number(e.target.value))
                    }
                  />
                </div>

                {/* Barcode */}
                <div className="col-span-2 relative">
                  <input
                    dir="ltr"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 pl-6 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all placeholder-slate-300 text-left"
                    placeholder="Scan..."
                    value={unit.barcode}
                    onChange={(e) => updateUnit(i, "barcode", e.target.value)}
                  />
                  <Scan className="absolute left-1.5 top-2 w-3 h-3 text-slate-400" />
                </div>

                {/* Initial Qty */}
                <div className="col-span-2 relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all text-center"
                    value={unit.initialQty || ""}
                    placeholder="0"
                    onChange={(e) =>
                      updateUnit(i, "initialQty", Number(e.target.value))
                    }
                  />
                  {unit.initialQty > 0 && (
                    <span className="absolute -top-1.5 left-1 text-[8px] font-black text-blue-500 bg-blue-50 border border-blue-100 px-1 py-0.5 rounded-full leading-none whitespace-nowrap">
                      = {(unit.initialQty * unit.conversion).toLocaleString()} ق
                    </span>
                  )}
                </div>

                {/* Price + Delete */}
                <div className="col-span-3 flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    className="price-input flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all"
                    value={unit.price}
                    onChange={(e) =>
                      updateUnit(i, "price", Number(e.target.value))
                    }
                  />
                  {i > 0 ? (
                    <button
                      type="button"
                      onClick={() => removeUnit(i)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <div className="w-6 shrink-0" />
                  )}
                </div>
              </div>
            ))}

            {units.length === 1 && (
              <button
                type="button"
                onClick={addUnit}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-[11px] font-bold text-slate-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus size={12} />
                أضف وحدة أخرى (كرتون، صندوق، ...)
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
