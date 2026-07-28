import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRefreshToken, generateAccessToken } from '@/lib/auth'
import { checkSubscriptionAllowed, type SubscriptionSnapshot } from '@/lib/subscriptions/grace'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('refresh-token')?.value
    ?? (await request.json().catch(() => ({}))).refreshToken

  if (!token) return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })

  // Verify signature
  let payload: Awaited<ReturnType<typeof verifyRefreshToken>>
  try {
    payload = await verifyRefreshToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
  }

  // Check not revoked
  const stored = await prisma.refreshToken.findUnique({ where: { token } })
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Refresh token revoked or expired' }, { status: 401 })
  }

  // ── Desktop: the subscription gate must run here too ───────────────────────
  // electron/main.js calls this at every startup (tryAutoLogin) with a 30-day
  // refresh token. Without this check an expired install kept issuing itself
  // fresh access tokens and never returned to the login screen — up to 30 days
  // of use after the subscription ended.
  if (process.env.IS_ELECTRON === '1' && payload.tenantId) {
    const cached = await (prisma as any).tenant.findUnique({
      where:  { id: payload.tenantId },
      select: {
        status: true,
        cachedSubscriptionStatus: true,
        cachedSubscriptionEndDate: true,
        cachedSubscriptionPlanName: true,
      },
    }).catch(() => null)

    if (cached) {
      const gate = checkSubscriptionAllowed(cached as SubscriptionSnapshot)
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status })
      }
    }
  }

  // Issue new access token
  const accessToken = await generateAccessToken({
    sub: payload.sub,
    role: payload.role,
    tenantId: payload.tenantId,
    branchId: payload.branchId,
  })

  const secure = process.env.NODE_ENV === 'production' && process.env.IS_ELECTRON !== '1'
  const res = NextResponse.json({ accessToken })
  res.cookies.set('auth-token', accessToken, { httpOnly: true, secure, path: '/', sameSite: 'lax', maxAge: 3600 })
  return res
}
