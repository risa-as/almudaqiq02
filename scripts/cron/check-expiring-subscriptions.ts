/**
 * Cron Job: check-expiring-subscriptions
 * Run daily via Vercel Cron / GitHub Actions / system cron.
 *
 * Subscription lifecycle:
 *   ACTIVE → (endDate passes) → GRACE (5 days grace period) → SUSPENDED
 *
 * Usage:  npx tsx scripts/cron/check-expiring-subscriptions.ts
 */

import { prisma } from '@/lib/multi-tenant/prisma'
import { createNotification } from '@/lib/notifications/in-app'
import {
  sendSubscriptionExpirySoon,
  sendSubscriptionExpired,
} from '@/lib/notifications/email'

async function main() {
  const now = new Date()

  const in7Days  = new Date(now); in7Days.setDate(in7Days.getDate() + 7);   in7Days.setHours(23, 59, 59, 999)
  const in1Day   = new Date(now); in1Day.setDate(in1Day.getDate() + 1);     in1Day.setHours(23, 59, 59, 999)
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0)
  const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(0, 0, 0, 0)

  const withAdmin = { include: { tenant: { include: { users: { where: { role: 'ADMIN' }, take: 1 } } } } }

  // ── 1. Expiring in 7 days ──────────────────────────────────────────────────
  const expiringSoon7 = await prisma.tenantSubscription.findMany({
    where: { status: 'ACTIVE', endDate: { gte: nextWeek, lte: in7Days } },
    ...withAdmin,
  })

  // ── 2. Expiring in 1 day ───────────────────────────────────────────────────
  const expiringSoon1 = await prisma.tenantSubscription.findMany({
    where: { status: 'ACTIVE', endDate: { gte: tomorrow, lte: in1Day } },
    ...withAdmin,
  })

  // ── 3. Just expired (ACTIVE → GRACE) ──────────────────────────────────────
  const expiredNow = await prisma.tenantSubscription.findMany({
    where: { status: 'ACTIVE', endDate: { lte: now } },
    ...withAdmin,
  })

  // ── 4. Grace period ended (GRACE → SUSPENDED) ─────────────────────────────
  const graceExpired = await prisma.tenantSubscription.findMany({
    where: { status: 'GRACE', gracePeriodEndsAt: { lte: now } },
    ...withAdmin,
  })

  console.log(
    `[cron] 7d warnings: ${expiringSoon7.length} | 1d warnings: ${expiringSoon1.length}` +
    ` | expired→GRACE: ${expiredNow.length} | GRACE→SUSPENDED: ${graceExpired.length}`
  )

  // ── Handle 7-day warnings ──────────────────────────────────────────────────
  for (const sub of expiringSoon7) {
    const admin = sub.tenant.users[0]
    if (!admin) continue
    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY',
      'تنبيه: اشتراكك سينتهي قريبًا',
      `اشتراكك سينتهي خلال 7 أيام (${sub.endDate!.toLocaleDateString('ar-IQ')}). يرجى التجديد لتجنب انقطاع الخدمة.`
    )
    if (admin.email) {
      await sendSubscriptionExpirySoon(admin.email, sub.tenant.name, 7)
        .catch(e => console.error(`Email 7d failed (${sub.tenantId}):`, e))
    }
  }

  // ── Handle 1-day warnings ──────────────────────────────────────────────────
  for (const sub of expiringSoon1) {
    const admin = sub.tenant.users[0]
    if (!admin) continue
    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY',
      'تنبيه عاجل: اشتراكك ينتهي غدًا',
      `اشتراكك ينتهي غدًا (${sub.endDate!.toLocaleDateString('ar-IQ')}). تواصل مع الدعم فورًا.`
    )
    if (admin.email) {
      await sendSubscriptionExpirySoon(admin.email, sub.tenant.name, 1)
        .catch(e => console.error(`Email 1d failed (${sub.tenantId}):`, e))
    }
  }

  // ── Handle expired → GRACE ─────────────────────────────────────────────────
  for (const sub of expiredNow) {
    const graceEnd = new Date(sub.endDate!)
    graceEnd.setDate(graceEnd.getDate() + 5)

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

    const admin = sub.tenant.users[0]
    if (!admin) continue
    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY',
      'انتهى اشتراكك — فترة المهلة نشطة',
      `انتهى اشتراكك. لديك 5 أيام (حتى ${graceEnd.toLocaleDateString('ar-IQ')}) لتجديد الاشتراك. بعدها سيتم تعليق الحساب.`
    )
    if (admin.email) {
      await sendSubscriptionExpired(admin.email, sub.tenant.name)
        .catch(e => console.error(`Email grace failed (${sub.tenantId}):`, e))
    }
  }

  // ── Handle grace expired → SUSPENDED ──────────────────────────────────────
  for (const sub of graceExpired) {
    await prisma.$transaction([
      prisma.tenantSubscription.update({
        where: { id: sub.id },
        data:  { status: 'SUSPENDED' },
      }),
      prisma.tenant.update({
        where: { id: sub.tenantId },
        data:  { status: 'SUSPENDED' },
      }),
    ])

    const admin = sub.tenant.users[0]
    if (!admin) continue
    await createNotification(sub.tenantId, admin.id, 'SUBSCRIPTION_EXPIRY',
      'تم تعليق حسابك',
      'انتهت فترة المهلة وتم تعليق حسابك. بياناتك محفوظة. تواصل مع الدعم الفني لإعادة التفعيل.'
    )
  }

  console.log('[cron] Subscription expiry check completed.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
