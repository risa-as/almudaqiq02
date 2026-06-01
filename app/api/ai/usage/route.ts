import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const [tenant, usageLog] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { aiDailyLimit: true } }),
    prisma.aiUsageLog.findUnique({ where: { tenantId_date: { tenantId: auth.tenantId, date: today } } }),
  ])

  const limit = tenant?.aiDailyLimit ?? 50
  const used  = usageLog?.count ?? 0

  return NextResponse.json({ used, limit, remaining: Math.max(0, limit - used) })
}
