/**
 * Seed Script: Create the first SuperAdmin account and default subscription plans.
 *
 * Usage:
 *   npx tsx scripts/seed-super-admin.ts
 *
 * Environment variables required:
 *   DATABASE_URL
 *   SUPER_ADMIN_EMAIL
 *   SUPER_ADMIN_USERNAME
 *   SUPER_ADMIN_PASSWORD  (min 8 chars)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@saas.com";
  const username = process.env.SUPER_ADMIN_USERNAME ?? "superadmin";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "123456";

  // ── 1. Create SuperAdmin ─────────────────────────────────────────────────
  const existing = await prisma.superAdmin.findFirst({ where: { username } });
  if (existing) {
    console.log(`SuperAdmin "${username}" already exists — skipping creation.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.superAdmin.create({
      data: { email, username, password: passwordHash },
    });
    console.log(`✅ SuperAdmin created: ${username} / ${email}`);
    console.log(`   Password: ${password}  ← Change this immediately!`);
  }

  // ── 2. Seed Default Subscription Plans ──────────────────────────────────
  const plans = [
    {
      name: "Basic",
      monthlyPrice: 20000,
      yearlyPrice: 200000,
      maxBranches: 1,
      maxUsers: 5,
      features: JSON.stringify(["POS", "Inventory", "Reports", "Offline Sync"]),
    },
    {
      name: "Pro",
      monthlyPrice: 30000,
      yearlyPrice: 300000,
      maxBranches: 5,
      maxUsers: 25,
      features: JSON.stringify([
        "POS",
        "Inventory",
        "Reports",
        "Offline Sync",
        "Multi-Branch",
        "Branch Comparison Reports",
        "Stock Transfers",
      ]),
    },
    {
      name: "Enterprise",
      monthlyPrice: 75000,
      yearlyPrice: 750000,
      maxBranches: -1, // -1 = unlimited
      maxUsers: -1, // -1 = unlimited
      features: JSON.stringify([
        "POS",
        "Inventory",
        "Reports",
        "Offline Sync",
        "Multi-Branch",
        "Branch Comparison Reports",
        "Stock Transfers",
        "API Access",
        "Priority Support",
        "Custom Integrations",
      ]),
    },
  ];

  for (const plan of plans) {
    const exists = await prisma.subscriptionPlan.findFirst({
      where: { name: plan.name },
    });
    if (exists) {
      console.log(`Plan "${plan.name}" already exists — skipping.`);
      continue;
    }
    await prisma.subscriptionPlan.create({ data: plan as any });
    console.log(
      `✅ Plan created: ${plan.name} ($${plan.monthlyPrice}/mo, ${plan.maxBranches || "∞"} branches)`,
    );
  }

  console.log("\nSeeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
