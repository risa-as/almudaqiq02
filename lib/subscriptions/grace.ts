/**
 * Subscription gate — the single rule for "may this account use the app right now?".
 *
 * Deliberately free of Prisma / email / cloud imports so it can run on the
 * desktop (SQLite, offline) and in the cloud alike, in any route.
 *
 * Grace end is *derived* (endDate + GRACE_PERIOD_DAYS) rather than read from a
 * column: the desktop's local SQLite ships prebuilt inside the installer and has
 * no migration path for existing installs, so it cannot gain new columns. The
 * derivation matches the server exactly — lib/subscriptions/lifecycle.ts sets
 * gracePeriodEndsAt to endDate + GRACE_PERIOD_DAYS, and the renew route clears it.
 */

/** Days of grace granted once a subscription's endDate passes. */
export const GRACE_PERIOD_DAYS = 5

export type SubscriptionBlockCode =
  | 'TENANT_SUSPENDED'
  | 'TENANT_CANCELLED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'SUBSCRIPTION_CANCELLED'

export interface SubscriptionSnapshot {
  status?: string | null
  cachedSubscriptionStatus?: string | null
  cachedSubscriptionEndDate?: Date | null
  cachedSubscriptionPlanName?: string | null
}

export type SubscriptionGate =
  | { ok: true;  inGrace: boolean; graceEndsAt: Date | null }
  | { ok: false; code: SubscriptionBlockCode; error: string; status: number }

export function graceEndFor(endDate: Date): Date {
  const end = new Date(endDate)
  end.setDate(end.getDate() + GRACE_PERIOD_DAYS)
  return end
}

/**
 * Decide whether a tenant's (possibly cached) subscription allows use.
 *
 * A subscription whose endDate has passed is NOT blocked immediately: the cloud
 * grants GRACE_PERIOD_DAYS before suspending, and the desktop must not lock the
 * customer out earlier than the cloud's own rules — that used to happen because
 * the check was a bare `endDate < now`, which cancelled the whole grace window.
 */
export function checkSubscriptionAllowed(t: SubscriptionSnapshot, now = new Date()): SubscriptionGate {
  if (t.status === 'SUSPENDED') {
    return { ok: false, code: 'TENANT_SUSPENDED', error: 'الحساب معلق، تواصل مع الدعم', status: 403 }
  }
  if (t.status === 'CANCELLED') {
    return { ok: false, code: 'TENANT_CANCELLED', error: 'الاشتراك ملغى', status: 403 }
  }

  const s = t.cachedSubscriptionStatus

  if (s === 'SUSPENDED') {
    return {
      ok: false, code: 'SUBSCRIPTION_SUSPENDED', status: 403,
      error: 'انتهت فترة المهلة وتم تعليق الحساب. يرجى التجديد ثم إعادة التحقق.',
    }
  }
  if (s === 'CANCELLED') {
    return { ok: false, code: 'SUBSCRIPTION_CANCELLED', error: 'الاشتراك ملغى', status: 403 }
  }

  // The sweep never writes EXPIRED (it goes ACTIVE → GRACE → SUSPENDED), so an
  // EXPIRED row is either legacy data or a deliberate manual state. Either way it
  // means "finished" — it does not earn a fresh grace window off its end date.
  if (s === 'EXPIRED') {
    return {
      ok: false, code: 'SUBSCRIPTION_EXPIRED', status: 403,
      error: 'انتهى الاشتراك. يرجى التجديد ثم إعادة التحقق.',
    }
  }

  const end = t.cachedSubscriptionEndDate ?? null

  if (end && end.getTime() < now.getTime()) {
    const graceEnd = graceEndFor(end)
    if (now.getTime() > graceEnd.getTime()) {
      return {
        ok: false, code: 'SUBSCRIPTION_EXPIRED', status: 403,
        error: 'انتهى الاشتراك. يرجى التجديد ثم إعادة التحقق.',
      }
    }
    // Inside the grace window — allowed, but the caller should warn the user.
    return { ok: true, inGrace: true, graceEndsAt: graceEnd }
  }

  return { ok: true, inGrace: s === 'GRACE', graceEndsAt: end ? graceEndFor(end) : null }
}
