import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'

export async function getTenantId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return null
    const payload = await verifyAccessToken(token)
    return payload.tenantId ?? null
  } catch {
    return null
  }
}

export async function getAuthContext(): Promise<{ tenantId: string; userId: string; role: string; branchId?: string } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return null
    const payload = await verifyAccessToken(token)
    if (!payload.tenantId) return null
    return { tenantId: payload.tenantId, userId: payload.sub, role: payload.role, branchId: payload.branchId }
  } catch {
    return null
  }
}

/** Verified super-admin context (no tenant). Returns null for non-super-admin tokens. */
export async function getSuperAdminContext(): Promise<{ superAdminId: string } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return null
    const payload = await verifyAccessToken(token)
    if (payload.role !== 'SUPER_ADMIN') return null
    return { superAdminId: payload.sub }
  } catch {
    return null
  }
}
