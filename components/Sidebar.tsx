'use client';

import React, { useState, useEffect } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Home, ShoppingCart, Package, BarChart3, Settings,
    Users, LogOut, Menu, X, FileText, Activity,
    Tag, TrendingDown, ChevronDown, Boxes, CalendarX2,
    ArrowDownToLine, Receipt, Calculator, PieChart,
    Building2, BrainCircuit, Database, Store, Wallet,
    Shield, Star, Zap, Monitor
} from 'lucide-react';
import { getRoleLabel, ROLE_LABELS } from '@/lib/roles';

interface NavItem {
    href: string;
    icon: React.ElementType;
    label: string;
}

interface NavSection {
    key: string;
    label: string;
    icon: React.ElementType;
    gradient: string;
    color: string;
    items: NavItem[];
}

// Role → avatar gradient color
const ROLE_COLORS: Record<string, { gradient: string; badge: string; icon: React.ElementType }> = {
    SUPER_ADMIN:    { gradient: 'from-blue-400 to-orange-500',  badge: 'bg-blue-500/20 text-blue-300',   icon: Shield },
    ADMIN:          { gradient: 'from-blue-400 to-violet-500', badge: 'bg-blue-500/20 text-blue-300', icon: Star },
    BRANCH_MANAGER: { gradient: 'from-cyan-400 to-blue-500',    badge: 'bg-cyan-500/20 text-cyan-300',     icon: Store },
    STOCK_KEEPER:   { gradient: 'from-emerald-400 to-teal-500', badge: 'bg-emerald-500/20 text-emerald-300', icon: Package },
    CASHIER:        { gradient: 'from-slate-400 to-slate-500',  badge: 'bg-slate-500/20 text-slate-300',   icon: Zap },
};

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [userRole, setUserRole] = useState<string>('CASHIER');
    const [openSections, setOpenSections] = useState<string[]>(['sales', 'purchases']);

    useEffect(() => {
        const checkScreen = () => setIsMobile(window.innerWidth < 1024);
        checkScreen();
        window.addEventListener('resize', checkScreen);
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => { if (data.user) setUserRole(data.user.role || 'CASHIER'); })
            .catch(console.error);
        return () => window.removeEventListener('resize', checkScreen);
    }, []);

    useEffect(() => {
        if (isMobile) setIsOpen(false);
    }, [pathname, isMobile]);

    const { confirm, dialog } = useConfirm();

    const handleLogout = async () => {
        if (!await confirm({ title: 'تسجيل الخروج', message: 'هل أنت متأكد من تسجيل الخروج من النظام؟', variant: 'logout', confirmLabel: 'خروج' })) return;
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const hiddenRoutes = ['/pos', '/login', '/customer-screen'];
    if (hiddenRoutes.some(route => pathname?.startsWith(route))) return null;

    const toggleSection = (key: string) => {
        setOpenSections(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const allNavHrefs = [
        '/inventory', '/inventory/batches', '/inventory/expiry',
        '/purchases/suppliers', '/purchases/suppliers/smart-buy',
        '/sales/invoices', '/sales/customers',
        '/accounting/expenses', '/accounting/shifts', '/accounting/financials',
        '/reports/sales', '/reports/inventory', '/reports/stock-movement', '/reports/analytics',
        '/reports/branches', '/reports/audit', '/reports/customers-debt',
        '/marketing/offers',
    ];

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        if (pathname === href) return true;
        if (!pathname?.startsWith(href + '/')) return false;
        const hasMoreSpecificSibling = allNavHrefs.some(
            h => h !== href && h.startsWith(href) && pathname?.startsWith(h)
        );
        return !hasMoreSpecificSibling;
    };

    const isSectionActive = (section: NavSection) =>
        section.items.some(item => isActive(item.href));

    const sections: NavSection[] = [
        {
            key: 'sales',
            label: 'المبيعات',
            icon: ShoppingCart,
            gradient: 'from-blue-500 to-blue-600',
            color: '#094B9F',
            items: [
                { href: '/sales/invoices', icon: FileText, label: 'سجل الفواتير' },
                { href: '/sales/customers', icon: Users, label: 'العملاء والديون' },
            ]
        },
        {
            key: 'purchases',
            label: 'المشتريات والمخزون',
            icon: Package,
            gradient: 'from-blue-400 to-orange-500',
            color: '#f59e0b',
            items: [
                { href: '/inventory', icon: Boxes, label: 'المنتجات والمخزون' },
                { href: '/inventory/batches', icon: Database,   label: 'إدارة الدفعات' },
                { href: '/inventory/expiry', icon: CalendarX2, label: 'إدارة الصلاحيات' },
                { href: '/purchases/suppliers', icon: Building2, label: 'الموردين' },
                { href: '/purchases/suppliers/smart-buy', icon: BrainCircuit, label: 'مستشار المشتريات' },
            ]
        },
        {
            key: 'accounting',
            label: 'المحاسبة',
            icon: Calculator,
            gradient: 'from-violet-500 to-purple-600',
            color: '#094B9F',
            items: [
                { href: '/accounting/expenses', icon: TrendingDown, label: 'المصروفات' },
                { href: '/accounting/shifts', icon: Receipt, label: 'الورديات' },
                { href: '/accounting/financials', icon: Wallet, label: 'التقارير المالية' },
            ]
        },
        {
            key: 'reports',
            label: 'التقارير والتحليلات',
            icon: BarChart3,
            gradient: 'from-cyan-400 to-sky-600',
            color: '#06b6d4',
            items: [
                { href: '/reports/sales', icon: Activity, label: 'تقرير المبيعات' },
                { href: '/reports/inventory', icon: PieChart, label: 'جرد المخزون' },
                { href: '/reports/stock-movement', icon: ArrowDownToLine, label: 'حركة المخزون' },
                { href: '/reports/branches', icon: Building2, label: 'مقارنة الفروع' },
                { href: '/reports/analytics', icon: BarChart3, label: 'لوحة BI الذكية' },
                { href: '/reports/audit', icon: Shield, label: 'سجل المراجعة' },
                { href: '/reports/customers-debt', icon: Users, label: 'ذمم العملاء' },
            ]
        },
        {
            key: 'marketing',
            label: 'التسويق',
            icon: Tag,
            gradient: 'from-emerald-400 to-teal-500',
            color: '#10b981',
            items: [
                { href: '/marketing/offers', icon: Tag, label: 'العروض والخصومات' },
            ]
        },
    ];

    const roleInfo = ROLE_COLORS[userRole] || ROLE_COLORS.CASHIER;
    const RoleIcon = roleInfo.icon;

    const SidebarContent = () => (
        <div
            className="flex flex-col h-full overflow-hidden relative"
            style={{
                background: 'linear-gradient(160deg, #1e1b4b 0%, #0f172a 55%, #0a0f1e 100%)',
                borderLeft: '1px solid rgba(255,255,255,0.04)',
            }}
        >
            {/* Ambient glow top */}
            <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #094B9F 0%, transparent 70%)', transform: 'translate(20%, -30%)' }} />

            {/* ── Header ── */}
            <div className="px-5 py-5 relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-30"
                    style={{ background: 'linear-gradient(135deg, rgba(9,75,159,0.4) 0%, transparent 60%)' }} />
                <div className="relative flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #094B9F 0%, #063A8A 100%)', boxShadow: '0 4px 16px rgba(9,75,159,0.4)' }}>
                        <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)' }} />
                        <Store size={20} className="text-white relative z-10" />
                    </div>
                    <div>
                        <p className="text-white font-black text-[15px] tracking-wide leading-tight">نظام المدقق</p>
                        <p className="text-blue-300/70 text-[10px] font-semibold mt-0.5 tracking-widest uppercase">SaaS Pro</p>
                    </div>
                </div>
            </div>

            {/* ── Dashboard Link ── */}
            <div className="px-4 pt-2 pb-1 flex-shrink-0">
                <Link
                    href="/"
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 group ${
                        isActive('/')
                            ? 'text-white'
                            : 'text-slate-400 hover:text-white'
                    }`}
                    style={isActive('/') ? {
                        background: 'linear-gradient(90deg, rgba(9,75,159,0.3) 0%, rgba(9,75,159,0.08) 100%)',
                        boxShadow: '0 0 20px rgba(9,75,159,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                        border: '1px solid rgba(9,75,159,0.3)',
                    } : {}}
                >
                    <div className={`p-1.5 rounded-lg transition-all ${isActive('/') ? 'bg-blue-500/30' : 'bg-white/5 group-hover:bg-white/8'}`}>
                        <Home size={16} className={isActive('/') ? 'text-blue-300' : 'text-slate-400 group-hover:text-white'} />
                    </div>
                    لوحة القيادة
                    {isActive('/') && (
                        <div className="mr-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                </Link>
            </div>

            {/* ── POS Quick Access ── */}
            <div className="px-4 pb-1 flex-shrink-0">
                <Link
                    href="/pos"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-emerald-300 transition-all duration-300 group"
                    style={{ ':hover': { background: 'rgba(16,185,129,0.08)' } } as React.CSSProperties}
                >
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-emerald-500/15 transition-colors">
                        <ShoppingCart size={16} className="text-slate-400 group-hover:text-emerald-400" />
                    </div>
                    شاشة الكاشير (POS)
                </Link>
            </div>

            {/* ── Customer Screen Quick Access ── */}
            <div className="px-4 pb-3 flex-shrink-0">
                <Link
                    href="/customer-screen"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-violet-300 transition-all duration-300 group"
                >
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-violet-500/15 transition-colors">
                        <Monitor size={16} className="text-slate-400 group-hover:text-violet-400" />
                    </div>
                    شاشة فاحص الأسعار
                </Link>
            </div>

            {/* ── Divider ── */}
            <div className="mx-4 mb-3 h-px flex-shrink-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(9,75,159,0.15), transparent)' }} />

            {/* ── Sections ── */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

                {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'BRANCH_MANAGER') && sections.map(section => (
                    <div key={section.key}>
                        <button
                            onClick={() => toggleSection(section.key)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 group ${
                                isSectionActive(section)
                                    ? 'text-white bg-white/5'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg transition-all ${isSectionActive(section) ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`}
                                    style={{ background: `linear-gradient(135deg, ${section.color}25, ${section.color}10)` }}>
                                    <section.icon size={15} style={{ color: section.color }} />
                                </div>
                                <span>{section.label}</span>
                            </div>
                            <ChevronDown
                                size={13}
                                className="text-slate-500 transition-transform duration-300"
                                style={{ transform: openSections.includes(section.key) ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            />
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 ${openSections.includes(section.key) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="space-y-0.5 border-r-2 mr-7 pr-2 py-1 mt-0.5"
                                style={{ borderColor: `${section.color}25` }}>
                                {section.items.map(item => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-2.5 py-2 px-3 rounded-lg text-[12.5px] transition-all duration-150 ${
                                            isActive(item.href)
                                                ? 'font-bold text-white'
                                                : 'font-medium text-slate-400 hover:text-slate-200 hover:bg-white/4'
                                        }`}
                                        style={isActive(item.href) ? {
                                            background: `linear-gradient(90deg, ${section.color}20 0%, transparent 100%)`,
                                            borderRight: `2px solid ${section.color}`,
                                            marginRight: '-2px',
                                        } : {}}
                                    >
                                        <item.icon size={13} style={{ color: isActive(item.href) ? section.color : undefined }} />
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {/* ── Settings ── */}
                {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'BRANCH_MANAGER') && (
                    <>
                        <div className="mx-1 my-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(9,75,159,0.15), transparent)' }} />
                        <Link
                            href="/settings"
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 ${
                                isActive('/settings')
                                    ? 'text-white bg-white/8'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                            }`}
                        >
                            <div className={`p-1.5 rounded-lg ${isActive('/settings') ? 'bg-white/10' : 'bg-white/5'}`}>
                                <Settings size={15} className={isActive('/settings') ? 'text-white' : 'text-slate-500'} />
                            </div>
                            الإعدادات
                        </Link>
                    </>
                )}
            </div>

            {/* ── Footer: User Info ── */}
            <div className="flex-shrink-0 p-3 mx-3 mb-3 rounded-2xl"
                style={{
                    background: 'rgba(9,75,159,0.05)',
                    border: '1px solid rgba(9,75,159,0.12)',
                }}>
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${roleInfo.gradient} shadow-md`}>
                        <RoleIcon size={16} className="text-white" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-[12px] font-bold truncate">{getRoleLabel(userRole)}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5 ${roleInfo.badge}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            متصل
                        </span>
                    </div>
                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
                        title="تسجيل الخروج"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {dialog}
            {/* Mobile Toggle */}
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden fixed top-4 right-4 z-40 bg-white p-2 rounded-xl shadow-lg border border-gray-100 text-gray-800"
            >
                <Menu size={22} />
            </button>

            {/* Mobile Backdrop */}
            {isOpen && isMobile && (
                <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 h-screen flex-shrink-0 overflow-hidden"
                style={{ boxShadow: '2px 0 24px rgba(0,0,0,0.15)' }}>
                <SidebarContent />
            </aside>

            {/* Mobile Drawer */}
            <aside
                className={`lg:hidden fixed top-0 right-0 h-screen w-72 z-50 flex flex-col transition-transform duration-300 shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 left-4 z-10 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                    <X size={18} />
                </button>
                <SidebarContent />
            </aside>
        </>
    );
}
