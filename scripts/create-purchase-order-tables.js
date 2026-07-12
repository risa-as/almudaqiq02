// Creates the PurchaseOrder / PurchaseOrderItem tables with raw DDL
// (prisma db push trips on unrelated index drift in this database).
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
        "id"           TEXT NOT NULL,
        "tenantId"     TEXT NOT NULL,
        "branchId"     TEXT NOT NULL,
        "supplierId"   TEXT,
        "supplierName" TEXT,
        "status"       TEXT NOT NULL DEFAULT 'DRAFT',
        "notes"        TEXT,
        "createdBy"    TEXT,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "orderedAt"    TIMESTAMP(3),
        "receivedAt"   TIMESTAMP(3),
        CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_branchId_createdAt_idx"
      ON "PurchaseOrder"("tenantId", "branchId", "createdAt")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
        "id"          TEXT NOT NULL,
        "orderId"     TEXT NOT NULL,
        "productId"   TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        "quantity"    INTEGER NOT NULL,
        "costPrice"   DECIMAL(65,30) NOT NULL DEFAULT 0,
        "receivedQty" INTEGER,
        CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "PurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId")
          REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_orderId_idx"
      ON "PurchaseOrderItem"("orderId")
    `)
    console.log('✅ PurchaseOrder + PurchaseOrderItem tables ready')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
