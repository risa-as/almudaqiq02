import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { markAllRead } from '@/lib/notifications/in-app'
import { getAuthContext } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenantId, userId } = auth

  const notifications = await prisma.notification.findMany({
    where: {
      tenantId,
      OR: [{ userId }, { userId: null }],
    },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: 30,
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  return NextResponse.json({ notifications, unreadCount })
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenantId, userId } = auth

  const body = await request.json().catch(() => ({}))

  if (body.markAllRead) {
    await markAllRead(userId, tenantId)
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, tenantId, OR: [{ userId }, { userId: null }] },
      data: { isRead: true },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
