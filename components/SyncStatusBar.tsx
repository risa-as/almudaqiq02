'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react'

interface SyncStatus {
  online: boolean
  pending: number
  lastSyncAt: string | null
  syncing: boolean
}

export default function SyncStatusBar() {
  const [status, setStatus] = useState<SyncStatus>({
    online: false,
    pending: 0,
    lastSyncAt: null,
    syncing: false,
  })

  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    const electron = window.electron
    setIsElectron(!!electron)

    if (electron?.onSyncStatus) {
      // Worker → main → preload delivers the inner status object directly.
      electron.onSyncStatus((s) => setStatus(prev => ({ ...prev, ...s })))
      return () => electron.removeSyncStatusListener?.()
    }

    // Web fallback: only browser online/offline detection (no worker).
    const updateOnline = () => setStatus(s => ({ ...s, online: navigator.onLine }))
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    updateOnline()
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  function forceSync() {
    window.electron?.forceSync?.()
  }

  // The sync bar is only meaningful inside the desktop app.
  if (!isElectron) return null

  const lastSync = status.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-xs text-gray-300 select-none">
      {/* Connection status */}
      <div className={`flex items-center gap-1.5 ${status.online ? 'text-green-400' : 'text-red-400'}`}>
        {status.online
          ? <Wifi className="w-3.5 h-3.5" />
          : <WifiOff className="w-3.5 h-3.5" />
        }
        <span>{status.online ? 'متصل' : 'غير متصل'}</span>
      </div>

      <span className="text-gray-600">|</span>

      {/* Pending operations */}
      {status.pending > 0 ? (
        <span className="text-yellow-400">
          {status.pending} عملية منتظرة
        </span>
      ) : (
        <span className="flex items-center gap-1 text-green-400">
          <CheckCircle className="w-3 h-3" />
          متزامن
        </span>
      )}

      {/* Last sync time */}
      {lastSync && (
        <>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">آخر مزامنة: {lastSync}</span>
        </>
      )}

      {/* Force sync button */}
      {status.online && (
        <>
          <span className="text-gray-600">|</span>
          <button
            onClick={forceSync}
            disabled={status.syncing}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${status.syncing ? 'animate-spin' : ''}`} />
            {status.syncing ? 'جاري...' : 'مزامنة'}
          </button>
        </>
      )}
    </div>
  )
}
