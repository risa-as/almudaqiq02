/**
 * Manual runner for the subscription lifecycle sweep.
 *
 * In production this runs on a schedule via /api/cron/check-subscriptions
 * (registered in vercel.json). This script stays for local runs and one-off
 * catch-ups; both call the same code in lib/subscriptions/lifecycle.ts.
 *
 * Usage:  npx tsx scripts/cron/check-expiring-subscriptions.ts
 */

import { prisma } from '@/lib/multi-tenant/prisma'
import { runSubscriptionLifecycleSweep } from '@/lib/subscriptions/lifecycle'

async function main() {
  const result = await runSubscriptionLifecycleSweep()

  console.log(
    `[cron] 7d warnings: ${result.warned7} | 1d warnings: ${result.warned1}` +
    ` | expired→GRACE: ${result.movedToGrace} | trials→GRACE: ${result.trialsEnded}` +
    ` | GRACE→SUSPENDED: ${result.suspended}`
  )
  for (const err of result.emailErrors) console.error(`[cron] email failed — ${err}`)

  console.log('[cron] Subscription expiry check completed.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
