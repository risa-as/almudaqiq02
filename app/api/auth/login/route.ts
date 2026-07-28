import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  verifyPassword,
  generateTokenPair,
  generateSuperAdminAccessToken,
  generateSuperAdminRefreshToken,
} from '@/lib/auth'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { logAction } from '@/lib/audit'
import {
  checkSubscriptionAllowed,
  graceEndFor,
  type SubscriptionSnapshot,
} from '@/lib/subscriptions/grace'

export const dynamic = 'force-dynamic'

// Cookies are sent only over HTTPS in the cloud. The Electron desktop serves
// over http://localhost, where Secure cookies would be dropped — so disable it there.
const SECURE_COOKIE = process.env.NODE_ENV === 'production' && process.env.IS_ELECTRON !== '1'

// ── Desktop ↔ Cloud verify helpers ────────────────────────────────────────────
// The desktop no longer holds cloud DB credentials. It verifies users by HTTPS
// against /api/auth/desktop-verify on the cloud, then caches the result in
// local SQLite so subsequent logins work offline (within a grace period).

/** Max time the desktop is allowed to run offline without re-verifying credentials. */
const OFFLINE_GRACE_MS = 30 * 86400_000 // 30 days

interface CloudVerifyData {
  user: { id: string; username: string; email: string | null; role: string; tenantId: string; branchId: string | null }
  tenant: { id: string; name: string; slug: string; status: string; aiDailyLimit?: number }
  branch: { id: string; tenantId: string; name: string; isActive: boolean; activationCode: string | null } | null
  subscription: {
    status: string
    startDate: string | null
    endDate: string | null
    trialEndDate: string | null
    gracePeriodEndsAt: string | null
    planName: string | null
  } | null
}

type CloudVerifyResult =
  | { ok: true; data: CloudVerifyData }
  | { ok: false; reason: 'no_cloud_url' | 'network' | 'invalid_credentials' | 'forbidden' | 'server'; error?: string }

