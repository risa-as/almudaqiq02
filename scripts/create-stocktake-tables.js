// Creates the StocktakeSession / StocktakeItem tables with raw DDL
// (prisma db push trips on unrelated index drift in this database).
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StocktakeSession" (
        "id"          TEXT NOT NULL,
        "tenantId"    TEXT NOT NULL,
        "branchId"    TEXT NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'DRAFT',
        "notes"       TEXT,
        "createdBy"   TEXT,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        CONSTRAINT "StocktakeSession_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StocktakeSession_tenantId_branchId_createdAt_idx"
      ON "StocktakeSession"("tenantId", "branchId", "createdAt")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StocktakeItem" (
        "id"          TEXT NOT NULL,
        "sessionId"   TEXT NOT NULL,
        "productId"   TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        "expectedQty" INTEGER NOT NULL,
        "countedQty"  INTEGER,
        "note"        TEXT,
        CONSTRAINT "StocktakeItem_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "StocktakeItem_sessionId_fkey" FOREIGN KEY ("sessionId")
          REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StocktakeItem_sessionId_idx"
      ON "StocktakeItem"("sessionId")
    `)
    console.log('✅ StocktakeSession + StocktakeItem tables ready')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
