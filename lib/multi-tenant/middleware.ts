import { NextRequest } from 'next/server'
import { prisma } from './prisma'

export interface TenantContext {
  tenantId: string
  tenantSlug: string
  tenantStatus: string
}

/**
 * Resolves the current tenant from subdomain or path prefix.
 * Subdomain:  mystore.domain.com  → slug = "mystore"
 * Path:       /t/mystore/...      → slug = "mystore"
 */
export function resolveTenantSlug(request: NextRequest): string | null {
  const host = request.headers.get('host') ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''

  // Subdomain-based (production): mystore.domain.com
  if (appDomain && host.endsWith(`.${appDomain}`)) {
    const slug = host.replace(`.${appDomain}`, '')
    if (slug && slug !== 'www') return slug
  }

  // Path-based (development): /t/mystore/...
  const pathname = request.nextUrl.pathname
  const match = pathname.match(/^\/t\/([^/]+)/)
  if (match) return match[1]

  return null
}

export async function getTenantFromSlug(slug: string): Promise<TenantContext | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  })
  if (!tenant) return null
  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantStatus: tenant.status,
  }
}

/**
 * Extracts JWT token from Authorization header or auth-token cookie.
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return request.cookies.get('auth-token')?.value ?? null
}
