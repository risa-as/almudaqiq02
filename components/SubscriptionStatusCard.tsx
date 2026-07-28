'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/query/fetcher'
import toast from 'react-hot-toast'
import {
  RefreshCw, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, Clock, Calendar, Cloud,
} from 'lucide-react'

interface SubscriptionView {
  source:        'cloud' | 'desktop'
  status:        string | null
  planName:      string | null
  endDate:       string | null
  graceEndsAt:   string | null
  daysRemaining: number | null
  inGrace:       boolean
  blocked:       boolean
  blockReason:   string | null
  checkedAt:     string | null
  refreshable:   boolean
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:    'ساري',
  TRIAL:     'تجريبي',
  GRACE:     'فترة مهلة',
  EXPIRED:   'منتهي',
  SUSPENDED: 'معلّق',
  CANCELLED: 'ملغى',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Subscription status + on-demand re-check.
 *
 * The refresh button is the renewal path for desktop installs: after the
 * customer pays and the subscription is extended in the cloud dashboard, one
 * press re-reads it over the branch token and rewrites the locally cached
 * dates, so the install unlocks without a logout or a reinstall.
 */
export default function SubscriptionStatusCard() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['subscription-status'],
    queryFn:  () => fetchJson<SubscriptionView>('/api/subscription', { cache: 'no-store' }),
    retry:    false,
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res  = await fetch('/api/subscription', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body?.error || 'تعذّر تحديث حالة الاشتراك')
        return
      }
      queryClient.setQueryData(['subscription-status'], body)
      await queryClient.invalidateQueries({ queryKey: ['billing'] })
      toast.success('تم تحديث حالة الاشتراك')
    } catch {
      toast.error('تعذّر الاتصال بالخادم')
    } finally {
      setRefreshing(false)
      void refetch()
    }
  }

  if (isPending) {
    return (
      <div
        className="p-5 flex items-center gap-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
      >
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>جاري قراءة حالة الاشتراك…</span>
      </div>
    )
  }

  if (isError || !data) return null

  const healthy = !data.blocked && !data.inGrace
  const accent  = data.blocked ? '#dc2626' : data.inGrace ? '#d97706' : '#059669'

  return (
    <div
      className="overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div
          className="w-9 h-9 flex items-center justify-center flex-shrink-0"
          style={{ borderRadius: '8px', background: `${accent}1a`, border: `1px solid ${accent}40` }}
        >
          {healthy
            ? <ShieldCheck size={17} style={{ color: accent }} />
            : <ShieldAlert size={17} style={{ color: accent }} />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>حالة الاشتراك</h3>
          <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            {data.source === 'desktop'
              ? <><Cloud size={11} /> آخر تحقق من الخادم: {formatDateTime(data.checkedAt)}</>
              : <>تُقرأ مباشرة من الخادم</>}
          </p>
        </div>

        <span
          className="mr-auto text-xs font-extrabold px-3 py-1"
          style={{ borderRadius: '6px', background: `${accent}14`, color: accent, border: `1px solid ${accent}40` }}
        >
          {STATUS_LABELS[data.status ?? ''] ?? data.status ?? 'غير معروف'}
        </span>

        {data.refreshable && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold transition-all disabled:opacity-60"
            style={{
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#fff',
            }}
          >
            {refreshing
              ? <><Loader2 size={13} className="animate-spin" /> جاري التحقق…</>
              : <><RefreshCw size={13} /> تحديث الحالة</>}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5" style={{ borderRadius: '10px', background: 'var(--bg-page)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={13} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>الخطة</span>
          </div>
          <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{data.planName ?? '—'}</p>
        </div>

        <div className="p-3.5" style={{ borderRadius: '10px', background: 'var(--bg-page)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>تاريخ الانتهاء</span>
          </div>
          <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{formatDate(data.endDate)}</p>
        </div>

        <div className="p-3.5" style={{ borderRadius: '10px', background: `${accent}0d`, border: `1px solid ${accent}33` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-extrabold" style={{ color: 'var(--text-muted)' }}>الأيام المتبقية</span>
          </div>
          <p className="text-xl font-black" style={{ color: accent }}>
            {data.daysRemaining === null
              ? '∞'
              : data.daysRemaining > 0 ? data.daysRemaining : 0}
            <span className="text-xs font-bold mr-1" style={{ color: 'var(--text-muted)' }}>يوم</span>
          </p>
        </div>
      </div>

      {(data.blocked || data.inGrace || (data.daysRemaining !== null && data.daysRemaining <= 7)) && (
        <div
          className="mx-5 mb-5 px-4 py-3 flex items-start gap-2.5"
          style={{
            borderRadius: '8px',
            background: data.blocked ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.08)',
            border: data.blocked ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: data.blocked ? '#dc2626' : '#d97706' }} />
          <p className="text-xs font-bold leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.blocked
              ? `${data.blockReason ?? 'الاشتراك غير فعّال'} — بعد التجديد اضغط «تحديث الحالة».`
              : data.inGrace
                ? `انتهى الاشتراك وأنت الآن في فترة المهلة حتى ${formatDate(data.graceEndsAt)}. جدّد قبل ذلك لتجنّب تعليق الحساب.`
                : 'الاشتراك قارب على الانتهاء — تواصل مع الدعم للتجديد.'}
          </p>
        </div>
      )}
    </div>
  )
}
