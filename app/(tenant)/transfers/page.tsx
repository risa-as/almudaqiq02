'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useEffect, useState, useRef, useCallback } from 'react'
import { useConfirm } from '@/hooks/useConfirm'
import {
    ArrowLeftRight, Plus, CheckCircle, XCircle, Clock, Truck,
    GitBranch, Search, Package, X, ChevronRight, StickyNote,
    RefreshCw, Layers, Filter, Globe, Loader2,
} from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'
import toast from 'react-hot-toast'

/* ─── Types ─────────────────────────────────────────────────────────── */
interface TransferItem { productId: string; unitId: string; quantity: number }

interface Transfer {
    id: string; status: string; notes?: string; createdAt: string
    fromBranch: { name: string }; toBranch: { name: string }
    items: string
}

interface ProductUnit { id: string; name: string; conversionFactor: number; price: number }
interface Product { id: string; name: string; baseStock: number; units: ProductUnit[] }

interface DraftItem { productId: string; productName: string; unitId: string; unitName: string; quantity: number; maxStock: number }

/* ─── Status config ──────────────────────────────────────────────────── */
const STATUS: Record<string, { label: string; icon: React.ElementType; pill: string; dot: string }> = {
    PENDING:   { label: 'معلق',     icon: Clock,         pill: 'bg-blue-50  text-blue-700  border-blue-200',  dot: 'bg-blue-400 animate-pulse' },
    APPROVED:  { label: 'موافق عليه', icon: CheckCircle, pill: 'bg-blue-50   text-blue-700   border-blue-200',   dot: 'bg-blue-500' },
    COMPLETED: { label: 'منفذ',     icon: Truck,         pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    CANCELLED: { label: 'ملغى',     icon: XCircle,       pill: 'bg-red-50    text-red-600    border-red-200',    dot: 'bg-red-400' },
}

const FILTER_TABS = [
    { key: 'ALL',       label: 'الكل' },
    { key: 'PENDING',   label: 'معلق' },
    { key: 'APPROVED',  label: 'موافق' },
    { key: 'COMPLETED', label: 'منفذ' },
    { key: 'CANCELLED', label: 'ملغى' },
]

/* ═══════════════════════════════════════════════════════════════════════ */
export default function TransfersPage() {
  usePageTitle('التحويلات');
    const { branches, loading: branchesLoading } = useBranch()
    const { confirm, dialog } = useConfirm()
    const [transfers, setTransfers]   = useState<Transfer[]>([])
    const [loading, setLoading]       = useState(true)
    const [filterStatus, setFilter]   = useState('ALL')
    const [showModal, setShowModal]   = useState(false)
    // Transfers span multiple branches, so they're managed from the cloud only.
    // The desktop (single-branch, offline) app shows an informational notice.
    const [isDesktop, setIsDesktop]   = useState(false)
    useEffect(() => { setIsDesktop(!!window.electron) }, [])

    const load = useCallback((status?: string) => {
        setLoading(true)
        const q = status && status !== 'ALL' ? `?status=${status}` : ''
        fetch(`/api/transfers${q}`)
            .then(r => r.json())
            .then(setTransfers)
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { load(filterStatus) }, [filterStatus, load])

    const changeStatus = async (id: string, status: string, label: string) => {
        if (status === 'CANCELLED' && !await confirm({ title: 'إلغاء الطلب', message: 'هل تريد إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.', variant: 'warning', confirmLabel: 'إلغاء الطلب', cancelLabel: 'تراجع' })) return
        const res = await fetch(`/api/transfers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        if (res.ok) { toast.success(label); load(filterStatus) }
        else toast.error('فشل تحديث الحالة')
    }

    /* stats */
    const allForStats = transfers
    const stats = {
        total:     allForStats.length,
        pending:   allForStats.filter(t => t.status === 'PENDING').length,
        approved:  allForStats.filter(t => t.status === 'APPROVED').length,
        completed: allForStats.filter(t => t.status === 'COMPLETED').length,
    }

    /* ── Single branch guard ── */
    if (branchesLoading) return (
        <div className="min-h-[70vh] flex items-center justify-center">
            <div className="w-9 h-9 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
        </div>
    )

    /* ── Desktop guard — transfers are managed from the web only ── */
    if (isDesktop) return (
        <div className="min-h-[70vh] flex items-center justify-center" dir="rtl">
            <div className="text-center max-w-md mx-auto px-6">
                <div className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 16px 40px rgba(9,75,159,.3)' }}>
                    <Globe className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">تُدار من موقع الويب</h2>
                <p className="text-slate-500 leading-relaxed text-sm">
                    صفحة <span className="font-bold text-blue-600">نقل المخزون بين الفروع</span> تُدار حصراً من
                    <span className="font-bold text-blue-600"> موقع الويب</span>، لأنها تتطلب رؤية جميع الفروع معاً.
                </p>
                <p className="text-slate-400 leading-relaxed text-xs mt-3">
                    يرجى استخدام لوحة التحكم السحابية لإنشاء طلبات النقل ومتابعة حالتها. ستظهر التحديثات هنا تلقائياً بعد المزامنة.
                </p>
            </div>
        </div>
    )

    if (branches.length <= 1) return (
        <div className="min-h-[70vh] flex items-center justify-center" dir="rtl">
            <div className="text-center max-w-sm mx-auto">
                <div className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 16px 40px rgba(9,75,159,.3)' }}>
                    <GitBranch className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">فرع واحد فقط</h2>
                <p className="text-slate-500 leading-relaxed text-sm">
                    ميزة نقل المخزون تعمل عند وجود <span className="font-bold text-blue-600">فرعين أو أكثر</span>.
                    أضف فرعاً جديداً من إعدادات النظام.
                </p>
            </div>
        </div>
    )

    /* ─────────────────────────────────────────────────────────────────── */
    return (
        <div className="space-y-5 animate-fade-in-up" dir="rtl">
            {dialog}

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg,#094B9F 0%,#063A8A 100%)', boxShadow: '0 10px 28px rgba(9,75,159,.35)' }}>
                        <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,.4) 0%,transparent 60%)' }} />
                        <ArrowLeftRight className="w-6 h-6 text-white relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black"
                            style={{ background: 'linear-gradient(135deg,#0f172a,#334155)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            نقل المخزون بين الفروع
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5 font-medium">إدارة طلبات نقل البضاعة وتتبع حالتها</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 8px 20px rgba(9,75,159,.35)' }}
                >
                    <Plus size={16} />
                    طلب نقل جديد
                </button>
            </div>

            {/* ── KPI row ── */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'إجمالي الطلبات', value: stats.total,     gradient: 'linear-gradient(135deg,#094B9F,#063A8A)', shadow: 'rgba(9,75,159,.25)',   icon: Layers },
                    { label: 'معلق',           value: stats.pending,   gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,.25)',  icon: Clock },
                    { label: 'موافق عليه',     value: stats.approved,  gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)', shadow: 'rgba(59,130,246,.25)',  icon: CheckCircle },
                    { label: 'منفذ',           value: stats.completed, gradient: 'linear-gradient(135deg,#10b981,#059669)', shadow: 'rgba(16,185,129,.25)',  icon: Truck },
                ].map(({ label, value, gradient, shadow, icon: Icon }) => (
                    <div key={label} className="glass-panel p-4 flex items-center gap-3 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[.03]" style={{ background: gradient }} />
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: gradient, boxShadow: `0 6px 16px ${shadow}` }}>
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filter tabs ── */}
            <div className="flex gap-1.5 p-1.5 bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl shadow-sm w-fit">
                {FILTER_TABS.map(tab => {
                    const isActive = filterStatus === tab.key
                    const count = tab.key === 'ALL'
                        ? transfers.length
                        : transfers.filter(t => t.status === tab.key).length
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${isActive ? 'text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                            style={isActive ? { background: 'linear-gradient(135deg,#094B9F,#063A8A)' } : {}}
                        >
                            {tab.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-white/25' : 'bg-slate-100 text-slate-400'}`}>
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* ── Transfer list ── */}
            <div className="glass-panel overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/40 bg-slate-50/50">
                    {['من فرع → إلى فرع', 'الأصناف', 'التاريخ', 'الحالة', 'إجراءات'].map((h, i) => (
                        <div key={h}
                            className={`text-[11px] font-bold text-slate-400 uppercase tracking-wide ${i === 0 ? 'col-span-4' : i === 4 ? 'col-span-3 text-center' : 'col-span-1'} ${i === 2 ? 'col-span-2' : ''} ${i === 3 ? 'col-span-2' : ''}`}>
                            {h}
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
                        <p className="text-sm text-slate-400 font-medium">جاري التحميل...</p>
                    </div>
                ) : transfers.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <ArrowLeftRight className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-600">لا توجد طلبات نقل</p>
                            <p className="text-sm text-slate-400 mt-1">اضغط "طلب نقل جديد" لإنشاء أول طلب</p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {transfers.map(t => {
                            const cfg = STATUS[t.status] ?? STATUS.PENDING
                            const Icon = cfg.icon
                            let items: any[] = []
                            try { items = JSON.parse(t.items) } catch { }

                            return (
                                <div key={t.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-50/40 transition-colors group">

                                    {/* From → To */}
                                    <div className="col-span-4 flex items-center gap-2.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-bold text-slate-800 text-sm truncate">{t.fromBranch.name}</span>
                                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                                <ChevronRight className="w-3.5 h-3.5 text-blue-500" />
                                            </div>
                                            <span className="font-bold text-slate-800 text-sm truncate">{t.toBranch.name}</span>
                                        </div>
                                    </div>

                                    {/* Items count */}
                                    <div className="col-span-1">
                                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-bold">
                                            <Package size={11} />
                                            {items.length}
                                        </span>
                                    </div>

                                    {/* Date */}
                                    <div className="col-span-2 text-xs text-slate-500 font-medium">
                                        <div>{new Date(t.createdAt).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                        <div className="text-slate-400">{new Date(t.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</div>
                                        {t.notes && (
                                            <div className="flex items-center gap-1 text-slate-400 mt-1">
                                                <StickyNote size={10} />
                                                <span className="truncate max-w-[100px]">{t.notes}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status badge */}
                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${cfg.pill}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                            <Icon size={12} />
                                            {cfg.label}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-3 flex items-center gap-2 justify-center">
                                        {t.status === 'PENDING' && (
                                            <button
                                                onClick={() => changeStatus(t.id, 'APPROVED', 'تمت الموافقة')}
                                                className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all"
                                            >
                                                <CheckCircle size={12} /> موافقة
                                            </button>
                                        )}
                                        {t.status === 'APPROVED' && (
                                            <button
                                                onClick={() => changeStatus(t.id, 'COMPLETED', 'تم تنفيذ النقل')}
                                                className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all"
                                            >
                                                <Truck size={12} /> تنفيذ
                                            </button>
                                        )}
                                        {(t.status === 'PENDING' || t.status === 'APPROVED') && (
                                            <button
                                                onClick={() => changeStatus(t.id, 'CANCELLED', 'تم إلغاء الطلب')}
                                                className="flex items-center gap-1 text-xs border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 px-3 py-1.5 rounded-lg font-bold transition-all"
                                            >
                                                <XCircle size={12} /> إلغاء
                                            </button>
                                        )}
                                        {(t.status === 'COMPLETED' || t.status === 'CANCELLED') && (
                                            <span className="text-xs text-slate-300 font-medium">—</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Create Transfer Modal ── */}
            {showModal && (
                <CreateTransferModal
                    branches={branches}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); load(filterStatus); toast.success('تم إنشاء طلب النقل') }}
                />
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
   Create Transfer Modal
════════════════════════════════════════════════════════════════════════ */
function CreateTransferModal({
    branches,
    onClose,
    onSuccess,
}: {
    branches: { id: string; name: string }[]
    onClose: () => void
    onSuccess: () => void
}) {
    const [fromBranchId, setFrom] = useState('')
    const [toBranchId,   setTo]   = useState('')
    const [notes,        setNotes] = useState('')
    const [items,        setItems] = useState<DraftItem[]>([])
    const [saving,       setSaving] = useState(false)

    /* product search */
    const [search,   setSearch]   = useState('')
    const [results,  setResults]  = useState<Product[]>([])
    const [searching, setSearching] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (search.length < 1) { setResults([]); return }
        setSearching(true)
        debounceRef.current = setTimeout(() => {
            fetch(`/api/products?search=${encodeURIComponent(search)}`)
                .then(r => r.json())
                .then(d => setResults(Array.isArray(d) ? d.slice(0, 8) : []))
                .finally(() => setSearching(false))
        }, 300)
    }, [search])

    const addItem = (p: Product) => {
        const unit = p.units[0]
        if (!unit) return
        const exists = items.find(i => i.productId === p.id && i.unitId === unit.id)
        if (exists) return
        setItems(prev => [...prev, {
            productId: p.id, productName: p.name,
            unitId: unit.id, unitName: unit.name,
            quantity: 1, maxStock: p.baseStock,
        }])
        setSearch(''); setResults([])
    }

    const updateQty = (idx: number, qty: number) =>
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, qty) } : it))

    const updateUnit = (idx: number, unitId: string, unitName: string) =>
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, unitId, unitName } : it))

    const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

    const handleSubmit = async () => {
        if (!fromBranchId || !toBranchId) return toast.error('اختر الفرعين')
        if (fromBranchId === toBranchId)  return toast.error('لا يمكن النقل للفرع نفسه')
        if (items.length === 0)           return toast.error('أضف منتجاً واحداً على الأقل')

        setSaving(true)
        const res = await fetch('/api/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromBranchId, toBranchId, notes: notes || undefined,
                items: items.map(i => ({ productId: i.productId, unitId: i.unitId, quantity: i.quantity })),
            }),
        })
        setSaving(false)
        if (res.ok) onSuccess()
        else toast.error('فشل إنشاء الطلب')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-fade-in-up"
                style={{ maxHeight: '90vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 6px 16px rgba(9,75,159,.3)' }}>
                            <ArrowLeftRight className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-800">طلب نقل جديد</h2>
                            <p className="text-xs text-slate-400 mt-0.5">حدد الفروع والمنتجات المراد نقلها</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                        <X size={16} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Branch selectors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">من فرع <span className="text-red-400">*</span></label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                                value={fromBranchId}
                                onChange={e => setFrom(e.target.value)}
                            >
                                <option value="">-- اختر فرع المصدر --</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">إلى فرع <span className="text-red-400">*</span></label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                                value={toBranchId}
                                onChange={e => setTo(e.target.value)}
                            >
                                <option value="">-- اختر فرع الوجهة --</option>
                                {branches.filter(b => b.id !== fromBranchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            ملاحظات <span className="text-slate-300 font-normal">(اختياري)</span>
                        </label>
                        <input
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder-slate-300"
                            placeholder="سبب النقل أو أي ملاحظة..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    {/* Product search */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">إضافة منتجات <span className="text-red-400">*</span></label>
                        <div className="relative">
                            <input
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder-slate-300"
                                placeholder="ابحث عن منتج بالاسم..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <Search size={15} className="absolute right-3.5 top-3 text-slate-400" />
                            {searching && <div className="absolute left-3 top-3 w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
                        </div>

                        {/* Search results */}
                        {results.length > 0 && (
                            <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white">
                                {results.map(p => (
                                    <button
                                        key={p.id} type="button"
                                        onClick={() => addItem(p)}
                                        className="w-full text-right px-4 py-3 hover:bg-blue-50 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                <Package size={13} className="text-slate-500" />
                                            </div>
                                            <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                                        </div>
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-medium shrink-0">
                                            رصيد: {p.baseStock}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Draft items table */}
                    {items.length > 0 && (
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            {/* header */}
                            <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100">
                                {['المنتج', 'الوحدة', 'الكمية', ''].map((h, i) => (
                                    <div key={i} className={`text-[10px] font-bold text-slate-400 uppercase ${i === 0 ? 'col-span-5' : i === 1 ? 'col-span-3' : i === 2 ? 'col-span-3' : 'col-span-1'}`}>{h}</div>
                                ))}
                            </div>
                            {/* rows */}
                            {items.map((item, idx) => {
                                const product = { units: [] as ProductUnit[] }
                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center border-b border-slate-50 last:border-0 hover:bg-slate-50/40 transition-colors">
                                        <div className="col-span-5 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                                                <Package size={11} className="text-blue-500" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 truncate">{item.productName}</span>
                                        </div>
                                        <div className="col-span-3">
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">{item.unitName}</span>
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number" min="1"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                                                value={item.quantity}
                                                onChange={e => updateQty(idx, Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <button type="button" onClick={() => removeItem(idx)}
                                                className="w-6 h-6 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Empty items hint */}
                    {items.length === 0 && (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl py-8 text-center">
                            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 font-medium">ابحث عن منتج وأضفه للقائمة</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                    <div className="text-sm text-slate-500 font-medium">
                        {items.length > 0 && <span className="text-blue-600 font-bold">{items.length} صنف</span>}
                        {items.length === 0 && <span className="text-slate-400">لا توجد أصناف بعد</span>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                        >
                            إلغاء
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(135deg,#094B9F,#063A8A)', boxShadow: '0 6px 16px rgba(9,75,159,.35)' }}
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftRight size={15} />}
                            {saving ? 'جاري الإرسال...' : 'إرسال الطلب'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
