import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { isOwnerRole, pinnedBranchId } from '@/lib/branch-scope'

/** Owner-only guard shared by the write handlers. Returns the tenant or an error response. */
async function ownerTenant(): Promise<{ tenantId: string } | NextResponse> {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerRole(auth.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  return { tenantId: auth.tenantId }
}

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenantId } = auth
  // Branch staff may only read their own branch.
  const pinned = pinnedBranchId(auth)
  if (pinned && pinned !== id) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  const branch = await prisma.branch.findFirst({
    where: { id, tenantId },
    include: {
      users: { select: { id: true, username: true, role: true } },
      storeSettings: true,
      _count: { select: { transactions: true, stockBatches: true } },
    },
  })
  if (!branch) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  if (!isOwnerRole(auth.role)) {
    const { activationCode: _code, ...rest } = branch
    return NextResponse.json(rest)
  }
  return NextResponse.json(branch)
}

const UpdateSchema = z.object({
  name:    z.string().min(2).optional(),
  address: z.string().optional(),
  phone:   z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await ownerTenant()
  if (owner instanceof NextResponse) return owner
  const { tenantId } = owner
  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const branch = await prisma.branch.updateMany({
    where: { id, tenantId },
    data: parsed.data,
  })
  if (!branch.count) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  return NextResponse.json({ success: true })
}

const StatusSchema = z.object({ isActive: z.boolean() })

// PATCH — toggle a branch's active status. Activating enforces the plan's branch cap.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await ownerTenant()
  if (owner instanceof NextResponse) return owner
  const { tenantId } = owner

  const body = await request.json().catch(() => null)
  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { isActive } = parsed.data

  const branch = await prisma.branch.findFirst({ where: { id, tenantId }, select: { id: true, isActive: true } })
  if (!branch) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  // Re-activating must respect the plan's branch limit (-1 = unlimited)
  if (isActive && !branch.isActive) {
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId }, include: { plan: { select: { maxBranches: true } } },
    })
    const cap = sub?.plan?.maxBranches ?? -1
    if (cap > 0) {
      const activeCount = await prisma.branch.count({ where: { tenantId, isActive: true } })
      if (activeCount >= cap) {
        return NextResponse.json(
          { error: `لا يمكن تفعيل الفرع — وصلت للحد الأقصى من الفروع (${cap}) في خطتك الحالية` },
          { status: 403 },
        )
      }
    }
  }

  await prisma.branch.updateMany({ where: { id, tenantId }, data: { isActive } })
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await ownerTenant()
  if (owner instanceof NextResponse) return owner
  const { tenantId } = owner

  // Check for transactions before archiving
  const txCount = await prisma.transaction.count({ where: { branchId: id, tenantId } })
  if (txCount > 0) {
    // Soft delete only
    await prisma.branch.updateMany({ where: { id, tenantId }, data: { isActive: false } })
    return NextResponse.json({ success: true, message: 'تم أرشفة الفرع' })
  }

  await prisma.branch.updateMany({ where: { id, tenantId }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
