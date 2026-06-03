/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SYNC — PULL ENDPOINT  (cloud → desktop)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Role in the sync pipeline:
 *   Desktop sync-worker.js calls this endpoint AFTER push completes.
 *   It returns a full snapshot (first call) or an incremental diff (subsequent
 *   calls) of all data the desktop branch needs, including hard-deletes.
 *
 * Incremental cursor:
 *   The desktop sends ?since=<ISO> on every call except the very first.
 *   The value is the `serverTime` returned by the previous pull response.
 *   We use SERVER time (not client time) to avoid clock-skew gaps.
 *   On first call (no ?since), we fall back to a 90-day history window.
 *
 * What gets returned:
 *   • Catalog    — products, productUnits, categories, suppliers, offers, storeSettings
 *   • Structural — branches (needed for StockTransfer FK resolution)
 *   • Operational— customers, transactions, transactionItems, expenses,
 *                  cashierShifts, stockTransfers, supplierLedgers
 *   • Meta       — auditLogs, notifications
 *   • Deletions  — CloudDeleteLog entries since last pull so desktop can
 *                  hard-delete records that were removed on the cloud/web
 *
 * Connected files:
 *   • electron/sync-worker.js  — calls this endpoint, passes data to applyPull()
 *   • electron/offline-queue.js (applyPull) — applies the returned data + deletions
 *   • lib/sync-delete-log.ts   — writes to CloudDeleteLog whenever cloud deletes
 *   • app/api/sync/push/route.ts — the sibling endpoint (desktop → cloud)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { verifyBranchToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// First pull falls back to this history window when no ?since cursor is present
const HISTORY_DAYS = 90

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // Branches authenticate with a long-lived branch JWT, not a user session.
  // This keeps the sync independent of individual user logins.
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Branch token required' }, { status: 401 })

  let branchPayload: Awaited<ReturnType<typeof verifyBranchToken>>
  try { branchPayload = await verifyBranchToken(token) }
  catch { return NextResponse.json({ error: 'Invalid branch token' }, { status: 401 }) }

  const { branchId, tenantId } = branchPayload

  // Revocation check: token must match the branch's current tokenVersion.
  {
    const branchRow = await prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { tokenVersion: true } })
    if (!branchRow || (branchPayload.tv ?? 0) !== (branchRow.tokenVersion ?? 0)) {
      return NextResponse.json({ error: 'Branch token revoked', code: 'TOKEN_REVOKED' }, { status: 401 })
    }
  }

  // ── Incremental pull cursor ────────────────────────────────────────────────
  // ?since=<ISO> drives incremental sync. Models with updatedAt use it directly.
  // Models without updatedAt (transactions, expenses, shifts) fall back to the
  // historyCutoff date so we don't re-pull unlimited old data on each sync.
  const sinceParam    = request.nextUrl.searchParams.get('since')
  const sinceUpdated  = sinceParam ? { updatedAt: { gt: new Date(sinceParam) } } : {}
  const historyCutoff = new Date(Date.now() - HISTORY_DAYS * 86_400_000)
  const sinceDate     = sinceParam ? new Date(sinceParam) : historyCutoff

  // The server time is returned as the next pull cursor — always uses server clock.
  const serverTime = new Date().toISOString()

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  // Parallel Promise.all keeps the pull fast by avoiding sequential DB round-trips.
  // Query order here doesn't matter (FK ordering is handled in applyPull on desktop).
  const [
    tenantSettings,
    products,
    suppliers,
    offers,
    storeSettings,
    categories,
    productBatches,
    customers,
    transactions,
    expenses,
    cashierShifts,
    branches,
    users,
    stockTransfers,
    auditLogs,
    supplierLedgers,
    notifications,
    subscriptionPlans,    // ← billing: plans (FK target for the subscription)
    subscription,         // ← billing: this tenant's subscription
    payments,             // ← billing: payment history
    paymentMethods,       // ← billing: platform payment methods
    deletions,      // ← records deleted on cloud/web since last pull
  ] = await Promise.all([

    // ── Tenant-level settings (aiDailyLimit + status) ────────────────────────
    // Always fetched so super-admin changes (e.g. AI limit, plan upgrade) reach
    // the desktop without requiring re-login.
    prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { id: true, name: true, status: true, aiDailyLimit: true },
    }),

    // ── Catalog (incremental: updatedAt filter) ──────────────────────────────
    // Products include their units so the desktop gets both in one round-trip.
    prisma.product.findMany({
      where: { tenantId, ...sinceUpdated },
      include: { units: true },
    }),
    prisma.supplier.findMany({ where: { tenantId, ...sinceUpdated } }),
    prisma.offer.findMany({ where: { tenantId, ...sinceUpdated } }),

    // storeSettings: always full fetch (tiny row, no updatedAt, scoped to branch)
    prisma.storeSettings.findFirst({ where: { tenantId, branchId } }),

    // categories: full fetch every time (no updatedAt, small & bounded set)
    prisma.category.findMany({ where: { tenantId } }),

    // productBatches: this branch only (stock is branch-scoped)
    prisma.productBatch.findMany({ where: { tenantId, branchId } }),

    // ── Operational data (this branch, within history window) ────────────────
    prisma.customer.findMany({
      where: { tenantId, ...(sinceParam ? sinceUpdated : {}) },
    }),
    prisma.transaction.findMany({
      where: { tenantId, branchId, date: { gte: sinceDate } },
      include: { items: true },
    }),
    prisma.expense.findMany({
      where: { tenantId, branchId, date: { gte: sinceDate } },
    }),
    prisma.cashierShift.findMany({
      where: { tenantId, branchId, openedAt: { gte: sinceDate } },
    }),

    // ── Structural (all branches — needed for StockTransfer FK resolution) ───
    prisma.branch.findMany({ where: { tenantId } }),

    // ── Users (all tenant users — mirrors the web user-management list) ───────
    // Incremental via updatedAt. We deliberately exclude failedAttempts /
    // lockedUntil because those are device-local security state — syncing them
    // would let one device's lockout clobber another's. password (bcrypt hash)
    // IS included so users can log in offline on the desktop.
    prisma.user.findMany({
      where: { tenantId, ...sinceUpdated },
      select: {
        id: true, tenantId: true, branchId: true, username: true,
        password: true, role: true, email: true,
        createdAt: true, updatedAt: true,
      },
    }),

    // Transfers involving this branch in either direction
    prisma.stockTransfer.findMany({
      where: {
        tenantId,
        OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
        createdAt: { gte: sinceDate },
      },
    }),

    // ── Meta ─────────────────────────────────────────────────────────────────
    prisma.auditLog.findMany({
      where: { tenantId, branchId, createdAt: { gte: sinceDate } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.supplierLedger.findMany({
      where: {
        supplier: { tenantId },
        date: { gte: sinceDate },
      },
    }),
    prisma.notification.findMany({
      where: { tenantId, createdAt: { gte: sinceDate } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),

    // ── Billing (full fetch every pull — tiny, read-only on the tenant side) ──
    // These are managed by the super-admin on the cloud; the desktop only mirrors
    // them so the settings → billing tab matches the web exactly. Plans must be
    // pulled too because the subscription FKs a plan (applyPull upserts plans first).
    prisma.subscriptionPlan.findMany({}),
    prisma.tenantSubscription.findUnique({ where: { tenantId } }),
    prisma.paymentRecord.findMany({
      where: { tenantId },
      orderBy: { paidAt: 'desc' },
      take: 50,
    }),
    prisma.platformPaymentMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),

    // ── Hard-deletes (CloudDeleteLog) ─────────────────────────────────────────
    // Written by lib/sync-delete-log.ts whenever a record is deleted on cloud.
    // The desktop's applyPull() uses this list to hard-delete the same records
    // from local SQLite, keeping both sides consistent.
    // We only return { table, id } — no PII, no large payloads.
    prisma.cloudDeleteLog.findMany({
      where: { tenantId, deletedAt: { gt: sinceDate } },
      select: { table: true, recordId: true },
    }),
  ])

  // ── Flatten product units out of their parent array ───────────────────────
  // Products are fetched with include: { units } for one DB round-trip.
  // We split them here so the desktop receives two flat arrays instead of nested.
  const productUnits = products.flatMap((p: any) => p.units ?? [])

  // ── Sync log ──────────────────────────────────────────────────────────────
  const recordsPulled =
    products.length + productUnits.length + suppliers.length + offers.length +
    categories.length + productBatches.length + customers.length +
    transactions.length + expenses.length + cashierShifts.length +
    branches.length + users.length + stockTransfers.length + auditLogs.length +
    supplierLedgers.length + notifications.length + deletions.length +
    subscriptionPlans.length + payments.length + paymentMethods.length +
    (storeSettings ? 1 : 0) + (subscription ? 1 : 0)

  await prisma.syncLog.create({
    data: { tenantId, branchId, status: 'SUCCESS', completedAt: new Date(), recordsPulled },
  }).catch(() => {})

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    // The desktop uses this as the next ?since cursor. Always server-generated.
    serverTime,

    // Tenant-level settings (applyPull updates the local Tenant row in-place)
    tenantSettings,

    // Catalog
    products:     products.map(({ units: _u, ...p }: any) => p),
    productUnits,
    categories,
    offers,
    storeSettings,
    suppliers,
    productBatches,

    // Structural
    branches,
    users,

    // Operational
    customers,
    transactions:     transactions.map(({ items: _i, ...t }: any) => t),
    transactionItems: transactions.flatMap((t: any) => t.items ?? []),
    expenses,
    cashierShifts,
    stockTransfers,

    // Meta
    auditLogs,
    supplierLedgers,
    notifications,

    // Billing (read-only mirror of cloud — settings → billing tab)
    subscriptionPlans,
    subscription,
    payments,
    paymentMethods,

    // Hard-deletes: [{ table: 'products', id: 'abc123' }, ...]
    // Applied by applyPull() in electron/offline-queue.js
    deletions: deletions.map((d: any) => ({ table: d.table, id: d.recordId })),
  })
}
