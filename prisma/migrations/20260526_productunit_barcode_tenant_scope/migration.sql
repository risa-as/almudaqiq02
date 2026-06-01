-- Scope barcode uniqueness to tenant instead of globally.
-- Before: barcode TEXT UNIQUE (one barcode across all tenants — wrong for multi-tenant).
-- After:  barcode TEXT, UNIQUE(barcode, tenantId) — same barcode allowed in different tenants.

-- 1. Add tenantId column (nullable first so we can backfill)
ALTER TABLE "ProductUnit" ADD COLUMN "tenantId" TEXT;

-- 2. Backfill from parent Product row
UPDATE "ProductUnit" pu
SET "tenantId" = p."tenantId"
FROM "Product" p
WHERE p.id = pu."productId";

-- 3. Make tenantId NOT NULL now that every row has a value
ALTER TABLE "ProductUnit" ALTER COLUMN "tenantId" SET NOT NULL;

-- 4. Drop the old global unique index on barcode
DROP INDEX IF EXISTS "ProductUnit_barcode_key";

-- 5. Add FK to Tenant
ALTER TABLE "ProductUnit"
  ADD CONSTRAINT "ProductUnit_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Add the new compound unique index (NULLs are never equal in PG, so nulls are fine)
CREATE UNIQUE INDEX "ProductUnit_barcode_tenantId_key"
  ON "ProductUnit"("barcode", "tenantId")
  WHERE "barcode" IS NOT NULL;
