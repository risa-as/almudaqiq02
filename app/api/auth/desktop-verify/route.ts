/**
 * Desktop verify endpoint.
 *
 * The Electron desktop app calls this over HTTPS at first login (and on every
 * subsequent online login) to:
 *   1) verify credentials against the cloud Postgres,
 *   2) fetch the user's tenant + active subscription status,
 *
 * so it can cache them locally for offline use and enforce subscription expiry.
 *
 * This endpoint NEVER returns the password hash, NEVER issues tokens, and
 * NEVER sets cookies — the desktop signs its own local JWT.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '@/lib/auth'
import { checkRateLimitAsync } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// This is a CLOUD-side endpoint by design — the desktop client calls it over
// HTTPS to verify cloud credentials. It MUST always use the PostgreSQL client
// regardless of IS_ELECTRON, so it works even when the same dev server is
// running in Electron mode (where the default prisma is SQLite).
const globalForCloud = globalThis as unknown as { __cloudPrismaForVerify?: PrismaClient }
const cloudPrisma =
  globalForCloud.__cloudPrismaForVerify
  ?? (globalForCloud.__cloudPrismaForVerify = new PrismaClient({
    log: ['error'],
    datasources: { db: { url: process.env.DATABASE_URL ?? '' } },
  }))

const Schema = z.object({
  email:    z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  // Reject only when DATABASE_URL is a local SQLite file — cloudPrisma uses
  // DATABASE_URL directly (PostgreSQL) regardless of IS_ELECTRON, so the
  // IS_ELECTRON flag alone is not a reason to block (CLOUD_URL may point to
  // the same dev server running in Electron mode).
  if ((process.env.DATABASE_URL ?? '').startsWith('file:')) {
    return NextResponse.json({ error: 'cloud verification not available on desktop server' }, { status: 503 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const rl = await checkRateLimitAsync(`desktop-verify:${ip}`, { limit: 10, windowMs: 5 * 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'محاولات كثيرة جداً. حاول لاحقاً.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const isEmail = email.includes('@')

  const user = await cloudPrisma.user.findFirst({
    where: isEmail ? { email } : { username: email },
    include: {
      tenant: {
        select: {
          id: true, name: true, slug: true, status: true, aiDailyLimit: true,
          subscription: {
            select: {
              status: true, startDate: true, endDate: true,
              trialEndDate: true, gracePeriodEndsAt: true,
              plan: { select: { name: true } },
            },
          },
        },
      },
      branch: { select: { id: true, tenantId: true, name: true, isActive: true, activationCode: true } },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
  }

  // Tenant-level gate (subscription expiry is enforced by the desktop on every login).
  if (user.tenant.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'الحساب معلق، تواصل مع الدعم' }, { status: 403 })
  }
  if (user.tenant.status === 'CANCELLED') {
    return NextResponse.json({ error: 'الاشتراك ملغى' }, { status: 403 })
  }

  return NextResponse.json({
    success: true,
    user: {
      id:       user.id,
      username: user.username,
      email:    user.email,
      role:     user.role,
      tenantId: user.tenantId,
      branchId: user.branchId ?? null,
    },
    tenant: {
      id:           user.tenant.id,
      name:         user.tenant.name,
      slug:         user.tenant.slug,
      status:       user.tenant.status,
      aiDailyLimit: user.tenant.aiDailyLimit,
    },
    branch: user.branch ? {
      id:             user.branch.id,
      tenantId:       user.branch.tenantId,
      name:           user.branch.name,
      isActive:       user.branch.isActive,
      activationCode: user.branch.activationCode,
    } : null,
    subscription: user.tenant.subscription ? {
      status:            user.tenant.subscription.status,
      startDate:         user.tenant.subscription.startDate,
      endDate:           user.tenant.subscription.endDate,
      trialEndDate:      user.tenant.subscription.trialEndDate,
      gracePeriodEndsAt: user.tenant.subscription.gracePeriodEndsAt,
      planName:          user.tenant.subscription.plan?.name ?? null,
    } : null,
    serverTime: new Date().toISOString(),
  })
}
