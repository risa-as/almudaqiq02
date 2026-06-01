/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SYNC WORKER  (electron/sync-worker.js)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Role in the sync pipeline:
 *   This is the orchestrator — a Node.js child process (forked by main.js) that
 *   runs in the background and drives the full bidirectional sync cycle:
 *
 *       ┌─────────────────────────────────────────────────────────┐
 *       │  Desktop SQLite  ←──── applyPull() ←────  Cloud Postgres │
 *       │       │                                        │         │
 *       │  SyncQueue rows  ────── push() ──────→  /api/sync/push  │
 *       └─────────────────────────────────────────────────────────┘
 *
 *   Order matters:  push() runs BEFORE pull() so the cloud has the latest
 *   local changes before we download.  This prevents an older cloud snapshot
 *   from overwriting data we just modified locally.
 *
 * Sync cycle (every SYNC_INTERVAL_MS while online):
 *   1. push()  — drain SyncQueue → POST /api/sync/push → mark synced
 *   2. pull()  — GET /api/sync/pull?since=<cursor> → applyPull() in offline-queue
 *   3. Advance the incremental cursor (serverTime from pull response)
 *   4. cleanup() — prune old synced SyncQueue rows
 *
 * Connectivity:
 *   A lightweight connectivity check runs every CONNECTIVITY_CHECK ms.
 *   When the device comes online after being offline, an immediate sync is
 *   triggered so the user doesn't wait for the next interval.
 *
 * IPC with Electron main process:
 *   Sends:    { type: 'sync:status',  status: { online, pending, lastSyncAt, syncing } }
 *             { type: 'sync:pulled',  applied: <number> }
 *   Receives: { type: 'sync:force' }  — trigger an immediate sync
 *             { type: 'init', token, baseUrl, dbUrl } — override env-based init
 *
 * Connected files:
 *   • electron/offline-queue.js      — local SQLite data layer (push queue + applyPull)
 *   • app/api/sync/push/route.ts     — cloud endpoint that receives push operations
 *   • app/api/sync/pull/route.ts     — cloud endpoint that returns catalog + deletions
 *   • main.js                        — forks this process, injects env vars, relays IPC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { OfflineQueue } = require('./offline-queue')

const SYNC_INTERVAL_MS   = 2 * 60 * 1000  // 2 minutes between sync cycles
const CONNECTIVITY_CHECK = 30 * 1000      // 30 seconds between connectivity pings

// ─── State ────────────────────────────────────────────────────────────────────

let branchToken  = null    // JWT issued to this branch — sent as Bearer token
let cloudBaseUrl = null    // e.g. https://your-app.vercel.app
let offlineQueue = null    // OfflineQueue instance (wraps local SQLite via Prisma)
let isOnline     = false   // last known connectivity state
let syncing      = false   // guard: prevents overlapping sync cycles
let lastSyncAt   = null    // ISO timestamp of last completed sync (for UI display)
let pullCursor   = null    // ISO timestamp used as ?since= in pull requests
let syncTimer    = null    // handle for the scheduled next sync
let checkTimer   = null    // handle for the connectivity interval

// ─── Fetch with Timeout ───────────────────────────────────────────────────────
// Standard fetch() has no built-in timeout.  This helper wires an AbortController
// so a slow or stalled cloud server never hangs the worker indefinitely.

