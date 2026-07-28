"use client";
import { usePageTitle } from "@/hooks/usePageTitle";

import React, { useState, useEffect, useRef } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Settings as SettingsIcon,
  Printer,
  Database,
  Save,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  Crown,
  Store,
  Phone,
  MapPin,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  Key,
  Building2,
  Receipt,
  ChevronDown,
  CreditCard,
  Calendar,
  Zap,
  Clock,
  Ban,
  TrendingUp,
  BadgeCheck,
  Package,
  PlayCircle,
  Bot,
  Pencil,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { ROLE_LABELS, canManage } from "@/lib/roles";
import { useTourContext } from "@/contexts/TourContext";
import { useBranch } from "@/contexts/BranchContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, fetchJsonOr } from "@/lib/query/fetcher";
import SubscriptionStatusCard from "@/components/SubscriptionStatusCard";
import toast from "react-hot-toast";

interface User {
  id: string;
  username: string;
  email: string | null;
  role: string;
  branchId?: string | null;
  createdAt: string;
}

interface Subscription {
  status: string;
  startDate: string;
  endDate: string | null;
  trialEndDate: string | null;
  gracePeriodEndsAt: string | null;
  plan: {
    name: string;
    maxBranches: number;
    maxUsers: number;
    monthlyPrice: string;
  };
}

interface PaymentRecord {
  id: string;
  amount: string;
  months: number;
  planName: string | null;
  notes: string | null;
  paidAt: string;
}

interface PlatformPaymentMethod {
  id: string;
  type: "ZAINCASH" | "SUPERKEY" | "MASTERCARD" | "OTHER";
  name: string;
  accountNumber: string | null;
  accountName: string | null;
  instructions: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; gradient: string; icon: React.ReactNode; badge: string }
