"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { BranchProvider, useBranch } from "@/contexts/BranchContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, Building2, Package, ShoppingCart, TruckIcon,
  BarChart3, Settings, ArrowLeftRight, LogOut, ChevronDown,
  Tag, Wallet, Users, FileText, ArrowDownToLine, Activity,
  TrendingUp, BookOpen, Clock, PieChart, Boxes, Receipt,
  ShoppingBag, Menu, X, Database, Store, Sun, Moon,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  {
    label: "المخزون", icon: Package,
    children: [
      { href: "/inventory", label: "قائمة المنتجات", icon: Boxes, exact: true },
      { href: "/inventory/batches", label: "إدارة الدفعات", icon: Database },
      { href: "/transfers", label: "نقل المخزون", icon: ArrowLeftRight },
    ],
  },
  {
    label: "المبيعات", icon: ShoppingCart,
    children: [
      { href: "/sales/invoices", label: "الفواتير", icon: FileText },
      { href: "/sales/customers", label: "العملاء", icon: Users },
    ],
  },
  {
    label: "المشتريات", icon: TruckIcon,
    children: [
      { href: "/purchases/suppliers", label: "الموردون", icon: ShoppingBag, exact: true },
      { href: "/purchases/suppliers/smart-buy", label: "الشراء الذكي", icon: TrendingUp },
    ],
  },
  {
    label: "المحاسبة", icon: Wallet,
    children: [
      { href: "/accounting/expenses", label: "المصروفات", icon: Receipt },
      { href: "/accounting/financials", label: "القوائم المالية", icon: BookOpen },
      { href: "/accounting/shifts", label: "الوردية", icon: Clock },
    ],
  },
  {
    label: "التقارير", icon: BarChart3,
    children: [
      { href: "/reports", label: "نظرة عامة", icon: BarChart3, exact: true },
      { href: "/reports/sales", label: "تقرير المبيعات", icon: TrendingUp },
      { href: "/reports/inventory", label: "تقرير المخزون", icon: Boxes },
      { href: "/reports/analytics", label: "التحليلات", icon: PieChart },
      { href: "/reports/stock-movement", label: "حركة المخزون", icon: Activity },
      { href: "/reports/branches", label: "تقرير الفروع", icon: Building2 },
      { href: "/reports/audit", label: "سجل التدقيق", icon: FileText },
    ],
  },
  { label: "التسويق", icon: Tag, children: [{ href: "/marketing/offers", label: "العروض", icon: Tag }] },
  { href: "/branches", label: "الفروع", icon: Building2 },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

function isGroupActive(pathname: string, children: { href: string; exact?: boolean }[]) {
  return children.some(c =>
    c.exact ? pathname === c.href : pathname === c.href || pathname.startsWith(c.href + "/")
  );
}

