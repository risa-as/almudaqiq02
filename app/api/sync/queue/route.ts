import { NextRequest, NextResponse } from 'next/server'
import { IS_ELECTRON, getDbUrl } from '@/lib/prisma-runtime'

export const dynamic = 'force-dynamic'

const TABLE_LABELS: Record<string, string> = {
  products:      'منتجات',
  categories:    'أقسام',
  suppliers:     'موردين',
  customers:     'عملاء',
  transactions:  'مبيعات',
  expenses:      'مصاريف',
  cashierShifts: 'وردية الكاشير',
  stockTransfers:'نقل مخزون',
  productBatches:'دفعات شراء',
}

export async function GET(request: NextRequest) {
  if (!IS_ELECTRON) {
    return NextResponse.json({ error: 'only available on desktop' }, { status: 403 })
  }

  // Dynamic require — only available in Electron (local SQLite client)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createRequire } = require('module')
  const nodeRequire = createRequire(import.meta.url)
  const { PrismaClient } = nodeRequire('@prisma/client-local')

  const db = new PrismaClient({ datasources: { db: { url: getDbUrl() } } })

  try {
    const showAll = request.nextUrl.searchParams.get('all') === '1'

    const rows = await db.syncQueue.findMany({
      where: showAll ? {} : { syncedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // Group by tableName
    const grouped: Record<string, {
      label: string
      pending: typeof rows
      failed: typeof rows
      synced: typeof rows
    }> = {}

    for (const row of rows) {
      const t = row.tableName
      if (!grouped[t]) {
        grouped[t] = {
          label:   TABLE_LABELS[t] ?? t,
          pending: [],
          failed:  [],
          synced:  [],
        }
      }
      if (row.syncedAt) {
        grouped[t].synced.push(row)
      } else if (row.attempts >= 5) {
        grouped[t].failed.push(row)
      } else {
        grouped[t].pending.push(row)
      }
    }

    const summary = Object.entries(grouped).map(([table, g]) => ({
      table,
      label:        g.label,
      pendingCount: g.pending.length,
      failedCount:  g.failed.length,
      syncedCount:  g.synced.length,
      operations: [
        ...g.failed.map(r => ({
          id:        r.id,
          type:      r.operation,
          recordId:  r.recordId,
          attempts:  r.attempts,
          status:    'failed' as const,
          error:     r.lastError ?? null,
          createdAt: r.createdAt,
          payload:   parsePayloadPreview(r.payload),
        })),
        ...g.pending.map(r => ({
          id:        r.id,
          type:      r.operation,
          recordId:  r.recordId,
          attempts:  r.attempts,
          status:    'pending' as const,
          error:     r.lastError ?? null,
          createdAt: r.createdAt,
          payload:   parsePayloadPreview(r.payload),
        })),
        ...(showAll ? g.synced.map(r => ({
          id:        r.id,
          type:      r.operation,
          recordId:  r.recordId,
          attempts:  r.attempts,
          status:    'synced' as const,
          error:     null,
          createdAt: r.createdAt,
          payload:   parsePayloadPreview(r.payload),
        })) : []),
      ],
    })).filter(g => g.pendingCount + g.failedCount + (showAll ? g.syncedCount : 0) > 0)

    const totals = {
      pending: summary.reduce((s, g) => s + g.pendingCount, 0),
      failed:  summary.reduce((s, g) => s + g.failedCount, 0),
      synced:  summary.reduce((s, g) => s + g.syncedCount, 0),
    }

    // Read SyncMeta for last pull cursor
    const meta = await db.syncMeta.findFirst({ orderBy: { id: 'desc' } }).catch(() => null)

    return NextResponse.json({ totals, groups: summary, lastPullAt: meta?.lastPullAt ?? null })
  } finally {
    await db.$disconnect()
  }
}

function parsePayloadPreview(raw: string | null): string {
  if (!raw) return ''
  try {
    const p = JSON.parse(raw)
    return p.name ?? p.title ?? p.id ?? ''
  } catch {
    return ''
  }
}
