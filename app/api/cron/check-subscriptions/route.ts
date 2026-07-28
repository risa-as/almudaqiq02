import { NextRequest, NextResponse } from 'next/server'
import { runSubscriptionLifecycleSweep } from '@/lib/subscriptions/lifecycle'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Subscription lifecycle sweep — invoked by Vercel Cron (see vercel.json).
 *
 * Moves ACTIVE → GRACE once endDate passes, then GRACE → SUSPENDED once the
 * grace window closes, and sends the 7-day / 1-day warnings.
 *
 * Until this route existed the logic lived only in a manual
 * `npx tsx scripts/cron/check-expiring-subscriptions.ts`, so in production no
 * subscription ever changed status on its own and no warning email was sent.
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

  try {
    const result = await runSubscriptionLifecycleSweep()
    console.log(
      `[cron] subscriptions — 7d: ${result.warned7} | 1d: ${result.warned1}` +
      ` | →GRACE: ${result.movedToGrace} | trials→GRACE: ${result.trialsEnded}` +
      ` | →SUSPENDED: ${result.suspended}`
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[cron] subscription sweep failed:', error)
    return NextResponse.json({ error: 'sweep failed' }, { status: 500 })
  }
}