function NavItem({ item, pathname, onNavigate }: { item: (typeof NAV)[number]; pathname: string; onNavigate?: () => void }) {
  const active = item.href
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : false;
  const groupActive = item.children ? isGroupActive(pathname, item.children) : false;
  const [open, setOpen] = useState(groupActive);

  useEffect(() => { if (groupActive) setOpen(true); }, [groupActive]);

  if (item.href) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
          active
            ? "text-white"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
        style={active ? {
          background: 'linear-gradient(90deg, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0.08) 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 0 16px rgba(99,102,241,0.12)',
        } : {}}
      >
        <item.icon className="w-4 h-4 shrink-0" style={{ color: active ? '#a5b4fc' : undefined }} />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
          groupActive && !open ? "text-indigo-300 bg-white/5" : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <item.icon className={`w-4 h-4 shrink-0 ${groupActive ? "text-indigo-400" : ""}`} />
        <span className="flex-1 text-right">{item.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""} ${groupActive ? "text-indigo-400" : "text-slate-600"}`} />
      </button>

      {open && (
        <div className="mt-0.5 mr-4 pr-3 border-r border-indigo-500/20 space-y-0.5">
          {item.children!.map(child => {
            const childActive = (child as any).exact
              ? pathname === child.href
              : pathname === child.href || pathname.startsWith(child.href + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                  childActive ? "text-white" : "text-slate-500 hover:text-slate-200 hover:bg-white/4"
                }`}
                style={childActive ? {
                  background: 'rgba(99,102,241,0.18)',
                  borderRight: '2px solid #6366f1',
                  marginRight: '-2px',
                } : {}}
              >
                <child.icon className="w-3.5 h-3.5 shrink-0" style={{ color: childActive ? '#a5b4fc' : undefined }} />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BranchSelector() {
  const { branches, selectedBranch, setSelectedBranch, isOwner, loading, isSwitching } = useBranch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Before client mount: render nothing (matches SSR output exactly — no hydration error)
  if (!mounted) return null;

  // After mount: if still loading but cache restored multi-branch admin data → show skeleton
  if (loading && isOwner && branches.length > 1) {
    return (
      <div className="px-3 py-3 mx-2 mb-2 rounded-xl animate-pulse"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="h-2 w-16 rounded mb-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-8 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }} />
      </div>
    );
  }

  if (!isOwner || branches.length <= 1) return null;

  return (
    <div
      className="px-3 py-3 mx-2 mb-2 rounded-xl transition-all duration-300"
      style={{
        background: isSwitching ? 'rgba(99,102,241,0.10)' : 'rgba(255,255,255,0.04)',
        border: isSwitching ? '1px solid rgba(99,102,241,0.40)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isSwitching ? '0 0 12px rgba(99,102,241,0.15)' : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-1.5 px-1">
        <p className="text-[10px] font-bold text-slate-500">الفرع النشط</p>
        {isSwitching && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping inline-block" />
            جاري التحديث
          </span>
        )}
      </div>
      <div className="relative">
        <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-colors duration-300"
          style={{ color: isSwitching ? '#818cf8' : '#6366f1' }} />
        <select
          value={selectedBranch?.id ?? "all"}
          onChange={e => {
            if (e.target.value === "all") setSelectedBranch({ id: "all", name: "جميع الفروع" });
            else { const b = branches.find(x => x.id === e.target.value); if (b) setSelectedBranch(b); }
          }}
          disabled={isSwitching}
          className="w-full pr-8 pl-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300"
          style={{
            background: isSwitching ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#a5b4fc',
            appearance: 'none',
            outline: 'none',
            opacity: isSwitching ? 0.75 : 1,
          }}
        >
          <option value="all">— جميع الفروع —</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-400 pointer-events-none" />
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div
      className="flex flex-col h-full relative overflow-hidden"
      dir="rtl"
      style={{
        background: 'linear-gradient(160deg, #1e1b4b 0%, #0f172a 55%, #0a0f1e 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)', transform: 'translate(20%, -30%)' }} />

      {/* Brand */}
      <div className="px-4 py-5 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-25"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4) 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)' }} />
            <Store className="w-4.5 h-4.5 text-white relative z-10" style={{ width: 17, height: 17 }} />
          </div>
          <div>
            <p className="text-sm font-black text-white leading-tight">نظام البيان</p>
            <p className="text-[10px] text-indigo-300/60 font-semibold tracking-widest uppercase">SaaS Pro</p>
          </div>
        </div>
      </div>

      {/* Branch Selector */}
      <BranchSelector />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {NAV.map(item => (
          <NavItem key={item.href ?? item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Footer actions */}
      <div className="px-2 py-3 flex-shrink-0 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-white/5"
          title={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع المظلم'}
        >
          {/* Animated pill */}
          <div
            className="relative flex-shrink-0 rounded-full transition-all duration-300"
            style={{
              width: 38, height: 20,
              background: isDark
                ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.4))'
                : 'rgba(255,255,255,0.12)',
              border: isDark ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.12)',
              boxShadow: isDark ? '0 0 10px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            <div
              className="absolute top-0.5 flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                width: 16, height: 16,
                right: isDark ? 2 : 'calc(100% - 18px)',
                background: isDark
                  ? 'linear-gradient(135deg, #818cf8, #6366f1)'
                  : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                boxShadow: isDark
                  ? '0 0 8px rgba(99,102,241,0.7)'
                  : '0 0 8px rgba(251,191,36,0.7)',
              }}
            >
              {isDark
                ? <Moon className="text-white" style={{ width: 9, height: 9 }} />
                : <Sun className="text-white" style={{ width: 9, height: 9 }} />
              }
            </div>
          </div>

          <span className="text-[12px] font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">
            {isDark ? 'الوضع المظلم' : 'الوضع الفاتح'}
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

  return (
    <div className="flex h-screen" dir="rtl" style={{ background: 'var(--bg-page)' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0"
        style={{ boxShadow: '2px 0 20px rgba(0,0,0,0.12)' }}>
        <Sidebar />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 lg:hidden transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Branch switching top bar */}
        <div
          className="overflow-hidden transition-all duration-300 shrink-0"
          style={{ height: isSwitching ? '36px' : '0px' }}
        >
          <div className="flex items-center justify-center gap-2 text-xs font-bold h-9"
            style={{
              background: 'linear-gradient(90deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
              borderBottom: '1px solid rgba(99,102,241,0.20)',
              color: '#818cf8',
            }}>
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            جاري تحميل بيانات {selectedBranch?.name ?? 'الفرع'}…
          </div>
        </div>

        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 shrink-0"
          data-mobile-topbar
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <ShoppingCart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>نظام البيان</span>
          </div>
          <button onClick={() => setMobileOpen(o => !o)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            {mobileOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
          </button>
        </header>

        <main
          className="flex-1 overflow-auto p-4 md:p-6 transition-opacity duration-200"
          style={{ opacity: isSwitching ? 0.6 : 1 }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BranchProvider>
        <MainContent>{children}</MainContent>
      </BranchProvider>
    </ThemeProvider>
  );
}
