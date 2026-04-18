/**
 * Sync Worker — background process that syncs local SQLite with cloud.
 *
 * Lifecycle:
 *   1. On startup: pull catalog updates from cloud
 *   2. Push queued local operations to cloud
 *   3. Repeat every SYNC_INTERVAL_MS when online
 *
 * Communication with Electron main process via IPC:
 *   - Sends:    'sync:status'  { online, pending, lastSyncAt, syncing }
 *   - Receives: 'sync:force'   trigger immediate sync
 */

const { ipcRenderer } = require('electron')
const { OfflineQueue } = require('./offline-queue')
const https = require('https')
const http  = require('http')

const SYNC_INTERVAL_MS   = 2 * 60 * 1000  // 2 minutes
const CONNECTIVITY_CHECK = 30 * 1000      // 30 seconds

let branchToken   = null
let cloudBaseUrl  = null
let offlineQueue  = null
let syncing       = false
let lastSyncAt    = null
let syncTimer     = null
let checkTimer    = null

// ─── Initialize ──────────────────────────────────────────────────────────────

function init({ token, baseUrl, dbUrl }) {
  branchToken  = token
  cloudBaseUrl = baseUrl
  offlineQueue = new OfflineQueue(dbUrl)
  startConnectivityMonitor()
}

// ─── Connectivity ─────────────────────────────────────────────────────────────

let isOnline = false

async function checkConnectivity() {
  try {
    await fetchWithTimeout(`${cloudBaseUrl}/api/sync/status`, { timeout: 5000 })
    if (!isOnline) {
      isOnline = true
      scheduleSyncNow()
    }
  } catch {
    if (isOnline) {
      isOnline = false
      clearTimeout(syncTimer)
    }
  }
  broadcastStatus()
}

function startConnectivityMonitor() {
  checkConnectivity()
  checkTimer = setInterval(checkConnectivity, CONNECTIVITY_CHECK)
}

// ─── Sync Cycle ───────────────────────────────────────────────────────────────

async function runSync() {
  if (syncing || !isOnline || !branchToken) return
  syncing = true
  broadcastStatus()

  try {
    await pull()
    await push()
    lastSyncAt = new Date().toISOString()
    await offlineQueue?.cleanup()
  } catch (err) {
    console.error('[SyncWorker] Sync failed:', err.message)
  } finally {
    syncing = false
    broadcastStatus()
    // Schedule next sync
    clearTimeout(syncTimer)
    syncTimer = setTimeout(runSync, SYNC_INTERVAL_MS)
  }
}

function scheduleSyncNow() {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(runSync, 1000)
}

// ─── Pull (cloud → local) ─────────────────────────────────────────────────────

async function pull() {
  const res = await fetchWithTimeout(`${cloudBaseUrl}/api/sync/pull`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${branchToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lastSyncAt }),
    timeout: 30_000,
  })

  if (!res.ok) throw new Error(`Pull failed: ${res.status}`)

  const data = await res.json()
  // Emit to renderer for local DB update
  if (typeof process.send === 'function') {
    process.send({ type: 'sync:pull-data', data })
  }
}

// ─── Push (local → cloud) ─────────────────────────────────────────────────────

async function push() {
  if (!offlineQueue) return

  const pending = await offlineQueue.getPending(200)
  if (pending.length === 0) return

  const operations = pending.map(op => ({
    table:   op.tableName,
    type:    op.operation,
    localId: op.recordId,
    payload: JSON.parse(op.payload),
    timestamp: op.createdAt.toISOString(),
  }))

  const res = await fetchWithTimeout(`${cloudBaseUrl}/api/sync/push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${branchToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ operations }),
    timeout: 60_000,
  })

  if (!res.ok) {
    await offlineQueue.incrementAttempts(pending.map(p => p.id), `HTTP ${res.status}`)
    throw new Error(`Push failed: ${res.status}`)
  }

  const result = await res.json()
  const successIds = pending
    .filter((_, i) => result.results?.[i]?.status === 'applied')
    .map(p => p.id)

  if (successIds.length > 0) {
    await offlineQueue.markSynced(successIds)
  }

  const failedIds = pending
    .filter((_, i) => result.results?.[i]?.status === 'error')
    .map(p => p.id)

  if (failedIds.length > 0) {
    await offlineQueue.incrementAttempts(failedIds, 'Server returned error')
  }
}

// ─── Broadcast status ─────────────────────────────────────────────────────────

async function broadcastStatus() {
  const pending = await offlineQueue?.pendingCount() ?? 0
  const status = { online: isOnline, pending, lastSyncAt, syncing }
  if (typeof process.send === 'function') {
    process.send({ type: 'sync:status', status })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchWithTimeout(url, options = {}) {
  const { timeout = 10_000, ...fetchOptions } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...fetchOptions, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

// ─── IPC from parent process ──────────────────────────────────────────────────

process.on('message', msg => {
  if (msg?.type === 'init')        init(msg)
  if (msg?.type === 'sync:force')  scheduleSyncNow()
})

module.exports = { init, scheduleSyncNow }
