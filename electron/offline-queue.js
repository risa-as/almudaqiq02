/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OFFLINE QUEUE  (electron/offline-queue.js)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Role in the sync pipeline:
 *   This class is the local data layer for all sync operations.  It wraps the
 *   local SQLite database (via @prisma/client-local) and provides two core
 *   responsibilities:
 *
 *   1. PUSH QUEUE — enqueue(), getPending(), markSynced(), incrementAttempts()
 *      Every user action on the desktop (create product, record sale, etc.)
 *      calls enqueueSync() in the local Next.js API routes, which ultimately
 *      calls this.enqueue().  sync-worker.js drains the queue by calling
 *      getPending(), posting the operations to /api/sync/push on the cloud,
 *      then calling markSynced() or incrementAttempts() based on the result.
 *
 *   2. PULL APPLY — applyPull(data, tenantId, branchId)
 *      After a successful push, sync-worker.js calls /api/sync/pull to get
 *      the latest cloud data, then passes the response to this method.
 *      applyPull() upserts all records into local SQLite (parents before
 *      children for FK ordering) and applies hard-deletes from CloudDeleteLog
 *      so local data mirrors what was deleted on the web/cloud.
 *
 * Connected files:
 *   • electron/sync-worker.js          — calls all public methods here
 *   • app/api/sync/push/route.ts       — cloud endpoint for push operations
 *   • app/api/sync/pull/route.ts       — cloud endpoint that returns pull data
 *   • lib/sync-delete-log.ts           — writes CloudDeleteLog (cloud side)
 *   • lib/sync-enqueue.ts              — enqueues ops from local API routes
 *   • prisma/schema.local.prisma       — local SQLite schema (SyncQueue, SyncMeta…)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { PrismaClient } = require("@prisma/client-local");

let _prisma = null;

// Singleton Prisma client — reused across all OfflineQueue instances so we
// never open multiple connections to the same SQLite file.
function getPrisma(dbUrl) {
  if (!_prisma) {
    _prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  }
  return _prisma;
}

class OfflineQueue {
  constructor(dbUrl) {
    this.db = getPrisma(dbUrl);
  }

  // ─── Push Queue ─────────────────────────────────────────────────────────────
  // These methods manage the SyncQueue table.  Each unsynced user action is a
  // row; sync-worker drains the table by calling getPending() → push → mark.

  // Add a new operation to the queue.  Called by lib/sync-enqueue.ts after
  // every local create/update/delete.
  async enqueue(tableName, operation, recordId, payload) {
    return this.db.syncQueue.create({
      data: {
        tableName,
        operation,
        recordId: String(recordId),
        payload:
          typeof payload === "string" ? payload : JSON.stringify(payload),
        attempts: 0,
      },
    });
  }

