-- CreateTable
CREATE TABLE "OfflineLicense" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientAddress" TEXT,
    "clientUsername" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "machineId" TEXT,
    "licenseKey" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,

    CONSTRAINT "OfflineLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfflineLicense_clientName_idx" ON "OfflineLicense"("clientName");

-- CreateIndex
CREATE INDEX "OfflineLicense_generatedAt_idx" ON "OfflineLicense"("generatedAt");
