"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { BranchProvider, useBranch } from "@/contexts/BranchContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { TourProvider } from "@/contexts/TourContext";
import { ChatWidget } from "@/components/ai-assistant/ChatWidget";
import { AppTour } from "@/components/tour/AppTour";
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  TruckIcon,
  BarChart3,
  Settings,
  ArrowLeftRight,
  LogOut,
  ChevronDown,
  Tag,
  Wallet,
  Users,
  FileText,
  ArrowDownToLine,
  Activity,
  TrendingUp,
  BookOpen,
  Clock,
  PieChart,
  Boxes,
  Receipt,
  ShoppingBag,
  Menu,
  X,
  Database,
  Sun,
  Moon,
  MessageSquare,
  Monitor,
  User,
  Shield,
  BarChart3Icon,
  LucideBarChart3,
  CalendarX2,
  Radio,
  Lock,
  Crown,
  Sparkles,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useAutoBackup } from "@/hooks/useAutoBackup";
import { FeatureProvider, useFeatures } from "@/contexts/FeatureContext";
import { requiredFeatureMeta, TIER_META, type PlanTier } from "@/lib/features";
import { clearClientSession } from '@/lib/client-session';

const NAV = [
  {
    href: "/dashboard",
    label: "الرئيسية",
    icon: LayoutDashboard,
    tourId: "tour-nav-dashboard",
  },
  {
    label: "المخزون",
    icon: Package,
    tourId: "tour-nav-inventory",
    children: [
      { href: "/inventory", label: "قائمة المنتجات", icon: Boxes, exact: true },
      { href: "/inventory/batches", label: "إدارة الدفعات", icon: Database },
      { href: "/inventory/stocktake", label: "جرد المخزون", icon: CalendarX2 },
      { href: "/transfers", label: "نقل المخزون", icon: ArrowLeftRight },
    ],
  },
  {
    label: "المبيعات",
    icon: ShoppingCart,
    tourId: "tour-nav-sales",
    children: [
      { href: "/sales/invoices", label: "الفواتير", icon: FileText },
      { href: "/sales/customers", label: "العملاء", icon: Users },
    ],
  },
  {
    label: "المشتريات",
    icon: TruckIcon,
    tourId: "tour-nav-purchases",
    children: [
      {
        href: "/purchases/suppliers",
        label: "الموردون",
        icon: ShoppingBag,
        exact: true,
      },
      {
        href: "/purchases/suppliers/smart-buy",
        label: "الشراء الذكي",
        icon: TrendingUp,
      },
    ],
  },
  {
    label: "المحاسبة",
    icon: Wallet,
    tourId: "tour-nav-accounting",
    children: [
      { href: "/accounting/expenses", label: "المصروفات", icon: Receipt },
      {
        href: "/accounting/financials",
        label: "القوائم المالية",
        icon: BookOpen,
      },
      { href: "/accounting/shifts", label: "الوردية", icon: Clock },
    ],
  },
  {
    label: "التقارير",
    icon: LucideBarChart3,
    tourId: "tour-nav-reports",
    children: [
      {
        href: "/reports",
        label: "نظرة عامة",
        icon: BarChart3Icon,
        exact: true,
      },
      { href: "/reports/sales", label: "تقرير المبيعات", icon: TrendingUp },
      { href: "/reports/inventory", label: "تقرير المخزون", icon: PieChart },
      { href: "/reports/expiry", label: "إدارة الصلاحيات", icon: CalendarX2 },
      {
        href: "/reports/analytics",
        label: "لوحة التحليلات",
        icon: BarChart3,
      },
      {
        href: "/reports/stock-movement",
        label: "حركة المخزون",
        icon: Activity,
      },
      { href: "/reports/branches", label: "مقارنة الفروع", icon: Building2 },
      { href: "/reports/audit", label: "سجل المراجعة", icon: Shield },
      { href: "/reports/customers-debt", label: "ذمم العملاء", icon: User },
      { href: "/reports/offers-performance", label: "أداء العروض", icon: Tag },
      { href: "/reports/abc-analysis", label: "تحليل ABC", icon: LucideBarChart3 },
    ],
  },
  {
    label: "التسويق",
    icon: Tag,
    tourId: "tour-nav-marketing",
    children: [{ href: "/marketing/offers", label: "العروض", icon: Tag }],
  },
  {
    href: "/branches",
    label: "الفروع",
    icon: Building2,
    tourId: "tour-nav-branches",
  },
  {
    href: "/customer-screen",
    label: "فاحص الأسعار",
    icon: Monitor,
    tourId: "tour-nav-customer-screen",
    external: true,
  },
  {
    href: "/assistant",
    label: "المساعد الذكي",
    icon: MessageSquare,
    tourId: "tour-nav-assistant",
  },
  {
    href: "/settings",
    label: "الإعدادات",
    icon: Settings,
    tourId: "tour-nav-settings",
  },
];