  // Fetch up to `limit` operations that haven't synced yet and haven't
  // permanently failed (attempts < 5).  Ordered oldest-first so the cloud
  // sees operations in the same order they happened locally.
  async getPending(limit = 100) {
    return this.db.syncQueue.findMany({
      where: { syncedAt: null, attempts: { lt: 5 } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  // Mark a batch of operations as successfully synced.
  async markSynced(ids) {
    return this.db.syncQueue.updateMany({
      where: { id: { in: ids } },
      data: { syncedAt: new Date() },
    });
  }

  // Record a failed attempt.  After 5 failures the row is excluded from
  // getPending() — resetFailed() can revive it after a fix is deployed.
  async incrementAttempts(ids, errorMsg) {
    return this.db.syncQueue.updateMany({
      where: { id: { in: ids } },
      data: { attempts: { increment: 1 }, lastError: errorMsg },
    });
  }

  // How many operations are still waiting to sync (for the status indicator).
  async pendingCount() {
    return this.db.syncQueue.count({
      where: { syncedAt: null, attempts: { lt: 5 } },
    });
  }

  // Delete synced operations older than 7 days to keep the queue table small.
  // Called at the end of every successful sync cycle by sync-worker.js.
  async cleanup() {
    const cutoff = new Date(Date.now() - 7 * 86400_000);
    return this.db.syncQueue.deleteMany({
      where: { syncedAt: { lt: cutoff } },
    });
  }

  // Revive permanently-failed operations (attempts ≥ 5) so they get retried.
  // Called once on first online sync after a worker restart.
  async resetFailed() {
    return this.db.syncQueue.updateMany({
      where: { syncedAt: null, attempts: { gte: 5 } },
      data: { attempts: 0, lastError: null },
    });
  }

  // ─── Account Isolation ──────────────────────────────────────────────────────

  // Wipe EVERYTHING when a different branch/tenant logs into this device.
  // Delete in reverse-FK order (children before parents) to satisfy SQLite
  // foreign-key constraints.  Platform-wide tables (SubscriptionPlan, SuperAdmin,
  // PlatformPaymentMethod, Announcement) are intentionally left untouched.
  async wipeAllTenantData() {
    const order = [
      "syncQueue",
      "syncMeta",
      "announcementRecipient",
      "notification",
      "auditLog",
      "syncLog",
      "licenseLog",
      "paymentRecord",
      "tenantSubscription",
      "aiUsageLog",
      "transactionItem",
      "transaction",
      "stockTransfer",
      "cashierShift",
      "expense",
      "offer",
      "storeSettings",
      "productBatch",
      "productUnit",
      "supplierLedger",
      "product",
      "category",
      "supplier",
      "customer",
      "refreshToken",
      "user",
      "branch",
      "tenant",
    ];
    const counts = {};
    for (const model of order) {
      try {
        const r = await this.db[model].deleteMany({});
        if (r.count > 0) counts[model] = r.count;
      } catch (err) {
        console.warn(
          `[OfflineQueue] wipeAllTenantData ${model} failed:`,
          err.message,
        );
      }
    }
    return counts;
  }

  // Wipe only catalog + operational data while keeping tenant/branch/user rows.
  // Used for "reset sync" flows where the user stays logged in — the next pull
  // will restore everything.
  async wipeSyncData() {
    const order = [
      "syncQueue",
      "syncMeta",
      "announcementRecipient",
      "notification",
      "auditLog",
      "syncLog",
      "licenseLog",
      "paymentRecord",
      "tenantSubscription",
      "aiUsageLog",
      "transactionItem",
      "transaction",
      "stockTransfer",
      "cashierShift",
      "expense",
      "offer",
      "storeSettings",
      "productBatch",
      "productUnit",
      "supplierLedger",
      "product",
      "category",
      "supplier",
      "customer",
      // tenant / branch / user / refreshToken are intentionally preserved
    ];
    const counts = {};
    for (const model of order) {
      try {
        const r = await this.db[model].deleteMany({});
        if (r.count > 0) counts[model] = r.count;
      } catch (err) {
        console.warn(
          `[OfflineQueue] wipeSyncData ${model} failed:`,
          err.message,
        );
      }
    }
    return counts;
  }

  // ─── Sync Cursor (SyncMeta) ─────────────────────────────────────────────────
  // SyncMeta stores the last successful pull timestamp.  sync-worker.js reads it
  // on startup to resume incremental pulls instead of re-downloading everything.

  async getMeta() {
    return this.db.syncMeta.findFirst({ orderBy: { id: "desc" } });
  }

  // Persist the server timestamp returned by the last successful pull.
  // This becomes the ?since= cursor for the next pull request.
  async setLastPullAt(date) {
    const meta = await this.getMeta();
    if (meta) {
      return this.db.syncMeta.update({
        where: { id: meta.id },
        data: { lastPullAt: new Date(date) },
      });
    }
    return this.db.syncMeta.create({
      data: {
        branchToken: process.env.BRANCH_TOKEN || "",
        tenantId: process.env.TENANT_ID || "",
        branchId: process.env.BRANCH_ID || "",
        lastPullAt: new Date(date),
      },
    });
  }

  // ─── Apply Pulled Cloud Data ────────────────────────────────────────────────
  //
  // Called by sync-worker.js after every successful pull from /api/sync/pull.
  //
  // Key design decisions:
  //   • tenantId/branchId are remapped to the LOCAL device's ids (cloud and
  //     local ids differ).  Catalog ids (product, category, supplier, …) are
  //     kept as-is so cross-references (e.g. productId on a TransactionItem)
  //     remain valid on both sides.
  //   • Upsert order respects FK constraints: parents are upserted before their
  //     children (branch → category → supplier → product → productUnit → …).
  //   • Hard-deletes from CloudDeleteLog are applied last so we never upsert a
  //     record that should be deleted in the same pull cycle.
  //   • Cascade-deleting tables (e.g. productUnit when product is deleted) don't
  //     need separate CloudDeleteLog entries — SQLite ON DELETE CASCADE handles them.

  async applyPull(data, tenantId, branchId) {
    if (!data) return 0;

    // Resolve local tenant/branch ids.  Callers pass env vars; fall back to
    // the most-recently-created tenant/branch row when env vars are absent
    // (e.g. during testing or first-boot before env is fully set).
    let T = tenantId;
    let B = branchId;
    if (!T || !B) {
      const tenant = await this.db.tenant.findFirst({
        orderBy: { createdAt: "desc" },
      });
      const branch = await this.db.branch.findFirst({
        orderBy: { createdAt: "desc" },
      });
      if (!tenant || !branch) {
        console.warn(
          "[OfflineQueue] applyPull: no local tenant/branch — skipping",
        );
        return 0;
      }
      T = tenant.id;
      B = branch.id;
    }

    // Strip relation objects, Date instances (Prisma handles ISO strings), and
    // the managed @updatedAt column (Prisma sets it automatically on upsert;
    // setting it explicitly causes a "read-only field" error in some drivers).
    const scalars = (rec) => {
      const out = {};
      for (const [k, v] of Object.entries(rec || {})) {
        if (k === "updatedAt") continue;
        if (v === null) {
          out[k] = null;
          continue;
        }
        const t = typeof v;
        if (t === "string" || t === "number" || t === "boolean") out[k] = v;
      }
      return out;
    };

    let count = 0;

    // Helper: upsert a single record, remapping tenantId/branchId via overrides.
    // Silently swallows individual row errors so one bad record doesn't abort
    // the whole pull — the row will be retried on the next pull cycle.
    const upsertById = async (model, rec, overrides) => {
      const base = scalars(rec);
      const id = base.id;
      if (!id) return;
      delete base.id;
      const payload = { ...base, ...overrides };
      try {
        await this.db[model].upsert({
          where: { id },
          create: { id, ...payload },
          update: payload,
        });
        count++;
      } catch (err) {
        console.warn(
          `[OfflineQueue] applyPull ${model} ${id} failed:`,
          err.message,
        );
      }
    };

    // ── Upsert order: parents before children ──────────────────────────────

    // 0. Tenant-level settings (aiDailyLimit, status) — refresh the LOCAL Tenant
    //    row so super-admin changes on cloud (e.g. lowering the AI limit) take
    //    effect on the desktop without requiring a re-login.
    if (data.tenantSettings) {
      try {
        await this.db.tenant.update({
          where: { id: T },
          data: {
            ...(data.tenantSettings.name         !== undefined ? { name:         data.tenantSettings.name } : {}),
            ...(data.tenantSettings.status       !== undefined ? { status:       data.tenantSettings.status } : {}),
            ...(data.tenantSettings.aiDailyLimit !== undefined ? { aiDailyLimit: data.tenantSettings.aiDailyLimit } : {}),
          },
        });
        count++;
      } catch (err) {
        console.warn("[OfflineQueue] applyPull tenantSettings failed:", err.message);
      }
    }

    // 0.5 Billing (read-only mirror of cloud — settings → billing tab).
    //     Plans first: TenantSubscription FKs a SubscriptionPlan. Plans and
    //     payment methods are platform-wide (no tenantId). The subscription and
    //     payments belong to this tenant, so their tenantId is remapped to T.
    for (const plan of data.subscriptionPlans ?? [])
      await upsertById("subscriptionPlan", plan, {});

    if (data.subscription) {
      // tenantId is @unique on TenantSubscription, so upsert by tenantId (not id)
      // to avoid a unique-constraint clash when the cloud row id differs locally.
      const sub = scalars(data.subscription);
      delete sub.id;
      const payload = { ...sub, tenantId: T };
      try {
        await this.db.tenantSubscription.upsert({
          where: { tenantId: T },
          create: payload,
          update: payload,
        });
        count++;
      } catch (err) {
        console.warn("[OfflineQueue] applyPull subscription failed:", err.message);
      }
    }

    for (const pay of data.payments ?? [])
      await upsertById("paymentRecord", pay, { tenantId: T });

    for (const pm of data.paymentMethods ?? [])
      await upsertById("platformPaymentMethod", pm, {});

    // 1. Branches must come first — StockTransfer and SupplierLedger FK them.
    for (const br of data.branches ?? [])
      await upsertById("branch", br, { tenantId: T });

    // 1.5 Users — FK tenant + branch (both upserted above). We remap tenantId to
    //     the local tenant and any non-null branchId to the local branch. We do
    //     NOT touch failedAttempts / lockedUntil / lastCloudVerifyAt: the pull
    //     never returns them, so scalars() omits them and local security state
    //     (offline-login grace, lockout) is preserved across upserts.
    for (const u of data.users ?? [])
      await upsertById("user", u, {
        tenantId: T,
        branchId: u.branchId ? B : null,
      });

    // 2. Catalog parents
    for (const c of data.categories ?? [])
      await upsertById("category", c, { tenantId: T });
    for (const s of data.suppliers ?? [])
      await upsertById("supplier", s, { tenantId: T });

    // 3. Products and their units (unit FKs product)
    for (const p of data.products ?? [])
      await upsertById("product", p, { tenantId: T });
    for (const u of data.productUnits ?? [])
      await upsertById("productUnit", u, {});

    // 4. Catalog children
    for (const o of data.offers ?? [])
      await upsertById("offer", o, {
        tenantId: T,
        branchId: o.branchId ? B : null,
      });
    for (const b of data.productBatches ?? [])
      await upsertById("productBatch", b, { tenantId: T, branchId: B });

    // 5. storeSettings — unique per branch, so upsert by branchId not cloud id.
    //    The cloud may have a different id for the same logical row.
    if (data.storeSettings) {
      const ss = scalars(data.storeSettings);
      delete ss.id;
      const payload = { ...ss, tenantId: T, branchId: B };
      try {
        await this.db.storeSettings.upsert({
          where: { branchId: B },
          create: payload,
          update: payload,
        });
        count++;
      } catch (err) {
        console.warn(
          "[OfflineQueue] applyPull storeSettings failed:",
          err.message,
        );
      }
    }

    // 6. Operational data (customers before transactions — transaction FKs customer)
    for (const cu of data.customers ?? [])
      await upsertById("customer", cu, {
        tenantId: T,
        branchId: cu.branchId ? B : null,
      });

    for (const ex of data.expenses ?? [])
      await upsertById("expense", ex, { tenantId: T, branchId: B });

    for (const sh of data.cashierShifts ?? [])
      await upsertById("cashierShift", sh, {
        tenantId: T,
        branchId: B,
        userId: sh.userId,
      });

    // Transactions: parent row first, then items (items have no updatedAt)
    for (const tx of data.transactions ?? []) {
      await upsertById("transaction", tx, { tenantId: T, branchId: B });
    }
    for (const item of data.transactionItems ?? []) {
      const base = scalars(item);
      const id = base.id;
      if (!id) continue;
      delete base.id;
      try {
        await this.db.transactionItem.upsert({
          where: { id },
          create: { id, ...base },
          update: base,
        });
        count++;
      } catch (err) {
        console.warn(
          `[OfflineQueue] applyPull transactionItem ${id} failed:`,
          err.message,
        );
      }
    }

    // Stock transfers — keep cloud branch IDs (branches upserted in step 1)
    for (const st of data.stockTransfers ?? [])
      await upsertById("stockTransfer", st, { tenantId: T });

    // Audit logs — tenantId/branchId may be null; remap only when present
    for (const al of data.auditLogs ?? [])
      await upsertById("auditLog", al, {
        tenantId: al.tenantId ? T : null,
        branchId: al.branchId ? B : null,
      });

    // Supplier ledger — no tenantId column, branchId is an optional FK
    for (const sl of data.supplierLedgers ?? [])
      await upsertById("supplierLedger", sl, {});

    // Notifications — broadcast to local tenant
    for (const n of data.notifications ?? [])
      await upsertById("notification", n, { tenantId: T });

    // ── Apply hard-deletes from CloudDeleteLog ─────────────────────────────
    // The pull response includes `deletions: [{ table, id }]` for every record
    // deleted on the cloud/web since the last pull.  We apply them here so
    // the local DB stays in sync with the cloud's state.
    //
    // Tables whose children cascade-delete (e.g. productUnit when product is
    // deleted) don't need their own CloudDeleteLog entries — SQLite handles them.
    //
    // We apply deletes AFTER upserts so that any record that was both upserted
    // and deleted in the same pull window ends up deleted (delete wins).
    //
    // Map: pull `table` name → local Prisma model name
    const TABLE_TO_MODEL = {
      products:       "product",
      categories:     "category",
      suppliers:      "supplier",
      customers:      "customer",
      offers:         "offer",
      expenses:       "expense",
      productBatches: "productBatch",
      users:          "user",
    };

    // Some parents have child rows whose foreign key does NOT cascade in the
    // local SQLite schema (e.g. SupplierLedger → Supplier). Deleting the parent
    // directly would throw a FK-constraint error and leave it un-deleted, so we
    // clear those children first — mirroring how the cloud DELETE routes do it.
    const CHILD_CLEANUP = {
      suppliers: async (id) => {
        await this.db.supplierLedger.deleteMany({ where: { supplierId: id } });
      },
      users: async (id) => {
        // RefreshToken → User does not cascade locally; clear it first so the
        // user row can be deleted without hitting a FK constraint.
        await this.db.refreshToken.deleteMany({ where: { userId: id } });
      },
    };

    for (const del of data.deletions ?? []) {
      const model = TABLE_TO_MODEL[del.table];
      if (!model) continue; // unknown table — skip safely
      try {
        const cleanup = CHILD_CLEANUP[del.table];
        if (cleanup) await cleanup(del.id);
        // deleteMany avoids P2025 (record not found) errors — returns { count: 0 }
        // if the row was never pulled or already deleted locally.
        await this.db[model].deleteMany({ where: { id: del.id } });
        count++;
      } catch (err) {
        console.warn(
          `[OfflineQueue] applyPull delete ${del.table} ${del.id} failed:`,
          err.message,
        );
      }
    }

    return count;
  }
}

module.exports = { OfflineQueue };
