'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  RefreshCw, Wifi, WifiOff, Clock, CheckCircle2,
  AlertTriangle, Loader2, RotateCcw, Activity, CloudUpload,
  CloudDownload, Database,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncOperation {
  id: number
  type: string
  recordId: string
  attempts: number
  status: 'pending' | 'failed' | 'synced'
  error: string | null
  createdAt: string
  payload: string
}

interface SyncGroup {
  table: string
  label: string
  pendingCount: number
  failedCount: number
  syncedCount: number
  operations: SyncOperation[]
}

interface QueueData {
  totals: { pending: number; failed: number; synced: number }
  groups: SyncGroup[]
  lastPullAt: string | null
}

interface SyncStatus {
  online: boolean
  pending: number
  lastSyncAt: string | null
  syncing: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ar', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ar', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

function opTypeLabel(t: string) {
  if (t === 'INSERT') return 'إضافة'
  if (t === 'UPDATE') return 'تعديل'
  if (t === 'DELETE') return 'حذف'
  return t
}

function opTypeColors(t: string) {
  if (t === 'INSERT') return { bg: 'rgba(16,185,129,0.12)', text: 'var(--color-success)' }
  if (t === 'UPDATE') return { bg: 'rgba(9,75,159,0.12)',  text: 'var(--color-primary)' }
  if (t === 'DELETE') return { bg: 'rgba(239,68,68,0.12)',   text: 'var(--color-danger)' }
  return { bg: 'rgba(100,116,139,0.12)', text: 'var(--text-secondary)' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ online, syncing }: { online: boolean; syncing: boolean }) {
  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
        style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-text)', border: '1px solid var(--border-primary)' }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        جاري المزامنة
      </span>
    )
  }
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
        style={{ background: 'var(--color-success-light)', color: 'var(--color-success-text)', border: '1px solid rgba(16,185,129,0.30)' }}>
        <Wifi className="w-3.5 h-3.5" />
        متصل
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
      style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger-text)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <WifiOff className="w-3.5 h-3.5" />
      غير متصل
    </span>
  )
}

