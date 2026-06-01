import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateBranchToken } from '@/lib/auth'
import { getTenantId } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const branches = await prisma.branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { transactions: true, users: true } },
      storeSettings: { select: { storeName: true } },
    },
  })
  return NextResponse.json(branches)
}

const CreateSchema = z.object({
  name:    z.string().min(2),
  address: z.string().optional(),
  phone:   z.string().optional(),
})

export async function POST(request: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Check branch limit per plan
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  })
  const currentCount = await prisma.branch.count({ where: { tenantId, isActive: true } })
  if (sub && sub.plan.maxBranches !== -1 && currentCount >= sub.plan.maxBranches) {
    return NextResponse.json({ error: `لقد وصلت للحد الأقصى من الفروع (${sub.plan.maxBranches}) في خطتك الحالية` }, { status: 403 })
  }

  const branch = await prisma.branch.create({
    data: { tenantId, ...parsed.data },
  })

  // Generate branch token for desktop app
  const branchToken = await generateBranchToken(branch.id, tenantId)

  return NextResponse.json({ ...branch, branchToken }, { status: 201 })
}
