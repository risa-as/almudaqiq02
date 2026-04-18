/**
 * CLI Script: Create a new tenant manually.
 *
 * Usage:
 *   npx tsx scripts/create-tenant.ts \
 *     --name "Metro Stores" \
 *     --slug "metro" \
 *     --adminEmail "admin@metro.com" \
 *     --adminUsername "metro_admin" \
 *     --adminPassword "Pass@1234" \
 *     --plan "Pro"
 *
 * Or via environment variables:
 *   TENANT_NAME / TENANT_SLUG / TENANT_ADMIN_EMAIL / TENANT_ADMIN_USERNAME / TENANT_ADMIN_PASSWORD / TENANT_PLAN
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

function getArg(flag: string, envVar: string, fallback?: string): string {
  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  if (process.env[envVar]) return process.env[envVar]!
  if (fallback !== undefined) return fallback
  throw new Error(`Missing required argument: ${flag} (or env ${envVar})`)
}

async function main() {
  const name          = getArg('--name',          'TENANT_NAME')
  const slug          = getArg('--slug',          'TENANT_SLUG')
  const adminEmail    = getArg('--adminEmail',    'TENANT_ADMIN_EMAIL')
  const adminUsername = getArg('--adminUsername', 'TENANT_ADMIN_USERNAME', slug + '_admin')
  const adminPassword = getArg('--adminPassword', 'TENANT_ADMIN_PASSWORD', 'Admin@1234')
  const planName      = getArg('--plan',          'TENANT_PLAN',           'Basic')

  // Validate slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens.')
  }

  // Check uniqueness
  const existing = await prisma.tenant.findFirst({ where: { slug } })
  if (existing) throw new Error(`Tenant with slug "${slug}" already exists.`)

  // Find plan
  const plan = await prisma.subscriptionPlan.findFirst({ where: { name: planName } })
  if (!plan) throw new Error(`Subscription plan "${planName}" not found. Run seed-super-admin first.`)

  // Create tenant + admin user + subscription in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name, slug, status: 'ACTIVE' },
    })

    const passwordHash = await bcrypt.hash(adminPassword, 12)
    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        username: adminUsername,
        email:    adminEmail,
        password: passwordHash,
        role:     'ADMIN',
      },
    })

    const trialDays = 14
    const endDate   = new Date()
    endDate.setDate(endDate.getDate() + trialDays)

    const subscription = await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId:   plan.id,
        status:   'TRIAL',
        startDate: new Date(),
        endDate,
      },
    })

    // Create default branch
    const branch = await tx.branch.create({
      data: {
        tenantId:       tenant.id,
        name:           'الفرع الرئيسي',
        activationCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        isActive:       true,
      },
    })

    return { tenant, adminUser, subscription, branch }
  })

  console.log('\n✅ Tenant created successfully!')
  console.log(`   Name:           ${result.tenant.name}`)
  console.log(`   Slug:           ${result.tenant.slug}`)
  console.log(`   URL:            https://${result.tenant.slug}.your-domain.com`)
  console.log(`   Admin:          ${adminUsername} / ${adminEmail}`)
  console.log(`   Password:       ${adminPassword}  ← Change this!`)
  console.log(`   Plan:           ${planName} (14-day trial)`)
  console.log(`   Branch:         الفرع الرئيسي`)
  console.log(`   Activation Code: ${result.branch.activationCode}`)
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
