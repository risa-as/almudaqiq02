import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAccessToken } from './lib/auth-edge'

/** Resolve tenant slug from subdomain or /t/<slug> path prefix. */
function resolveTenantSlug(request: NextRequest): string | null {
  const host = request.headers.get('host') ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''
  if (appDomain && host.endsWith(`.${appDomain}`)) {
    const slug = host.replace(`.${appDomain}`, '')
    if (slug && slug !== 'www') return slug
  }
  const match = request.nextUrl.pathname.match(/^\/t\/([^/]+)/)
  return match ? match[1] : null
}

// ─── Public paths — no auth required ─────────────────────────────────────────
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/refresh',
  '/_next',
  '/favicon.ico',
  '/logo.png',
  '/activate',
]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

// ─── Super Admin paths ────────────────────────────────────────────────────────
function isSuperAdminPath(pathname: string) {
  return pathname.startsWith('/super-admin') || pathname.startsWith('/api/super-admin')
}

// ─── Role-based allowed paths ─────────────────────────────────────────────────

const CASHIER_ALLOWED = [
  '/pos',
  '/customer-screen',
  '/api/transactions',
  '/api/shifts',
  '/api/products',
  '/api/offers',
  '/api/customers',
  '/api/auth',
]

const STOCK_KEEPER_ALLOWED = [
  '/dashboard/inventory',
  '/dashboard/purchases',
  '/dashboard/suppliers',
  '/dashboard/transfers',
  '/api/inventory',
  '/api/purchases',
  '/api/suppliers',
  '/api/transfers',
  '/api/products',
  '/api/auth',
  '/api/batches',
]

const BRANCH_MANAGER_ALLOWED = [
  '/dashboard',
  '/api/dashboard',
  '/api/reports',
  '/api/expenses',
  '/api/discounts',
  '/api/audit',
  ...CASHIER_ALLOWED,
  ...STOCK_KEEPER_ALLOWED,
]

function isAllowed(pathname: string, allowList: string[]): boolean {
  return allowList.some(p => pathname.startsWith(p))
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // إعادة توجيه /super-admin/login إلى /login الموحدة
  if (pathname === '/super-admin/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Always allow public paths
  if (isPublic(pathname)) return NextResponse.next()

  // ── Extract token ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ??
    request.cookies.get('auth-token')?.value ??
    null

  if (!token) {
    return redirectOrUnauthorized(request, pathname)
  }

  // ── Verify token ─────────────────────────────────────────────────────────
  let payload: Awaited<ReturnType<typeof verifyAccessToken>>
  try {
    payload = await verifyAccessToken(token)
  } catch (err: any) {
    const isDev = process.env.NODE_ENV === 'development'
    const isTransient = err?.code !== 'ERR_JWT_EXPIRED' && err?.code !== 'ERR_JWS_INVALID'
    if (isDev && isTransient && token && token.length > 20) {
      return NextResponse.next()
    }
    return redirectOrUnauthorized(request, pathname)
  }

  const role = payload.role

  // ── Super Admin guard ────────────────────────────────────────────────────
  if (isSuperAdminPath(pathname)) {
    if (role !== 'SUPER_ADMIN') {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        : NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // ── Inject tenant context headers ────────────────────────────────────────
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', payload.tenantId ?? '')
  response.headers.set('x-user-id',   payload.sub)
  response.headers.set('x-user-role', role)
  if (payload.branchId) response.headers.set('x-branch-id', payload.branchId)

  // ── Role-based path restrictions ─────────────────────────────────────────

  if (role === 'CASHIER' && !isAllowed(pathname, CASHIER_ALLOWED)) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
      : NextResponse.redirect(new URL('/pos', request.url))
  }

  if (role === 'STOCK_KEEPER' && !isAllowed(pathname, STOCK_KEEPER_ALLOWED)) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
      : NextResponse.redirect(new URL('/dashboard/inventory', request.url))
  }

  if (role === 'BRANCH_MANAGER' && !isAllowed(pathname, BRANCH_MANAGER_ALLOWED)) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
      : NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

function redirectOrUnauthorized(request: NextRequest, pathname: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
