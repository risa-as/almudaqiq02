-- Migration: إضافة Role enum وتحويل TENANT_ADMIN إلى ADMIN
-- تاريخ: 2026-04-08
-- Branch: 018-roles-auth-overhaul

-- ─── الخطوة 1: تحديث قيم TENANT_ADMIN إلى ADMIN قبل إنشاء الـ enum ────────────
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'TENANT_ADMIN';

-- ─── الخطوة 2: إنشاء enum type ────────────────────────────────────────────────
CREATE TYPE "Role" AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'BRANCH_MANAGER',
  'CASHIER',
  'STOCK_KEEPER'
);

-- ─── الخطوة 3: تحويل عمود role من Text إلى enum ────────────────────────────────
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING "role"::"Role";

-- ─── الخطوة 4: تعيين القيمة الافتراضية للعمود ────────────────────────────────
ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'CASHIER'::"Role";

-- ─── الخطوة 5: إضافة unique constraint على email في User ─────────────────────
-- ملاحظة: NULL values لا تعتبر متساوية في PostgreSQL — يمكن لأكثر من مستخدم أن يكون email = null
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email") WHERE "email" IS NOT NULL;

-- ─── الخطوة 6: إضافة unique constraint على email في SuperAdmin ───────────────
CREATE UNIQUE INDEX IF NOT EXISTS "SuperAdmin_email_key" ON "SuperAdmin"("email") WHERE "email" IS NOT NULL;
