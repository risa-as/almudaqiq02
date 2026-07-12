import { prisma } from '@/lib/multi-tenant/prisma'

/**
 * Convenience wrapper: resolves the acting user's name from the auth context
 * then writes the audit entry. Never throws (logAction swallows its own errors).
 */
export async function logActionAs(
  auth: { userId: string; tenantId: string; branchId?: string | null },
  action: string,
  entity: string,
  entityId: string | null,
  details: string | null = null
) {
  let username: string | null = null
  try {
    username = (
      await prisma.user.findUnique({ where: { id: auth.userId }, select: { username: true } })
    )?.username ?? null
  } catch { /* fall back to 'System' below */ }
  await logAction(action, entity, entityId, details, username ?? 'System', auth.tenantId, auth.branchId ?? undefined)
}

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
