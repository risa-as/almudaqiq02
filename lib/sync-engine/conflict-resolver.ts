/**
 * Conflict Resolution Rules:
 * - transactions:   local wins  (never reject an offline sale)
 * - products:       cloud wins  (catalog is managed centrally)
 * - productUnits:   cloud wins
 * - categories:     cloud wins
 * - offers:         cloud wins
 * - storeSettings:  cloud wins
 * - customers:      last-write-wins (compare updatedAt)
 * - suppliers:      cloud wins
 * - expenses:       local wins  (branch-local data)
 * - productBatch:   merge quantities + flag conflict
 */

type ConflictRecord = { updatedAt?: string | Date; [key: string]: unknown }

const CLOUD_WINS_TABLES = ['products', 'productUnits', 'categories', 'offers', 'storeSettings', 'suppliers']
const LOCAL_WINS_TABLES = ['transactions', 'expenses']

export function resolveConflict(
  table: string,
  localRecord: ConflictRecord,
  cloudRecord: ConflictRecord
): ConflictRecord {
  if (CLOUD_WINS_TABLES.includes(table)) return cloudRecord
  if (LOCAL_WINS_TABLES.includes(table)) return localRecord

  if (table === 'customers') {
    // Last-write-wins
    const localTime = localRecord.updatedAt ? new Date(localRecord.updatedAt as string).getTime() : 0
    const cloudTime = cloudRecord.updatedAt ? new Date(cloudRecord.updatedAt as string).getTime() : 0
    return localTime > cloudTime ? localRecord : cloudRecord
  }

  if (table === 'productBatch') {
    // Merge: keep cloud record but add a note about the discrepancy
    return {
      ...cloudRecord,
      _conflictNote: `Local quantity was ${localRecord.quantity}, cloud was ${cloudRecord.quantity}`,
    }
  }

  // Default: cloud wins
  return cloudRecord
}

export interface ConflictDetail {
  table: string
  localId: string | number
  cloudId?: string
  winner: 'local' | 'cloud' | 'merged'
  description: string
}

export function describeConflict(
  table: string,
  localRecord: ConflictRecord,
  cloudRecord: ConflictRecord
): ConflictDetail {
  if (CLOUD_WINS_TABLES.includes(table)) {
    return { table, localId: localRecord.id as string, cloudId: cloudRecord.id as string, winner: 'cloud', description: `تعارض في ${table}: تم تطبيق بيانات السحابة` }
  }
  if (LOCAL_WINS_TABLES.includes(table)) {
    return { table, localId: localRecord.id as string, cloudId: cloudRecord.id as string, winner: 'local', description: `تعارض في ${table}: تم تطبيق البيانات المحلية` }
  }
  return { table, localId: localRecord.id as string, cloudId: cloudRecord.id as string, winner: 'merged', description: `تعارض في ${table}: تم دمج البيانات` }
}
