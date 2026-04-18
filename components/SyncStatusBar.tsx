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

  useEffect(() => {
    // Listen for sync status updates from Electron IPC (via window.electron bridge)
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'sync:status') {
        setStatus(event.data.status)
      }
    }

    // Browser-based online/offline detection as fallback
    const updateOnline = () => setStatus(s => ({ ...s, online: navigator.onLine }))
    window.addEventListener('message', handler)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    updateOnline()

    return () => {
      window.removeEventListener('message', handler)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  function forceSync() {
    // Send to Electron main process via window.postMessage or custom bridge
    window.postMessage({ type: 'sync:force' }, '*')
  }

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
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${status.syncing ? 'animate-spin' : ''}`} />
            {status.syncing ? 'جاري...' : 'مزامنة'}
          </button>
        </>
      )}
    </div>
  )
}
