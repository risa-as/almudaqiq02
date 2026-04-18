import { prisma } from '@/lib/multi-tenant/prisma'

type NotificationType = 'SUBSCRIPTION_EXPIRY' | 'SYNC_FAILURE' | 'LOW_STOCK' | 'SYSTEM' | 'STOCK_TRANSFER'

export async function createNotification(
  tenantId: string,
  userId: string | null,
  type: NotificationType,
  title: string,
  body: string
) {
  return prisma.notification.create({
    data: { tenantId, userId, type, title, body },
  })
}

export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  })
}

export async function markAllRead(userId: string, tenantId: string) {
  return prisma.notification.updateMany({
    where: { userId, tenantId, isRead: false },
    data: { isRead: true },
  })
}

export async function getUnread(userId: string, tenantId: string) {
  return prisma.notification.findMany({
    where: {
      tenantId,
      isRead: false,
      OR: [{ userId }, { userId: null }],  // personal + broadcast
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

export async function getUnreadCount(userId: string, tenantId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      tenantId,
      isRead: false,
      OR: [{ userId }, { userId: null }],
    },
  })
}
