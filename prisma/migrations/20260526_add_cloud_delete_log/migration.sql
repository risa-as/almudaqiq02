-- CloudDeleteLog: tracks every hard-delete on cloud so desktop pull can mirror it.
-- Desktop reads entries newer than its pullCursor and deletes the matching local rows.
-- Entries are pruned by the cleanup job after HISTORY_DAYS (90 days by default).

CREATE TABLE "CloudDeleteLog" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "table"     TEXT NOT NULL,
  "recordId"  TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CloudDeleteLog_pkey" PRIMARY KEY ("id")
);

-- Index for incremental pull: WHERE tenantId = ? AND deletedAt > pullCursor
CREATE INDEX "CloudDeleteLog_tenantId_deletedAt_idx"
  ON "CloudDeleteLog"("tenantId", "deletedAt");

-- FK to Tenant
ALTER TABLE "CloudDeleteLog"
  ADD CONSTRAINT "CloudDeleteLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
