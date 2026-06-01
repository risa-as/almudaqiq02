-- Downgrade barcode constraint from UNIQUE to a plain index.
-- Same barcode is valid across different branches/products of the same tenant
-- when each branch creates products independently offline.
-- POS lookup uses findFirst (application-level), so uniqueness is not required at DB level.

DROP INDEX IF EXISTS "ProductUnit_barcode_tenantId_key";

CREATE INDEX "ProductUnit_barcode_tenantId_idx"
  ON "ProductUnit"("barcode", "tenantId")
  WHERE "barcode" IS NOT NULL;
