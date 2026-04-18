import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { recipients: true } } },
  })
  return NextResponse.json(announcements)
}

const Schema = z.object({
  title:        z.string().min(2),
  body:         z.string().min(2),
  type:         z.enum(['INFO', 'WARNING', 'MAINTENANCE']).default('INFO'),
  tenantIds:    z.array(z.string()).optional(), // empty = all tenants
  expiresAt:    z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { tenantIds, expiresAt, ...rest } = parsed.data

  // Determine recipients
  const targets = tenantIds?.length
    ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true } })
    : await prisma.tenant.findMany({ where: { status: { in: ['ACTIVE', 'TRIAL'] } }, select: { id: true } })

  const announcement = await prisma.announcement.create({
    data: {
      ...rest,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      recipients: {
        create: targets.map(t => ({ tenantId: t.id })),
      },
    },
    include: { _count: { select: { recipients: true } } },
  })

  return NextResponse.json(announcement, { status: 201 })
}
