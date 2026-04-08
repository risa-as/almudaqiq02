'use client';

import Link from 'next/link';
import {
  ShoppingCart, Package, AlertTriangle, BarChart3,
  TrendingDown, TrendingUp, Activity, ArrowLeft, Users, FileText,
  ArrowDownToLine, Tag, Zap, Receipt
} from 'lucide-react';
import { useEffect, useState } from 'react';
import StatCard from '@/components/ui/StatCard';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';

export default function Home() {
  const { selectedBranch } = useBranch();
  const [alerts, setAlerts] = useState<{ lowStock: any[], expiringBatches: any[] } | null>(null);
  const [profit, setProfit] = useState({ revenue: 0, cogs: 0, expenses: 0, netProfit: 0, grossProfit: 0 });
  const [latestTransactions, setLatestTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const branchQuery = selectedBranch?.id ? `?branchId=${selectedBranch.id}` : '';
    const profitQuery = selectedBranch?.id ? `&branchId=${selectedBranch.id}` : '';
    setLoading(true);
    Promise.all([
      fetch(`/api/inventory/alerts${branchQuery}`).then(r => r.json()).catch(() => ({ lowStock: [], expiringBatches: [] })),
      fetch(`/api/reports/profit?period=daily${profitQuery}`).then(r => r.json()).catch(() => null),
      fetch(`/api/transactions?limit=7${profitQuery}`).then(r => r.json()).catch(() => []),
    ]).then(([alertsData, profitData, txData]) => {
      setAlerts(alertsData);
      if (profitData && !profitData.error) setProfit(profitData);
      if (Array.isArray(txData)) setLatestTransactions(txData.slice(0, 7));
      else if (txData?.transactions) setLatestTransactions(txData.transactions.slice(0, 7));
      setLoading(false);
    });
  }, [selectedBranch?.id]);

  const quickActions = [
    { href: '/inventory/new',       icon: Package,       label: 'منتج جديد',      gradient: 'linear-gradient(135deg,#10b981,#059669)', glow: 'rgba(16,185,129,0.2)' },
    { href: '/inventory/stock-in',  icon: ArrowDownToLine, label: 'إدخال مخزون',  gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', glow: 'rgba(99,102,241,0.2)' },
    { href: '/accounting/expenses', icon: TrendingDown,  label: 'مصروف',          gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', glow: 'rgba(239,68,68,0.2)' },
    { href: '/sales/customers',     icon: Users,         label: 'العملاء',         gradient: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', glow: 'rgba(139,92,246,0.2)' },
    { href: '/sales/invoices',      icon: FileText,      label: 'الفواتير',        gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', glow: 'rgba(6,182,212,0.2)' },
    { href: '/marketing/offers',    icon: Tag,           label: 'العروض',          gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', glow: 'rgba(245,158,11,0.2)' },
  ];

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: 'var(--bg-page)' }}>

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-7">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--gradient-brand)' }} />
            <h1 className="text-2xl font-black"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #4338ca 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
              لوحة القيادة
            </h1>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)', paddingRight: '12px' }}>
            {new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/pos"
          className="btn-primary"
        >
          <ShoppingCart size={17} />
          شاشة الكاشير
        </Link>
      </div>

      {/* ── Alerts ── */}
      {alerts && (alerts.lowStock.length > 0 || alerts.expiringBatches.length > 0) && (
        <div className="space-y-3 mb-6">
          {alerts.lowStock.length > 0 && (
            <div
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)',
                border: '1px solid rgba(245,158,11,0.3)',
                boxShadow: '0 4px 16px rgba(245,158,11,0.1)',
              }}
            >
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <AlertTriangle size={15} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: '#92400e' }}>
                  مخزون منخفض — {alerts.lowStock.length} منتج
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                  بعض المنتجات قريبة من النفاذ —{' '}
                  <Link href="/inventory" className="underline font-bold">مراجعة المخزون</Link>
                </p>
              </div>
            </div>
          )}
          {alerts.expiringBatches.length > 0 && (
            <div
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                border: '1px solid rgba(239,68,68,0.3)',
                boxShadow: '0 4px 16px rgba(239,68,68,0.1)',
              }}
            >
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <AlertTriangle size={15} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: '#991b1b' }}>
                  منتجات ستنتهي صلاحيتها — {alerts.expiringBatches.length} دفعة
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>تحتاج مراجعة فورية</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="إيرادات اليوم"
          value={formatCurrency(profit.revenue)}
          icon={TrendingUp}
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          valueColor="var(--value-positive)"
          trend={{ direction: 'up', label: 'إيرادات اليوم' }}
        />
        <StatCard
          label="تكلفة البضاعة"
          value={formatCurrency(profit.cogs)}
          icon={Package}
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          valueColor="var(--value-negative)"
        />
        <StatCard
          label="مصروفات اليوم"
          value={formatCurrency(profit.expenses)}
          icon={TrendingDown}
          gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
          valueColor="var(--value-negative)"
        />
        <StatCard
          label="الربح الصافي"
          value={formatCurrency(profit.netProfit)}
          icon={BarChart3}
          gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
          valueColor={profit.netProfit >= 0 ? 'var(--value-positive)' : 'var(--value-negative)'}
          highlight={true}
          trend={{ direction: profit.netProfit >= 0 ? 'up' : 'down', label: profit.netProfit >= 0 ? 'ربح' : 'خسارة' }}
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Transactions */}
        <div
          className="lg:col-span-2 rounded-2xl p-5"
          style={{
            background: 'white',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-black text-base flex items-center gap-2.5" style={{ color: 'var(--text-primary)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Activity size={14} className="text-white" />
              </div>
              أحدث الفواتير
            </h2>
            <Link href="/sales/invoices"
              className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:bg-indigo-50"
              style={{ color: 'var(--color-primary)' }}>
              عرض الكل <ArrowLeft size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-14 rounded-xl skeleton" />
              ))}
            </div>
          ) : latestTransactions.length > 0 ? (
            <div className="space-y-2">
              {latestTransactions.map((tx: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3.5 rounded-xl transition-all duration-150 group cursor-default"
                  style={{ background: '#f8fafc' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eef2ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: tx.type === 'REFUND'
                          ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                          : tx.customerId
                            ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                            : 'linear-gradient(135deg,#10b981,#059669)',
                      }}>
                      <Receipt size={14} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        فاتورة #{tx.receiptNumber || tx.id}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(tx.date).toLocaleString('ar-IQ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <p className="font-black text-sm" style={{ color: 'var(--color-primary)' }}>
                      {formatCurrency(Number(tx.totalAmount))}
                    </p>
                    <span className="badge"
                      style={tx.type === 'REFUND'
                        ? { background: '#fef2f2', color: '#991b1b' }
                        : tx.customerId
                          ? { background: '#fffbeb', color: '#92400e' }
                          : { background: '#ecfdf5', color: '#065f46' }}>
                      {tx.type === 'REFUND' ? 'مرتجع' : tx.customerId ? 'آجل' : 'نقدي'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-14" style={{ color: 'var(--text-muted)' }}>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)' }}>
                <Activity size={28} className="opacity-40" />
              </div>
              <p className="font-bold text-sm">لا توجد فواتير اليوم بعد</p>
              <p className="text-xs mt-1 opacity-60">ابدأ أول بيع من شاشة الكاشير</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'white',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h2 className="font-black text-base mb-5 flex items-center gap-2.5" style={{ color: 'var(--text-primary)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <Zap size={14} className="text-white" />
            </div>
            إجراءات سريعة
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(action => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl text-center transition-all duration-200 group relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${action.gradient.includes('10b981') ? '#ecfdf5' : action.gradient.includes('6366f1') ? '#eef2ff' : action.gradient.includes('ef4444') ? '#fef2f2' : action.gradient.includes('8b5cf6') ? '#f5f3ff' : action.gradient.includes('06b6d4') ? '#ecfeff' : '#fffbeb'} 0%, white 100%)`,
                  border: '1px solid rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${action.glow}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                  style={{ background: action.gradient, boxShadow: `0 4px 12px ${action.glow}` }}>
                  <div className="absolute inset-0 opacity-25"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)' }} />
                  <action.icon size={18} className="text-white relative z-10" />
                </div>
                <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-10 text-center text-xs pb-4" style={{ color: 'var(--text-muted)' }}>
        © 2026 جميع الحقوق محفوظة — نظام البيان ERP
      </footer>
    </div>
  );
}