type NavEntry = (typeof NAV)[number];

function getNavForRole(role: string | null, isElectron: boolean): NavEntry[] {
  if (role === "STOCK_KEEPER") {
    return [
      {
        label: "المخزون",
        icon: Package,
        tourId: "tour-nav-inventory",
        children: [
          {
            href: "/inventory",
            label: "قائمة المنتجات",
            icon: Boxes,
            exact: true,
          },
          {
            href: "/inventory/batches",
            label: "إدارة الدفعات",
            icon: Database,
          },
        ],
      },
      {
        label: "المشتريات",
        icon: TruckIcon,
        tourId: "tour-nav-purchases",
        children: [
          {
            href: "/purchases/suppliers",
            label: "الموردون",
            icon: ShoppingBag,
            exact: true,
          },
        ],
      },
    ] as NavEntry[];
  }
  // ADMIN / BRANCH_MANAGER: full nav on both desktop and cloud
  return NAV;
}

function isGroupActive(
  pathname: string,
  children: { href: string; exact?: boolean }[],
) {
  return children.some((c) =>
    c.exact
      ? pathname === c.href
      : pathname === c.href || pathname.startsWith(c.href + "/"),
  );
}

// Small badge marking a nav link as belonging to a higher plan tier.
function TierBadge({ tier }: { tier: PlanTier }) {
  const isEnterprise = tier === "enterprise";
  const Icon = isEnterprise ? Crown : Sparkles;
  return (
    <span
      title={`متاحة في خطة ${TIER_META[tier].label}`}
      className="flex items-center justify-center w-5 h-5 rounded-md shrink-0"
      style={{
        background: isEnterprise ? "rgba(245,158,11,0.16)" : "rgba(139,92,246,0.16)",
        border: `1px solid ${isEnterprise ? "rgba(245,158,11,0.45)" : "rgba(139,92,246,0.45)"}`,
      }}
    >
      <Icon className="w-3 h-3" style={{ color: isEnterprise ? "#fbbf24" : "#a78bfa" }} />
    </span>
  );
}

function NavItem({
  item,
  pathname,
  onNavigate,
  isElectron,
}: {
  item: (typeof NAV)[number];
  pathname: string;
  onNavigate?: () => void;
  isElectron?: boolean;
}) {
  const { hasFeature } = useFeatures();
  const active = item.href
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : false;
  const groupActive = item.children
    ? isGroupActive(pathname, item.children)
    : false;
  const [open, setOpen] = useState(groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  if (item.href) {
    const isExternal = (item as any).external && !isElectron;
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        id={(item as any).tourId}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
          active
            ? "text-white"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
        style={
          active
            ? {
                background:
                  "linear-gradient(90deg, rgba(9,75,159,0.3) 0%, rgba(9,75,159,0.08) 100%)",
                border: "1px solid rgba(9,75,159,0.25)",
                boxShadow: "0 0 16px rgba(9,75,159,0.12)",
              }
            : {}
        }
      >
        <item.icon
          className="w-4 h-4 shrink-0"
          style={{ color: active ? "#93C5FD" : undefined }}
        />
        <span className="flex-1">{item.label}</span>
        {(() => {
          const lock = requiredFeatureMeta(item.href!);
          return lock && !hasFeature(lock.key) ? <TierBadge tier={lock.tier} /> : null;
        })()}
      </Link>
    );
  }

  return (
    <div>
      <button
        id={(item as any).tourId}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
          groupActive && !open
            ? "text-blue-300 bg-white/5"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <item.icon
          className={`w-4 h-4 shrink-0 ${groupActive ? "text-blue-400" : ""}`}
        />
        <span className="flex-1 text-right">{item.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""} ${groupActive ? "text-blue-400" : "text-slate-600"}`}
        />
      </button>

      {open && (
        <div className="mt-0.5 mr-4 pr-3 border-r border-blue-500/20 space-y-0.5">
          {item.children!.map((child) => {
            const childActive = (child as any).exact
              ? pathname === child.href
              : pathname === child.href ||
                pathname.startsWith(child.href + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                  childActive
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/4"
                }`}
                style={
                  childActive
                    ? {
                        background: "rgba(9,75,159,0.18)",
                        borderRight: "2px solid #094B9F",
                        marginRight: "-2px",
                      }
                    : {}
                }
              >
                <child.icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: childActive ? "#93C5FD" : undefined }}
                />
                <span className="flex-1">{child.label}</span>
                {(() => {
                  const lock = requiredFeatureMeta(child.href);
                  return lock && !hasFeature(lock.key) ? <TierBadge tier={lock.tier} /> : null;
                })()}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatWidgetGuard() {
  const { isElectron } = useUser();
  if (isElectron) return null;
  return <ChatWidget />;
}

