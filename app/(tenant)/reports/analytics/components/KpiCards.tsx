import React from 'react';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, ShoppingBag, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Kpis {
    revenue: number; profit: number; aov: number; transactions: number;
    prevRevenue: number; prevProfit: number; prevAov: number; prevTransactions: number;
}

interface KpiCardsProps { data: Kpis }

const CARDS = [
    { key: 'revenue',      label: 'إجمالي الإيرادات', prev: 'prevRevenue',      currency: true,  icon: DollarSign,  gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', glow: 'rgba(99,102,241,0.2)' },
    { key: 'profit',       label: 'صافي الربح',        prev: 'prevProfit',       currency: true,  icon: TrendingUp,  gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', glow: 'rgba(16,185,129,0.2)' },
    { key: 'aov',          label: 'متوسط الفاتورة',    prev: 'prevAov',          currency: true,  icon: CreditCard,  gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', glow: 'rgba(139,92,246,0.2)' },
    { key: 'transactions', label: 'إجمالي الفواتير',   prev: 'prevTransactions', currency: false, icon: ShoppingBag, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', glow: 'rgba(245,158,11,0.2)' },
] as const;

export default function KpiCards({ data }: KpiCardsProps) {
    const growth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {CARDS.map(card => {
                const val  = data[card.key as keyof Kpis] as number;
                const prev = data[card.prev as keyof Kpis] as number;
                const g    = growth(val, prev);
                const pos  = g >= 0;
                const Icon = card.icon;

                return (
                    <div key={card.key}
                        className="rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1"
                        style={{ background: 'white', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `var(--shadow-hover), 0 0 24px ${card.glow}`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'; }}
                    >
                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none opacity-8 blur-2xl"
                            style={{ background: card.gradient, transform: 'translate(30%,-30%)' }} />

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>{card.label}</p>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
                                    style={{ background: card.gradient, boxShadow: `0 4px 12px ${card.glow}` }}>
                                    <div className="absolute inset-0 opacity-25"
                                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
                                    <Icon size={18} className="text-white relative z-10" />
                                </div>
                            </div>

                            <h3 className="text-2xl font-black mb-3 truncate" style={{ color: 'var(--text-primary)' }} dir="ltr">
                                {card.currency ? formatCurrency(val) : val.toLocaleString('en-US')}
                            </h3>

                            <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${pos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    {pos ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                                    {Math.abs(g).toFixed(1)}%
                                </span>
                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>مقارنة بالفترة السابقة</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
