/**
 * Offline Queue — manages unsynced local operations in SQLite
 * Uses the SyncQueue table in the local database.
 */

const { PrismaClient } = require('@prisma/client')

let _prisma = null

function getPrisma(dbUrl) {
  if (!_prisma) {
    _prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })
  }
  return _prisma
}

class OfflineQueue {
  constructor(dbUrl) {
    this.db = getPrisma(dbUrl)
  }

  /** Add an operation to the queue */
  async enqueue(tableName, operation, recordId, payload) {
    return this.db.syncQueue.create({
      data: {
        tableName,
        operation,
        recordId: String(recordId),
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
        attempts: 0,
      },
    })
  }

  /** Get pending (unsynced) operations, oldest first */
  async getPending(limit = 100) {
    return this.db.syncQueue.findMany({
      where: { syncedAt: null, attempts: { lt: 5 } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  }

  /** Mark operations as synced */
  async markSynced(ids) {
    return this.db.syncQueue.updateMany({
      where: { id: { in: ids } },
      data: { syncedAt: new Date() },
    })
  }

  /** Increment retry counter on failure */
  async incrementAttempts(ids, errorMsg) {
    return this.db.syncQueue.updateMany({
      where: { id: { in: ids } },
      data: { attempts: { increment: 1 }, lastError: errorMsg },
    })
  }

  /** Count pending operations */
  async pendingCount() {
    return this.db.syncQueue.count({ where: { syncedAt: null, attempts: { lt: 5 } } })
  }

  /** Clear successfully synced records older than 7 days */
  async cleanup() {
    const cutoff = new Date(Date.now() - 7 * 86400_000)
    return this.db.syncQueue.deleteMany({
      where: { syncedAt: { lt: cutoff } },
    })
  }
}

module.exports = { OfflineQueue }