async function tryCloudHttpsVerify(email: string, password: string): Promise<CloudVerifyResult> {
  const cloudUrl = process.env.CLOUD_URL?.replace(/\/$/, '')
  if (!cloudUrl) {
    console.warn('[desktop-login] CLOUD_URL is not set — cannot verify online')
    return { ok: false, reason: 'no_cloud_url' }
  }
  const target = `${cloudUrl}/api/auth/desktop-verify`
  try {
    console.log(`[desktop-login] verifying via ${target}`)
    const res = await fetch(target, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
      signal:  AbortSignal.timeout(15_000),
    })
    console.log(`[desktop-login] verify response status: ${res.status}`)
    if (res.status === 401) return { ok: false, reason: 'invalid_credentials' }
    if (res.status === 403) {
      const d = await res.json().catch(() => ({}))
      return { ok: false, reason: 'forbidden', error: d.error }
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[desktop-login] verify failed: HTTP ${res.status}: ${body.slice(0, 300)}`)
      return { ok: false, reason: 'server' }
    }
    const data = (await res.json()) as CloudVerifyData
    return { ok: true, data }
  } catch (err: any) {
    console.warn(`[desktop-login] verify network error: ${err?.message ?? err}`)
    return { ok: false, reason: 'network' }
  }
}

/**
 * CRITICAL ISOLATION: wipe every byte of the previous tenant's data from the
 * local SQLite DB when a different account logs in. Runs BEFORE we cache the
 * new user/tenant/branch — otherwise products, categories, SyncQueue ops, etc.
 * from the previous organization would leak into the new account's UI.
 *
 * We do NOT touch User / Tenant / Branch records here — those are immediately
 * upserted by cacheCloudVerifyResult below. Platform-wide tables
 * (SubscriptionPlan, SuperAdmin, PlatformPaymentMethod, Announcement) are
 * also left alone since they're not tenant-scoped.
 *
 * Deletion order matters: children before parents for FK constraints.
 */
async function wipePreviousTenantData(newTenantId: string) {
  // Only run inside Electron — cloud Postgres serves all tenants from one DB.
  if (process.env.IS_ELECTRON !== '1') return

  try {
    const existing = await prisma.tenant.findFirst({ select: { id: true } }).catch(() => null)
    // First-time login (no local tenant yet) → nothing to wipe.
    // Same tenant logging in again → leave data alone (would lose unsynced work).
    if (!existing || existing.id === newTenantId) return

    console.log(`[desktop-login] Tenant switch detected: ${existing.id} → ${newTenantId}. Wiping local data.`)

    const order: (keyof typeof prisma)[] = [
      'syncQueue', 'syncMeta',
      'announcementRecipient', 'notification', 'auditLog', 'syncLog', 'licenseLog',
      'paymentRecord', 'tenantSubscription', 'aiUsageLog',
      'transactionItem', 'transaction',
      'stockTransfer', 'cashierShift', 'expense', 'offer', 'storeSettings',
      'productBatch', 'productUnit', 'supplierLedger',
      'product', 'category', 'supplier', 'customer',
      'refreshToken',
    ] as const

    for (const model of order) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any)[model].deleteMany({})
      } catch (err: any) {
        console.warn(`[desktop-login] wipe ${String(model)} failed: ${err?.message}`)
      }
    }

    // Drop the old branch-config.json so sync re-activates against the new branch
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs   = require('fs')   as typeof import('fs')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path') as typeof import('path')
      // electron/main.js passes the real path. It cannot be reconstructed here:
      // userData resolves from app.getName() — the electron-builder productName
      // ("المدقق") — not from the package name, so the old hard-coded
      // 'supermarket-core' guess never matched a packaged install and the stale
      // branch config survived a tenant switch. The guess is kept only as a
      // fallback for dev runs where the app name does resolve that way.
      const candidates: string[] = []
      if (process.env.BRANCH_CONFIG_PATH) candidates.push(process.env.BRANCH_CONFIG_PATH)
      const appDataRoot = process.env.APPDATA
        || (process.env.HOME ? `${process.env.HOME}/.config` : null)
      if (appDataRoot) candidates.push(path.join(appDataRoot, 'supermarket-core', 'branch-config.json'))

      for (const cfg of candidates) {
        if (fs.existsSync(cfg)) fs.unlinkSync(cfg)
      }
    } catch { /* non-critical */ }
  } catch (err: any) {
    console.warn('[desktop-login] wipePreviousTenantData failed:', err?.message)
  }
}

/** Persist a cloud verify result locally: tenant + branch + user (with fresh bcrypt). */
async function cacheCloudVerifyResult(data: CloudVerifyData, plainPassword: string) {
  // Isolation step — must run before upserting the new identity.
  await wipePreviousTenantData(data.tenant.id)

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bcrypt = require('bcrypt') as typeof import('bcrypt')
  const hash = await bcrypt.hash(plainPassword, 10)
  const now  = new Date()

  // Write activation params so electron/main.js can trigger sync without going
  // through the renderer (avoids CORS and IPC timing issues).
  if (process.env.IS_ELECTRON === '1' && data.branch?.activationCode) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs   = require('fs')  as typeof import('fs')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path') as typeof import('path')
      const params = JSON.stringify({
        branchId:       data.branch.id,
        tenantId:       data.tenant.id,
        activationCode: data.branch.activationCode,
        cloudUrl:       process.env.CLOUD_URL ?? '',
      })
      fs.writeFileSync(path.join(process.cwd(), 'activation_params.json'), params, 'utf-8')
    } catch { /* non-critical */ }
  }

  await prisma.tenant.upsert({
    where:  { id: data.tenant.id },
    create: {
      id:                          data.tenant.id,
      name:                        data.tenant.name,
      slug:                        data.tenant.slug || data.tenant.id,
      status:                      data.tenant.status,
      // aiDailyLimit comes from cloud verify response — fall back to Prisma default
      // when the cloud build is older and doesn't include the field.
      ...(data.tenant.aiDailyLimit !== undefined ? { aiDailyLimit: data.tenant.aiDailyLimit } : {}),
      cachedSubscriptionStatus:    data.subscription?.status ?? null,
      cachedSubscriptionEndDate:   data.subscription?.endDate ? new Date(data.subscription.endDate) : null,
      cachedSubscriptionPlanName:  data.subscription?.planName ?? null,
      cachedAt:                    now,
    },
    update: {
      name:                        data.tenant.name,
      status:                      data.tenant.status,
      ...(data.tenant.aiDailyLimit !== undefined ? { aiDailyLimit: data.tenant.aiDailyLimit } : {}),
      cachedSubscriptionStatus:    data.subscription?.status ?? null,
      cachedSubscriptionEndDate:   data.subscription?.endDate ? new Date(data.subscription.endDate) : null,
      cachedSubscriptionPlanName:  data.subscription?.planName ?? null,
      cachedAt:                    now,
    },
  }).catch(() => {})

  if (data.branch) {
    await prisma.branch.upsert({
      where:  { id: data.branch.id },
      create: {
        id:             data.branch.id,
        tenantId:       data.branch.tenantId,
        name:           data.branch.name,
        isActive:       data.branch.isActive,
        activationCode: data.branch.activationCode ?? '',
      },
      update: {
        tenantId:       data.branch.tenantId,
        name:           data.branch.name,
        isActive:       data.branch.isActive,
      },
    }).catch(() => {})
  }

  await prisma.user.upsert({
    where:  { id: data.user.id },
    create: {
      id:                data.user.id,
      tenantId:          data.user.tenantId,
      branchId:          data.user.branchId ?? null,
      username:          data.user.username,
      password:          hash,
      role:              data.user.role,
      email:             data.user.email,
      lastCloudVerifyAt: now,
    },
    update: {
      password:          hash,
      role:              data.user.role,
      email:             data.user.email,
      branchId:          data.user.branchId ?? null,
      lastCloudVerifyAt: now,
    },
  }).catch(() => {})
}

/** Shape the cloud verify payload into what the subscription gate reads. */
function snapshotFromVerify(d: CloudVerifyData): SubscriptionSnapshot {
  return {
    status:                     d.tenant.status,
    cachedSubscriptionStatus:   d.subscription?.status ?? null,
    cachedSubscriptionEndDate:  d.subscription?.endDate ? new Date(d.subscription.endDate) : null,
    cachedSubscriptionPlanName: d.subscription?.planName ?? null,
  }
}

/**
 * 403 body for a blocked subscription.
 *
 * Carries a machine-readable `code` plus the dates, so the login page can render
 * a real expiry screen (plan, end date, grace end, re-check button) instead of a
 * bare line of red text.
 */
function subscriptionBlockedResponse(
  gate: Extract<ReturnType<typeof checkSubscriptionAllowed>, { ok: false }>,
  snapshot: SubscriptionSnapshot,
) {
  const end = snapshot.cachedSubscriptionEndDate ?? null
  return NextResponse.json({
    error:        gate.error,
    code:         gate.code,
    subscription: {
      status:      snapshot.cachedSubscriptionStatus ?? null,
      planName:    snapshot.cachedSubscriptionPlanName ?? null,
      endDate:     end ? end.toISOString() : null,
      graceEndsAt: end ? graceEndFor(end).toISOString() : null,
    },
  }, { status: gate.status })
}

const LoginSchema = z.object({
  email:    z.string().min(1, 'البريد الإلكتروني أو اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
})

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

function redirectTo(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':  return '/super-admin/dashboard'
    case 'CASHIER':      return '/pos'
    case 'STOCK_KEEPER': return '/inventory'
    default:             return '/dashboard'
  }
}

export async function POST(request: NextRequest) {
  // Rate limit by client IP to slow credential stuffing (account lockout handles per-account).
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const rl = await checkRateLimitAsync(`login:${ip}`, { limit: 10, windowMs: 5 * 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'محاولات كثيرة جداً. حاول مرة أخرى بعد قليل.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' }, { status: 400 })
  }
  const { email, password } = parsed.data
  const isEmail = email.includes('@')
  // Mobile clients declare themselves to receive the refresh token in the body (no cookie jar).
  const isMobile = request.headers.get('x-client-type')?.toLowerCase() === 'mobile'

  // ── 1. البحث في SuperAdmin (SQLite) ────────────────────────────────────────
  const superAdmin = await prisma.superAdmin.findFirst({
    where: isEmail ? { email } : { username: email },
  })
  if (superAdmin) {
    if (superAdmin.lockedUntil && superAdmin.lockedUntil > new Date()) {
      const remaining = Math.ceil((superAdmin.lockedUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json({ error: `الحساب مقفل. حاول بعد ${remaining} دقيقة` }, { status: 423 })
    }

    const valid = await verifyPassword(password, superAdmin.password)
    if (!valid) {
      const attempts = superAdmin.failedAttempts + 1
      const locked   = attempts >= MAX_ATTEMPTS
      await prisma.superAdmin.update({
        where: { id: superAdmin.id },
        data:  { failedAttempts: attempts, lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      })
      return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
    }

    await prisma.superAdmin.update({ where: { id: superAdmin.id }, data: { failedAttempts: 0, lockedUntil: null } })

    // Mobile app never receives super-admin tokens — that role works via the web platform only.
    if (isMobile) {
      return NextResponse.json({ error: 'حساب مشغّل المنصة يعمل عبر لوحة الويب فقط' }, { status: 403 })
    }

    const [accessToken, refreshToken] = await Promise.all([
      generateSuperAdminAccessToken(superAdmin.id),
      generateSuperAdminRefreshToken(superAdmin.id),
    ])
    await prisma.refreshToken.create({
      data: { token: refreshToken, superAdminId: superAdmin.id, expiresAt: new Date(Date.now() + 30 * 86400_000) },
    })

    const res = NextResponse.json({
      accessToken,
      user:       { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN' },
      redirectTo: '/super-admin/dashboard',
    })
    res.cookies.set('auth-token',    accessToken,  { httpOnly: true, secure: SECURE_COOKIE, path: '/',                  sameSite: 'lax', maxAge: 28800 })
    res.cookies.set('refresh-token', refreshToken, { httpOnly: true, secure: SECURE_COOKIE, path: '/api/auth/refresh', sameSite: 'lax', maxAge: 30 * 86400 })
    return res
  }

  const IS_DESKTOP = process.env.IS_ELECTRON === '1'

  // ── 2. البحث في User (SQLite or PostgreSQL via the runtime-selected client) ──
  let user = await prisma.user.findFirst({
    where:   isEmail ? { email } : { username: email },
    include: { tenant: { select: { id: true, name: true, status: true } } },
  })

  // ── 3. First-time desktop login — requires the cloud to verify creds + status ─
  if (!user && IS_DESKTOP) {
    const verify = await tryCloudHttpsVerify(email, password)
    if (!verify.ok) {
      if (verify.reason === 'invalid_credentials') {
        return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
      }
      if (verify.reason === 'forbidden') {
        return NextResponse.json({ error: verify.error || 'الحساب غير مفعّل أو معلق' }, { status: 403 })
      }
      return NextResponse.json({
        error: 'تسجيل الدخول الأول يتطلّب اتصالاً بالإنترنت للتحقق من الحساب والاشتراك.',
      }, { status: 503 })
    }
    await cacheCloudVerifyResult(verify.data, password)

    // desktop-verify only rejects SUSPENDED/CANCELLED *tenants* — it does not
    // look at the subscription, so an expired account used to sail through a
    // first-time install. Apply the same gate every other login path uses.
    const firstSnapshot = snapshotFromVerify(verify.data)
    const firstGate     = checkSubscriptionAllowed(firstSnapshot)
    if (!firstGate.ok) return subscriptionBlockedResponse(firstGate, firstSnapshot)

    user = await prisma.user.findFirst({
      where:   { id: verify.data.user.id },
      include: { tenant: { select: { id: true, name: true, status: true } } },
    })
    if (!user) {
      return NextResponse.json({ error: 'تعذّر حفظ بيانات المستخدم محليًا' }, { status: 500 })
    }
    return await issueLocalLoginResponse(user, isMobile)
  }

  if (!user) {
    return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
  }

  // ── فحص حالة الـ tenant ─────────────────────────────────────────────────────
  if (user.tenant.status === 'SUSPENDED') return NextResponse.json({ error: 'الحساب معلق، تواصل مع الدعم' }, { status: 403 })
  if (user.tenant.status === 'CANCELLED') return NextResponse.json({ error: 'الاشتراك ملغى' }, { status: 403 })

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return NextResponse.json({ error: `الحساب مقفل. حاول بعد ${remaining} دقيقة` }, { status: 423 })
  }

  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    const attempts = user.failedAttempts + 1
    const locked   = attempts >= MAX_ATTEMPTS
    await prisma.user.update({
      where: { id: user.id },
      data:  { failedAttempts: attempts, lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    })
    await logAction(
      locked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', 'User', user.id,
      `Failed login attempt ${attempts}/${MAX_ATTEMPTS}`,
      user.username, user.tenantId, user.branchId ?? undefined,
    )
    return NextResponse.json({
      error: locked ? `تم قفل الحساب لمدة ${LOCK_MINUTES} دقيقة` : 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    }, { status: 401 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } })

  let subscriptionNotice: SubscriptionNotice = null

  // ── Desktop: best-effort cloud refresh + subscription enforcement ──────────
  if (IS_DESKTOP) {
    const verify = await tryCloudHttpsVerify(email, password)
    if (verify.ok) {
      await cacheCloudVerifyResult(verify.data, password)
    } else if (verify.reason === 'invalid_credentials' || verify.reason === 'forbidden') {
      return NextResponse.json({ error: verify.error || 'الحساب غير صالح حاليًا' }, { status: 401 })
    }
    // Read the locally-cached tenant + subscription fields (Electron-only columns).
    const cached = await (prisma as any).tenant.findUnique({
      where:  { id: user.tenantId },
      select: {
        status: true,
        cachedSubscriptionStatus: true,
        cachedSubscriptionEndDate: true,
        cachedSubscriptionPlanName: true,
      },
    })
    const snapshot: SubscriptionSnapshot = cached ?? {}
    const sub = checkSubscriptionAllowed(snapshot)
    if (!sub.ok) return subscriptionBlockedResponse(sub, snapshot)
    if (!verify.ok) {
      // Offline / cloud unreachable: enforce 30-day grace period since last verify.
      const last = (user as any).lastCloudVerifyAt as Date | null
      if (!last || (Date.now() - last.getTime() > OFFLINE_GRACE_MS)) {
        return NextResponse.json({
          error: 'انقضت مهلة العمل دون اتصال (30 يومًا). يرجى الاتصال بالإنترنت لتجديد التحقق.',
          code:  'OFFLINE_GRACE_ENDED',
        }, { status: 401 })
      }
    }

    // Inside the cloud's 5-day grace window — let them in, but say so.
    if (sub.inGrace && sub.graceEndsAt) {
      subscriptionNotice = { inGrace: true, graceEndsAt: sub.graceEndsAt.toISOString() }
    }
  }

  return await issueLocalLoginResponse(user, isMobile, subscriptionNotice)
}

/** Non-blocking subscription warning attached to a successful login. */
type SubscriptionNotice = { inGrace: true; graceEndsAt: string } | null

async function issueLocalLoginResponse(user: {
  id: string
  email: string | null
  username?: string | null
  role: string
  tenantId: string
  branchId: string | null
  tenant: { id: string; name: string }
}, isMobile: boolean, subscriptionNotice: SubscriptionNotice = null) {
  await logAction('LOGIN', 'User', user.id, 'Successful login',
    user.username ?? user.email ?? 'System', user.tenantId, user.branchId ?? undefined)
  const { accessToken, refreshToken } = await generateTokenPair({
    sub:      user.id,
    role:     user.role,
    tenantId: user.tenantId,
    branchId: user.branchId ?? undefined,
  })
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 30 * 86400_000) },
  })
  const res = NextResponse.json({
    accessToken,
    // Mobile has no cookie jar — it stores the refresh token itself (SecureStore).
    ...(isMobile ? { refreshToken } : {}),
    user: {
      id: user.id, email: user.email, role: user.role,
      ...(isMobile ? { username: user.username ?? null, branchId: user.branchId } : {}),
    },
    tenant:     { id: user.tenant.id, name: user.tenant.name },
    redirectTo: redirectTo(user.role),
    ...(subscriptionNotice ? { subscriptionNotice } : {}),
  })
  res.cookies.set('auth-token',    accessToken,  { httpOnly: true, secure: SECURE_COOKIE, path: '/',                  sameSite: 'lax', maxAge: 28800 })
  res.cookies.set('refresh-token', refreshToken, { httpOnly: true, secure: SECURE_COOKIE, path: '/api/auth/refresh', sameSite: 'lax', maxAge: 30 * 86400 })
  return res
}
