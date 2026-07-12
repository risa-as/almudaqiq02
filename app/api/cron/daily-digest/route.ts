import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { buildDailyDigest } from '@/lib/ai/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Daily proactive digest — invoked by Vercel Cron (see vercel.json).
 * For every active tenant: build the rule-based digest, store it as an in-app
 * notification (broadcast), and email tenant admins when Resend is configured.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (Vercel sends it automatically
 * when the CRON_SECRET env var is set).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] } },
    select: { id: true, name: true },
  })

  let notified = 0
  let emailed = 0
  const errors: string[] = []

  for (const tenant of tenants) {
    try {
      const digest = await buildDailyDigest(tenant.id)
      if (digest.insights.length === 0) continue

      // Avoid duplicates if the cron fires twice for the same day.
      const title = `ملخص المتجر الذكي — ${digest.date}`
      const existing = await prisma.notification.findFirst({
        where: { tenantId: tenant.id, type: 'AI_INSIGHT', title },
        select: { id: true },
      })
      if (existing) continue

      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          userId:   null, // broadcast to all tenant users
          type:     'AI_INSIGHT',
          title,
          body:     digest.text,
        },
      })
      notified++

      // Email tenant admins (best-effort; skipped when Resend isn't configured).
      if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        try {
          const admins = await prisma.user.findMany({
            where: { tenantId: tenant.id, role: 'ADMIN', email: { not: null } },
            select: { email: true },
          })
          const to = admins.map(a => a.email!).filter(Boolean)
          if (to.length) {
            const { Resend } = await import('resend')
            const resend = new Resend(process.env.RESEND_API_KEY)
            await resend.emails.send({
              from:    process.env.EMAIL_FROM,
              to,
              subject: `${title} — ${tenant.name}`,
              text:    digest.text,
            })
            emailed++
          }
        } catch (e) {
          errors.push(`email:${tenant.id}: ${e instanceof Error ? e.message : e}`)
        }
      }
    } catch (e) {
      errors.push(`${tenant.id}: ${e instanceof Error ? e.message : e}`)
    }
  }

  return NextResponse.json({
    tenants: tenants.length,
    notified,
    emailed,
    errors: errors.slice(0, 10),
  })
}