// Blocks rendering of a page whose required plan feature is disabled. Ungated
// pages (featureForPath === null) always render. While features load we render
// children to avoid a flash; the cached feature map makes this near-instant.
function PageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasFeature, ready } = useFeatures();
  const meta = requiredFeatureMeta(pathname);

  // Ungated pages always render. For gated pages we must NOT render children
  // until we know the feature is granted — otherwise the page mounts and calls
  // its (now 403-guarded) API, crashing on the non-array response. We gate on
  // `ready` (true as soon as the cached feature map is read) so a locked page
  // shows the upgrade screen instantly instead of waiting for the network.
  if (!meta) return <>{children}</>;
  if (hasFeature(meta.key)) return <>{children}</>;
  if (!ready)
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[78vh]">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
      </div>
    );

  const isEnterprise = meta.tier === "enterprise";
  const accent = isEnterprise ? "#f59e0b" : "#8b5cf6";
  const accent2 = isEnterprise ? "#d97706" : "#7c3aed";
  const TierIcon = isEnterprise ? Crown : Sparkles;

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[78vh] px-4" dir="rtl">
      <div className="max-w-lg w-full rounded-3xl overflow-hidden bg-white shadow-xl border border-slate-100">
        {/* Hero */}
        <div
          className="relative px-8 pt-10 pb-8 text-center overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)` }}
        >
          <div className="absolute -top-8 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-8 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center mb-4 border border-white/30">
              <TierIcon className="w-10 h-10 text-white" />
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-white/20 border border-white/30 px-3 py-1 rounded-full">
              <Lock className="w-3 h-3" />
              ميزة خطة {meta.tierLabel}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-8 text-center">
          <h2 className="text-2xl font-extrabold text-slate-800 mb-3">{meta.label}</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-7">
            هذه الصفحة غير متاحة في خطتك الحالية. للوصول إلى
            <span className="font-bold text-slate-700"> {meta.label} </span>
            يرجى ترقية اشتراكك إلى خطة
            <span className="font-extrabold" style={{ color: accent2 }}> «{meta.tierLabel}» </span>
            أو أعلى.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm px-6 py-3 rounded-xl transition-all"
            >
              العودة للرئيسية
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md"
              style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)` }}
            >
              <Sparkles className="w-4 h-4" />
              ترقية الخطة
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-5">للترقية يرجى التواصل مع مزوّد الخدمة</p>
        </div>
      </div>
    </div>
  );
}

function SyncMonitorLink({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [pending, setPending] = useState(0);
  const [online, setOnline]   = useState(false);
  const [syncing, setSyncing] = useState(false);
  const active = pathname === "/sync-monitor";

  useEffect(() => {
    const el = (window as any).electron;
    if (!el) return;
    el.onSyncStatus((s: { online: boolean; pending: number; syncing: boolean }) => {
      setOnline(s.online);
      setPending(s.pending);
      setSyncing(s.syncing);
    });
    return () => el.removeSyncStatusListener();
  }, []);

  return (
    <Link
      href="/sync-monitor"
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
        active ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
      style={
        active
          ? {
              background: "linear-gradient(90deg, rgba(9,75,159,0.3) 0%, rgba(9,75,159,0.08) 100%)",
              border: "1px solid rgba(9,75,159,0.25)",
              boxShadow: "0 0 16px rgba(9,75,159,0.12)",
            }
          : {}
      }
    >
      <Radio
        className="w-4 h-4 shrink-0"
        style={{ color: active ? "#93C5FD" : syncing ? "#fbbf24" : online ? "#34d399" : "#f87171" }}
      />
      <span className="flex-1">مراقبة المزامنة</span>
      {pending > 0 && !syncing && (
        <span
          className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(251,191,36,0.20)", color: "#fbbf24" }}
        >
          {pending}
        </span>
      )}
      {syncing && (
        <span
          className="text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse"
          style={{ background: "rgba(9,75,159,0.20)", color: "#93C5FD" }}
        >
          ↑↓
        </span>
      )}
    </Link>
  );
}

function BranchSelector() {
  const {
    branches,
    selectedBranch,
    setSelectedBranch,
    isOwner,
    loading,
    isSwitching,
  } = useBranch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Before client mount: render nothing (matches SSR output exactly — no hydration error)
  if (!mounted) return null;

  // After mount: if still loading but cache restored multi-branch admin data → show skeleton
  if (loading && isOwner && branches.length > 1) {
    return (
      <div
        className="px-3 py-3 mx-2 mb-2 rounded-xl animate-pulse"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="h-2 w-16 rounded mb-2"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <div
          className="h-8 rounded-xl"
          style={{ background: "rgba(9,75,159,0.08)" }}
        />
      </div>
    );
  }

  if (!isOwner || branches.length <= 1) return null;

  return (
    <div
      className="px-3 py-3 mx-2 mb-2 rounded-xl transition-all duration-300"
      style={{
        background: isSwitching
          ? "rgba(9,75,159,0.10)"
          : "rgba(255,255,255,0.04)",
        border: isSwitching
          ? "1px solid rgba(9,75,159,0.40)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: isSwitching ? "0 0 12px rgba(9,75,159,0.15)" : "none",
      }}
    >
      <div className="flex items-center justify-between mb-1.5 px-1">
        <p className="text-[10px] font-bold text-slate-500">الفرع النشط</p>
        {isSwitching && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-blue-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping inline-block" />
            جاري التحديث
          </span>
        )}
      </div>
      <div className="relative">
        <Building2
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-colors duration-300"
          style={{ color: isSwitching ? "#818cf8" : "#094B9F" }}
        />
        <select
          value={selectedBranch?.id ?? "all"}
          onChange={(e) => {
            if (e.target.value === "all")
              setSelectedBranch({ id: "all", name: "جميع الفروع" });
            else {
              const b = branches.find((x) => x.id === e.target.value);
              if (b) setSelectedBranch(b);
            }
          }}
          disabled={isSwitching}
          className="w-full pr-8 pl-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300"
          style={{
            background: isSwitching
              ? "rgba(9,75,159,0.18)"
              : "rgba(9,75,159,0.12)",
            border: "1px solid rgba(9,75,159,0.25)",
            color: "#93C5FD",
            appearance: "none",
            outline: "none",
            opacity: isSwitching ? 0.75 : 1,
          }}
        >
          <option value="all">— جميع الفروع —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 pointer-events-none" />
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { role, isElectron } = useUser();
  const isDark = theme === "dark";

  useEffect(() => {
    if (role === "CASHIER") router.replace("/pos");
  }, [role, router]);

  // Locked (out-of-plan) links are shown too, with a tier badge — gating
  // happens on click via PageGate, not by hiding them from the sidebar.
  const visibleNav = getNavForRole(role, isElectron);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearClientSession();
    router.push("/login");
  }

  return (
    <div
      className="flex flex-col h-full relative overflow-hidden"
      dir="rtl"
      style={{
        background:
          "linear-gradient(160deg, #1e1b4b 0%, #0f172a 55%, #0a0f1e 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 pointer-events-none"
        style={{
          background: "radial-gradient(circle, #094B9F, transparent)",
          transform: "translate(20%, -30%)",
        }}
      />

      {/* Brand */}
      <div className="px-4 py-5 relative overflow-hidden flex-shrink-0">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            background:
              "linear-gradient(135deg, rgba(9,75,159,0.4) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
            style={{ boxShadow: "0 4px 12px rgba(9,75,159,0.4)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-black text-white leading-tight">
              نظام المدقق
            </p>
            <p className="text-[10px] text-blue-300/60 font-semibold tracking-widest uppercase">
              SaaS Pro
            </p>
          </div>
        </div>
      </div>

      {/* Branch Selector */}
      <BranchSelector />

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
        }}
      >
        {visibleNav.map((item) => (
          <NavItem
            key={item.href ?? item.label}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            isElectron={isElectron}
          />
        ))}
        {isElectron && (
          <SyncMonitorLink pathname={pathname} onNavigate={onNavigate} />
        )}
      </nav>

      {/* Footer actions */}
      <div
        className="px-2 py-3 flex-shrink-0 space-y-1"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-white/5"
          title={
            isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع المظلم"
          }
        >
          {/* Animated pill */}
          <div
            className="relative flex-shrink-0 rounded-full transition-all duration-300"
            style={{
              width: 38,
              height: 20,
              background: isDark
                ? "linear-gradient(135deg, rgba(9,75,159,0.5), rgba(14,99,212,0.4))"
                : "rgba(255,255,255,0.12)",
              border: isDark
                ? "1px solid rgba(9,75,159,0.5)"
                : "1px solid rgba(255,255,255,0.12)",
              boxShadow: isDark ? "0 0 10px rgba(9,75,159,0.3)" : "none",
            }}
          >
            <div
              className="absolute top-0.5 flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                width: 16,
                height: 16,
                right: isDark ? 2 : "calc(100% - 18px)",
                background: isDark
                  ? "linear-gradient(135deg, #818cf8, #094B9F)"
                  : "linear-gradient(135deg, #fbbf24, #f59e0b)",
                boxShadow: isDark
                  ? "0 0 8px rgba(9,75,159,0.7)"
                  : "0 0 8px rgba(251,191,36,0.7)",
              }}
            >
              {isDark ? (
                <Moon className="text-white" style={{ width: 9, height: 9 }} />
              ) : (
                <Sun className="text-white" style={{ width: 9, height: 9 }} />
              )}
            </div>
          </div>

          <span className="text-[12px] font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">
            {isDark ? "الوضع المظلم" : "الوضع الفاتح"}
          </span>
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-500 hover:text-red-400 transition-all duration-150 hover:bg-red-500/8"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { isSwitching, selectedBranch } = useBranch();
  const [mobileOpen, setMobileOpen] = useState(false);
  useAutoBackup();

  // Auto-activate sync worker on first run inside Electron, and re-activate
  // whenever the logged-in user's branch differs from the saved config.
  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron) return;

    async function setupSync() {
      try {
        const setupRes = await fetch("/api/sync/setup");
        if (!setupRes.ok) return;
        const { cloudUrl, branchId, tenantId, activationCode } =
          await setupRes.json();
        if (!cloudUrl || !branchId || !activationCode) return;

        const existing = await electron.getBranchConfig().catch(() => null);
        // Skip only if already configured for the exact same branch
        if (existing?.branchToken && existing?.branchId === branchId) return;

        // Delegate the cloud fetch to the Electron main process so it runs in
        // Node.js — Chromium enforces CORS and would block a cross-port fetch.
        await electron.activateSync({
          activationCode,
          branchId,
          tenantId,
          cloudUrl,
        });
      } catch {
        // Sync setup is best-effort — silently fail if cloud unreachable
      }
    }

    setupSync();
  }, []);

  return (
    <div
      className="flex h-screen"
      dir="rtl"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0"
        style={{ boxShadow: "2px 0 20px rgba(0,0,0,0.12)" }}
      >
        <Sidebar />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 lg:hidden transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Branch switching top bar */}
        <div
          className="overflow-hidden transition-all duration-300 shrink-0"
          style={{ height: isSwitching ? "36px" : "0px" }}
        >
          <div
            className="flex items-center justify-center gap-2 text-xs font-bold h-9"
            style={{
              background:
                "linear-gradient(90deg, rgba(9,75,159,0.12) 0%, rgba(14,99,212,0.12) 100%)",
              borderBottom: "1px solid rgba(9,75,159,0.20)",
              color: "#818cf8",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            جاري تحميل بيانات {selectedBranch?.name ?? "الفرع"}…
          </div>
        </div>

        {/* Mobile topbar */}
        <header
          className="lg:hidden flex items-center justify-between px-4 py-3 shrink-0"
          data-mobile-topbar
          style={{
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--border-color)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #094B9F, #063A8A)",
              }}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="text-sm font-black"
              style={{ color: "var(--text-primary)" }}
            >
              نظام المدقق
            </span>
          </div>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-slate-600" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600" />
            )}
          </button>
        </header>

        <main
          className="flex-1 overflow-auto p-4 md:p-6 transition-opacity duration-200"
          style={{ opacity: isSwitching ? 0.6 : 1 }}
        >
          <PageGate>{children}</PageGate>
        </main>
      </div>

      {/* AI Assistant floating widget — hidden on desktop */}
      <ChatWidgetGuard />
    </div>
  );
}

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <FeatureProvider>
        <BranchProvider>
          <TourProvider>
            <MainContent>{children}</MainContent>
            <AppTour />
          </TourProvider>
        </BranchProvider>
      </FeatureProvider>
    </ThemeProvider>
  );
}
