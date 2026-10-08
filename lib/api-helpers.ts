import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth'

/** Token extraction: `Authorization: Bearer` header first (mobile), then the `auth-token` cookie (web). */
async function getRequestToken(): Promise<string | null> {
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization')
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7)
  }
  const cookieStore = await cookies()
  return cookieStore.get('auth-token')?.value ?? null
}

export async function getTenantId(): Promise<string | null> {
  try {
    const token = await getRequestToken()
    if (!token) return null
    const payload = await verifyAccessToken(token)
    return payload.tenantId ?? null
  } catch {
    return null
  }
}

export async function getAuthContext(): Promise<{ tenantId: string; userId: string; role: string; branchId?: string } | null> {
  try {
    const token = await getRequestToken()
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
    const token = await getRequestToken()
    if (!token) return null
    const payload = await verifyAccessToken(token)
    if (payload.role !== 'SUPER_ADMIN') return null
    return { superAdminId: payload.sub }
  } catch {
    return null
  }
}

/**
 * In-route guard for /api/super-admin/*. Middleware already blocks other roles,
 * but routes must not depend on a single layer (a middleware bypass — such as
 * the Next.js advisory fixed in 16.3.8 — would otherwise expose every tenant).
 * Returns a 403 response to send, or null when the caller is a super admin.
 */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const ctx = await getSuperAdminContext()
  return ctx ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
