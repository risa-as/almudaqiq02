/**
 * Migration script: single-tenant SQLite → multi-tenant PostgreSQL
 *
 * Usage:
 *   npx ts-node scripts/migrate-to-multitenant.ts \
 *     --tenant-name "اسم المتجر" \
 *     --tenant-slug "my-store" \
 *     --branch-name "الفرع الرئيسي" \
 *     --admin-username "admin" \
 *     --admin-password "new-secure-password"
 *
 * Prerequisites:
 *   - DATABASE_URL (PostgreSQL) must be set in .env
 *   - LOCAL_DATABASE_URL must point to the existing dev.db
 *   - Run `npx prisma migrate deploy` on the PostgreSQL DB first
 */

import { PrismaClient as CloudPrisma } from '@prisma/client'
import Database from 'better-sqlite3'
import * as bcrypt from 'bcrypt'
import * as path from 'path'
import * as fs from 'fs'

const args = process.argv.slice(2)
function getArg(name: string, fallback?: string): string {
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  if (fallback !== undefined) return fallback
  throw new Error(`Missing required argument: --${name}`)
}

async function main() {
  const tenantName   = getArg('tenant-name', 'المتجر الرئيسي')
  const tenantSlug   = getArg('tenant-slug', 'main-store')
  const branchName   = getArg('branch-name', 'الفرع الرئيسي')
  const adminUser    = getArg('admin-username', 'admin')
  const adminPass    = getArg('admin-password', 'admin123')

  const dbPath = process.env.LOCAL_DATABASE_URL?.replace('file:', '') ?? './dev.db'
  const resolvedDb = path.resolve(dbPath)

  if (!fs.existsSync(resolvedDb)) {
    throw new Error(`SQLite database not found at: ${resolvedDb}`)
  }

  console.log(`\n📦 Reading local SQLite: ${resolvedDb}`)
  const sqlite = new Database(resolvedDb, { readonly: true })

  const cloud = new CloudPrisma()

  // ── Create SubscriptionPlan defaults ──────────────────────────────────────
  console.log('\n📋 Creating subscription plans...')
  const basicPlan = await cloud.subscriptionPlan.upsert({
    where: { name: 'Basic' },
    create: { name: 'Basic', maxBranches: 1, monthlyPrice: 0, yearlyPrice: 0 },
    update: {},
  })
  await cloud.subscriptionPlan.upsert({
    where: { name: 'Pro' },
    create: { name: 'Pro', maxBranches: 5, monthlyPrice: 25000, yearlyPrice: 250000 },
    update: {},
  })
  await cloud.subscriptionPlan.upsert({
    where: { name: 'Enterprise' },
    create: { name: 'Enterprise', maxBranches: -1, monthlyPrice: 75000, yearlyPrice: 750000 },
    update: {},
  })

  // ── Create Tenant ──────────────────────────────────────────────────────────
  console.log(`\n🏪 Creating tenant: ${tenantName} (${tenantSlug})`)
  const tenant = await cloud.tenant.create({
    data: {
      name: tenantName,
      slug: tenantSlug,
      status: 'ACTIVE',
      subscription: {
        create: {
          planId: basicPlan.id,
          status: 'ACTIVE',
          startDate: new Date(),
        },
      },
    },
  })

  // ── Create Branch ──────────────────────────────────────────────────────────
  console.log(`\n🏬 Creating branch: ${branchName}`)
  const settings = sqlite.prepare('SELECT * FROM StoreSettings LIMIT 1').get() as any
  const branch = await cloud.branch.create({
    data: {
      tenantId: tenant.id,
      name: branchName,
      address: settings?.storeAddress ?? null,
      phone: settings?.storePhone ?? null,
      storeSettings: {
        create: {
          tenantId: tenant.id,
          storeName: settings?.storeName ?? branchName,
          storeAddress: settings?.storeAddress ?? null,
          storePhone: settings?.storePhone ?? null,
          taxNumber: settings?.taxNumber ?? null,
          footerMessage: settings?.footerMessage ?? null,
          autoPrint: settings?.autoPrint === 1,
        },
      },
    },
  })

  // ── Migrate Users ──────────────────────────────────────────────────────────
  console.log('\n👥 Migrating users...')
  const localUsers = sqlite.prepare('SELECT * FROM User').all() as any[]
  const userIdMap = new Map<number, string>()

  for (const u of localUsers) {
    const hashedPassword = await bcrypt.hash(adminPass, 12)
    const role = u.role === 'SUPER_ADMIN' || u.role === 'TENANT_ADMIN' ? 'ADMIN' : u.role
    const user = await cloud.user.create({
      data: {
        tenantId: tenant.id,
        branchId: role === 'CASHIER' ? branch.id : null,
        username: u.username,
        password: hashedPassword,
        role,
      },
    })
    userIdMap.set(u.id, user.id)
  }
  console.log(`  ✓ ${localUsers.length} users migrated`)

  // ── Migrate Categories ─────────────────────────────────────────────────────
  console.log('\n🗂 Migrating categories...')
  const localCategories = sqlite.prepare('SELECT * FROM Category ORDER BY id').all() as any[]
  const categoryIdMap = new Map<number, string>()

  // First pass: create without parent
  for (const c of localCategories) {
    const cat = await cloud.category.create({
      data: { tenantId: tenant.id, name: c.name, description: c.description },
    })
    categoryIdMap.set(c.id, cat.id)
  }
  // Second pass: set parentId
  for (const c of localCategories) {
    if (c.parentId) {
      await cloud.category.update({
        where: { id: categoryIdMap.get(c.id)! },
        data: { parentId: categoryIdMap.get(c.parentId) },
      })
    }
  }
  console.log(`  ✓ ${localCategories.length} categories migrated`)

  // ── Migrate Suppliers ──────────────────────────────────────────────────────
  console.log('\n🏭 Migrating suppliers...')
  const localSuppliers = sqlite.prepare('SELECT * FROM Supplier').all() as any[]
  const supplierIdMap = new Map<number, string>()

  for (const s of localSuppliers) {
    const sup = await cloud.supplier.create({
      data: {
        tenantId: tenant.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        balance: s.balance,
      },
    })
    supplierIdMap.set(s.id, sup.id)
  }
  console.log(`  ✓ ${localSuppliers.length} suppliers migrated`)

  // ── Migrate Products ───────────────────────────────────────────────────────
  console.log('\n📦 Migrating products...')
  const localProducts = sqlite.prepare('SELECT * FROM Product').all() as any[]
  const productIdMap = new Map<number, string>()

  for (const p of localProducts) {
    const prod = await cloud.product.create({
      data: {
        tenantId: tenant.id,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId ? categoryIdMap.get(p.categoryId) : null,
        supplierId: p.supplierId ? supplierIdMap.get(p.supplierId) : null,
        costPrice: p.costPrice,
      },
    })
    productIdMap.set(p.id, prod.id)
  }
  console.log(`  ✓ ${localProducts.length} products migrated`)

  // ── Migrate Product Units ──────────────────────────────────────────────────
  console.log('\n📏 Migrating product units...')
  const localUnits = sqlite.prepare('SELECT * FROM ProductUnit').all() as any[]
  const unitIdMap = new Map<number, string>()

  for (const u of localUnits) {
    const unit = await cloud.productUnit.create({
      data: {
        productId: productIdMap.get(u.productId)!,
        name: u.name,
        conversionFactor: u.conversionFactor,
        barcode: u.barcode,
        price: u.price,
      },
    })
    unitIdMap.set(u.id, unit.id)
  }
  console.log(`  ✓ ${localUnits.length} product units migrated`)

  // ── Migrate Product Batches (branch stock) ─────────────────────────────────
  console.log('\n📊 Migrating inventory batches...')
  const localBatches = sqlite.prepare('SELECT * FROM ProductBatch').all() as any[]

  for (const b of localBatches) {
    await cloud.productBatch.create({
      data: {
        productId: productIdMap.get(b.productId)!,
        branchId: branch.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
        quantity: b.quantity,
        costPrice: b.costPrice,
        createdAt: new Date(b.createdAt),
      },
    })
  }
  console.log(`  ✓ ${localBatches.length} batches migrated`)

  // ── Migrate Customers ──────────────────────────────────────────────────────
  console.log('\n👤 Migrating customers...')
  const localCustomers = sqlite.prepare('SELECT * FROM Customer').all() as any[]
  const customerIdMap = new Map<number, string>()

  for (const c of localCustomers) {
    const cust = await cloud.customer.create({
      data: {
        tenantId: tenant.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        balance: c.balance,
      },
    })
    customerIdMap.set(c.id, cust.id)
  }
  console.log(`  ✓ ${localCustomers.length} customers migrated`)

  // ── Migrate Transactions ───────────────────────────────────────────────────
  console.log('\n💰 Migrating transactions...')
  const localTxs = sqlite.prepare('SELECT * FROM "Transaction" ORDER BY id').all() as any[]
  const txIdMap = new Map<number, string>()

  for (const t of localTxs) {
    const tx = await cloud.transaction.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        type: t.type,
        totalAmount: t.totalAmount,
        date: new Date(t.date),
        userId: t.userId ? userIdMap.get(t.userId) : null,
        notes: t.notes,
        discount: t.discount,
        paymentMethod: t.paymentMethod,
        paidAmount: t.paidAmount,
      },
    })
    txIdMap.set(t.id, tx.id)
  }
  // Second pass: set originalTxId
  for (const t of localTxs) {
    if (t.originalTxId && txIdMap.has(t.originalTxId)) {
      await cloud.transaction.update({
        where: { id: txIdMap.get(t.id)! },
        data: { originalTxId: txIdMap.get(t.originalTxId) },
      })
    }
  }

  // Migrate transaction items
  const localItems = sqlite.prepare('SELECT * FROM TransactionItem').all() as any[]
  for (const i of localItems) {
    if (!txIdMap.has(i.transactionId)) continue
    await cloud.transactionItem.create({
      data: {
        transactionId: txIdMap.get(i.transactionId)!,
        productId: productIdMap.get(i.productId)!,
        unitId: unitIdMap.get(i.unitId)!,
        quantity: i.quantity,
        price: i.price,
        cost: i.cost,
      },
    })
  }
  console.log(`  ✓ ${localTxs.length} transactions + ${localItems.length} items migrated`)

  // ── Migrate Expenses ───────────────────────────────────────────────────────
  console.log('\n💸 Migrating expenses...')
  const localExpenses = sqlite.prepare('SELECT * FROM Expense').all() as any[]
  for (const e of localExpenses) {
    await cloud.expense.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        description: e.description,
        date: new Date(e.date),
      },
    })
  }
  console.log(`  ✓ ${localExpenses.length} expenses migrated`)

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Migration completed successfully!')
  console.log(`\n📋 Summary:`)
  console.log(`   Tenant ID:  ${tenant.id}`)
  console.log(`   Branch ID:  ${branch.id}`)
  console.log(`   Activation: ${branch.activationCode}`)
  console.log(`\n   Use the activation code in the desktop app to connect to the cloud.`)

  sqlite.close()
  await cloud.$disconnect()
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err.message)
  process.exit(1)
})