async function fetchWithTimeout(url, options = {}) {
  const { timeout = 30_000, ...fetchOptions } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Initialize ──────────────────────────────────────────────────────────────
// Called once — either from the auto-init block below (env vars set by main.js
// via fork()) or via an IPC 'init' message from main.js.

function init({ token, baseUrl, dbUrl }) {
  if (!token || !baseUrl) {
    console.error('[SyncWorker] init called with missing token or baseUrl')
    return
  }
  branchToken  = token
  cloudBaseUrl = baseUrl.replace(/\/$/, '')
  offlineQueue = new OfflineQueue(dbUrl)
  console.log(`[SyncWorker] Initialized — cloud: ${cloudBaseUrl}`)

  // Restore the incremental pull cursor from SyncMeta so a restart doesn't
  // re-download the full 90-day history window on the very next pull.
  offlineQueue.getMeta()
    .then(meta => { if (meta?.lastPullAt) pullCursor = new Date(meta.lastPullAt).toISOString() })
    .catch(() => {})

  startConnectivityMonitor()
}

// Auto-init from environment variables injected by main.js when it forks this process.
// main.js passes BRANCH_TOKEN, CLOUD_URL, and LOCAL_DATABASE_URL as env vars.
if (process.env.BRANCH_TOKEN && process.env.CLOUD_URL) {
  init({
    token:   process.env.BRANCH_TOKEN,
    baseUrl: process.env.CLOUD_URL,
    dbUrl:   process.env.LOCAL_DATABASE_URL,
  })
}

// ─── Connectivity Monitor ─────────────────────────────────────────────────────
// Pings /api/sync/status every CONNECTIVITY_CHECK ms.
// When coming back online after being offline, schedules an immediate sync
// so pending local changes don't wait for the next timed interval.

async function checkConnectivity() {
  try {
    const res = await fetchWithTimeout(`${cloudBaseUrl}/api/sync/status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${branchToken}` },
      timeout: 5000,
    })
    if (res.ok && !isOnline) {
      isOnline = true
      console.log('[SyncWorker] Online — scheduling immediate sync')
      scheduleSyncNow()
    } else if (!res.ok) {
      isOnline = false
    }
  } catch {
    if (isOnline) {
      isOnline = false
      clearTimeout(syncTimer)
      console.log('[SyncWorker] Offline')
    }
  }
  broadcastStatus()
}

function startConnectivityMonitor() {
  checkConnectivity()
  checkTimer = setInterval(checkConnectivity, CONNECTIVITY_CHECK)
}

// ─── Sync Cycle ───────────────────────────────────────────────────────────────
// Full bidirectional sync:  push first, then pull.
// The order is critical — see the header comment for why.

async function runSync() {
  if (syncing || !isOnline || !branchToken) return
  syncing = true
  broadcastStatus()
  console.log('[SyncWorker] Sync started')

  try {
    // On the first online sync after startup, revive any permanently-failed
    // operations (attempts ≥ 5) so they get retried in case a fix was deployed.
    if (!lastSyncAt) await offlineQueue?.resetFailed().catch(() => {})

    // Push local changes BEFORE pulling so the cloud sees our latest state.
    // If we pulled first, an older cloud snapshot could overwrite locally-modified
    // data (e.g. a product price changed offline) with a stale value.
    await push()
    await pull()

    lastSyncAt = new Date().toISOString()
    await offlineQueue?.cleanup()  // remove old synced queue rows
    console.log('[SyncWorker] Sync completed at', lastSyncAt)
  } catch (err) {
    console.error('[SyncWorker] Sync failed:', err.message)
  } finally {
    syncing = false
    broadcastStatus()
    // Schedule the next regular sync cycle
    clearTimeout(syncTimer)
    syncTimer = setTimeout(runSync, SYNC_INTERVAL_MS)
  }
}

// Schedule a sync to run in 1 second (debounced — cancels any pending timer).
function scheduleSyncNow() {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(runSync, 1000)
}

// ─── Pull (cloud → local) ─────────────────────────────────────────────────────
// Fetches the latest cloud data since the last pull cursor, then applies it
// to the local SQLite database via offlineQueue.applyPull().
//
// The pull response includes:
//   • Catalog: products, productUnits, categories, suppliers, offers, storeSettings
//   • Operational: customers, transactions, expenses, shifts, stockTransfers, …
//   • Deletions: [{ table, id }] from CloudDeleteLog — applied as hard-deletes locally

async function pull() {
  const params = new URLSearchParams()
  if (pullCursor) params.set('since', pullCursor)

  const res = await fetchWithTimeout(
    `${cloudBaseUrl}/api/sync/pull?${params.toString()}`,
    {
      method:  'GET',
      headers: { Authorization: `Bearer ${branchToken}` },
      timeout: 30_000,
    }
  )

  if (!res.ok) throw new Error(`Pull failed: ${res.status}`)

  const data = await res.json()
  console.log(
    `[SyncWorker] Pulled — products:${data.products?.length ?? 0} ` +
    `users:${data.users?.length ?? 0} ` +
    `offers:${data.offers?.length ?? 0} ` +
    `plans:${data.subscriptionPlans?.length ?? 0} ` +
    `sub:${data.subscription ? 1 : 0} ` +
    `payments:${data.payments?.length ?? 0} ` +
    `payMethods:${data.paymentMethods?.length ?? 0} ` +
    `deletions:${data.deletions?.length ?? 0}`
  )

  // Apply the pulled data (upserts) and deletions into local SQLite.
  const applied = await offlineQueue.applyPull(
    data,
    process.env.TENANT_ID,
    process.env.BRANCH_ID,
  )
  console.log(`[SyncWorker] Applied ${applied} records/deletions to local DB`)

  // Advance the cursor using SERVER time (never local clock) to avoid clock-skew
  // gaps where records updated between the two clocks would be missed on the next pull.
  // Persisting the cursor means a restart resumes incrementally, not from scratch.
  if (data.serverTime) {
    pullCursor = data.serverTime
    await offlineQueue.setLastPullAt(data.serverTime).catch(() => {})
  }

  // Notify the renderer so open pages can refresh their data.
  if (typeof process.send === 'function') {
    process.send({ type: 'sync:pulled', applied })
  }
}

