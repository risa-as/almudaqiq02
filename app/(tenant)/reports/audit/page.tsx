'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useEffect, useState, useMemo } from 'react';
import {
    ShieldAlert, Search, Clock, ChevronDown, ChevronUp, X,
    ShoppingCart, PackagePlus, RotateCcw, ArrowLeftRight, Database,
    Plus, Pencil, Trash2, Package, Box, Truck, UserCog, Building2,
    Server, Activity, Users as UsersIcon, CalendarDays, Layers, Tag,
} from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import PageHeader from '@/components/ui/PageHeader';

interface AuditLog {
    id: string; userId: string | null; username: string | null;
    action: string; entity: string; entityId: string | null;
    details: string | null; createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  ترجمة العناصر (Entities) — مع بحث غير حساس لحالة الأحرف
// ════════════════════════════════════════════════════════════════════════════
const ENTITY_META: Record<string, { label: string; icon: React.ElementType }> = {
    transaction:  { label: 'فاتورة بيع',  icon: ShoppingCart },
    productbatch: { label: 'دفعة مخزون',  icon: Layers },
    product:      { label: 'منتج',         icon: Box },
    customer:     { label: 'عميل',         icon: UsersIcon },
    supplier:     { label: 'مورد',         icon: Truck },
    user:         { label: 'مستخدم',       icon: UserCog },
    cashiershift: { label: 'وردية',        icon: Clock },
    transfer:     { label: 'تحويل مخزون',  icon: ArrowLeftRight },
    branch:       { label: 'فرع',          icon: Building2 },
    system:       { label: 'النظام',       icon: Server },
};

function entityMeta(entity: string) {
    return ENTITY_META[entity?.toLowerCase()] ?? { label: entity, icon: Package };
}

// ════════════════════════════════════════════════════════════════════════════
//  ترجمة الإجراءات (Actions) — لكل إجراء فئة + لون + أيقونة + اسم عربي
//  الفئات: create | update | delete | sale | special | system
// ════════════════════════════════════════════════════════════════════════════
type Cat = 'create' | 'update' | 'delete' | 'sale' | 'special' | 'system';

const CAT_STYLE: Record<Cat, { bg: string; text: string; ring: string; bar: string }> = {
    create:  { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', bar: '#10b981' },
    update:  { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200',    bar: '#3b82f6' },
    delete:  { bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200',    bar: '#f43f5e' },
    sale:    { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200',  bar: '#8b5cf6' },
    special: { bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-200',   bar: '#f59e0b' },
    system:  { bg: 'bg-slate-100',  text: 'text-slate-600',   ring: 'ring-slate-200',   bar: '#94a3b8' },
};

const ACTION_META: Record<string, { label: string; cat: Cat; icon: React.ElementType }> = {
    // مبيعات ومشتريات
    SALE:            { label: 'بيع',           cat: 'sale',    icon: ShoppingCart },
    PURCHASE:        { label: 'شراء',          cat: 'create',  icon: PackagePlus },
    PURCHASE_RETURN: { label: 'مرتجع شراء',    cat: 'special', icon: RotateCcw },
    REFUND:          { label: 'استرداد',        cat: 'special', icon: RotateCcw },
    TRANSFER:        { label: 'تحويل مخزون',   cat: 'special', icon: ArrowLeftRight },
    APPLY_DISCOUNT:  { label: 'خصم على الفاتورة', cat: 'special', icon: Tag },
    EDIT_PRICE:      { label: 'تعديل سعر بيع',  cat: 'update',  icon: Pencil },
    // منتجات
    CREATE_PRODUCT:  { label: 'إضافة منتج',    cat: 'create',  icon: Plus },
    UPDATE_PRODUCT:  { label: 'تعديل منتج',    cat: 'update',  icon: Pencil },
    DELETE_PRODUCT:  { label: 'حذف منتج',      cat: 'delete',  icon: Trash2 },
    UPDATE_PRICE:    { label: 'تعديل سعر',     cat: 'update',  icon: Pencil },
    // عملاء
    CREATE_CUSTOMER: { label: 'إضافة عميل',    cat: 'create',  icon: Plus },
    UPDATE_CUSTOMER: { label: 'تعديل عميل',    cat: 'update',  icon: Pencil },
    DELETE_CUSTOMER: { label: 'حذف عميل',      cat: 'delete',  icon: Trash2 },
    // مستخدمون
    CREATE_USER:     { label: 'إضافة مستخدم',  cat: 'create',  icon: Plus },
    UPDATE_USER:     { label: 'تعديل مستخدم',  cat: 'update',  icon: Pencil },
    DELETE_USER:     { label: 'حذف مستخدم',    cat: 'delete',  icon: Trash2 },
    // ورديات ونظام
    OPEN_SHIFT:      { label: 'فتح وردية',     cat: 'create',  icon: Clock },
    CLOSE_SHIFT:     { label: 'إغلاق وردية',   cat: 'system',  icon: Clock },
    BACKUP:          { label: 'نسخ احتياطي',   cat: 'system',  icon: Database },
};

// ترجمة احتياطية لأي إجراء غير معرّف صراحةً (CREATE_X / UPDATE_X / DELETE_X …)
const VERB_AR: Record<string, { ar: string; cat: Cat; icon: React.ElementType }> = {
    CREATE: { ar: 'إضافة',  cat: 'create', icon: Plus },
    ADD:    { ar: 'إضافة',  cat: 'create', icon: Plus },
    UPDATE: { ar: 'تعديل',  cat: 'update', icon: Pencil },
    EDIT:   { ar: 'تعديل',  cat: 'update', icon: Pencil },
    DELETE: { ar: 'حذف',    cat: 'delete', icon: Trash2 },
    REMOVE: { ar: 'حذف',    cat: 'delete', icon: Trash2 },
    OPEN:   { ar: 'فتح',    cat: 'create', icon: Clock },
    CLOSE:  { ar: 'إغلاق',  cat: 'system', icon: Clock },
};
const NOUN_AR: Record<string, string> = {
    PRODUCT: 'منتج', CUSTOMER: 'عميل', USER: 'مستخدم', SUPPLIER: 'مورد',
    SHIFT: 'وردية', PRICE: 'سعر', BATCH: 'دفعة', BRANCH: 'فرع',
    CATEGORY: 'فئة', OFFER: 'عرض', TRANSFER: 'تحويل', ORDER: 'طلب',
};

function actionMeta(action: string): { label: string; cat: Cat; icon: React.ElementType } {
    if (ACTION_META[action]) return ACTION_META[action];
    // محاولة ترجمة تركيبية: VERB_NOUN
    const parts = (action ?? '').split('_');
    const verb = VERB_AR[parts[0]];
    if (verb) {
        const noun = parts.slice(1).map(p => NOUN_AR[p] ?? '').filter(Boolean).join(' ');
        return { label: noun ? `${verb.ar} ${noun}` : verb.ar, cat: verb.cat, icon: verb.icon };
    }
    return { label: action || '—', cat: 'system', icon: Activity };
}

// ════════════════════════════════════════════════════════════════════════════
//  ترجمة تفاصيل العملية (details JSON)
// ════════════════════════════════════════════════════════════════════════════
const DETAIL_KEYS: Record<string, string> = {
    total: 'الإجمالي', items: 'عدد الأصناف', paymentMethod: 'طريقة الدفع',
    product: 'المنتج', qty: 'الكمية', quantity: 'الكمية', costPrice: 'سعر التكلفة',
    name: 'الاسم', price: 'السعر', amount: 'المبلغ', batchId: 'رقم الدفعة',
    productId: 'رقم المنتج', discount: 'الخصم', customer: 'العميل', supplier: 'المورد',
    receipt: 'رقم الفاتورة', count: 'عدد الأصناف المعدّلة', priceEdited: 'تعديل سعر',
};
const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'نقد', CARD: 'بطاقة', CREDIT: 'آجل', SPLIT: 'مختلط',
};
function translateDetails(obj: Record<string, any>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => {
            const key = DETAIL_KEYS[k] ?? k;
            const val = (k === 'paymentMethod' && PAYMENT_LABELS[String(v)]) ? PAYMENT_LABELS[String(v)] : String(v);
            return [key, val];
        })
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  مكوّنات صغيرة
// ════════════════════════════════════════════════════════════════════════════
function ActionBadge({ action, withIcon = true }: { action: string; withIcon?: boolean }) {
    const m = actionMeta(action);
    const s = CAT_STYLE[m.cat];
    const Icon = m.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
            {withIcon && <Icon size={11} />}
            {m.label}
        </span>
    );
}

// وقت نسبي بالعربي
function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'الآن';
    const m = Math.floor(s / 60);
    if (m < 60) return `منذ ${m} دقيقة`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} ساعة`;
    const d = Math.floor(h / 24);
    if (d < 30) return `منذ ${d} يوم`;
    return new Date(iso).toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });
}

const PAGE_SIZE = 25;
const PERIOD_OPTS = [
    { v: 'today', l: 'اليوم' }, { v: 'week', l: 'أسبوع' },
    { v: 'month', l: '30 يوماً' }, { v: 'all', l: 'الكل' },
];

export default function AuditReportPage() {
  usePageTitle('سجل التدقيق');
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [logs,    setLogs]    = useState<AuditLog[]>([]);
    const [stats,   setStats]   = useState<any>(null);
    const [filters, setFilters] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);

    const [search,    setSearch]    = useState('');
    const [period,    setPeriod]    = useState('month');
    const [selAction, setSelAction] = useState('');
    const [selEntity, setSelEntity] = useState('');
    const [selUser,   setSelUser]   = useState('');
    const [page,      setPage]      = useState(1);
    const [expanded,  setExpanded]  = useState<string | null>(null);

    useEffect(() => {
        if (branchLoading) return;
        setLoading(true);
        setPage(1);
        const params = new URLSearchParams({ period });
        if (selAction) params.set('action', selAction);
        if (selEntity) params.set('entity', selEntity);
        if (selUser)   params.set('username', selUser);
        if (selectedBranch?.id && selectedBranch.id !== 'all') params.set('branchId', selectedBranch.id);
        fetch(`/api/audit?${params}`)
            .then(r => r.json())
            .then(d => { setLogs(d.logs ?? []); setStats(d.stats ?? null); setFilters(d.filters ?? null); })
            .catch(console.error)
            .finally(() => { setLoading(false); setInitialized(true); });
    }, [selectedBranch, branchLoading, period, selAction, selEntity, selUser]);

    const filtered = useMemo(() =>
        logs.filter(l => {
            if (!search) return true;
            const q = search.toLowerCase();
            const m = actionMeta(l.action);
            return (
                (l.username ?? '').toLowerCase().includes(q) ||
                (l.action   ?? '').toLowerCase().includes(q) ||
                m.label.includes(search) ||
                entityMeta(l.entity).label.includes(search) ||
                (l.entity   ?? '').toLowerCase().includes(q) ||
                (l.details  ?? '').toLowerCase().includes(q) ||
                (l.entityId ?? '').toLowerCase().includes(q)
            );
        }), [logs, search]);

    const pages     = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hasFilters = !!(selAction || selEntity || selUser || search);

    // ── Loading ──────────────────────────────────────────────────────────────
    if (!initialized) return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen" dir="rtl">
            <div className="flex flex-col items-center justify-center pt-10 pb-4 gap-5">
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 12px 40px rgba(249,115,22,0.4)' }}>
                        <div className="absolute inset-0 opacity-25" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 60%)' }} />
                        <ShieldAlert size={36} className="text-white relative z-10 sk-spin" />
                    </div>
                </div>
                <div className="text-center space-y-1.5">
                    <p className="text-xl font-black text-slate-800">جاري تحميل سجل المراقبة</p>
                    <div className="flex items-center justify-center gap-1.5">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400 sk-pulse" style={{ animationDelay: `${delay}s` }} />
                        ))}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                <div className="divide-y divide-slate-50">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-6 py-4">
                            {[60, 35, 30, 70].map((w, j) => <div key={j} className="skeleton h-3.5 rounded" style={{ width: `${w / 4}%` }} />)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
            {loading && initialized && (
                <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #094B9F, #1565C0, #094B9F)", backgroundSize: "200% 100%", width: "40%", animation: "shimmer 1.2s ease-in-out infinite" }} />
                </div>
            )}

            {/* Header */}
            <PageHeader
                title="سجل المراقبة والتدقيق"
                subtitle="تتبّع احترافي لجميع العمليات والأوامر التي ينفّذها المستخدمون على النظام"
                icon={ShieldAlert}
                gradient="linear-gradient(135deg, #f97316, #ea580c)"
            />

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Activity}    color="#094B9F" label="إجمالي العمليات" value={stats.total} />
                    <StatCard icon={CalendarDays} color="#f97316" label="عمليات اليوم"    value={stats.today} highlight />
                    <StatCard icon={UsersIcon}   color="#10b981" label="مستخدمون نشطون"  value={filters?.users?.length ?? 0} />
                    <StatCard icon={Layers}      color="#8b5cf6" label="أنواع العناصر"    value={filters?.entities?.length ?? 0} />
                </div>
            )}

            {/* Top actions */}
            {filters?.actions?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity size={15} className="text-orange-500" />
                        <h3 className="text-sm font-bold text-gray-800">أكثر الأوامر تكراراً</h3>
                        <span className="text-[11px] text-gray-400">— اضغط للتصفية</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {filters.actions.slice(0, 10).map((a: any) => {
                            const active = selAction === a.value;
                            return (
                                <button key={a.value}
                                    onClick={() => { setSelAction(active ? '' : a.value); setPage(1); }}
                                    className={`flex items-center gap-2 pr-2 pl-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-orange-300'}`}>
                                    {active ? <span className="text-[11px] font-bold">{actionMeta(a.value).label}</span> : <ActionBadge action={a.value} />}
                                    <span className={`font-bold tabular-nums ${active ? 'text-white' : 'text-gray-400'}`}>{a.count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="بحث في المستخدم، الأمر، العنصر، التفاصيل…"
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />
                    </div>

                    {/* Period */}
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                        {PERIOD_OPTS.map(o => (
                            <button key={o.v} onClick={() => { setPeriod(o.v); setPage(1); }}
                                style={period === o.v ? { background: '#094B9F', color: '#fff', fontWeight: 700 } : undefined}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === o.v ? 'shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                {o.l}
                            </button>
                        ))}
                    </div>

                    {/* Entity filter — بالعربي */}
                    {filters?.entities?.length > 0 && (
                        <select value={selEntity} onChange={e => { setSelEntity(e.target.value); setPage(1); }}
                            className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 text-gray-700">
                            <option value="">كل العناصر</option>
                            {filters.entities.map((e: any) => (
                                <option key={e.value} value={e.value}>{entityMeta(e.value).label} ({e.count})</option>
                            ))}
                        </select>
                    )}

                    {/* User filter */}
                    {filters?.users?.length > 0 && (
                        <select value={selUser} onChange={e => { setSelUser(e.target.value); setPage(1); }}
                            className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 text-gray-700">
                            <option value="">كل المستخدمين</option>
                            {filters.users.map((u: any) => <option key={u.value} value={u.value}>{u.value} ({u.count})</option>)}
                        </select>
                    )}

                    {hasFilters && (
                        <button onClick={() => { setSelAction(''); setSelEntity(''); setSelUser(''); setSearch(''); setPage(1); }}
                            className="flex items-center gap-1 text-xs text-orange-600 font-semibold hover:bg-orange-50 px-2 py-1.5 rounded-lg transition">
                            <X size={12} /> مسح الفلاتر
                        </button>
                    )}

                    <span className="text-xs text-gray-400 mr-auto tabular-nums">{filtered.length} سجل</span>
                </div>

                {/* Active filter chips */}
                {(selAction || selEntity || selUser) && (
                    <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 bg-orange-50/40 border-b border-orange-100">
                        {selAction && <FilterChip label={actionMeta(selAction).label} onClear={() => setSelAction('')} />}
                        {selEntity && <FilterChip label={entityMeta(selEntity).label} onClear={() => setSelEntity('')} />}
                        {selUser   && <FilterChip label={selUser} onClear={() => setSelUser('')} />}
                    </div>
                )}

                {/* Log list — timeline rows */}
                <div className="divide-y divide-gray-50">
                    {paginated.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                <ShieldAlert size={32} className="opacity-30" />
                                <p className="font-semibold text-sm text-gray-500">لا توجد سجلات مطابقة</p>
                                <p className="text-xs">جرّب تغيير الفترة الزمنية أو مسح الفلاتر</p>
                            </div>
                        </div>
                    ) : (
                        paginated.map(log => {
                            const isExpanded = expanded === log.id;
                            const m  = actionMeta(log.action);
                            const s  = CAT_STYLE[m.cat];
                            const em = entityMeta(log.entity);
                            const EIcon = em.icon;
                            const AIcon = m.icon;
                            let parsedDetails: any = null;
                            try { if (log.details) parsedDetails = JSON.parse(log.details); } catch {}
                            const hasDetails = !!log.details;

                            return (
                                <div key={log.id} className="group">
                                    <div className={`flex items-center gap-3 px-4 md:px-5 py-3.5 transition-colors ${hasDetails ? 'cursor-pointer hover:bg-orange-50/30' : ''} ${isExpanded ? 'bg-orange-50/40' : ''}`}
                                        onClick={() => hasDetails && setExpanded(isExpanded ? null : log.id)}>

                                        {/* Accent bar + action icon */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="w-1 h-9 rounded-full" style={{ background: s.bar }} />
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg} ${s.text}`}>
                                                <AIcon size={16} />
                                            </div>
                                        </div>

                                        {/* Main */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{m.label}</span>
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                    <EIcon size={12} className="text-gray-400" />
                                                    <span className="font-medium text-gray-700">{em.label}</span>
                                                    {log.entityId && <span className="text-gray-300 font-mono text-[10px]">#{log.entityId.slice(-6)}</span>}
                                                </span>
                                            </div>
                                            {/* Inline details preview */}
                                            <div className="mt-1 text-[11px] text-gray-400 truncate">
                                                {parsedDetails
                                                    ? Object.entries(translateDetails(parsedDetails)).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join('  ·  ')
                                                    : (log.details ?? '')}
                                            </div>
                                        </div>

                                        {/* User */}
                                        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white">
                                                {(log.username ?? 'S')[0].toUpperCase()}
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 max-w-[110px] truncate">{log.username ?? 'النظام'}</span>
                                        </div>

                                        {/* Time */}
                                        <div className="flex flex-col items-end flex-shrink-0 w-[88px] text-left">
                                            <span className="text-[11px] font-medium text-gray-500">{relativeTime(log.createdAt)}</span>
                                            <span className="text-[10px] text-gray-300 tabular-nums">
                                                {new Date(log.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* Chevron */}
                                        <div className="w-4 flex-shrink-0">
                                            {hasDetails && (isExpanded
                                                ? <ChevronUp size={14} className="text-gray-400" />
                                                : <ChevronDown size={14} className="text-gray-300 group-hover:text-gray-400" />)}
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && hasDetails && (
                                        <div className="px-5 pb-4 pt-1 bg-orange-50/20">
                                            <div className="rounded-xl border border-orange-100 bg-white p-3">
                                                <div className="flex items-center gap-2 mb-2.5 text-[11px] font-bold text-gray-500">
                                                    <Server size={12} className="text-orange-400" /> تفاصيل العملية
                                                    <span className="text-gray-300 font-normal mr-auto">
                                                        {new Date(log.createdAt).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </span>
                                                </div>
                                                {parsedDetails ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(translateDetails(parsedDetails)).map(([k, v]) => (
                                                            <div key={k} className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-1.5">
                                                                <span className="text-[10px] text-gray-400 block">{k}</span>
                                                                <span className="text-xs font-semibold text-gray-800 break-all">{v}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-600 font-mono break-all">{log.details}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
                        <span className="text-xs text-gray-400">صفحة {page} من {pages}</span>
                        <div className="flex gap-1">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition">السابق</button>
                            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                                const p = page <= 3 ? i + 1 : page - 2 + i;
                                if (p < 1 || p > pages) return null;
                                return <button key={p} onClick={() => setPage(p)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${p === page ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-200 hover:bg-gray-100'}`}>{p}</button>;
                            })}
                            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition">التالي</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, color, label, value, highlight }: {
    icon: React.ElementType; color: string; label: string; value: number; highlight?: boolean;
}) {
    return (
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3"
            style={{ borderColor: highlight ? `${color}33` : '#f1f5f9' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15`, color }}>
                <Icon size={20} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-extrabold text-gray-900 tabular-nums leading-tight">{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{label}</p>
            </div>
        </div>
    );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-white border border-orange-200 rounded-full pr-2.5 pl-1.5 py-1">
            {label}
            <button onClick={onClear} className="hover:bg-orange-100 rounded-full p-0.5 transition">
                <X size={11} />
            </button>
        </span>
    );
}