> = {
  ACTIVE: {
    label: "نشط",
    gradient: "from-emerald-500 to-teal-600",
    icon: <BadgeCheck size={16} />,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  TRIAL: {
    label: "تجربة",
    gradient: "from-blue-500 to-violet-600",
    icon: <Zap size={16} />,
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  GRACE: {
    label: "فترة مهلة",
    gradient: "from-orange-500 to-blue-600",
    icon: <Clock size={16} />,
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  SUSPENDED: {
    label: "معلق",
    gradient: "from-blue-500 to-yellow-600",
    icon: <AlertTriangle size={16} />,
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CANCELLED: {
    label: "ملغى",
    gradient: "from-rose-500 to-red-600",
    icon: <Ban size={16} />,
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

const ROLE_GRADIENT: Record<string, string> = {
  SUPER_ADMIN: "from-yellow-500 to-blue-600",
  ADMIN: "from-purple-500 to-violet-600",
  BRANCH_MANAGER: "from-blue-500 to-blue-600",
  CASHIER: "from-sky-500 to-cyan-600",
  STOCK_KEEPER: "from-emerald-500 to-teal-600",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  gradient,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  gradient: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{ background: gradient, borderBottom: "1px solid #f1f5f9" }}
      >
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
          {icon}
        </div>
        <h2 className="text-sm font-extrabold text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  usePageTitle("الإعدادات");
  const { role: myRole } = useUser();
  const isSuperAdmin = myRole === "SUPER_ADMIN";
  const { requestTour } = useTourContext();
  const { confirm, dialog } = useConfirm();
  const { selectedBranch, loading: branchLoading } = useBranch();
  // Effective branch for scoping settings/users/backup to the selected branch.
  const branchScope =
    selectedBranch?.id && selectedBranch.id !== "all"
      ? selectedBranch.id
      : null;
  const branchQuery = branchScope ? `?branchId=${branchScope}` : "";
  const bId = branchScope ?? "all";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"system" | "users" | "billing">(
    "system",
  );

  // Receipt-preview clock — computed only on the client to avoid an SSR/CSR
  // hydration mismatch (server time ≠ client time when the page hydrates).
  const [previewNow, setPreviewNow] = useState<Date | null>(null);
  useEffect(() => {
    setPreviewNow(new Date());
  }, []);

  // AI Usage
  const aiUsageQuery = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () =>
      fetchJsonOr<{
        used: number;
        limit: number;
        remaining: number;
      } | null>("/api/ai/usage", null),
  });
  const aiUsage = aiUsageQuery.data ?? null;

  // Billing
  const billingQuery = useQuery({
    queryKey: ["billing"],
    queryFn: () =>
      fetchJson<{
        subscription: Subscription | null;
        payments?: PaymentRecord[];
        error?: string;
      }>("/api/billing", { cache: "no-store" }),
  });
  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () =>
      fetchJsonOr<PlatformPaymentMethod[]>("/api/payment-methods", []),
  });
  const subscription: Subscription | null =
    billingQuery.data && !billingQuery.data.error
      ? (billingQuery.data.subscription ?? null)
      : null;
  const payments: PaymentRecord[] =
    billingQuery.data && !billingQuery.data.error
      ? (billingQuery.data.payments ?? [])
      : [];
  const loadingBilling =
    billingQuery.isPending || paymentMethodsQuery.isPending;
  const paymentMethods = Array.isArray(paymentMethodsQuery.data)
    ? paymentMethodsQuery.data
    : [];

  // System settings
  const [autoPrint, setAutoPrint] = useState(false);
  const [backupIntervalHours, setBackupIntervalHours] = useState(6);
  const [taxRate, setTaxRate] = useState(0);
  const [currency, setCurrency] = useState("ريال");
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [footerMessage, setFooterMessage] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const backupLogsQuery = useQuery({
    queryKey: ["backup-logs", bId],
    queryFn: () =>
      fetchJsonOr<
        {
          id: string;
          createdAt: string;
          username: string;
          sizeKb: number | null;
        }[]
      >(`/api/settings/backup${branchQuery}`, []),
    enabled: !branchLoading,
  });
  const backupLogs = Array.isArray(backupLogsQuery.data)
    ? backupLogsQuery.data
    : [];
  const loadingLogs = backupLogsQuery.isPending;
  const [wipingLocal, setWipingLocal] = useState(false);

  // Users
  const usersQuery = useQuery({
    queryKey: ["users", bId],
    queryFn: () => fetchJson<User[]>(`/api/users${branchQuery}`),
    enabled: !branchLoading,
  });
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];
  const loadingUsers = usersQuery.isPending;
  const [addForm, setAddForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "CASHIER",
  });
  const [addingUser, setAddingUser] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "CASHIER",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const savedTax = localStorage.getItem("taxRate");
    if (savedTax) setTaxRate(Number(savedTax));

    // Load backup interval: Electron → IPC, web → localStorage
    const el = (window as any).electron;
    if (el?.backup?.getInterval) {
      el.backup.getInterval().then((h: number) => {
        if (h) setBackupIntervalHours(h);
      });
    } else {
      const h = parseInt(
        localStorage.getItem("backupIntervalHours") || "6",
        10,
      );
      setBackupIntervalHours(isNaN(h) ? 6 : h);
    }
  }, []);

  // Store settings are per-branch — the query (re)fetches whenever the selected
  // branch changes; seed the local form state from whichever branch's data loads.
  const settingsQuery = useQuery({
    queryKey: ["settings", bId],
    queryFn: () => fetchJson<any>(`/api/settings${branchQuery}`),
    enabled: !branchLoading,
  });

  useEffect(() => {
    const d = settingsQuery.data;
    if (d && !d.error) {
      setStoreName(d.storeName ?? "");
      setStorePhone(d.storePhone ?? "");
      setStoreAddress(d.storeAddress ?? "");
      setFooterMessage(d.footerMessage ?? "");
      setAutoPrint(d.autoPrint ?? false);
      setCurrency(d.currency ?? "ريال");
    }
  }, [settingsQuery.data]);

  async function handleSave() {
    setSavingSettings(true);
    try {
      localStorage.setItem("taxRate", String(taxRate));

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          storePhone,
          storeAddress,
          footerMessage,
          autoPrint,
          currency,
          branchId: branchScope,
        }),
      });
      if (res.ok) {
        toast.success("تم حفظ الإعدادات بنجاح");
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      } else {
        toast.error("فشل حفظ الإعدادات");
      }
    } catch {
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleIntervalChange(hours: number) {
    setBackupIntervalHours(hours);
    const el = (window as any).electron;
    if (el?.backup?.setInterval) {
      await el.backup.setInterval(hours);
    } else {
      localStorage.setItem("backupIntervalHours", String(hours));
      window.dispatchEvent(
        new CustomEvent("backupIntervalChanged", { detail: hours }),
      );
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branchScope }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "فشل النسخ الاحتياطي");
        return;
      }
      // Trigger file download
      const blob = await res.blob();
      const dateStr = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[T:]/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل النسخة الاحتياطية بنجاح");
      queryClient.invalidateQueries({ queryKey: ["backup-logs"] });
    } catch {
      toast.error("فشل النسخ الاحتياطي");
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    let data: any;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast.error("الملف ليس JSON صالحاً");
      return;
    }
    if (!data?.exportedAt) {
      toast.error("هذا ليس ملف نسخة احتياطية صالحاً");
      return;
    }

    const ok = await confirm({
      title: "استيراد نسخة احتياطية",
      message: `سيتم استرجاع السجلات المفقودة فقط من هذه النسخة (تاريخها: ${new Date(
        data.exportedAt,
      ).toLocaleString("ar")}). البيانات الحالية لن تُحذف أو تُعدّل. هل تريد المتابعة؟`,
      confirmLabel: "استرجاع",
    });
    if (!ok) return;

    setRestoring(true);
    try {
      const res = await fetch("/api/settings/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "فشل الاسترجاع");
        return;
      }
      toast.success(`تم الاسترجاع بنجاح — ${d.total ?? 0} سجل مستعاد`);
      queryClient.invalidateQueries({ queryKey: ["backup-logs"] });
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
    } finally {
      setRestoring(false);
    }
  }

  async function handleWipeLocal() {
    const ok = await confirm({
      title: "مسح البيانات المحلية",
      message:
        "سيتم حذف جميع البيانات المحلية على هذا الجهاز (المنتجات، المبيعات، الإعدادات…) وإعادة تزامنها من الخادم السحابي. لن تُفقد أي بيانات من السحابة. هل تريد المتابعة؟",
      variant: "danger",
      confirmLabel: "مسح وإعادة التزامن",
    });
    if (!ok) return;
    setWipingLocal(true);
    try {
      const el = (window as any).electron;
      const result = await el.wipeLocalData();
      if (result?.ok) {
        toast.success(
          "تم مسح البيانات المحلية — سيبدأ التزامن من السحابة خلال لحظات",
        );
      } else {
        toast.error(result?.error ?? "فشل مسح البيانات");
      }
    } catch {
      toast.error("تعذر تنفيذ عملية المسح");
    } finally {
      setWipingLocal(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.email || !addForm.password) return;
    setAddingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, branchId: branchScope }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("تم إضافة المستخدم بنجاح");
        setAddForm({ username: "", email: "", password: "", role: "CASHIER" });
        queryClient.invalidateQueries({ queryKey: ["users"] });
      } else {
        toast.error(d.error ?? "فشلت العملية");
      }
    } catch {
      toast.error("تعذر الاتصال بالخادم");
    } finally {
      setAddingUser(false);
    }
  }

  function openEditUser(u: User) {
    setEditingUser(u);
    setEditForm({
      username: u.username,
      email: u.email ?? "",
      password: "",
      role: u.role,
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const body: Record<string, string> = {
        id: editingUser.id,
        username: editForm.username,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("تم تحديث المستخدم بنجاح");
        setEditingUser(null);
        queryClient.invalidateQueries({ queryKey: ["users"] });
      } else {
        toast.error(d.error ?? "فشلت العملية");
      }
    } catch {
      toast.error("تعذر الاتصال بالخادم");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteUser(u: User) {
    if (
      !(await confirm({
        title: "حذف المستخدم",
        message: `هل أنت متأكد من حذف المستخدم "${u.username}"؟ لا يمكن التراجع عن هذا الإجراء.`,
        variant: "danger",
        confirmLabel: "حذف",
      }))
    )
      return;
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/users?id=${u.id}`, { method: "DELETE" });
      const d = await res.json();
      res.ok
        ? (toast.success("تم حذف المستخدم"),
          queryClient.invalidateQueries({ queryKey: ["users"] }))
        : toast.error(d.error ?? "فشل الحذف");
    } catch {
      toast.error("تعذر الاتصال بالخادم");
    } finally {
      setDeletingId(null);
    }
  }

  const inputCls =
    "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none transition-all bg-white";
  const focusHandlers = {
    onFocus: (
      e: React.FocusEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      e.currentTarget.style.borderColor = "#094B9F";
      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(9,75,159,0.12)";
    },
    onBlur: (
      e: React.FocusEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      e.currentTarget.style.borderColor = "#e2e8f0";
      e.currentTarget.style.boxShadow = "none";
    },
  };

  return (
    <div className="space-y-6 animate-fade-in-up" dir="rtl">
      {dialog}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <>
          {/* Blur layer: extends 24px beyond viewport on all sides to eliminate edge artifacts */}
          <div
            className="fixed z-[49] pointer-events-none"
            style={{
              top: "-24px",
              left: "-24px",
              right: "-24px",
              bottom: "-24px",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          />
          {/* Dark overlay + centering wrapper */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(15,23,42,0.48)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingUser(null);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: "white",
                boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
              }}
            >
              {/* Header */}
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{
                  background: "linear-gradient(135deg, #094B9F, #063A8A)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Pencil size={15} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      تعديل المستخدم
                    </h3>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      {editingUser.username}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X size={15} className="text-white" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                <Field label="اسم المستخدم">
                  <input
                    required
                    type="text"
                    value={editForm.username}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, username: e.target.value }))
                    }
                    className={inputCls}
                    {...focusHandlers}
                  />
                </Field>
                <Field label="البريد الإلكتروني">
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email: e.target.value }))
                    }
                    dir="ltr"
                    className={`${inputCls} text-left`}
                    {...focusHandlers}
                  />
                </Field>
                <Field
                  label="كلمة المرور الجديدة"
                  hint="اتركها فارغة إذا لم ترد تغييرها"
                >
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="••••••••"
                    className={inputCls}
                    {...focusHandlers}
                  />
                </Field>
                <Field label="الدور الوظيفي">
                  <div className="relative">
                    <select
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, role: e.target.value }))
                      }
                      className={`${inputCls} appearance-none pl-8 cursor-pointer`}
                      {...focusHandlers}
                    >
                      <option value="CASHIER">كاشير</option>
                      <option value="STOCK_KEEPER">أمين مخزن</option>
                      <option value="BRANCH_MANAGER">مدير فرع</option>
                      {/* <option value="ADMIN">مدير</option> */}
                      {isSuperAdmin && (
                        <option value="SUPER_ADMIN">سوبر أدمن</option>
                      )}
                    </select>
                    <ChevronDown
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </Field>
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, #094B9F, #063A8A)",
                      boxShadow: "0 4px 14px rgba(9,75,159,0.3)",
                    }}
                  >
                    {savingEdit ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    {savingEdit ? "جاري الحفظ…" : "حفظ التغييرات"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div
          className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #094B9F, #063A8A)",
            boxShadow: "0 8px 24px rgba(9,75,159,0.3)",
          }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)",
            }}
          />
          <SettingsIcon size={22} className="text-white relative z-10" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">إعدادات النظام</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">
            إدارة معلومات المتجر، الطباعة، والمستخدمين
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex gap-2 p-1 rounded-2xl w-fit"
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        {[
          {
            key: "system",
            label: "الإعدادات العامة",
            icon: <SettingsIcon size={14} />,
          },
          {
            key: "users",
            label: "إدارة المستخدمين",
            icon: <Users size={14} />,
          },
          {
            key: "billing",
            label: "الاشتراك والفواتير",
            icon: <CreditCard size={14} />,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "system" | "users")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={
              activeTab === tab.key
                ? {
                    background: "linear-gradient(135deg, #094B9F, #063A8A)",
                    color: "white",
                    boxShadow: "0 4px 12px rgba(9,75,159,0.3)",
                  }
                : { color: "#64748b" }
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ SYSTEM TAB ══════════════ */}
      {activeTab === "system" && (
        <div className="space-y-5">
          {/* ── Row 1: Store info + Receipt preview ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Form — 3 cols */}
            <div
              className="lg:col-span-3 rounded-2xl overflow-hidden"
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
              }}
            >
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: "1px solid #f1f5f9" }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #094B9F, #063A8A)",
                    boxShadow: "0 4px 10px rgba(9,75,159,0.25)",
                  }}
                >
                  <Store size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800">
                    معلومات المتجر
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    تظهر في رأس وتذييل الفاتورة
                  </p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <Field label="اسم المتجر">
                  <div className="relative">
                    <Store
                      size={13}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="مثال: المدقق ميني ماركت"
                      className={`${inputCls} pr-9`}
                      {...focusHandlers}
                    />
                  </div>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="رقم الهاتف">
                    <div className="relative">
                      <Phone
                        size={13}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                      <input
                        value={storePhone}
                        onChange={(e) => setStorePhone(e.target.value)}
                        placeholder="07XX XXX XXXX"
                        dir="ltr"
                        className={`${inputCls} pr-9 text-right`}
                        {...focusHandlers}
                      />
                    </div>
                  </Field>
                  <Field label="العنوان">
                    <div className="relative">
                      <MapPin
                        size={13}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                      <input
                        value={storeAddress}
                        onChange={(e) => setStoreAddress(e.target.value)}
                        placeholder="مثال: شارع النصر، بغداد"
                        className={`${inputCls} pr-9`}
                        {...focusHandlers}
                      />
                    </div>
                  </Field>
                </div>
                <Field
                  label="تذييل الفاتورة"
                  hint="النص الذي يظهر أسفل كل إيصال"
                >
                  <div className="relative">
                    <FileText
                      size={13}
                      className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none"
                    />
                    <textarea
                      value={footerMessage}
                      onChange={(e) => setFooterMessage(e.target.value)}
                      rows={2}
                      placeholder="مثال: شكراً لزيارتكم … زورونا مجدداً"
                      className={`${inputCls} pr-9 resize-none leading-relaxed`}
                      style={{ paddingTop: "10px" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#094B9F";
                        e.currentTarget.style.boxShadow =
                          "0 0 0 3px rgba(9,75,159,0.12)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>
                </Field>
              </div>
            </div>

            {/* Receipt preview — 2 cols */}
            <div
              className="lg:col-span-2 rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="px-5 py-4 flex items-center gap-3"
                style={{ borderBottom: "1px solid var(--border-color)" }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "var(--bg-page)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <Receipt size={15} style={{ color: "var(--text-muted)" }} />
                </div>
                <div>
                  <h2
                    className="text-sm font-extrabold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    معاينة الفاتورة
                  </h2>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    تحديث فوري
                  </p>
                </div>
              </div>

              {/* Thermal receipt simulation — mirrors ReceiptBody exactly */}
              <div
                className="flex-1 flex items-start justify-center p-5 overflow-y-auto"
                style={{ background: "var(--bg-page)" }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 260,
                    fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
                    fontSize: 11,
                    color: "#000",
                    background: "#fff",
                    direction: "rtl",
                    boxShadow:
                      "0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.06)",
                    borderRadius: 3,
                  }}
                >
                  {/* Top tear */}
                  <div
                    style={{
                      height: 7,
                      background:
                        "repeating-linear-gradient(90deg,#fff 0,#fff 5px,#f1f5f9 5px,#f1f5f9 7px)",
                      borderBottom: "1px dashed #ddd",
                    }}
                  />

                  {/* ── HEADER ── */}
                  <div
                    style={{ textAlign: "center", padding: "12px 12px 8px" }}
                  >
                    <div style={{ marginBottom: 5 }}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#000"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ display: "inline" }}
                      >
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        margin: "0 0 4px",
                        letterSpacing: 0.3,
                      }}
                    >
                      {storeName || "— اسم المتجر —"}
                    </p>
                    {storePhone && (
                      <p
                        style={{
                          fontSize: 10,
                          margin: "2px 0",
                          color: "#333",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#444"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: "inline" }}
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.58 3.44 2 2 0 0 1 3.55 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l1.63-1.63a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        {storePhone}
                      </p>
                    )}
                    {storeAddress && (
                      <p
                        style={{
                          fontSize: 10,
                          margin: "2px 0",
                          color: "#333",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#444"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: "inline" }}
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {storeAddress}
                      </p>
                    )}
                  </div>

                  {/* Solid line */}
                  <div style={{ borderTop: "1px solid #bbb", margin: 0 }} />

                  {/* ── META ── */}
                  <div style={{ padding: "6px 12px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#555"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: "inline" }}
                        >
                          <line x1="4" y1="9" x2="20" y2="9" />
                          <line x1="4" y1="15" x2="20" y2="15" />
                          <line x1="10" y1="3" x2="8" y2="21" />
                          <line x1="16" y1="3" x2="14" y2="21" />
                        </svg>
                        <span style={{ color: "#555" }}>فاتورة:</span>
                        <span style={{ fontWeight: 900, fontSize: 11 }}>
                          #00000001
                        </span>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 10,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#555"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ display: "inline" }}
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span style={{ fontWeight: 700 }}>
                            {previewNow
                              ? previewNow.toLocaleDateString("ar-IQ")
                              : ""}
                          </span>
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#555"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ display: "inline" }}
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span style={{ fontWeight: 700 }}>
                            {previewNow
                              ? previewNow.toLocaleTimeString("ar-IQ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#555"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: "inline" }}
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span style={{ color: "#555" }}>الكاشير:</span>
                        <span style={{ fontWeight: 700 }}>كاشير</span>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#555"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: "inline" }}
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span style={{ color: "#555" }}>العميل:</span>
                        <span style={{ fontWeight: 700 }}>عام</span>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#555"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: "inline" }}
                        >
                          <rect x="1" y="4" width="22" height="16" rx="2" />
                          <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                        <span style={{ color: "#555" }}>الدفع:</span>
                        <span style={{ fontWeight: 800 }}>نقدي</span>
                      </span>
                    </div>
                  </div>

                  {/* Dashed line */}
                  <div style={{ borderTop: "1px dashed #ccc", margin: 0 }} />

                  {/* ── ITEMS TABLE ── */}
                  <div style={{ padding: "0 12px" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 11,
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "5px 2px 4px",
                              fontWeight: 800,
                              fontSize: 10,
                              borderBottom: "1px solid #888",
                            }}
                          >
                            المادة
                          </th>
                          <th
                            style={{
                              textAlign: "center",
                              padding: "5px 2px 4px",
                              fontWeight: 800,
                              fontSize: 10,
                              borderBottom: "1px solid #888",
                              width: 30,
                            }}
                          >
                            الكمية
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "5px 2px 4px",
                              fontWeight: 800,
                              fontSize: 10,
                              borderBottom: "1px solid #888",
                              width: 58,
                            }}
                          >
                            الإجمالي
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            name: "حليب طازج",
                            qty: 2,
                            price: 2500,
                            unit: "قطعة",
                          },
                          {
                            name: "خبز تنور",
                            qty: 1,
                            price: 1500,
                            unit: "ربطة",
                          },
                          {
                            name: "ماء معدني",
                            qty: 3,
                            price: 1000,
                            unit: "قطعة",
                          },
                        ].map((item, idx) => (
                          <tr
                            key={idx}
                            style={{ borderBottom: "1px dashed #ddd" }}
                          >
                            <td
                              style={{ padding: "4px 2px", textAlign: "right" }}
                            >
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 10.5,
                                  color: "#000",
                                }}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: "#777",
                                  marginTop: 1,
                                }}
                              >
                                {item.price.toLocaleString("ar-IQ")} د.ع ·{" "}
                                {item.unit}
                              </div>
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                padding: "4px 2px",
                                fontWeight: 900,
                                fontSize: 12,
                                color: "#000",
                              }}
                            >
                              {item.qty}
                            </td>
                            <td
                              style={{
                                textAlign: "left",
                                padding: "4px 2px",
                                fontWeight: 800,
                                fontSize: 10.5,
                                color: "#000",
                              }}
                            >
                              {(item.price * item.qty).toLocaleString("ar-IQ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ── TOTAL BAR ── */}
                  <div
                    style={{
                      margin: "5px 0 0",
                      padding: "8px 12px",
                      background: "#f5f5f5",
                      borderTop: "1px solid #999",
                      borderBottom: "1px solid #999",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{ fontWeight: 700, fontSize: 11, color: "#333" }}
                    >
                      المجموع الكلي
                    </span>
                    <span
                      style={{
                        fontWeight: 900,
                        fontSize: 17,
                        letterSpacing: "-0.5px",
                        color: "#000",
                      }}
                    >
                      9,500 د.ع
                    </span>
                  </div>

                  {/* ── FOOTER ── */}
                  <div
                    style={{ textAlign: "center", padding: "9px 12px 10px" }}
                  >
                    <p
                      style={{
                        margin: "0 0 3px",
                        fontWeight: 800,
                        fontSize: 11,
                        color: "#000",
                        letterSpacing: 0.5,
                      }}
                    >
                      ✦&nbsp;شكراً لزيارتكم&nbsp;✦
                    </p>
                    {footerMessage && (
                      <p
                        style={{
                          fontSize: 9.5,
                          color: "#555",
                          margin: "3px 0 0",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {footerMessage}
                      </p>
                    )}
                  </div>

                  {/* Bottom tear */}
                  <div
                    style={{
                      height: 7,
                      background:
                        "repeating-linear-gradient(90deg,#fff 0,#fff 5px,#f1f5f9 5px,#f1f5f9 7px)",
                      borderTop: "1px dashed #ddd",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Print + Financial side by side ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Print */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: "1px solid var(--border-color)" }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                    boxShadow: "0 4px 10px rgba(6,182,212,0.25)",
                  }}
                >
                  <Printer size={15} className="text-white" />
                </div>
                <div>
                  <h2
                    className="text-sm font-extrabold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    إعدادات الطباعة
                  </h2>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    تُطبَّق على جميع نقاط البيع
                  </p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: "var(--bg-page)",
                    border: "1.5px solid var(--border-color)",
                  }}
                >
                  <div>
                    <p
                      className="text-sm font-extrabold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      الطباعة التلقائية
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      طباعة الإيصال مباشرةً بعد الدفع
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoPrint((v) => !v)}
                    className="relative flex-shrink-0 rounded-full transition-all duration-300 focus:outline-none"
                    style={{
                      width: 44,
                      height: 24,
                      background: autoPrint
                        ? "linear-gradient(135deg, #094B9F, #063A8A)"
                        : "var(--border-color)",
                      boxShadow: autoPrint
                        ? "0 0 12px rgba(9,75,159,0.4)"
                        : "none",
                    }}
                  >
                    <div
                      className="absolute top-0.5 rounded-full bg-white shadow transition-all duration-300"
                      style={{
                        width: 20,
                        height: 20,
                        right: autoPrint ? 2 : 22,
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Financial + Backup stacked */}
            <div className="space-y-5">
              {/* Financial */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      boxShadow: "0 4px 10px rgba(16,185,129,0.25)",
                    }}
                  >
                    <ShieldCheck size={15} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800">
                      الإعدادات المالية
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ضريبة القيمة المضافة
                    </p>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  {/* Tax rate */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      نسبة الضريبة
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={taxRate}
                          onChange={(e) => setTaxRate(Number(e.target.value))}
                          className={`${inputCls} pl-10`}
                          {...focusHandlers}
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                          %
                        </span>
                      </div>
                      <div
                        className={`px-3 py-2 rounded-xl text-sm font-extrabold transition-all ${
                          taxRate > 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {taxRate > 0 ? `${taxRate}%` : "معطّل"}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      اتركها صفراً إذا كانت غير مطبقة
                    </p>
                  </div>
                  {/* Currency */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      وحدة العملة
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        placeholder="مثال: ريال، دينار، درهم، جنيه"
                        className={`${inputCls} flex-1`}
                        {...focusHandlers}
                      />
                      <div className="px-3 py-2 rounded-xl text-sm font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                        {currency || "—"}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      تُستخدم في تقارير المساعد الذكي وعرض الأرقام
                    </p>
                  </div>
                </div>
              </div>

              {/* Backup */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      boxShadow: "0 4px 10px rgba(245,158,11,0.25)",
                    }}
                  >
                    <Database size={15} className="text-white" />
                  </div>
                  <div>
                    <h2
                      className="text-sm font-extrabold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      النسخ الاحتياطي
                    </h2>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      تصدير كامل بيانات المتجر كملف JSON
                    </p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      المنتجات، المبيعات، العملاء، الموردين، الفئات، المخزون
                      والإعدادات — يُحفظ على جهازك مباشرة
                    </p>
                    <button
                      onClick={handleBackup}
                      disabled={backingUp}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #f59e0b, #d97706)",
                        boxShadow: "0 4px 10px rgba(245,158,11,0.25)",
                      }}
                    >
                      {backingUp ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Database size={13} />
                      )}
                      {backingUp ? "جاري التصدير…" : "نسخ احتياطي الآن"}
                    </button>

                    {/* Restore / import a backup file */}
                    <input
                      ref={restoreInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={handleRestoreFile}
                    />
                    <button
                      onClick={() => restoreInputRef.current?.click()}
                      disabled={restoring}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                      style={{
                        background: "rgba(245,158,11,0.10)",
                        color: "#b45309",
                        border: "1px solid rgba(245,158,11,0.35)",
                      }}
                    >
                      {restoring ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Database size={13} />
                      )}
                      {restoring ? "جاري الاسترجاع…" : "استيراد نسخة"}
                    </button>
                  </div>

                  {/* Auto-backup interval */}
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      background: "rgba(245,158,11,0.06)",
                      border: "1.5px solid rgba(245,158,11,0.2)",
                    }}
                  >
                    <div>
                      <p
                        className="text-sm font-extrabold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        النسخ الاحتياطي التلقائي
                      </p>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        يُنفَّذ تلقائياً كل فترة محددة · في سطح المكتب: يُحفظ في
                        مجلد بيانات التطبيق · في الإغلاق: يُنزَّل نسخة إضافية
                      </p>
                    </div>
                    <select
                      value={backupIntervalHours}
                      onChange={(e) =>
                        handleIntervalChange(Number(e.target.value))
                      }
                      className="text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer flex-shrink-0 mr-4"
                      style={{
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {[1, 2, 3, 6, 12, 24].map((h) => (
                        <option key={h} value={h}>
                          كل {h} {h === 1 ? "ساعة" : h <= 10 ? "ساعات" : "ساعة"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Backup history */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--border-color)" }}
                  >
                    <div
                      className="px-4 py-2 flex items-center justify-between"
                      style={{
                        background: "var(--bg-page)",
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <span
                        className="text-[11px] font-extrabold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        سجل النسخ السابقة
                      </span>
                      {loadingLogs && (
                        <Loader2
                          size={11}
                          className="animate-spin"
                          style={{ color: "var(--text-muted)" }}
                        />
                      )}
                    </div>
                    {backupLogs.length === 0 ? (
                      <div
                        className="px-4 py-5 text-center text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {loadingLogs
                          ? "جاري التحميل…"
                          : "لا توجد نسخ احتياطية بعد"}
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                        {backupLogs.map((log, i) => (
                          <div
                            key={log.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 transition-colors"
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLDivElement
                              ).style.background = "var(--table-row-hover)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLDivElement
                              ).style.background = "";
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: "rgba(9,75,159,0.10)" }}
                              >
                                <Database size={11} className="text-blue-500" />
                              </div>
                              <div>
                                <p
                                  className="text-xs font-bold"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {new Date(log.createdAt).toLocaleString(
                                    "ar-IQ",
                                    { dateStyle: "medium", timeStyle: "short" },
                                  )}
                                </p>
                                <p
                                  className="text-[10px]"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  بواسطة: {log.username}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {log.sizeKb && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                  style={{
                                    color: "var(--text-muted)",
                                    background: "var(--bg-page)",
                                    border: "1px solid var(--border-color)",
                                  }}
                                >
                                  {log.sizeKb > 1024
                                    ? `${(log.sizeKb / 1024).toFixed(1)} MB`
                                    : `${log.sizeKb} KB`}
                                </span>
                              )}
                              {i === 0 && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                  style={{
                                    color: "var(--value-positive)",
                                    background: "rgba(16,185,129,0.10)",
                                  }}
                                >
                                  الأحدث
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Wipe local data (Electron only) ── */}
          {typeof window !== "undefined" &&
            !!(window as any).electron?.wipeLocalData && (
              <div
                className="rounded-2xl px-6 py-4 flex items-center justify-between gap-4"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(239,68,68,0.04), rgba(220,38,38,0.04))",
                  border: "1px solid rgba(239,68,68,0.2)",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div>
                  <p className="text-sm font-extrabold text-red-700">
                    مسح البيانات المحلية
                  </p>
                  <p className="text-xs text-red-400 mt-0.5">
                    يحذف جميع بيانات هذا الجهاز ويُعيد التزامن الكامل من السحابة
                    · لا تُفقد أي بيانات من السحابة
                  </p>
                </div>
                <button
                  onClick={handleWipeLocal}
                  disabled={wipingLocal}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    boxShadow: "0 4px 14px rgba(239,68,68,0.3)",
                  }}
                >
                  {wipingLocal ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  {wipingLocal ? "جاري المسح…" : "مسح وإعادة التزامن"}
                </button>
              </div>
            )}

          {/* ── Tour restart ── */}
          <div
            className="rounded-2xl px-6 py-4 flex items-center justify-between gap-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(9,75,159,0.04), rgba(14,99,212,0.04))",
              border: "1px solid rgba(9,75,159,0.15)",
              boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div>
              <p className="text-sm font-extrabold text-slate-700">
                جولة النظام التعريفية
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                استعرض ميزات النظام مرة أخرى في جولة تفاعلية
              </p>
            </div>
            <button
              onClick={requestTour}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #094B9F, #063A8A)",
                boxShadow: "0 4px 14px rgba(9,75,159,0.3)",
              }}
            >
              <PlayCircle size={15} />
              إعادة الجولة
            </button>
          </div>

          {/* ── Save bar ── */}
          <div
            className="rounded-2xl px-6 py-4 flex items-center justify-between gap-4"
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
            }}
          >
            <p className="text-xs text-slate-400 font-medium">
              سيتم حفظ معلومات المتجر والطباعة والإعدادات المالية معاً
            </p>
            <button
              onClick={handleSave}
              disabled={savingSettings}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #094B9F, #063A8A)",
                boxShadow: "0 4px 16px rgba(9,75,159,0.35)",
              }}
            >
              {savingSettings ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {savingSettings ? "جاري الحفظ…" : "حفظ الإعدادات"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ USERS TAB ══════════════ */}
      {activeTab === "users" && (
        <div className="space-y-5">
          {/* ── Add user ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{ borderBottom: "1px solid #f1f5f9" }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #094B9F, #063A8A)",
                  boxShadow: "0 4px 10px rgba(9,75,159,0.25)",
                }}
              >
                <UserPlus size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-800">
                  إضافة مستخدم جديد
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  سيتم إرسال بيانات الدخول للمستخدم
                </p>
              </div>
            </div>
            <form onSubmit={handleAddUser} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Field label="اسم المستخدم">
                  <input
                    required
                    type="text"
                    value={addForm.username}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="مثال: أحمد، cashier1"
                    className={inputCls}
                    {...focusHandlers}
                  />
                </Field>
                <Field label="البريد الإلكتروني">
                  <input
                    required
                    type="email"
                    value={addForm.email}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="user@example.com"
                    dir="ltr"
                    className={`${inputCls} text-left`}
                    {...focusHandlers}
                  />
                </Field>
                <Field label="كلمة المرور">
                  <input
                    required
                    type="password"
                    value={addForm.password}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="••••••••"
                    className={inputCls}
                    {...focusHandlers}
                  />
                </Field>
                <Field label="الدور الوظيفي">
                  <div className="relative">
                    <select
                      value={addForm.role}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, role: e.target.value }))
                      }
                      className={`${inputCls} appearance-none pl-8 cursor-pointer`}
                      {...focusHandlers}
                    >
                      <option value="CASHIER">كاشير</option>
                      <option value="STOCK_KEEPER">أمين مخزن</option>
                      <option value="BRANCH_MANAGER">مدير فرع</option>
                      {/* <option value="ADMIN">مدير</option> */}
                      {isSuperAdmin && (
                        <option value="SUPER_ADMIN">سوبر أدمن</option>
                      )}
                    </select>
                    <ChevronDown
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </Field>
              </div>
              {/* Role hint strip */}
              <div className="flex items-center gap-2 flex-wrap mb-5">
                {[
                  {
                    role: "CASHIER",
                    label: "كاشير",
                    color: "bg-sky-50 text-sky-700 border-sky-200",
                  },
                  {
                    role: "STOCK_KEEPER",
                    label: "أمين مخزن",
                    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  },
                  {
                    role: "BRANCH_MANAGER",
                    label: "مدير فرع",
                    color: "bg-blue-50 text-blue-700 border-blue-200",
                  },
                  // {
                  //   role: "ADMIN",
                  //   label: "مدير",
                  //   color: "bg-purple-50 text-purple-700 border-purple-200",
                  // },
                ].map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, role: r.role }))}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      addForm.role === r.role
                        ? r.color + " ring-2 ring-offset-1 ring-blue-300"
                        : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingUser}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #094B9F, #063A8A)",
                    boxShadow: "0 4px 14px rgba(9,75,159,0.3)",
                  }}
                >
                  {addingUser ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <UserPlus size={15} />
                  )}
                  {addingUser ? "جاري الإضافة…" : "إضافة المستخدم"}
                </button>
              </div>
            </form>
          </div>

          {/* ── Users list ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid #f1f5f9" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #64748b, #475569)",
                    boxShadow: "0 4px 10px rgba(100,116,139,0.2)",
                  }}
                >
                  <Users size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800">
                    قائمة المستخدمين
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    جميع حسابات النظام
                  </p>
                </div>
              </div>
              <span
                className="text-xs font-extrabold px-3 py-1 rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg,rgba(9,75,159,0.08),rgba(14,99,212,0.06))",
                  border: "1px solid rgba(9,75,159,0.15)",
                  color: "#094B9F",
                }}
              >
                {users.length} مستخدم
              </span>
            </div>

            {loadingUsers ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 size={28} className="animate-spin text-blue-400" />
                <p className="text-sm text-slate-400 font-medium">
                  جاري التحميل…
                </p>
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "#f1f5f9" }}
                >
                  <Users size={24} className="text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-600">
                    لا يوجد مستخدمون
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    أضف أول مستخدم باستخدام النموذج أعلاه
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {users.map((u) => {
                  const rl =
                    ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ??
                    ROLE_LABELS.CASHIER;
                  const grad =
                    ROLE_GRADIENT[u.role] ?? "from-slate-400 to-slate-500";
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/60 transition-colors group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-gradient-to-br ${grad}`}
                          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                        >
                          <div
                            className="absolute inset-0 opacity-30"
                            style={{
                              background:
                                "linear-gradient(135deg,rgba(255,255,255,0.4) 0%,transparent 60%)",
                            }}
                          />
                          <span className="text-white text-xs font-extrabold relative z-10">
                            {u.username?.charAt(0)?.toUpperCase() ?? "?"}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-extrabold text-slate-800">
                              {u.username}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${rl.bg} ${rl.color}`}
                              style={{
                                borderColor: "currentColor",
                                borderOpacity: 0.3,
                              }}
                            >
                              {u.role === "SUPER_ADMIN" && <Crown size={9} />}
                              {rl.label}
                            </span>
                            {/* Branch scope: managers (no branchId) appear in every branch */}
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                u.branchId == null
                                  ? "bg-violet-50 text-violet-600 border-violet-200"
                                  : "bg-blue-50 text-blue-600 border-blue-200"
                              }`}
                            >
                              {u.branchId == null ? (
                                <>
                                  <Building2 size={9} /> كل الفروع
                                </>
                              ) : (
                                <>
                                  <Store size={9} /> هذا الفرع
                                </>
                              )}
                            </span>
                          </div>
                          {u.email && (
                            <p
                              className="text-[11px] text-slate-400 mt-0.5 font-medium"
                              dir="ltr"
                            >
                              {u.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 hidden sm:block">
                          {new Date(u.createdAt).toLocaleDateString("ar-IQ", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {canManage(myRole ?? "", u.role) ? (
                          <>
                            <button
                              onClick={() => openEditUser(u)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all opacity-0 group-hover:opacity-100"
                              title="تعديل المستخدم"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={deletingId === u.id}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-60"
                              title="حذف المستخدم"
                            >
                              {deletingId === u.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 px-2 py-0.5 rounded-md border border-slate-100 opacity-0 group-hover:opacity-100 select-none">
                            محمي
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ AI USAGE CARD (system tab only) ══════════════ */}
      {activeTab === "system" && aiUsage && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
          }}
        >
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{ borderBottom: "1px solid #f1f5f9" }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #094B9F, #063A8A)",
                boxShadow: "0 4px 10px rgba(9,75,159,0.25)",
              }}
            >
              <Bot size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">
                المساعد الذكي
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                حد الاستخدام اليومي
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-700">
                الاستفسارات اليوم
              </span>
              <span
                className={`text-sm font-black ${
                  aiUsage.remaining === 0
                    ? "text-red-500"
                    : aiUsage.remaining <= 5
                      ? "text-blue-500"
                      : "text-blue-600"
                }`}
              >
                {aiUsage.used} / {aiUsage.limit}
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-slate-100 mb-3">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, (aiUsage.used / aiUsage.limit) * 100)}%`,
                  background:
                    aiUsage.remaining === 0
                      ? "linear-gradient(90deg, #ef4444, #dc2626)"
                      : aiUsage.remaining <= 5
                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                        : "linear-gradient(90deg, #094B9F, #063A8A)",
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "الحد اليومي",
                  value: aiUsage.limit,
                  color: "text-slate-700",
                },
                {
                  label: "المستخدم",
                  value: aiUsage.used,
                  color: "text-blue-600",
                },
                {
                  label: "المتبقي اليوم",
                  value: aiUsage.remaining,
                  color:
                    aiUsage.remaining === 0
                      ? "text-red-500"
                      : aiUsage.remaining <= 5
                        ? "text-blue-500"
                        : "text-emerald-600",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="text-center rounded-xl p-3 bg-slate-50 border border-slate-100"
                >
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            {aiUsage.remaining === 0 && (
              <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600 font-semibold">
                  تم استنفاد الحد اليومي — يتجدد تلقائياً في منتصف الليل
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ BILLING TAB ══════════════ */}
      {activeTab === "billing" && (
        <div className="space-y-5">
          {/* Works on the desktop too, where /api/billing has no local row:
              reads the cached subscription and can re-check the cloud on demand. */}
          <SubscriptionStatusCard />

          {loadingBilling ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <p className="text-sm text-slate-400 font-medium">
                جاري تحميل بيانات الاشتراك…
              </p>
            </div>
          ) : (
            <>
              {/* ── Subscription card ── */}
              {subscription ? (
                (() => {
                  const cfg =
                    STATUS_CONFIG[subscription.status] ??
                    STATUS_CONFIG.SUSPENDED;
                  const now = new Date();
                  const endDate = subscription.endDate
                    ? new Date(subscription.endDate)
                    : subscription.trialEndDate
                      ? new Date(subscription.trialEndDate)
                      : null;
                  const daysLeft = endDate
                    ? Math.ceil((endDate.getTime() - now.getTime()) / 86400_000)
                    : null;
                  return (
                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      {/* Gradient banner */}
                      <div
                        className={`relative bg-gradient-to-br ${cfg.gradient} p-6 overflow-hidden`}
                      >
                        <div
                          className="absolute inset-0 opacity-20"
                          style={{
                            background:
                              "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.5), transparent 60%)",
                          }}
                        />
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30 flex-shrink-0">
                              <CreditCard size={26} className="text-white" />
                            </div>
                            <div>
                              <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                                خطة الاشتراك
                              </p>
                              <p className="text-white text-2xl font-black mt-0.5">
                                {subscription.plan.name}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full border self-start sm:self-auto ${cfg.badge}`}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Plan details */}
                      <div className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            {
                              icon: (
                                <Calendar size={16} className="text-blue-500" />
                              ),
                              label: "تاريخ الانتهاء",
                              value: endDate
                                ? endDate.toLocaleDateString("ar-IQ", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })
                                : "—",
                              sub:
                                daysLeft !== null ? (
                                  daysLeft > 0 ? (
                                    <span
                                      className={`text-[11px] font-bold ${daysLeft <= 7 ? "text-rose-500" : daysLeft <= 30 ? "text-blue-500" : "text-emerald-500"}`}
                                    >
                                      {daysLeft <= 0
                                        ? "انتهى"
                                        : `متبقٍ ${daysLeft} يوم`}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-rose-500">
                                      منتهي
                                    </span>
                                  )
                                ) : null,
                            },
                            {
                              icon: (
                                <Building2
                                  size={16}
                                  className="text-violet-500"
                                />
                              ),
                              label: "الفروع المسموحة",
                              value:
                                subscription.plan.maxBranches <= 0
                                  ? "غير محدود"
                                  : subscription.plan.maxBranches,
                            },
                            {
                              icon: (
                                <Users size={16} className="text-blue-500" />
                              ),
                              label: "المستخدمون المسموحون",
                              value:
                                subscription.plan.maxUsers <= 0
                                  ? "غير محدود"
                                  : subscription.plan.maxUsers,
                            },
                            {
                              icon: (
                                <TrendingUp
                                  size={16}
                                  className="text-emerald-500"
                                />
                              ),
                              label: "السعر الشهري",
                              value:
                                Number(subscription.plan.monthlyPrice) > 0
                                  ? `${Number(subscription.plan.monthlyPrice).toLocaleString("ar-IQ")} د.ع`
                                  : "مجاني",
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="rounded-xl p-3.5"
                              style={{
                                background: "var(--bg-page)",
                                border: "1px solid var(--border-color)",
                              }}
                            >
                              <div className="flex items-center gap-1.5 mb-2">
                                {item.icon}
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {item.label}
                                </span>
                              </div>
                              <p
                                className="text-lg font-black leading-tight"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {item.value}
                              </p>
                              {item.sub && (
                                <div className="mt-1">{item.sub}</div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Grace / expiry warning */}
                        {(subscription.status === "GRACE" ||
                          (daysLeft !== null &&
                            daysLeft <= 7 &&
                            daysLeft > 0)) && (
                          <div
                            className="mt-4 rounded-xl px-4 py-3 flex items-start gap-3"
                            style={{
                              background: "rgba(245,158,11,0.06)",
                              border: "1px solid rgba(245,158,11,0.2)",
                            }}
                          >
                            <AlertTriangle
                              size={16}
                              className="text-amber-500 flex-shrink-0 mt-0.5"
                            />
                            <div>
                              <p
                                className="text-sm font-extrabold"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {subscription.status === "GRACE"
                                  ? "الحساب في فترة المهلة"
                                  : `الاشتراك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`}
                              </p>
                              <p
                                className="text-xs mt-0.5"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                يرجى التواصل مع الإدارة لتجديد الاشتراك وتجنب
                                انقطاع الخدمة
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div
                  className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "var(--bg-page)" }}
                  >
                    <CreditCard
                      size={24}
                      style={{ color: "var(--text-muted)" }}
                    />
                  </div>
                  <p
                    className="text-sm font-bold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    لا يوجد اشتراك نشط
                  </p>
                </div>
              )}

              {/* ── Payment history ── */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        boxShadow: "0 4px 10px rgba(16,185,129,0.25)",
                      }}
                    >
                      <Receipt size={15} className="text-white" />
                    </div>
                    <div>
                      <h2
                        className="text-sm font-extrabold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        سجل الدفعات
                      </h2>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        جميع المدفوعات المسجلة
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-extrabold px-3 py-1 rounded-full"
                    style={{
                      background: "rgba(16,185,129,0.08)",
                      border: "1px solid rgba(16,185,129,0.18)",
                      color: "var(--value-positive)",
                    }}
                  >
                    {payments.length} دفعة
                  </span>
                </div>

                {payments.length === 0 ? (
                  <div className="py-14 flex flex-col items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: "var(--bg-page)" }}
                    >
                      <Receipt
                        size={20}
                        style={{ color: "var(--text-muted)" }}
                      />
                    </div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      لا توجد دفعات مسجلة بعد
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {payments.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-6 py-4 transition-colors"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background =
                            "var(--table-row-hover)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background =
                            "";
                        }}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                            style={{
                              background: "rgba(16,185,129,0.10)",
                              border: "1px solid rgba(16,185,129,0.18)",
                            }}
                          >
                            <Receipt size={15} className="text-emerald-500" />
                          </div>
                          <div>
                            <p
                              className="text-sm font-extrabold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {Number(p.amount).toLocaleString("ar-IQ")}
                              <span
                                className="text-xs font-bold mr-1"
                                style={{ color: "var(--text-muted)" }}
                              >
                                د.ع
                              </span>
                            </p>
                            <p
                              className="text-[11px] mt-0.5"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {p.months === 12
                                ? "سنة كاملة"
                                : `${p.months} شهر`}
                              {p.planName ? ` — ${p.planName}` : ""}
                            </p>
                            {p.notes && (
                              <p
                                className="text-[11px] mt-0.5 italic"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {p.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-left flex flex-col items-end gap-1">
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {new Date(p.paidAt).toLocaleDateString("ar-IQ", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(16,185,129,0.10)",
                              color: "var(--value-positive)",
                              border: "1px solid rgba(16,185,129,0.18)",
                            }}
                          >
                            مدفوع
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Platform Payment Methods ── */}
              {paymentMethods.length > 0 && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div
                    className="px-6 py-4 flex items-center gap-3"
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                        boxShadow: "0 4px 10px rgba(139,92,246,0.25)",
                      }}
                    >
                      <CreditCard size={15} className="text-white" />
                    </div>
                    <div>
                      <h2
                        className="text-sm font-extrabold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        طرق الدفع المتاحة
                      </h2>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        لتجديد الاشتراك تواصل مع الإدارة عبر إحدى الطرق التالية
                      </p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {paymentMethods.map((m) => {
                      const iconMap: Record<string, React.ReactNode> = {
                        ZAINCASH: (
                          <span className="text-violet-500 font-black text-[11px]">
                            ZC
                          </span>
                        ),
                        SUPERKEY: (
                          <span className="text-sky-500 font-black text-[11px]">
                            SK
                          </span>
                        ),
                        MASTERCARD: (
                          <span className="text-rose-500 font-black text-[11px]">
                            MC
                          </span>
                        ),
                        OTHER: (
                          <span
                            className="font-black text-[11px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            $$
                          </span>
                        ),
                      };
                      const bgMap: Record<string, string> = {
                        ZAINCASH: "rgba(139,92,246,0.06)",
                        SUPERKEY: "rgba(14,165,233,0.06)",
                        MASTERCARD: "rgba(239,68,68,0.06)",
                        OTHER: "var(--bg-page)",
                      };
                      const borderMap: Record<string, string> = {
                        ZAINCASH: "rgba(139,92,246,0.20)",
                        SUPERKEY: "rgba(14,165,233,0.20)",
                        MASTERCARD: "rgba(239,68,68,0.20)",
                        OTHER: "var(--border-color)",
                      };
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl p-4"
                          style={{
                            background: bgMap[m.type] ?? bgMap.OTHER,
                            border: `1px solid ${borderMap[m.type] ?? borderMap.OTHER}`,
                          }}
                        >
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-color)",
                              }}
                            >
                              {iconMap[m.type]}
                            </div>
                            <span
                              className="font-extrabold text-sm"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {m.name}
                            </span>
                          </div>
                          {m.accountNumber && (
                            <p
                              className="text-sm font-bold tabular-nums tracking-wide"
                              style={{ color: "var(--text-primary)" }}
                              dir="ltr"
                            >
                              {m.accountNumber}
                            </p>
                          )}
                          {m.accountName && (
                            <p
                              className="text-xs font-medium mt-0.5"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {m.accountName}
                            </p>
                          )}
                          {m.instructions && (
                            <p
                              className="text-[11px] mt-2.5 leading-relaxed pt-2.5"
                              style={{
                                color: "var(--text-secondary)",
                                borderTop: "1px solid var(--border-color)",
                              }}
                            >
                              {m.instructions}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
