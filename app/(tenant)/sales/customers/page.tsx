"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  MapPin,
  DollarSign,
  X,
  FileText,
  ChevronDown,
  Package,
  Wallet,
  ShoppingCart,
  AlertCircle,
  UserCheck,
  Loader2,
  Store,
  Building2,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useUser } from "@/hooks/useUser";
import PageHeader from "@/components/ui/PageHeader";
import { useBranch } from "@/contexts/BranchContext";
import { useConfirm } from "@/hooks/useConfirm";
import toast from "react-hot-toast";
interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  balance: number;
  branchId?: string | null;
  _count?: { transactions: number };
}

/* Avatar colour derived deterministically from the name so each customer keeps a stable colour */
const AVATAR_THEMES = [
  { bg: "bg-blue-100", text: "text-blue-600", ring: "ring-blue-200" },
  { bg: "bg-emerald-100", text: "text-emerald-600", ring: "ring-emerald-200" },
  { bg: "bg-blue-100", text: "text-blue-600", ring: "ring-blue-200" },
  { bg: "bg-rose-100", text: "text-rose-600", ring: "ring-rose-200" },
  { bg: "bg-violet-100", text: "text-violet-600", ring: "ring-violet-200" },
  { bg: "bg-cyan-100", text: "text-cyan-600", ring: "ring-cyan-200" },
];
const avatarTheme = (name: string) =>
  AVATAR_THEMES[
    [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_THEMES.length
  ];

/* Icon-only card action with a hover tooltip showing its purpose */
function CardAction({
  label,
  icon: Icon,
  onClick,
  color,
  loading = false,
  disabled = false,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  color: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative group/tip">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        disabled={disabled || loading}
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${color}`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Icon size={16} />
        )}
      </button>
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

export default function CustomersPage() {
  usePageTitle('العملاء');
  const { isAdmin } = useUser();
  const { selectedBranch, loading: branchLoading } = useBranch();
  const { confirm, dialog } = useConfirm();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debtFilter, setDebtFilter] = useState<"ALL" | "DEBT" | "CLEAR">("ALL");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "BRANCH" | "ORG">(
    "ALL",
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    address: string;
    initialBalance: string;
    creditLimit: string;
  }>({
    name: "",
    phone: "",
    address: "",
    initialBalance: "0",
    creditLimit: "0",
  });

  useEffect(() => {
    if (branchLoading) return;
    fetchCustomers();
  }, [selectedBranch, branchLoading]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const branchQuery = selectedBranch?.id
        ? `?branchId=${selectedBranch.id}`
        : "";
      const res = await fetch(`/api/customers${branchQuery}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = "/api/customers";
      const method = editId ? "PUT" : "POST";
      const body = editId
        ? { ...formData, id: editId }
        : {
            ...formData,
            branchId: selectedBranch?.id === "all" ? null : selectedBranch?.id,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        fetchCustomers();
        setIsModalOpen(false);
        setEditId(null);
        setFormData({ name: "", phone: "", address: "", initialBalance: "0", creditLimit: "0" });
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !(await confirm({
        title: "حذف العميل",
        message:
          "هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.",
        variant: "danger",
        confirmLabel: "حذف",
      }))
    )
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingId(null);
        setRemovingId(id);
        setTimeout(() => {
          setCustomers((prev) => prev.filter((c) => c.id !== id));
          setRemovingId(null);
          toast.success("تم حذف العميل بنجاح");
        }, 450);
      } else {
        toast.error("فشل الحذف");
        setDeletingId(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء الحذف");
      setDeletingId(null);
    }
  };

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search);
    const bal = Number(c.balance);
    const matchesDebt =
      debtFilter === "ALL" ? true : debtFilter === "DEBT" ? bal > 0 : bal <= 0;
    const isOrg = c.branchId == null;
    const matchesScope =
      scopeFilter === "ALL"
        ? true
        : scopeFilter === "ORG"
          ? isOrg
          : !isOrg;
    return matchesSearch && matchesDebt && matchesScope;
  });

  /* Summary stats (computed from the full customer list, not the filtered view) */
  const stats = {
    total: customers.length,
    debtors: customers.filter((c) => Number(c.balance) > 0).length,
    totalDebt: customers.reduce(
      (s, c) => s + Math.max(0, Number(c.balance)),
      0,
    ),
    transactions: customers.reduce(
      (s, c) => s + (c._count?.transactions || 0),
      0,
    ),
  };

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] =
    useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForPayment || !paymentAmount) return;

    if (
      !(await confirm({
        title: "تأكيد التسديد",
        message: `استلام مبلغ ${formatCurrency(Number(paymentAmount))} من العميل ${selectedCustomerForPayment.name}؟`,
        variant: "info",
        confirmLabel: "تأكيد الاستلام",
      }))
    )
      return;

    setIsPaying(true);
    try {
      const res = await fetch("/api/customers/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerForPayment.id,
          amount: paymentAmount,
        }),
      });

      if (res.ok) {
        toast.success("تم تسجيل الدفعة بنجاح ✅");
        fetchCustomers();
        setIsPaymentModalOpen(false);
        setPaymentAmount("");
        setSelectedCustomerForPayment(null);
      } else {
        toast.error("فشلت العملية");
      }
    } catch (error) {
      toast.error("حدث خطأ");
    } finally {
      setIsPaying(false);
    }
  };

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] =
    useState<Customer | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const fetchHistory = async (customerId: number) => {
    setHistoryLoading(true);
    setExpandedTxId(null);
    try {
      const branchQuery = selectedBranch?.id
        ? `?branchId=${selectedBranch.id}`
        : "";
      const res = await fetch(
        `/api/customers/${customerId}/history${branchQuery}`,
      );
      if (res.ok) {
        const data = await res.json();
        setCustomerHistory(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading)
    return (
      <div
        className="min-h-screen p-6 md:p-10"
        dir="rtl"
        style={{ background: "var(--bg-page)" }}
      >
        <div className="max-w-6xl mx-auto space-y-8">
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
                <Users size={36} className="text-white relative z-10 sk-spin" />
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
                جاري تحميل قائمة العملاء
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
                يتم تحميل بيانات العملاء والأرصدة
              </p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="skeleton h-9 flex-1 min-w-[200px] rounded-xl" />
            <div className="skeleton h-9 w-32 rounded-xl" />
            <div className="skeleton h-9 w-32 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 space-y-4"
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="skeleton w-11 h-11 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-28" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((j) => (
                    <div
                      key={j}
                      className="rounded-xl p-3 space-y-1"
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div className="skeleton h-2.5 w-16" />
                      <div className="skeleton h-5 w-20" />
                    </div>
                  ))}
                </div>
                <div className="skeleton h-8 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <div
      className="min-h-screen p-6 md:p-10 text-right"
      dir="rtl"
      style={{ background: "var(--bg-page)" }}
    >
      {dialog}
      <style>{`
                @keyframes cardDeletingPulse {
                    0%, 100% { box-shadow: 0 0 0 2px rgba(239,68,68,0.25), 0 1px 4px rgba(0,0,0,0.05); background-color: rgba(254,226,226,0.4); }
                    50%      { box-shadow: 0 0 0 2px rgba(239,68,68,0.5),  0 1px 4px rgba(0,0,0,0.05); background-color: rgba(254,202,202,0.65); }
                }
                .card-deleting { animation: cardDeletingPulse 1.1s ease-in-out infinite; border-color: rgba(239,68,68,0.3) !important; }
                @keyframes cardRemoving {
                    0%   { opacity: 1; transform: scale(1);    }
                    30%  { opacity: 0.7; transform: scale(0.97); }
                    100% { opacity: 0; transform: scale(0.88); }
                }
                .card-removing { animation: cardRemoving 0.45s cubic-bezier(0.4,0,0.2,1) forwards; pointer-events: none; }
            `}</style>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="سجل العملاء والديون"
          subtitle="تابع عملائك وديونهم بدقة وسهولة."
          icon={Users}
          gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
          actions={
            isAdmin && (
              <button
                onClick={() => {
                  setEditId(null);
                  setFormData({
                    name: "",
                    phone: "",
                    address: "",
                    initialBalance: "0",
                    creditLimit: "0",
                  });
                  setIsModalOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={20} />
                عميل جديد
              </button>
            )
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "إجمالي العملاء",  value: stats.total,                      icon: Users,        iconBg: '#eef2ff', iconColor: '#094B9F' },
            { label: "عملاء مدينون",    value: stats.debtors,                    icon: AlertCircle,  iconBg: '#fef2f2', iconColor: '#ef4444' },
            { label: "إجمالي الديون",   value: formatCurrency(stats.totalDebt),  icon: Wallet,       iconBg: '#ecfdf5', iconColor: '#10b981' },
            { label: "عدد المعاملات",   value: stats.transactions,               icon: ShoppingCart, iconBg: '#fffbeb', iconColor: '#f59e0b' },
          ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <div key={label} className="kpi-card">
              <div className="kpi-icon" style={{ background: iconBg }}>
                <Icon size={18} style={{ color: iconColor }} />
              </div>
              <div className="min-w-0">
                <p className="kpi-label">{label}</p>
                <p className="kpi-value">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar: search + debt filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="w-full pr-9 pl-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition text-gray-700 font-semibold placeholder-gray-300"
              placeholder="بحث باسم العميل أو رقم الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Scope filter — isolate branch vs organization customers */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
            {(
              [
                { key: "ALL", label: "الكل", icon: null },
                { key: "BRANCH", label: "الفرع", icon: Store },
                { key: "ORG", label: "المؤسسة", icon: Building2 },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setScopeFilter(t.key)}
                style={
                  scopeFilter === t.key
                    ? { background: "#094B9F", color: "#fff", fontWeight: 700 }
                    : undefined
                }
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scopeFilter === t.key ? "shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                {t.icon && <t.icon size={12} />}
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
            {(
              [
                { key: "ALL", label: "الكل" },
                { key: "DEBT", label: "مدينون" },
                { key: "CLEAR", label: "مسددون" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setDebtFilter(t.key)}
                style={
                  debtFilter === t.key
                    ? { background: "#094B9F", color: "#fff", fontWeight: 700 }
                    : undefined
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${debtFilter === t.key ? "shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-semibold">
            {filtered.length} عميل
          </span>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 bg-gray-100 rounded-2xl animate-pulse"
              ></div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center gap-3 text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Users size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-sm">
                {customers.length === 0
                  ? "لا يوجد عملاء مضافين."
                  : "لا يوجد عملاء مطابقون للبحث."}
              </p>
            </div>
          ) : (
            filtered.map((customer) => {
              const bal = Number(customer.balance);
              const hasDebt = bal > 0;
              const theme = avatarTheme(customer.name);
              const isCardDeleting = deletingId === customer.id;
              const isCardRemoving = removingId === customer.id;
              return (
                <div
                  key={customer.id}
                  className={`bg-[var(--bg-card)] rounded-2xl shadow-card border border-[var(--border-color)] transition-all group flex flex-col overflow-hidden ${isCardRemoving ? "card-removing" : isCardDeleting ? "card-deleting" : "hover:shadow-md"}`}
                >
                  {/* Top: identity + balance */}
                  <div className="p-5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl ${theme.bg} ${theme.text} ring-2 ${theme.ring} flex items-center justify-center font-black text-lg flex-shrink-0`}
                      >
                        {customer.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          {customer.name}
                        </h3>
                        {customer.phone ? (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                            <Phone
                              size={12}
                              className="text-gray-400 flex-shrink-0"
                            />
                            <span dir="ltr" className="truncate">
                              {customer.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">
                            لا يوجد رقم
                          </span>
                        )}
                        {customer.address && (
                          <div className="flex items-start gap-1.5 text-xs text-gray-400 mt-1">
                            <MapPin
                              size={12}
                              className="flex-shrink-0 mt-0.5"
                            />
                            <span className="truncate">{customer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap flex-shrink-0 ${hasDebt ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}
                    >
                      {formatCurrency(bal)}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
                    {/* Scope badge — branch vs organization */}
                    {customer.branchId == null ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 bg-violet-50/70 border border-violet-200 px-2 py-1 rounded-lg">
                        <Building2 size={12} />
                        عميل مؤسسة
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50/70 border border-blue-200 px-2 py-1 rounded-lg">
                        <Store size={12} />
                        عميل فرع
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 bg-gray-50/50 border border-[var(--border-color)] px-2 py-1 rounded-lg">
                      <ShoppingCart size={12} className="text-gray-400" />
                      {customer._count?.transactions || 0} معاملة
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg border ${hasDebt ? "text-rose-500 bg-rose-50/60 border-rose-100" : "text-emerald-500 bg-emerald-50/60 border-emerald-100"}`}
                    >
                      <UserCheck size={12} />
                      {hasDebt ? "عليه دين" : "حساب مسدد"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex items-center justify-end gap-1.5 px-4 py-3 border-t border-[var(--border-color)] bg-gray-50/50">
                    <CardAction
                      label="تسديد دفعة"
                      icon={DollarSign}
                      color="text-green-600 bg-green-50 hover:bg-green-100"
                      onClick={() => {
                        setSelectedCustomerForPayment(customer);
                        setPaymentAmount("");
                        setIsPaymentModalOpen(true);
                      }}
                    />
                    <CardAction
                      label="كشف الحساب"
                      icon={FileText}
                      color="text-blue-600 bg-blue-50 hover:bg-blue-100"
                      onClick={() => {
                        setSelectedCustomerForHistory(customer);
                        setIsHistoryModalOpen(true);
                        fetchHistory(customer.id);
                      }}
                    />
                    {isAdmin && (
                      <CardAction
                        label="تعديل البيانات"
                        icon={Pencil}
                        color="text-gray-500 bg-gray-100 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => {
                          setEditId(customer.id);
                          setFormData({
                            name: customer.name,
                            phone: customer.phone || "",
                            address: customer.address || "",
                            initialBalance: String(customer.balance),
                            creditLimit: String((customer as { creditLimit?: number }).creditLimit ?? 0),
                          });
                          setIsModalOpen(true);
                        }}
                      />
                    )}
                    {isAdmin && (
                      <CardAction
                        label="حذف العميل"
                        icon={Trash2}
                        color={
                          isCardDeleting
                            ? "text-red-600 bg-red-50"
                            : "text-gray-400 bg-gray-100 hover:bg-red-50 hover:text-red-600"
                        }
                        loading={isCardDeleting}
                        disabled={isCardDeleting || isCardRemoving}
                        onClick={() => handleDelete(customer.id)}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Edit/Add Modal */}
        {isModalOpen && (
          /* ... (Same Edit Modal) ... */
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSubmit}
              className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-fade-in-up"
            >
              {/* ... Content Same as before ... */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editId ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                {/* ... Form Fields ... */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    اسم العميل <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      رقم الهاتف
                    </label>
                    <input
                      className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      العنوان
                    </label>
                    <input
                      className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                </div>
                {!editId && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      الدين الحالي
                    </label>
                    <input
                      type="number"
                      className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl font-bold"
                      value={formData.initialBalance}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          initialBalance: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    حدّ الدين المسموح
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl font-bold"
                    placeholder="0 = بلا حد"
                    value={formData.creditLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, creditLimit: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    يُمنع البيع الآجل إذا تجاوز رصيد العميل هذا الحد (0 = بلا حد)
                  </p>
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                >
                  إلغاء
                </button>
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  {isSubmitting ? "جاري الحفظ..." : "حفظ البيانات"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Payment Modal */}
        {isPaymentModalOpen && selectedCustomerForPayment && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handlePaymentSubmit}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-fade-in-up border-t-4 border-green-500"
            >
              {/* ... Payment Modal Content ... */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    تسديد دفعة
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {selectedCustomerForPayment.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl text-center mb-4">
                  <span className="text-gray-500 text-sm block mb-1">
                    الرصيد الحالي
                  </span>
                  <span
                    className={`text-2xl font-extrabold ${selectedCustomerForPayment.balance > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {formatCurrency(Number(selectedCustomerForPayment.balance))}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    المبلغ المستلم
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full bg-white border-2 border-green-100 focus:border-green-500 p-4 rounded-xl text-2xl font-bold text-center outline-none text-green-700"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                >
                  إلغاء
                </button>
                <button
                  disabled={isPaying}
                  type="submit"
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPaying ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  {isPaying ? "جاري الاستلام..." : "تأكيد الاستلام"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* History Modal */}
        {isHistoryModalOpen && selectedCustomerForHistory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <style>{`
                            @keyframes fadeSlideIn {
                                from { opacity: 0; transform: translateX(6px); }
                                to   { opacity: 1; transform: translateX(0); }
                            }
                        `}</style>
            <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    سجل المعاملات
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    العميل: {selectedCustomerForHistory.name}
                  </p>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {historyLoading ? (
                  <div className="text-center py-12 text-gray-400">
                    جاري تحميل السجل...
                  </div>
                ) : customerHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    لا توجد معاملات سابقة لهذا العميل.
                  </div>
                ) : (
                  <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right data-table">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              التاريخ
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              النوع
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              التفاصيل
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">
                              المبلغ
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {customerHistory.map((tx) => {
                            const isExpanded = expandedTxId === tx.id;
                            const method = tx.paymentMethod ?? "CASH";
                            const isSale = tx.type === "SALE";

                            return (
                              <React.Fragment key={tx.id}>
                                <tr
                                  className={`hover:bg-blue-50/50 transition-colors group ${isSale ? "cursor-pointer" : ""} ${isExpanded ? "bg-blue-50/60" : ""}`}
                                  onClick={() =>
                                    isSale &&
                                    setExpandedTxId(isExpanded ? null : tx.id)
                                  }
                                >
                                  <td className="px-6 py-4 text-sm text-gray-600">
                                    {new Date(tx.date).toLocaleDateString(
                                      "ar-IQ",
                                    )}{" "}
                                    <br />
                                    <span className="text-xs text-gray-400">
                                      {new Date(tx.date).toLocaleTimeString(
                                        "ar-IQ",
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    {(() => {
                                      if (!isSale) {
                                        const cfg =
                                          tx.type === "PAYMENT"
                                            ? {
                                                cls: "bg-green-100 text-green-700",
                                                label: "تسديد دفعة",
                                              }
                                            : tx.type === "RETURN"
                                              ? {
                                                  cls: "bg-red-100 text-red-700",
                                                  label: "مرتجع",
                                                }
                                              : tx.type === "OPENING"
                                                ? {
                                                    cls: "bg-blue-100 text-blue-700",
                                                    label: "رصيد افتتاحي",
                                                  }
                                                : {
                                                    cls: "bg-gray-100 text-gray-700",
                                                    label: tx.type,
                                                  };
                                        return (
                                          <span
                                            className={`px-2 py-1 rounded-md text-xs font-bold ${cfg.cls}`}
                                          >
                                            {cfg.label}
                                          </span>
                                        );
                                      }
                                      const saleLabel =
                                        method === "CREDIT"
                                          ? "شراء (آجل)"
                                          : method === "CARD"
                                            ? "شراء (بطاقة)"
                                            : method === "SPLIT"
                                              ? "شراء (جزئي)"
                                              : "شراء (نقدي)";
                                      const saleCls =
                                        method === "CREDIT"
                                          ? "bg-orange-100 text-orange-700"
                                          : method === "CARD"
                                            ? "bg-blue-100 text-blue-700"
                                            : method === "SPLIT"
                                              ? "bg-purple-100 text-purple-700"
                                              : "bg-emerald-100 text-emerald-700";
                                      return (
                                        <span
                                          className={`px-2 py-1 rounded-md text-xs font-bold ${saleCls}`}
                                        >
                                          {saleLabel}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600">
                                    {isSale && (
                                      <span className="text-xs font-medium">
                                        {tx.items?.length} مواد
                                      </span>
                                    )}
                                    {tx.type === "PAYMENT" && (
                                      <span className="text-xs">دفع نقدي</span>
                                    )}
                                    {tx.type === "OPENING" && (
                                      <span className="text-xs">
                                        دين سابق عند إنشاء الحساب
                                      </span>
                                    )}
                                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                                      #{tx.id.slice(-8)}
                                    </div>
                                  </td>
                                  <td
                                    className={`px-6 py-4 text-left font-bold ${
                                      tx.type === "PAYMENT" ||
                                      tx.type === "RETURN"
                                        ? "text-green-600"
                                        : isSale &&
                                            (method === "CASH" ||
                                              method === "CARD")
                                          ? "text-slate-700"
                                          : "text-red-500"
                                    }`}
                                  >
                                    {tx.type === "PAYMENT" ||
                                    tx.type === "RETURN"
                                      ? "-"
                                      : "+"}
                                    {formatCurrency(Number(tx.totalAmount))}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    {isSale && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedTxId(
                                            isExpanded ? null : tx.id,
                                          );
                                        }}
                                        className={`p-1.5 rounded-lg transition-all duration-300 ${isExpanded ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"}`}
                                        title="عرض الأصناف"
                                      >
                                        <ChevronDown
                                          size={15}
                                          style={{
                                            transition:
                                              "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                                            transform: isExpanded
                                              ? "rotate(180deg)"
                                              : "rotate(0deg)",
                                          }}
                                        />
                                      </button>
                                    )}
                                  </td>
                                </tr>

                                {/* Items sub-row — always in DOM, animated via max-height */}
                                {isSale && (
                                  <tr style={{ display: "table-row" }}>
                                    <td
                                      colSpan={5}
                                      style={{
                                        padding: 0,
                                        overflow: "hidden",
                                      }}
                                    >
                                      <div
                                        style={{
                                          maxHeight: isExpanded
                                            ? "600px"
                                            : "0px",
                                          opacity: isExpanded ? 1 : 0,
                                          transform: isExpanded
                                            ? "translateY(0)"
                                            : "translateY(-8px)",
                                          transition:
                                            "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, transform 0.3s ease",
                                          overflow: "hidden",
                                        }}
                                      >
                                        <div className="mx-4 my-3">
                                          <div className="border border-blue-200 rounded-2xl overflow-hidden shadow-sm shadow-blue-100/60">
                                            {/* Header */}
                                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-blue-50 to-violet-50 border-b border-blue-100">
                                              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                                                <Package
                                                  size={12}
                                                  className="text-blue-600"
                                                />
                                              </div>
                                              <span className="text-xs font-bold text-blue-700">
                                                تفاصيل الأصناف
                                              </span>
                                              <span className="mr-auto text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                                {tx.items?.length} صنف
                                              </span>
                                            </div>

                                            {/* Items table */}
                                            <table className="w-full text-right text-xs data-table">
                                              <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                                <tr>
                                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-8">
                                                    #
                                                  </th>
                                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    الصنف
                                                  </th>
                                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                                                    الوحدة
                                                  </th>
                                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                                                    الكمية
                                                  </th>
                                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                                                    السعر
                                                  </th>
                                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">
                                                    الإجمالي
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-50 bg-white">
                                                {tx.items?.map(
                                                  (item: any, idx: number) => (
                                                    <tr
                                                      key={item.id ?? idx}
                                                      className="hover:bg-blue-50/50 transition-colors group"
                                                      style={{
                                                        animation: isExpanded
                                                          ? `fadeSlideIn 0.25s ease ${idx * 40}ms both`
                                                          : "none",
                                                      }}
                                                    >
                                                      <td className="px-6 py-4 text-gray-300 font-bold">
                                                        {idx + 1}
                                                      </td>
                                                      <td className="px-6 py-4 font-semibold text-gray-800">
                                                        {item.product?.name ??
                                                          "—"}
                                                      </td>
                                                      <td className="px-6 py-4 text-center">
                                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                                                          {item.unit?.name ??
                                                            "—"}
                                                        </span>
                                                      </td>
                                                      <td className="px-6 py-4 text-center">
                                                        <span className="bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded-md">
                                                          {item.quantity}
                                                        </span>
                                                      </td>
                                                      <td className="px-6 py-4 text-center text-gray-500">
                                                        {formatCurrency(
                                                          Number(item.price),
                                                        )}
                                                      </td>
                                                      <td className="px-6 py-4 text-left font-black text-gray-800">
                                                        {formatCurrency(
                                                          Number(item.price) *
                                                            Number(
                                                              item.quantity,
                                                            ),
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ),
                                                )}
                                              </tbody>
                                              <tfoot>
                                                <tr className="bg-gradient-to-l from-blue-600 to-violet-600 text-white font-bold">
                                                  <td
                                                    colSpan={5}
                                                    className="px-4 py-2.5 text-right text-xs"
                                                  >
                                                    الإجمالي الكلي
                                                  </td>
                                                  <td className="px-4 py-2.5 text-left font-black">
                                                    {formatCurrency(
                                                      Number(tx.totalAmount),
                                                    )}
                                                  </td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-3xl">
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-full bg-white border border-gray-300 py-3 rounded-xl font-bold hover:bg-gray-100 text-gray-700"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
