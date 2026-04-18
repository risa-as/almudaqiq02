const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Branch activation
  activateBranch: (config) => ipcRenderer.invoke('branch:activate', config),
  getBranchConfig: () => ipcRenderer.invoke('branch:get-config'),

  // Sync
  forceSync: () => ipcRenderer.send('sync:force'),
  onSyncStatus: (callback) => {
    ipcRenderer.on('sync:status', (_event, status) => callback(status))
  },
  removeSyncStatusListener: () => {
    ipcRenderer.removeAllListeners('sync:status')
  },
})
