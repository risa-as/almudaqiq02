// Type declarations for the Electron preload bridge (window.electron)

interface Window {
  electron?: {
    isElectron: true
    activateBranch: (config: Record<string, unknown>) => Promise<{ ok: boolean }>
    getBranchConfig: () => Promise<Record<string, unknown> | null>
    forceSync: () => void
    onSyncStatus: (callback: (status: {
      online: boolean
      pending: number
      lastSyncAt: string | null
      syncing: boolean
    }) => void) => void
    removeSyncStatusListener: () => void
    onPulled: (callback: (data: { applied: number }) => void) => void
    removePulledListener: () => void
  }
}
