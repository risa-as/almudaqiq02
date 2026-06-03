import type { PrismaClient } from "@prisma/client";
// Single source of truth for the Prisma client — re-use the one created in
// lib/prisma.ts so the whole process shares ONE connection pool. Creating a
// second client here risked doubling the pool (and exhausting Neon) depending
// on module load order, especially in production.
import { prisma } from "../prisma";

export { prisma };

/**
 * Models that have a tenantId field and should be auto-scoped.
 * Child models (TransactionItem, ProductUnit, SupplierLedger) are accessed
 * through their parent relations and do NOT have tenantId.
 */
const TENANT_SCOPED_MODELS = new Set([
  "tenant",
  "branch",
  "user",
  "tenantSubscription",
  "category",
  "product",
  "productBatch",
  "supplier",
  "customer",
  "transaction",
  "expense",
  "cashierShift",
  "offer",
  "storeSettings",
  "stockTransfer",
  "syncLog",
  "auditLog",
  "notification",
  "announcementRecipient",
]);

function withTenant(model: string, args: any, tenantId: string) {
  if (!TENANT_SCOPED_MODELS.has(model)) return args;
  return { ...args, where: { ...args?.where, tenantId } };
}

function withTenantData(model: string, args: any, tenantId: string) {
  if (!TENANT_SCOPED_MODELS.has(model)) return args;
  if (Array.isArray(args.data)) {
    return { ...args, data: args.data.map((d: any) => ({ ...d, tenantId })) };
  }
  return { ...args, data: { ...args.data, tenantId } };
}

/**
 * Returns a Prisma client that automatically scopes all queries to a tenant.
 *
 * Usage:
 *   const db = getTenantPrisma(tenantId)
 *   const products = await db.product.findMany() // auto-filters by tenantId
 */
export function getTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
        async findFirst({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
        async findUnique({ args, query }: any) {
          return query(args); // findUnique uses unique fields, can't inject freely
        },
        async create({ model, args, query }: any) {
          return query(withTenantData(model, args, tenantId));
        },
        async createMany({ model, args, query }: any) {
          return query(withTenantData(model, args, tenantId));
        },
        async update({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
        async updateMany({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
        async delete({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
        async deleteMany({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
        async count({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
        async aggregate({ model, args, query }: any) {
          return query(withTenant(model, args, tenantId));
        },
      },
    },
  }) as unknown as PrismaClient;
}

/** Models that have both tenantId and branchId */
const BRANCH_SCOPED_MODELS = new Set([
  "branch",
  "user",
  "transaction",
  "expense",
  "cashierShift",
  "productBatch",
  "syncLog",
  "storeSettings",
  "auditLog",
]);

/** Models that have tenantId but NOT branchId (tenant-level) */
const TENANT_ONLY_MODELS = new Set([
  "tenant",
  "tenantSubscription",
  "category",
  "product",
  "supplier",
  "customer",
  "offer",
  "stockTransfer",
  "notification",
  "announcementRecipient",
]);

function withBranch(
  model: string,
  args: any,
  tenantId: string,
  branchId: string,
) {
  if (BRANCH_SCOPED_MODELS.has(model)) {
    return { ...args, where: { ...args?.where, tenantId, branchId } };
  }
  if (TENANT_ONLY_MODELS.has(model)) {
    return { ...args, where: { ...args?.where, tenantId } };
  }
  return args; // child models — no injection
}

function withBranchData(
  model: string,
  args: any,
  tenantId: string,
  branchId: string,
) {
  if (BRANCH_SCOPED_MODELS.has(model)) {
    if (Array.isArray(args.data)) {
      return {
        ...args,
        data: args.data.map((d: any) => ({ ...d, tenantId, branchId })),
      };
    }
    return { ...args, data: { ...args.data, tenantId, branchId } };
  }
  if (TENANT_ONLY_MODELS.has(model)) {
    if (Array.isArray(args.data)) {
      return { ...args, data: args.data.map((d: any) => ({ ...d, tenantId })) };
    }
    return { ...args, data: { ...args.data, tenantId } };
  }
  return args;
}

/**
 * Returns a Prisma client scoped to both tenant and branch.
 */
export function getBranchPrisma(tenantId: string, branchId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
        async findFirst({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
        async findUnique({ args, query }: any) {
          return query(args);
        },
        async create({ model, args, query }: any) {
          return query(withBranchData(model, args, tenantId, branchId));
        },
        async createMany({ model, args, query }: any) {
          return query(withBranchData(model, args, tenantId, branchId));
        },
        async update({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
        async updateMany({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
        async delete({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
        async deleteMany({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
        async count({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
        async aggregate({ model, args, query }: any) {
          return query(withBranch(model, args, tenantId, branchId));
        },
      },
    },
  }) as unknown as PrismaClient;
}
