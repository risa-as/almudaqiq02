-- Pre-launch additions (2026-06-03)
-- Idempotent (IF NOT EXISTS) so it is safe on databases where these columns
-- were already added manually, and on fresh production databases.

-- Per-tenant feature overrides (wins over plan.features). JSON object, nullable.
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "featureOverrides" TEXT;

-- Branch token revocation: bump to invalidate all existing branch tokens.
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Customer credit limit (0 = no limit; blocks credit sales beyond this balance).
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0;
