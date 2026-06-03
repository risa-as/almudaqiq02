import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { verifyBranchToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Branch token required' }, { status: 401 })

  let branchPayload: Awaited<ReturnType<typeof verifyBranchToken>>
  try { branchPayload = await verifyBranchToken(token) }
  catch { return NextResponse.json({ error: 'Invalid branch token' }, { status: 401 }) }

  const { branchId } = branchPayload

  // Revocation check: token must match the branch's current tokenVersion.
  const branchRow = await prisma.branch.findFirst({ where: { id: branchId, tenantId: branchPayload.tenantId }, select: { tokenVersion: true } })
  if (!branchRow || (branchPayload.tv ?? 0) !== (branchRow.tokenVersion ?? 0)) {
    return NextResponse.json({ error: 'Branch token revoked', code: 'TOKEN_REVOKED' }, { status: 401 })
  }

  // Pull and push are recorded as separate sync logs, so read the most recent
  // value of each independently.
  const [lastSync, pendingConflicts] = await Promise.all([
    prisma.syncLog.findFirst({
      where: { branchId, status: 'SUCCESS' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, recordsPushed: true, recordsPulled: true },
    }),
    prisma.syncLog.count({ where: { branchId, NOT: { conflicts: null } } }),
  ])

  return NextResponse.json({
    lastSyncAt:       lastSync?.completedAt   ?? null,
    lastPushed:       lastSync?.recordsPushed ?? 0,
    lastPulled:       lastSync?.recordsPulled ?? 0,
    pendingConflicts,
    serverTime: new Date().toISOString(),
  })
}
