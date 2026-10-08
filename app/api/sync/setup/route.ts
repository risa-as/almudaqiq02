import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/multi-tenant/prisma'
import { IS_ELECTRON } from '@/lib/prisma-runtime'

export const dynamic = 'force-dynamic'

/**
 * Desktop-only: returns the data needed to activate the sync worker.
 * Called from the tenant layout when running inside Electron and no
 * branch-config.json exists yet.
 */
export async function GET() {
  // Desktop-only. On the cloud this would hand any signed-in user (a cashier
  // included — /api/sync/ is outside the role middleware) the branch activation
  // code, which /api/branches/[id]/activate exchanges for a sync token.
  if (!IS_ELECTRON) return NextResponse.json({ error: 'only available on desktop' }, { status: 403 })

  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, branchId } = auth
  if (!branchId) return NextResponse.json({ error: 'no_branch' }, { status: 400 })

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { id: true, activationCode: true },
  })

  if (!branch?.activationCode) {
    return NextResponse.json({ error: 'activation_code_missing' }, { status: 404 })
  }

  return NextResponse.json({
    cloudUrl:       process.env.CLOUD_URL ?? '',
    branchId:       branch.id,
    tenantId,
    activationCode: branch.activationCode,
  })
}
