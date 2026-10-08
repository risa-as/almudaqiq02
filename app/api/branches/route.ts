import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { RELATION_JOIN } from '@/lib/prisma-runtime'
import { generateBranchToken } from '@/lib/auth'
import { getAuthContext } from '@/lib/api-helpers'
import { isOwnerRole } from '@/lib/branch-scope'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenantId } = auth

  const branches = await prisma.branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { transactions: true, users: true } },
      storeSettings: { select: { storeName: true } },
    },
    // رحلة واحدة بدل ثلاث (فروع + عدّادات + إعدادات المتجر): ~1190ms ← ~590ms.
    // هذا المسار حرج: BranchContext ينتظره قبل أن تبدأ صفحات الفروع استعلاماتها.
    ...RELATION_JOIN,
  })
  // The activation code is what binds a desktop install to a branch (and hands it
  // a sync token), so only owners may see it — not branch managers.
  if (!isOwnerRole(auth.role)) {
    return NextResponse.json(branches.map(({ activationCode: _code, ...rest }) => rest))
  }
  return NextResponse.json(branches)
}

const CreateSchema = z.object({
  name:    z.string().min(2),
  address: z.string().optional(),
  phone:   z.string().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerRole(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  const { tenantId } = auth

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
  const branchToken = await generateBranchToken(branch.id, tenantId, branch.tokenVersion)

  return NextResponse.json({ ...branch, branchToken }, { status: 201 })
}
