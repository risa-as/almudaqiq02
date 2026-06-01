'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronRight, Wallet, ArrowDownToLine, ArrowUpFromLine,
    RefreshCw, Scale, Phone, MapPin, FileText, Activity,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';
import PageHeader from '@/components/ui/PageHeader';

interface LedgerEntry {
    id: string;
    type: string;          // PURCHASE | PAYMENT | RETURN | ADJUSTMENT
    amount: number;
    description: string | null;
    date: string;
    branchId: string | null;
}

interface SupplierInfo {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    balance: number;
    creditLimit?: number | null;
}

/* Display config — PURCHASE increases what we owe (+); everything else reduces it (-),
   matching the balance computation in the API. */
const TYPE_CONFIG: Record<string, { label: string; sign: 1 | -1; badge: string; amount: string; icon: React.ElementType }> = {
    PURCHASE:   { label: 'توريد',       sign: 1,  badge: 'bg-blue-50 text-blue-700 border-blue-200',     amount: 'text-blue-700',   icon: ArrowDownToLine },
    PAYMENT:    { label: 'تسديد دفعة',  sign: -1, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', amount: 'text-emerald-600', icon: ArrowUpFromLine },
    RETURN:     { label: 'مرتجع',       sign: -1, badge: 'bg-blue-50 text-blue-700 border-blue-200',         amount: 'text-blue-600',    icon: RefreshCw },
    ADJUSTMENT: { label: 'تسوية',       sign: -1, badge: 'bg-gray-100 text-gray-600 border-gray-200',        amount: 'text-gray-600',    icon: Scale },
};
const cfgFor = (type: string) => TYPE_CONFIG[type] ?? { label: type, sign: 1 as const, badge: 'bg-gray-100 text-gray-600 border-gray-200', amount: 'text-gray-700', icon: Activity };

export default function SupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  usePageTitle('دفتر المورد');
    const { id } = use(params);
    const router = useRouter();
    const { selectedBranch, loading: branchLoading } = useBranch();

    const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (branchLoading) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const branchQuery = selectedBranch?.id && selectedBranch.id !== 'all' ? `?branchId=${selectedBranch.id}` : '';
                const res = await fetch(`/api/suppliers/${id}${branchQuery}`, { cache: 'no-store' });
                if (!res.ok) { setNotFound(true); return; }
                const data = await res.json();
                setSupplier(data.supplier);
                setLedger(data.ledger ?? []);
            } catch (err) {
                console.error(err);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, selectedBranch, branchLoading]);

    /* Running balance: API returns newest-first, so accumulate oldest→newest then flip back */
    const rows = useMemo(() => {
        const asc = [...ledger].reverse();
        let running = 0;
        const withBalance = asc.map(e => {
            running += cfgFor(e.type).sign * Number(e.amount);
            return { ...e, runningBalance: running };
        });
        return withBalance.reverse(); // newest first for display
    }, [ledger]);

    const stats = useMemo(() => {
        const purchases = ledger.filter(e => e.type === 'PURCHASE').reduce((s, e) => s + Number(e.amount), 0);
        const payments  = ledger.filter(e => e.type !== 'PURCHASE').reduce((s, e) => s + Number(e.amount), 0);
        return { purchases, payments };
    }, [ledger]);

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto space-y-5" dir="rtl">
                <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
        );
    }

    if (notFound || !supplier) {
        return (
            <div className="p-6 max-w-5xl mx-auto" dir="rtl">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-600 font-semibold">
                    المورد غير موجود
                </div>
            </div>
        );
    }

    const bal = Number(supplier.balance);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-5" dir="rtl">

            {/* Header */}
            <PageHeader
                title="كشف حساب المورد"
                subtitle={supplier.name}
                icon={FileText}
                gradient="linear-gradient(135deg, #f59e0b, #d97706)"
                actions={
                    <button
                        onClick={() => router.push('/purchases/suppliers')}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600"
                    >
                        <ChevronRight size={16} />
                        رجوع
                    </button>
                }
            />

            {/* Supplier contact chips */}
            {(supplier.phone || supplier.address) && (
                <div className="flex flex-wrap items-center gap-2">
                    {supplier.phone && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-xl">
                            <Phone size={13} className="text-gray-400" />
                            <span dir="ltr">{supplier.phone}</span>
                        </span>
                    )}
                    {supplier.address && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-xl">
                            <MapPin size={13} className="text-gray-400" />
                            {supplier.address}
                        </span>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'إجمالي المشتريات', value: formatCurrency(stats.purchases), color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-100',   icon: ArrowDownToLine },
                    { label: 'إجمالي المدفوعات', value: formatCurrency(stats.payments),  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ArrowUpFromLine },
                    { label: 'الرصيد المستحق',   value: formatCurrency(bal),             color: bal > 0 ? 'text-rose-700' : 'text-emerald-700', bg: bal > 0 ? 'bg-rose-50' : 'bg-emerald-50', border: bal > 0 ? 'border-rose-100' : 'border-emerald-100', icon: Wallet },
                ].map(({ label, value, color, bg, border, icon: Icon }) => (
                    <div key={label} className={`rounded-2xl border ${border} ${bg} p-4 flex items-center gap-3`}>
                        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                            <Icon size={18} className={color} />
                        </div>
                        <div className="min-w-0">
                            <p className={`text-lg font-extrabold ${color} truncate`}>{value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Ledger table */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[var(--border-color)] bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700">سجل الحركات المالية</h3>
                    <span className="text-xs text-gray-400 font-semibold">{ledger.length} حركة</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                            <tr>
                                {['التاريخ', 'نوع الحركة', 'البيان', 'المبلغ', 'الرصيد بعد الحركة'].map(h => (
                                    <th key={h} className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                                                <Activity size={24} className="text-gray-400" />
                                            </div>
                                            <p className="text-sm font-semibold text-gray-400">لا توجد حركات مالية لهذا المورد</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : rows.map(entry => {
                                const cfg = cfgFor(entry.type);
                                const Icon = cfg.icon;
                                const d = new Date(entry.date);
                                return (
                                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                                            {d.toLocaleDateString('ar-IQ')}
                                            <span className="block text-gray-400 mt-0.5">{d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.badge}`}>
                                                <Icon size={12} />
                                                {cfg.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-gray-600 max-w-[260px]">
                                            {entry.description || '—'}
                                        </td>
                                        <td className={`px-5 py-3.5 text-sm font-extrabold whitespace-nowrap ${cfg.amount}`}>
                                            {cfg.sign > 0 ? '+' : '-'}{formatCurrency(Number(entry.amount))}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-bold text-gray-800 whitespace-nowrap">
                                            {formatCurrency(entry.runningBalance)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