function StatCard({
  icon: Icon, label, value, accent, sub,
}: {
  icon: typeof Activity
  label: string
  value: number | string
  accent: string
  sub?: string
}) {
  return (
    <div
      className="flex-1 min-w-[140px] rounded-xl p-4 transition-shadow hover:shadow-md"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}20` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
      <div className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SyncMonitorPage() {
  usePageTitle('مراقبة المزامنة');
  const [data, setData]             = useState<QueueData | null>(null)
  const [status, setStatus]         = useState<SyncStatus>({ online: false, pending: 0, lastSyncAt: null, syncing: false })
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retrying, setRetrying]     = useState(false)
  const [showSynced, setShowSynced] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [activeTab, setActiveTab]   = useState<string>('')
  // pendingForceSync: tracks the brief window between clicking "مزامنة فورية" and
  // the sync-worker reporting back via IPC. Without it the button looks dead on click.
  const [pendingForceSync, setPendingForceSync] = useState(false)
  const retryLock = useRef(false)
  const forceSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load queue data ────────────────────────────────────────────────────────
  // `manual` distinguishes user-triggered refreshes (which show the spinner)
  // from the silent 15-second auto-refresh (which doesn't flash UI).
  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    const startedAt = Date.now()
    try {
      const url = `/api/sync/queue${showSynced ? '?all=1' : ''}`
      const res = await fetch(url)
      if (res.ok) {
        setData(await res.json())
        setLastRefresh(new Date())
      }
    } catch { /* silent */ }
    finally {
      setLoading(false)
      if (manual) {
        // Keep the spinner up for at least 500ms so the click registers visually
        // even when the API responds instantly.
        const elapsed = Date.now() - startedAt
        const wait = Math.max(0, 500 - elapsed)
        setTimeout(() => setRefreshing(false), wait)
      }
    }
  }, [showSynced])

  useEffect(() => {
    refresh()
    const t = setInterval(() => refresh(false), 15_000)
    return () => clearInterval(t)
  }, [refresh])

  // Auto-select first tab when data first loads, or when active tab disappears
  useEffect(() => {
    if (!data) return
    if (data.groups.length === 0) { setActiveTab(''); return }
    if (!activeTab || !data.groups.some(g => g.table === activeTab)) {
      setActiveTab(data.groups[0].table)
    }
  }, [data, activeTab])

  // ── Live sync status from Electron IPC ────────────────────────────────────

  useEffect(() => {
    const el = (window as any).electron
    if (!el) return
    el.onSyncStatus((s: SyncStatus) => {
      setStatus(s)
      // The worker started syncing — IPC has caught up, drop the optimistic flag
      if (s.syncing && pendingForceSync) {
        setPendingForceSync(false)
        if (forceSyncTimerRef.current) clearTimeout(forceSyncTimerRef.current)
      }
    })
    return () => el.removeSyncStatusListener()
  }, [pendingForceSync])

  // Clear the force-sync timer on unmount
  useEffect(() => () => {
    if (forceSyncTimerRef.current) clearTimeout(forceSyncTimerRef.current)
  }, [])

  // ── Retry actions (with idempotency lock) ─────────────────────────────────

  const doRetry = useCallback(async (table?: string) => {
    if (retryLock.current) return
    retryLock.current = true
    setRetrying(true)
    try {
      await fetch('/api/sync/reset-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(table ? { table } : {}),
      })
      const el = (window as any).electron
      if (el?.forceSync) el.forceSync()
      await new Promise(r => setTimeout(r, 1200))
      await refresh(true)
    } finally {
      setRetrying(false)
      retryLock.current = false
    }
  }, [refresh])

  const forceSync = useCallback(() => {
    const el = (window as any).electron
    if (!el?.forceSync) return
    el.forceSync()
    // Optimistic feedback: spinner appears immediately on click, before the
    // worker IPC reports back. If IPC never says "syncing" within 5s (e.g.
    // worker is offline), we drop the flag so the button isn't stuck.
    setPendingForceSync(true)
    if (forceSyncTimerRef.current) clearTimeout(forceSyncTimerRef.current)
    forceSyncTimerRef.current = setTimeout(() => setPendingForceSync(false), 5000)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeGroup = useMemo(
    () => data?.groups.find(g => g.table === activeTab) ?? null,
    [data, activeTab],
  )

  const hasProblems = (data?.totals.pending ?? 0) > 0 || (data?.totals.failed ?? 0) > 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-5" dir="rtl">

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-primary)' }}
            >
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                مراقبة المزامنة
              </h1>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
                التحديث التلقائي كل 15 ثانية · آخر تحديث {fmtTime(lastRefresh.toISOString())}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill online={status.online} syncing={status.syncing} />
            <button
              onClick={() => refresh(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'جاري التحديث...' : 'تحديث'}
            </button>
            <button
              onClick={forceSync}
              disabled={status.syncing || pendingForceSync || !status.online}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white"
              style={{
                background: 'var(--gradient-brand)',
                boxShadow: (status.syncing || pendingForceSync || !status.online) ? 'none' : 'var(--shadow-primary)',
              }}
              title={!status.online ? 'غير متصل بالإنترنت' : undefined}
            >
              {(status.syncing || pendingForceSync)
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              {(status.syncing || pendingForceSync) ? 'جاري المزامنة...' : 'مزامنة فورية'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Stat cards ───────────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard icon={Clock}         label="معلق"   value={data.totals.pending} accent="#f59e0b" />
          <StatCard icon={AlertTriangle} label="فاشل"   value={data.totals.failed}  accent="#ef4444" />
          <StatCard icon={CheckCircle2}  label="متزامن" value={data.totals.synced}  accent="#10b981" />
          <StatCard
            icon={CloudDownload}
            label="آخر سحب"
            value={fmtTime(data.lastPullAt ?? new Date(0).toISOString())}
            sub={data.lastPullAt ? fmtDate(data.lastPullAt) : 'لم يحدث بعد'}
            accent="#06b6d4"
          />
          <StatCard
            icon={CloudUpload}
            label="آخر رفع"
            value={status.lastSyncAt ? fmtTime(status.lastSyncAt) : '—'}
            sub={status.lastSyncAt ? fmtDate(status.lastSyncAt) : 'لم يحدث بعد'}
            accent="#8b5cf6"
          />
        </div>
      )}

      {/* ─── Global retry bar ─────────────────────────────────────────────── */}
      {(data?.totals.failed ?? 0) > 0 && (
        <div
          className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-xl"
          style={{
            background: 'var(--color-danger-light)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--color-danger-text)' }}>
              {data!.totals.failed} عملية تجاوزت الحد الأقصى للمحاولات
            </span>
          </div>
          <button
            onClick={() => doRetry()}
            disabled={retrying || status.syncing}
            className="flex items-center gap-1.5 text-[12px] font-bold px-4 py-1.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white"
            style={{ background: 'var(--gradient-danger)' }}
          >
            {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {retrying ? 'جاري إعادة المحاولة...' : 'إعادة المحاولة للكل'}
          </button>
        </div>
      )}

      {/* ─── All-clear banner ─────────────────────────────────────────────── */}
      {!loading && !hasProblems && (
        <div
          className="flex items-center gap-3 px-4 py-4 rounded-xl"
          style={{
            background: 'var(--color-success-light)',
            border: '1px solid rgba(16,185,129,0.25)',
          }}
        >
          <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: 'var(--color-success)' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-success-text)' }}>
              جميع العمليات متزامنة مع السحابة
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-success-text)', opacity: 0.75 }}>
              لا توجد عمليات معلقة أو فاشلة
            </p>
          </div>
        </div>
      )}

      {/* ─── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-14 rounded-xl animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            />
          ))}
        </div>
      )}

      {/* ─── Tabs + Operations table ──────────────────────────────────────── */}
      {!loading && data && data.groups.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Tabs bar */}
          <div
            className="flex items-center gap-1 px-3 pt-3 overflow-x-auto"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            {data.groups.map(g => {
              const isActive = g.table === activeTab
              const hasProblem = g.pendingCount > 0 || g.failedCount > 0
              return (
                <button
                  key={g.table}
                  onClick={() => setActiveTab(g.table)}
                  className="relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold rounded-t-lg transition-all whitespace-nowrap"
                  style={{
                    color:      isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--color-primary-light)' : 'transparent',
                    borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                >
                  <span>{g.label}</span>
                  {hasProblem && (
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                      style={{
                        background: g.failedCount > 0 ? 'var(--color-danger)' : 'var(--color-warning)',
                        color: 'white',
                      }}
                    >
                      {g.failedCount + g.pendingCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Group toolbar */}
          {activeGroup && (
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
              style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-page)' }}
            >
              <div className="flex items-center gap-3 flex-wrap text-[12px]">
                <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--color-warning-text)' }}>
                  <Clock className="w-3.5 h-3.5" /> {activeGroup.pendingCount} معلق
                </span>
                <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--color-danger-text)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> {activeGroup.failedCount} فاشل
                </span>
                <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--color-success-text)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {activeGroup.syncedCount} متزامن
                </span>
              </div>
              {activeGroup.failedCount > 0 && (
                <button
                  onClick={() => doRetry(activeGroup.table)}
                  disabled={retrying || status.syncing}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--color-primary-light)',
                    color: 'var(--color-primary-text)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  إعادة محاولة الفاشلة فقط
                </button>
              )}
            </div>
          )}

          {/* Operations table */}
          {activeGroup && (
            <div className="overflow-x-auto">
              {activeGroup.operations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Database className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    لا توجد عمليات في هذا التاب
                  </p>
                </div>
              ) : (
                <table className="w-full text-[12px] data-table" style={{ color: 'var(--text-secondary)' }}>
                  <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider">الحالة</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider">النوع</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider">السجل</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider">المحاولات</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider">التاريخ</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider">الخطأ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeGroup.operations.map((op, i) => {
                      const c = opTypeColors(op.type)
                      return (
                        <tr
                          key={op.id}
                          style={{
                            borderBottom: i === activeGroup.operations.length - 1 ? 'none' : '1px solid var(--border-light)',
                          }}
                        >
                          <td className="px-4 py-2.5">
                            {op.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger-text)' }}>
                                <AlertTriangle className="w-2.5 h-2.5" />
                                فاشل
                              </span>
                            ) : op.status === 'synced' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--color-success-light)', color: 'var(--color-success-text)' }}>
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                متزامن
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning-text)' }}>
                                <Clock className="w-2.5 h-2.5" />
                                معلق
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                              style={{ background: c.bg, color: c.text }}>
                              {opTypeLabel(op.type)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 max-w-[260px] truncate font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {op.payload || <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {op.attempts}/5
                          </td>
                          <td className="px-3 py-2.5 text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {fmtDate(op.createdAt)}
                          </td>
                          <td className="px-3 py-2.5 max-w-[200px] truncate text-[11px]"
                            style={{ color: op.error ? 'var(--color-danger)' : 'var(--text-muted)' }}
                            title={op.error ?? ''}>
                            {op.error ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Empty state when no groups ───────────────────────────────────── */}
      {!loading && data && data.groups.length === 0 && hasProblems === false && showSynced && (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-semibold">لا توجد عمليات في قائمة المزامنة</p>
        </div>
      )}

      {/* ─── Footer toggle ─────────────────────────────────────────────────── */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setShowSynced(v => !v)}
          className="text-[12px] font-semibold transition-colors hover:underline underline-offset-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {showSynced ? 'إخفاء العمليات المتزامنة' : 'عرض السجل الكامل (يشمل المتزامنة)'}
        </button>
      </div>
    </div>
  )
}
