import { prisma } from '@/lib/multi-tenant/prisma'

export async function logAction(
  action: string,
  entity: string,
  entityId: string | null = null,
  details: string | null = null,
  username: string | null = 'System',
  tenantId?: string,
  branchId?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details,
        username,
        ...(tenantId ? { tenantId } : {}),
        ...(branchId ? { branchId } : {}),
      },
    })
  } catch (error) {
    console.error('Failed to write audit log:', error)
  }
}
