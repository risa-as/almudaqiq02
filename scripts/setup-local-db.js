/**
 * setup-local-db.js — Initialises the local SQLite database for Electron.
 *
 * Run once before the first `npm run electron`:
 *   node scripts/setup-local-db.js
 *
 * What it does:
 *   1. Generates the local Prisma client (@prisma/client-local) from schema.local.prisma
 *   2. Pushes the local schema to dev.db (creates tables if they don't exist)
 *   3. Seeds a default SuperAdmin and default Tenant if the DB is empty
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const root = path.join(__dirname, '..')

function run(cmd, label) {
  console.log(`\n▶ ${label}`)
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' })
  } catch (err) {
    console.error(`✗ Failed: ${label}`)
    process.exit(1)
  }
  console.log(`✓ Done: ${label}`)
}

// 1. Generate @prisma/client-local
run(
  'npx prisma generate --schema=prisma/schema.local.prisma',
  'Generating local Prisma client (@prisma/client-local)'
)

// 2. Push schema to dev.db (non-destructive)
run(
  'npx prisma db push --schema=prisma/schema.local.prisma --skip-generate',
  'Pushing local schema to dev.db'
)

// 3. Seed default data if DB is fresh
// dev.db lives in prisma/ when LOCAL_DATABASE_URL=file:./dev.db and cwd=prisma/
// but Prisma resolves it relative to the schema file directory
const dbPath = fs.existsSync(path.join(root, 'prisma', 'dev.db'))
  ? path.join(root, 'prisma', 'dev.db')
  : path.join(root, 'dev.db')

if (!fs.existsSync(dbPath)) {
  console.log('\n⚠  dev.db not found after push — skipping seed')
  process.exit(0)
}

console.log('\n▶ Seeding default data (if needed)…')
try {
  const { PrismaClient } = require('@prisma/client-local')
  const db = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  })

  async function seed() {
    // Check if already seeded
    const tenantCount = await db.tenant.count()
    if (tenantCount > 0) {
      console.log('✓ Database already seeded — skipping')
      await db.$disconnect()
      return
    }

    const bcrypt = require('bcrypt')
    // Generate a random initial admin password instead of a known default.
    const crypto = require('crypto')
    const adminPassword = process.env.SEED_ADMIN_PASSWORD
      || crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
    const hash = await bcrypt.hash(adminPassword, 10)

    // Create default tenant
    const tenant = await db.tenant.create({
      data: {
        name: 'المتجر الرئيسي',
        slug: 'main-store',
        status: 'ACTIVE',
      },
    })

    // Create default branch
    const branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'الفرع الرئيسي',
        activationCode: 'LOCAL-BRANCH-001',
        isActive: true,
      },
    })

    // Create default admin user
    await db.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        username: 'admin',
        password: hash,
        role: 'ADMIN',
        email: 'admin@local.app',
      },
    })

    // Create default store settings
    await db.storeSettings.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        storeName: 'المتجر الرئيسي',
      },
    })

    // Create default subscription plan
    const plan = await db.subscriptionPlan.create({
      data: {
        name: 'محلي',
        maxBranches: 0,
        maxUsers: 0,
        monthlyPrice: 0,
        yearlyPrice: 0,
        isActive: true,
      },
    })

    await db.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'ACTIVE',
      },
    })

    await db.$disconnect()

    console.log('✓ Default data seeded:')
    console.log('   Tenant:  المتجر الرئيسي')
    console.log('   Branch:  الفرع الرئيسي')
    console.log(`   Admin:   admin / ${adminPassword}`)
    console.log('   ⚠  Save this password now and change it after first login.')
  }

  seed().catch(err => {
    console.error('Seed failed:', err.message)
    process.exit(1)
  })
} catch (err) {
  console.warn('⚠  Could not seed — bcrypt or prisma not ready:', err.message)
}
