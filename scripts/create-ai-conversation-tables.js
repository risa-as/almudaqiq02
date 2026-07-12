// Creates the AiConversation / AiMessage tables with raw DDL.
// Used instead of `prisma db push` because push trips on unrelated index drift
// in this database (see featureOverrides precedent).
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AiConversation" (
        "id"        TEXT NOT NULL,
        "tenantId"  TEXT NOT NULL,
        "userId"    TEXT NOT NULL,
        "title"     TEXT NOT NULL DEFAULT 'محادثة جديدة',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AiConversation_tenantId_userId_updatedAt_idx"
      ON "AiConversation"("tenantId", "userId", "updatedAt")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AiMessage" (
        "id"             TEXT NOT NULL,
        "conversationId" TEXT NOT NULL,
        "role"           TEXT NOT NULL,
        "content"        TEXT NOT NULL,
        "toolsInvoked"   TEXT,
        "charts"         TEXT,
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId")
          REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AiMessage_conversationId_createdAt_idx"
      ON "AiMessage"("conversationId", "createdAt")
    `)
    console.log('✅ AiConversation + AiMessage tables ready')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
