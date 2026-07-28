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
  '/api/auth/desktop-verify',
  '/api/sync/',
  '/api/cron/', // secured internally via CRON_SECRET bearer token

  '/_next',
  '/favicon.ico',
  '/logo.png',
  '/logo.jpg',
  '/logo.ico',
]

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return true
  // Branch activation — called by desktop main process with activationCode, no user JWT
  if (/^\/api\/branches\/[^/]+\/activate$/.test(pathname)) return true
  return false
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

// Pages the stock-keeper can visit
const STOCK_KEEPER_ALLOWED = [
  '/inventory',
  '/purchases/suppliers',
  '/api/inventory',
  '/api/stocktake',
  '/api/products',
  // Needed to pick a category when adding a product — without it the category
  // list 403s and silently renders empty, on the web /inventory/new page too.
  '/api/categories',
  '/api/suppliers',
  '/api/batches',
  '/api/auth',
]

// Sub-paths inside allowed prefixes that stock-keepers must NOT access
const STOCK_KEEPER_BLOCKED = [
  '/purchases/suppliers/smart-buy',
  // Branch transfers are not part of the stock-keeper role: the page was already
  // blocked, and /api/transfers is no longer in the allow-list above either.
  '/transfers',
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
  } catch {
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

  // NOTE: tenant/user context is derived from the verified token inside each
  // route via getAuthContext() — never trust client-supplied x-* headers.
  const response = NextResponse.next()

  // ── Role-based path restrictions ─────────────────────────────────────────

  if (role === 'CASHIER' && !isAllowed(pathname, CASHIER_ALLOWED)) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
      : NextResponse.redirect(new URL('/pos', request.url))
  }

  if (role === 'STOCK_KEEPER') {
    const blocked = STOCK_KEEPER_BLOCKED.some(p => pathname.startsWith(p))
    if (blocked || !isAllowed(pathname, STOCK_KEEPER_ALLOWED)) {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
        : NextResponse.redirect(new URL('/inventory', request.url))
    }
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo\\.png|logo\\.jpg|logo\\.ico).*)'],
}
