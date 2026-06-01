import { NextRequest, NextResponse } from 'next/server'
import { IS_ELECTRON, getDbUrl } from '@/lib/prisma-runtime'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!IS_ELECTRON) {
    return NextResponse.json({ error: 'only available on desktop' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createRequire } = require('module')
  const nodeRequire = createRequire(import.meta.url)
  const { PrismaClient } = nodeRequire('@prisma/client-local')

  const db = new PrismaClient({ datasources: { db: { url: getDbUrl() } } })

  try {
    const body = await request.json().catch(() => ({}))
    const table: string | undefined = body.table

    const where = {
      syncedAt: null,
      attempts: { gte: 5 },
      ...(table ? { tableName: table } : {}),
    }

    const result = await db.syncQueue.updateMany({
      where,
      data: { attempts: 0, lastError: null },
    })

    // Notify sync worker to pick up the newly-unfrozen operations immediately.
    if (typeof process.send === 'function') {
      process.send({ type: 'sync:force' })
    }

    return NextResponse.json({ reset: result.count })
  } finally {
    await db.$disconnect()
  }
}
