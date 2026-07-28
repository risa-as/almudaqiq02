import { NextResponse } from 'next/server'
import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import {
  checkSubscriptionAllowed,
  graceEndFor,
  type SubscriptionSnapshot,
} from '@/lib/subscriptions/grace'

export const dynamic = 'force-dynamic'

const IS_DESKTOP = () => process.env.IS_ELECTRON === '1'

interface SubscriptionView {
  source:        'cloud' | 'desktop'
  status:        string | null
  planName:      string | null
  endDate:       string | null
  graceEndsAt:   string | null
  daysRemaining: number | null
  inGrace:       boolean
  blocked:       boolean
  blockReason:   string | null
  checkedAt:     string | null
  refreshable:   boolean
}

function daysBetween(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

function viewFromSnapshot(
  snapshot: SubscriptionSnapshot,
  source: SubscriptionView['source'],
  checkedAt: Date | null,
  refreshable: boolean,
): SubscriptionView {
  const now  = new Date()
  const gate = checkSubscriptionAllowed(snapshot, now)
  const end  = snapshot.cachedSubscriptionEndDate ?? null

  return {
    source,
    status:        snapshot.cachedSubscriptionStatus ?? null,
    planName:      snapshot.cachedSubscriptionPlanName ?? null,
    endDate:       end ? end.toISOString() : null,
    graceEndsAt:   end ? graceEndFor(end).toISOString() : null,
    daysRemaining: end ? daysBetween(end, now) : null,
    inGrace:       gate.ok ? gate.inGrace : false,
    blocked:       !gate.ok,
    blockReason:   gate.ok ? null : gate.error,
    checkedAt:     checkedAt ? checkedAt.toISOString() : null,
    refreshable,
  }
}

/**
 * Locate the branch token this install syncs with.
 *
 * Both inputs come from electron/main.js, which is the only process that can
 * resolve them: BRANCH_TOKEN directly, and BRANCH_CONFIG_PATH as the absolute
 * path to branch-config.json. The path is never guessed here — userData is
 * derived from app.getName() (the electron-builder productName, "المدقق"), so
 * any path this process reconstructed from the package name would be wrong.
 *
 * Returns null on installs whose main process predates this, which simply
 * hides the refresh button; those users still recover via the login screen's
 * re-check, which re-verifies with their credentials.
 */
function readBranchCredentials(): { token: string; cloudUrl: string } | null {
  const envCloud = (process.env.CLOUD_URL ?? '').replace(/\/$/, '')
  const envToken = process.env.BRANCH_TOKEN
  if (envToken && envCloud) return { token: envToken, cloudUrl: envCloud }

  const cfgPath = process.env.BRANCH_CONFIG_PATH
  if (!cfgPath) return null

  try {
    if (!fs.existsSync(cfgPath)) return null
    const cfg      = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
    const token    = cfg?.branchToken
    const cloudUrl = (cfg?.cloudUrl || envCloud || '').replace(/\/$/, '')
    if (!token || !cloudUrl) return null
    return { token, cloudUrl }
  } catch {
    return null
  }
}

/** Read the cached subscription the desktop enforces its gate against. */
async function readDesktopSnapshot(tenantId: string) {
  const cached = await (prisma as any).tenant.findUnique({
    where:  { id: tenantId },
    select: {
      status: true,
      cachedSubscriptionStatus: true,
      cachedSubscriptionEndDate: true,
      cachedSubscriptionPlanName: true,
      cachedAt: true,
    },
  }).catch(() => null)

  return cached as (SubscriptionSnapshot & { cachedAt?: Date | null }) | null
}

/** Cloud deployments read the live subscription row. */
async function readCloudView(tenantId: string): Promise<SubscriptionView> {
  const [tenant, sub] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } }),
    (prisma as any).tenantSubscription.findUnique({
      where:   { tenantId },
      include: { plan: { select: { name: true } } },
    }).catch(() => null),
  ])

  const snapshot: SubscriptionSnapshot = {
    status:                     tenant?.status ?? null,
    cachedSubscriptionStatus:   sub?.status ?? null,
    cachedSubscriptionEndDate:  sub?.endDate ?? null,
    cachedSubscriptionPlanName: sub?.plan?.name ?? null,
  }
  return viewFromSnapshot(snapshot, 'cloud', new Date(), false)
}

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  if (!IS_DESKTOP()) {
    return NextResponse.json(await readCloudView(auth.tenantId))
  }

  const snapshot = await readDesktopSnapshot(auth.tenantId)
  if (!snapshot) return NextResponse.json({ error: 'تعذّر قراءة حالة الاشتراك' }, { status: 404 })

  return NextResponse.json(
    viewFromSnapshot(snapshot, 'desktop', snapshot.cachedAt ?? null, readBranchCredentials() !== null)
  )
}

/**
 * Force a re-check against the cloud and rewrite the locally cached subscription.
 *
 * This is what Settings → "تحديث الحالة" calls: after the customer renews, they
 * press it and the install picks the new dates up immediately, instead of
 * waiting for the next full login.
 */
export async function POST() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  if (!IS_DESKTOP()) {
    // The cloud reads the live row on every request — nothing to refresh.
    return NextResponse.json(await readCloudView(auth.tenantId))
  }

  const creds = readBranchCredentials()
  if (!creds) {
    return NextResponse.json(
      { error: 'هذا الجهاز غير مرتبط بفرع بعد — سجّل الدخول مرة واحدة عبر الإنترنت أولاً.' },
      { status: 409 },
    )
  }

  let payload: {
    tenant?: { status?: string | null }
    subscription?: { status?: string | null; endDate?: string | null; planName?: string | null } | null
  }
  try {
    const res = await fetch(`${creds.cloudUrl}/api/sync/subscription`, {
      headers: { Authorization: `Bearer ${creds.token}` },
      signal:  AbortSignal.timeout(15_000),
    })
    if (res.status === 401) {
      return NextResponse.json(
        { error: 'انتهت صلاحية ربط هذا الجهاز بالفرع. يرجى تسجيل الدخول مجدداً عبر الإنترنت.' },
        { status: 401 },
      )
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'تعذّر الوصول إلى الخادم. تحقق من الاتصال بالإنترنت.' }, { status: 503 })
    }
    payload = await res.json()
  } catch {
    return NextResponse.json({ error: 'تعذّر الوصول إلى الخادم. تحقق من الاتصال بالإنترنت.' }, { status: 503 })
  }

  const now     = new Date()
  const endDate = payload.subscription?.endDate ? new Date(payload.subscription.endDate) : null

  await (prisma as any).tenant.update({
    where: { id: auth.tenantId },
    data:  {
      ...(payload.tenant?.status ? { status: payload.tenant.status } : {}),
      cachedSubscriptionStatus:   payload.subscription?.status ?? null,
      cachedSubscriptionEndDate:  endDate,
      cachedSubscriptionPlanName: payload.subscription?.planName ?? null,
      cachedAt:                   now,
    },
  }).catch(() => null)

  const snapshot = await readDesktopSnapshot(auth.tenantId)
  if (!snapshot) return NextResponse.json({ error: 'تعذّر قراءة حالة الاشتراك' }, { status: 404 })

  return NextResponse.json(viewFromSnapshot(snapshot, 'desktop', now, true))
}
