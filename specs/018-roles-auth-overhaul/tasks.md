# Tasks: إصلاح شامل للأدوار وتسجيل الدخول وعزل البيانات

**Feature Branch**: `018-roles-auth-overhaul`  
**Spec**: [spec.md](./spec.md)  
**Created**: 2026-04-08  
**Completed**: 2026-04-08  
**Total Tasks**: 32 ✅ جميعها مكتملة

---

## Phase 1: Setup

- [x] T001 قراءة وتوثيق جميع أماكن TENANT_ADMIN في الكود
- [x] T002 [P] قراءة prisma/schema.prisma
- [x] T003 [P] قراءة app/(tenant)/settings/page.tsx
- [x] T004 [P] قراءة components/Sidebar.tsx

---

## Phase 2: Foundational

- [x] T005 إنشاء `lib/roles.ts` — ROLES, UserRole, ROLE_LABELS, ROLE_HIERARCHY, canManage()
- [x] T006 تحديث `lib/auth.ts` — دوال جديدة + backward compat لـ TENANT_ADMIN
- [x] T007 تحديث `lib/auth-edge.ts` — نفس التغييرات

---

## Phase 3: US1 — تسجيل الدخول الموحد

- [x] T008 [US1] تحديث `prisma/schema.prisma` — إضافة enum Role، تغيير User.role، email @unique
- [x] T009 [US1] إنشاء migration SQL يدوياً في `prisma/migrations/20260408_add_role_enum_and_email_unique/migration.sql`
- [x] T010 [US1] تحديث `app/api/auth/login/route.ts` — API موحد يقبل email+password، يبحث في SuperAdmin ثم User
- [x] T011 [US1] backward compatibility لـ TENANT_ADMIN في verifyAccessToken (مُدمج في T006)
- [x] T012 [US1] تحديث `app/login/page.tsx` — حذف orgCode، إضافة email، استخدام redirectTo
- [x] T013 [US1] تحديث `middleware.ts` — حذف /super-admin/login من PUBLIC_PATHS، إضافة STOCK_KEEPER + BRANCH_MANAGER routes

---

## Phase 4: US2 — Super Admin من نفس الصفحة

- [x] T014 [US2] تحويل `app/(super-admin)/super-admin/login/page.tsx` إلى redirect لـ /login
- [x] T015 [US2] تحويل `app/api/auth/super-admin/login/route.ts` إلى 410 Gone
- [x] T016 [US2] تحديث `app/(super-admin)/layout.tsx` — logout يوجه لـ /login

---

## Phase 5: US3 — UI الأدوار الخمسة

- [x] T017 [US3] تحديث `app/(tenant)/settings/page.tsx` — استيراد ROLE_LABELS من lib/roles.ts
- [x] T018 [US3] تحديث dropdown الأدوار — إضافة STOCK_KEEPER وBRANCH_MANAGER
- [x] T019 [US3] تحديث `app/api/users/route.ts` — استخدام canManage() من lib/roles.ts
- [x] T020 [US3] تحديث `components/Sidebar.tsx` — استخدام getRoleLabel() وتوسيع شرط BRANCH_MANAGER

---

## Phase 6: US4 — Middleware للأدوار

- [x] T021 [US4] تحديث `middleware.ts` — تعريف CASHIER_ALLOWED, STOCK_KEEPER_ALLOWED, BRANCH_MANAGER_ALLOWED
- [x] T022 [US4] تحديث `middleware.ts` — منطق الرفض/التوجيه لكل دور
- [x] T023 [US4] تحديث `app/api/audit/route.ts` — إزالة TENANT_ADMIN
- [x] T024 [US4] تحديث `app/api/reports/bi/route.ts` — إزالة TENANT_ADMIN

---

## Phase 7: Polish

- [x] T025 [P] تحديث `scripts/create-tenant.ts` — TENANT_ADMIN → ADMIN
- [x] T026 [P] تحديث `scripts/migrate-to-multitenant.ts` — TENANT_ADMIN → ADMIN
- [x] T027 [P] تحديث `scripts/cron/check-expiring-subscriptions.ts` — TENANT_ADMIN → ADMIN
- [x] T028 [P] تحديث `hooks/useUser.ts` — type union + isAdmin
- [x] T029 [P] تحديث `contexts/BranchContext.tsx` — TENANT_ADMIN → ADMIN
- [x] T030 [P] `components/AdminBackButton.tsx` — لم يحتج تعديل (لا يحتوي TENANT_ADMIN كـ role value)
- [x] T031 [P] تحديث `app/api/super-admin/tenants/route.ts` — TENANT_ADMIN → ADMIN
- [x] T032 تحقق نهائي — grep TENANT_ADMIN: 0 نتائج كـ role value ✅

---

## الحالة النهائية

**grep للتحقق النهائي:**
```
المراجع المتبقية لـ TENANT_ADMIN:
- lib/auth.ts, lib/auth-edge.ts: backward compatibility (مقصود)
- scripts/create-tenant.ts: env variable names مثل TENANT_ADMIN_EMAIL (ليست role values)
- scripts/migrate-to-multitenant.ts: شرط تحويل القيم القديمة (مقصود)
```

✅ **صفر مراجع** لـ TENANT_ADMIN كقيمة role في الإنتاج