// ─── Push (local → cloud) ─────────────────────────────────────────────────────
// Reads pending SyncQueue rows, posts them to /api/sync/push on the cloud,
// then marks each operation as synced or increments its failure count.
//
// Design notes:
//   • localId (= recordId) is the stable idempotency key.  The cloud creates rows
//     with this same id, so a retried push finds the existing row instead of
//     creating a duplicate.
//   • Operations are batched (up to 200 per push request) to keep payloads manageable.
//   • Results are matched by localId (not array index) to handle reordering.

async function push() {
  if (!offlineQueue) return

  const pending = await offlineQueue.getPending(200)
  if (pending.length === 0) {
    console.log('[SyncWorker] Nothing to push')
    return
  }

  console.log(`[SyncWorker] Pushing ${pending.length} operations…`)

  // Build the operations array expected by /api/sync/push
  const operations = pending.map(op => {
    let payload = {}
    try { payload = JSON.parse(op.payload) } catch { payload = {} }
    return {
      table:     op.tableName,
      type:      op.operation,
      localId:   String(op.recordId),
      // cloudId is set when a previous push already created the cloud row
      // (e.g. an UPDATE that follows an INSERT in the same queue).
      cloudId:   payload.cloudId ? String(payload.cloudId) : undefined,
      payload,
      timestamp: op.createdAt instanceof Date
        ? op.createdAt.toISOString()
        : new Date(op.createdAt).toISOString(),
    }
  })

  const res = await fetchWithTimeout(`${cloudBaseUrl}/api/sync/push`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${branchToken}`,
      'Content-Type': 'application/json',
    },
    body:    JSON.stringify({ operations }),
    timeout: 60_000,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    await offlineQueue.incrementAttempts(pending.map(p => p.id), `HTTP ${res.status}: ${errText}`)
    throw new Error(`Push failed: ${res.status}`)
  }

  const result = await res.json()

  // Index results by localId for O(1) lookup — robust against server reordering.
  const byLocalId = new Map(
    (result.results ?? []).map(r => [String(r.localId), r])
  )

  const successIds = []
  const failedIds  = []
  let firstFailReason = 'Server error'

  for (const p of pending) {
    const r = byLocalId.get(String(p.recordId))
    if (r && r.status === 'applied') {
      successIds.push(p.id)
    } else {
      failedIds.push(p.id)
      if (r?.reason) firstFailReason = r.reason
    }
  }

  if (successIds.length > 0) {
    await offlineQueue.markSynced(successIds)
    console.log(`[SyncWorker] Marked ${successIds.length} operations as synced`)
  }

  if (failedIds.length > 0) {
    await offlineQueue.incrementAttempts(failedIds, firstFailReason)
    console.warn(`[SyncWorker] ${failedIds.length} operations failed — reason: ${firstFailReason}`)
  }
}

// ─── Status Broadcast ─────────────────────────────────────────────────────────
// Sends the current sync state to the Electron main process, which forwards
// it to the renderer (status bar / sync indicator in the UI).

async function broadcastStatus() {
  const pending = await offlineQueue?.pendingCount() ?? 0
  if (typeof process.send === 'function') {
    process.send({
      type:   'sync:status',
      status: { online: isOnline, pending, lastSyncAt, syncing },
    })
  }
}

// ─── IPC from Electron Main Process ──────────────────────────────────────────

process.on('message', msg => {
  if (!msg) return
  if (msg.type === 'init')       init(msg)
  if (msg.type === 'sync:force') {
    console.log('[SyncWorker] Force sync requested by main process')
    scheduleSyncNow()
  }
})

// EPIPE is expected when the parent process (main.js) closes — ignore it.
process.on('uncaughtException', err => {
  if (err.code === 'EPIPE') return
  console.error('[SyncWorker] Uncaught exception:', err)
})
