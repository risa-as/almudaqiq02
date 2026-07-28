/**
 * Subscription lifecycle sweep.
 *
 *   ACTIVE → (endDate passes) → GRACE (5 days) → SUSPENDED
 *
 * Shared by the scheduled route (app/api/cron/check-subscriptions) and the
 * manual script (scripts/cron/check-expiring-subscriptions.ts) so the two can
 * never drift apart.
 *
 * The desktop app reads the resulting status/dates through /api/auth/desktop-verify
 * and caches them locally, so nothing here may be skipped without leaving desktop
 * installs on stale data.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/multi-tenant/prisma'
import { createNotification } from '@/lib/notifications/in-app'
import { GRACE_PERIOD_DAYS, graceEndFor } from '@/lib/subscriptions/grace'

export { GRACE_PERIOD_DAYS }

/**
 * Notifications here are **in-app only**. Email was removed deliberately: the
 * customer is contacted over WhatsApp, outside the system. Each entry below is
 * also a Notification row the tenant's admin sees inside the dashboard.
 */
export interface SubscriptionSweepResult {
  warned7: number
  warned1: number
  movedToGrace: number
  trialsEnded: number
  suspended: number
}

/**
 * True when this tenant already received a notification with the same title
 * today. The sweep is scheduled daily but Vercel may retry a failed run, and
 * warnings are sent on a date *range* — without this a retry re-notifies
 * every tenant in the window.
 */
async function alreadyNotifiedToday(tenantId: string, title: string): Promise<boolean> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const existing = await prisma.notification.findFirst({
    where: {
      tenantId,
      type:      'SUBSCRIPTION_EXPIRY',
      title,
      createdAt: { gte: startOfDay },
    },
    select: { id: true },
  })
  return existing !== null
}

export async function runSubscriptionLifecycleSweep(): Promise<SubscriptionSweepResult> {
  const now = new Date()

  const in7Days  = new Date(now); in7Days.setDate(in7Days.getDate() + 7);   in7Days.setHours(23, 59, 59, 999)
  const in1Day   = new Date(now); in1Day.setDate(in1Day.getDate() + 1);     in1Day.setHours(23, 59, 59, 999)
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0)
  const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(0, 0, 0, 0)

  // `satisfies` keeps the literal types Prisma needs to infer `tenant.users`
  // on the result — a plain const widens `role` to string and drops the relation.
  const adminInclude = {
    tenant: { include: { users: { where: { role: 'ADMIN' }, take: 1 } } },
  } satisfies Prisma.TenantSubscriptionInclude

  const [expiringSoon7, expiringSoon1, expiredNow, trialEnded, graceExpired] = await Promise.all([
    prisma.tenantSubscription.findMany({ where: { status: 'ACTIVE', endDate: { gte: nextWeek, lte: in7Days } }, include: adminInclude }),
    prisma.tenantSubscription.findMany({ where: { status: 'ACTIVE', endDate: { gte: tomorrow, lte: in1Day  } }, include: adminInclude }),
    prisma.tenantSubscription.findMany({ where: { status: 'ACTIVE', endDate: { lte: now } },                    include: adminInclude }),
    // TRIAL tenants carry their expiry in trialEndDate and leave endDate null.
    // Nothing used to match them, so a trial never ended — and the desktop gate,
    // which reasons about endDate, saw "no end date" and let them in forever.
    prisma.tenantSubscription.findMany({ where: { status: 'TRIAL', trialEndDate: { lte: now } },                include: adminInclude }),
    prisma.tenantSubscription.findMany({ where: { status: 'GRACE',  gracePeriodEndsAt: { lte: now } },          include: adminInclude }),
  ])

  const result: SubscriptionSweepResult = {
    warned7: 0, warned1: 0, movedToGrace: 0, trialsEnded: 0, suspended: 0,
  }

  // ── Expiring in 7 days ──────────────────────────────────────────────────────
  for (const sub of expiringSoon7) {
    const admin = sub.tenant.users[0]
    if (!admin) continue
    const title = 'تنبيه: اشتراكك سينتهي قريبًا'
    if (await alreadyNotifiedToday(sub.tenantId, title)) continue

    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY', title,
      `اشتراكك سينتهي خلال 7 أيام (${sub.endDate!.toLocaleDateString('ar-IQ')}). يرجى التجديد لتجنب انقطاع الخدمة.`
    )
    result.warned7++
  }

  // ── Expiring tomorrow ───────────────────────────────────────────────────────
  for (const sub of expiringSoon1) {
    const admin = sub.tenant.users[0]
    if (!admin) continue
    const title = 'تنبيه عاجل: اشتراكك ينتهي غدًا'
    if (await alreadyNotifiedToday(sub.tenantId, title)) continue

    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY', title,
      `اشتراكك ينتهي غدًا (${sub.endDate!.toLocaleDateString('ar-IQ')}). تواصل مع الدعم فورًا.`
    )
    result.warned1++
  }

  // ── Expired → GRACE ─────────────────────────────────────────────────────────
  for (const sub of expiredNow) {
    // Same formula the desktop derives locally — see lib/subscriptions/grace.ts.
    const graceEnd = graceEndFor(sub.endDate!)

    await prisma.$transaction([
      prisma.tenantSubscription.update({
        where: { id: sub.id },
        data:  { status: 'GRACE', gracePeriodEndsAt: graceEnd },
      }),
      prisma.tenant.update({
        where: { id: sub.tenantId },
        data:  { status: 'GRACE' },
      }),
    ])
    result.movedToGrace++

    const admin = sub.tenant.users[0]
    if (!admin) continue
    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY',
      'انتهى اشتراكك — فترة المهلة نشطة',
      `انتهى اشتراكك. لديك ${GRACE_PERIOD_DAYS} أيام (حتى ${graceEnd.toLocaleDateString('ar-IQ')}) لتجديد الاشتراك. بعدها سيتم تعليق الحساب.`
    )
  }

  // ── Trial ended → GRACE ─────────────────────────────────────────────────────
  // endDate is written from trialEndDate here so every consumer downstream — the
  // desktop's derived grace window included — has a single date to reason about.
  for (const sub of trialEnded) {
    const trialEnd = sub.trialEndDate!
    const graceEnd = graceEndFor(trialEnd)

    await prisma.$transaction([
      prisma.tenantSubscription.update({
        where: { id: sub.id },
        data:  { status: 'GRACE', endDate: trialEnd, gracePeriodEndsAt: graceEnd },
      }),
      prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: 'GRACE' } }),
    ])
    result.trialsEnded++

    const admin = sub.tenant.users[0]
    if (!admin) continue
    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY',
      'انتهت الفترة التجريبية — فترة المهلة نشطة',
      `انتهت فترتك التجريبية. لديك ${GRACE_PERIOD_DAYS} أيام (حتى ${graceEnd.toLocaleDateString('ar-IQ')}) للاشتراك. بعدها سيتم تعليق الحساب.`
    )
  }

  // ── Grace ended → SUSPENDED ─────────────────────────────────────────────────
  for (const sub of graceExpired) {
    await prisma.$transaction([
      prisma.tenantSubscription.update({ where: { id: sub.id },       data: { status: 'SUSPENDED' } }),
      prisma.tenant.update({            where: { id: sub.tenantId },  data: { status: 'SUSPENDED' } }),
    ])
    result.suspended++

    const admin = sub.tenant.users[0]
    if (!admin) continue
    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY',
      'تم تعليق حسابك',
      'انتهت فترة المهلة وتم تعليق حسابك. بياناتك محفوظة. تواصل مع الدعم الفني لإعادة التفعيل.'
    )
  }

  return result
}
