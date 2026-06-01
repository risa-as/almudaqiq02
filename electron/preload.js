const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Detected by Next.js pages to know they're inside Electron
  isElectron: true,

  // Branch activation
  activateBranch: (config) => ipcRenderer.invoke('branch:activate', config),
  getBranchConfig: () => ipcRenderer.invoke('branch:get-config'),
  // Activate sync from main process (avoids CORS: main process has no origin restrictions)
  activateSync: (params) => ipcRenderer.invoke('sync:activate', params),

  // Sync
  forceSync: () => ipcRenderer.send('sync:force'),
  wipeLocalData: () => ipcRenderer.invoke('db:wipe-local'),
  onSyncStatus: (callback) => {
    ipcRenderer.on('sync:status', (_event, status) => callback(status))
  },
  removeSyncStatusListener: () => {
    ipcRenderer.removeAllListeners('sync:status')
  },
  // Fired after the worker applies pulled catalog data to the local DB.
  onPulled: (callback) => {
    ipcRenderer.on('sync:pulled', (_event, data) => callback(data))
  },
  removePulledListener: () => {
    ipcRenderer.removeAllListeners('sync:pulled')
  },

  // ── Auto-backup bridge ────────────────────────────────────────────────────
  backup: {
    // Main → Renderer: trigger a scheduled backup
    onRequest:       (cb) => ipcRenderer.on('backup:request',      () => cb()),
    // Main → Renderer: trigger backup before quitting
    onRequestQuit:   (cb) => ipcRenderer.on('backup:request-quit', () => cb()),
    // Renderer → Main: backup done, safe to quit
    doneQuit:        ()   => ipcRenderer.send('backup:done-quit'),
    // Renderer → Main: save JSON file to userData/backups/
    save:            (json, filename) => ipcRenderer.invoke('backup:save', { json, filename }),
    // Renderer → Main: read/write configured interval
    getInterval:     ()      => ipcRenderer.invoke('backup:get-interval'),
    setInterval:     (hours) => ipcRenderer.invoke('backup:set-interval', hours),
    // Cleanup
    removeListeners: () => {
      ipcRenderer.removeAllListeners('backup:request')
      ipcRenderer.removeAllListeners('backup:request-quit')
    },
  },
})
