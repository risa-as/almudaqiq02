'use client'

import React from 'react'
import { AlertTriangle, CalendarX2, RefreshCw, ArrowRight, Loader2, WifiOff } from 'lucide-react'

export interface BlockedSubscription {
  status:      string | null
  planName:    string | null
  endDate:     string | null
  graceEndsAt: string | null
}

export interface SubscriptionBlock {
  code:         string
  error:        string
  subscription?: BlockedSubscription | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })
}

const TITLES: Record<string, string> = {
  SUBSCRIPTION_EXPIRED:   'انتهى الاشتراك',
  SUBSCRIPTION_SUSPENDED: 'تم تعليق الحساب',
  SUBSCRIPTION_CANCELLED: 'الاشتراك ملغى',
  TENANT_SUSPENDED:       'الحساب معلق',
  TENANT_CANCELLED:       'الاشتراك ملغى',
  OFFLINE_GRACE_ENDED:    'انقضت مهلة العمل دون اتصال',
}

/**
 * Shown instead of the login form when the subscription gate refuses the login.
 *
 * The re-check button simply retries the same login: on the desktop that call
 * re-verifies against the cloud and refreshes the locally cached subscription,
 * so a customer who has just paid gets back in with one click instead of
 * waiting for a cache to expire.
 */
export default function SubscriptionExpiredScreen({
  block,
  onRetry,
  onBack,
  retrying = false,
}: {
  block:    SubscriptionBlock
  onRetry:  () => void
  onBack:   () => void
  retrying?: boolean
}) {
  const isOffline = block.code === 'OFFLINE_GRACE_ENDED'
  const sub       = block.subscription ?? null
  const title     = TITLES[block.code] ?? 'تعذّر الدخول'

  const rows: { label: string; value: string }[] = []
  if (sub?.planName)    rows.push({ label: 'الخطة',              value: sub.planName })
  if (sub?.endDate)     rows.push({ label: 'تاريخ الانتهاء',      value: formatDate(sub.endDate) })
  if (sub?.graceEndsAt) rows.push({ label: 'انتهاء فترة المهلة',  value: formatDate(sub.graceEndsAt) })

  return (
    <div
      className="p-6"
      style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow:    '0 12px 40px rgba(15,23,42,0.08)',
      }}
      dir="rtl"
    >
      <div className="flex items-start gap-3 mb-5">
        <div
          className="w-11 h-11 flex items-center justify-center flex-shrink-0"
          style={{ borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          {isOffline
            ? <WifiOff size={20} style={{ color: '#dc2626' }} />
            : <CalendarX2 size={20} style={{ color: '#dc2626' }} />}
        </div>
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{block.error}</p>
        </div>
      </div>

      {rows.length > 0 && (
        <div
          className="mb-5 overflow-hidden"
          style={{ borderRadius: '10px', border: '1px solid var(--border-color)' }}
        >
          {rows.map((row, i) => (
            <div
              key={row.label}
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                background: 'var(--bg-page)',
                borderTop:  i === 0 ? 'none' : '1px solid var(--border-color)',
              }}
            >
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-start gap-2.5 px-4 py-3 mb-5"
        style={{
          borderRadius: '8px',
          background:   'rgba(245,158,11,0.08)',
          border:       '1px solid rgba(245,158,11,0.25)',
        }}
      >
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
        <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {isOffline
            ? 'يجب الاتصال بالإنترنت مرة واحدة لتجديد التحقق من الحساب، ثم اضغط «تحقق الآن».'
            : 'بعد تجديد الاشتراك لدى الدعم، اضغط «تحقق الآن» — سيتم تحديث حالة الاشتراك فورًا دون إعادة تثبيت أو إدخال أي رمز. بياناتك محفوظة كما هي.'}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="flex-1 flex items-center justify-center gap-2 py-3 font-bold text-white transition-all disabled:opacity-60"
          style={{
            borderRadius: '8px',
            background:   'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          }}
        >
          {retrying
            ? <><Loader2 size={16} className="animate-spin" /> جاري التحقق...</>
            : <><RefreshCw size={16} /> تحقق الآن</>}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-2 px-4 py-3 font-bold transition-all"
          style={{
            borderRadius: '8px',
            background:   'var(--bg-page)',
            border:       '1px solid var(--border-color)',
            color:        'var(--text-secondary)',
          }}
        >
          <ArrowRight size={16} /> رجوع
        </button>
      </div>
    </div>
  )
}
