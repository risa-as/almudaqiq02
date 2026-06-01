/**
 * sync-enqueue.ts
 *
 * In the Electron desktop build (IS_ELECTRON=1) this records each local write
 * into the local SyncQueue table so the background sync worker can later push
 * it to the cloud. In cloud/web mode it is a no-op.
 *
 * Fire-and-forget: enqueueing must never block or fail the originating request.
 */
import { IS_ELECTRON } from './prisma-runtime'
import { prisma } from './multi-tenant/prisma'

export function enqueueSync(
  tableName: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string | number,
  payload: Record<string, unknown>
): void {
  if (!IS_ELECTRON) return

  // In Electron, `prisma` is the local SQLite client which has the SyncQueue model.
  void (prisma as any).syncQueue
    .create({
      data: {
        tableName,
        operation,
        recordId: String(recordId),
        payload: JSON.stringify(payload),
        attempts: 0,
      },
    })
    .catch((err: unknown) => {
      console.error('[enqueueSync] failed to enqueue operation:', err)
    })
}
