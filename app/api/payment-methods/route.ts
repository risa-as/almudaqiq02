import { NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { getTenantId } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/payment-methods — returns active platform payment methods for tenant view
export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const methods = await prisma.platformPaymentMethod.findMany({
    where:   { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select:  { id: true, type: true, name: true, accountNumber: true, accountName: true, instructions: true },
  })
  return NextResponse.json(methods)
}
