import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { prisma as localPrisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCloudDb(async () => {
    const { id } = await params
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription:   { include: { plan: true } },
        branches:       { select: { id: true, name: true, isActive: true, createdAt: true } },
        paymentRecords: { orderBy: { paidAt: 'desc' }, take: 20 },
        _count:         { select: { users: true, transactions: true } },
      },
    })
    if (!tenant) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(tenant)
  })
}

const UpdateSchema = z.object({
  name:         z.string().min(2).optional(),
  status:       z.enum(['ACTIVE', 'TRIAL', 'GRACE', 'SUSPENDED', 'CANCELLED']).optional(),
  planId:       z.string().optional(),
  endDate:      z.string().datetime().optional().nullable(),
  aiDailyLimit: z.number().int().min(0).max(10000).optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCloudDb(async () => {
    const { id } = await params
    const body   = await request.json().catch(() => null)
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { name, status, planId, endDate, aiDailyLimit } = parsed.data

    await prisma.tenant.update({
      where: { id },
      data: {
        ...(name                        ? { name }         : {}),
        ...(status                      ? { status }       : {}),
        ...(aiDailyLimit !== undefined  ? { aiDailyLimit } : {}),
      },
    })

    if (planId || endDate !== undefined) {
      await prisma.tenantSubscription.update({
        where: { tenantId: id },
        data: {
          ...(planId                ? { planId }                                      : {}),
          ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        },
      })
    }

    const updated = await prisma.tenant.findUnique({
      where:   { id },
      include: { subscription: { include: { plan: true } }, _count: { select: { branches: true, users: true } } },
    })
    return NextResponse.json(updated)
  })
}

const DeleteSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCloudDb(async () => {
    const { id } = await params

    const body   = await request.json().catch(() => null)
    const parsed = DeleteSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }, { status: 400 })

    const { email, password } = parsed.data
    const admin = await prisma.superAdmin.findFirst({ where: { email } })
    if (!admin) return NextResponse.json({ error: 'بيانات السوبر أدمن غير صحيحة' }, { status: 401 })

    const valid = await verifyPassword(password, admin.password)
    if (!valid) return NextResponse.json({ error: 'بيانات السوبر أدمن غير صحيحة' }, { status: 401 })

    const tenant = await prisma.tenant.findUnique({ where: { id } })
    if (!tenant) return NextResponse.json({ error: 'المستأجر غير موجود' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      const txIds   = (await tx.transaction.findMany({ where: { tenantId: id }, select: { id: true } })).map(r => r.id)
      const suppIds = (await tx.supplier.findMany(    { where: { tenantId: id }, select: { id: true } })).map(r => r.id)
      const userIds = (await tx.user.findMany(        { where: { tenantId: id }, select: { id: true } })).map(r => r.id)

      if (txIds.length)   await tx.transactionItem.deleteMany({ where: { transactionId: { in: txIds } } })
      if (suppIds.length) await tx.supplierLedger.deleteMany({ where: { supplierId: { in: suppIds } } })
      if (userIds.length) await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } })

      await tx.syncLog.deleteMany(               { where: { tenantId: id } })
      await tx.auditLog.deleteMany(              { where: { tenantId: id } })
      await tx.notification.deleteMany(          { where: { tenantId: id } })
      await tx.announcementRecipient.deleteMany( { where: { tenantId: id } })
      await tx.cashierShift.deleteMany(          { where: { tenantId: id } })
      await tx.stockTransfer.deleteMany(         { where: { tenantId: id } })
      await tx.paymentRecord.deleteMany(         { where: { tenantId: id } })
      await tx.storeSettings.deleteMany(         { where: { tenantId: id } })
      await tx.expense.deleteMany(               { where: { tenantId: id } })
      await tx.offer.deleteMany(                 { where: { tenantId: id } })
      await tx.transaction.deleteMany(           { where: { tenantId: id } })
      await tx.product.deleteMany(               { where: { tenantId: id } })
      await tx.supplier.deleteMany(              { where: { tenantId: id } })
      await tx.category.deleteMany(              { where: { tenantId: id } })
      await tx.customer.deleteMany(              { where: { tenantId: id } })
      await tx.tenantSubscription.deleteMany(    { where: { tenantId: id } })
      await tx.user.deleteMany(                  { where: { tenantId: id } })
      await tx.branch.deleteMany(                { where: { tenantId: id } })
      await tx.tenant.delete(                    { where: { id } })
    }, { timeout: 30_000 })

    // Also purge any locally-cached copies in SQLite
    try {
      const localUserIds = (await localPrisma.user.findMany({ where: { tenantId: id }, select: { id: true } })).map(r => r.id)
      if (localUserIds.length) await localPrisma.refreshToken.deleteMany({ where: { userId: { in: localUserIds } } })
      await localPrisma.storeSettings.deleteMany({ where: { tenantId: id } })
      await localPrisma.user.deleteMany(         { where: { tenantId: id } })
      await localPrisma.branch.deleteMany(       { where: { tenantId: id } })
      await localPrisma.tenant.deleteMany(       { where: { id } })
    } catch { /* SQLite cleanup is best-effort */ }

    return NextResponse.json({ success: true })
  })
}
