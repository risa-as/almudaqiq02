# Tasks: منصة SaaS لإدارة المتاجر المتكاملة

**Branch**: `016-saas-multitenant-platform`
**Input**: Design documents from `/specs/016-saas-multitenant-platform/`
**Prerequisites**: spec.md ✅ | plan.md ✅

---

## Phase 0: Setup — هيكل المشروع والبنية التحتية

**Purpose**: تهيئة البنية التحتية الأساسية قبل البدء بأي ميزة

- [x] T001 [P] تثبيت التبعيات الجديدة: `bcrypt`, `@types/bcrypt`, `resend`, `zod` في `package.json`
- [x] T002 [P] إنشاء `prisma/schema.local.prisma` للنسخة المحلية (SQLite) بنفس هيكل الـ cloud مع إضافة حقول المزامنة
- [x] T003 [P] إعداد متغيرات البيئة في `.env.example`: `DATABASE_URL` (PostgreSQL), `SUPER_ADMIN_SECRET`, `JWT_SECRET`, `REFRESH_SECRET`, `RESEND_API_KEY`
- [x] T004 إنشاء هيكل المجلدات الجديد: `app/(super-admin)/`, `app/(tenant)/`, `app/api/super-admin/`, `app/api/sync/`, `lib/sync-engine/`, `lib/multi-tenant/`

---

## Phase 1: Database Schema — تحديث قاعدة البيانات (BLOCKS ALL)

**Purpose**: إضافة multi-tenant + branch support للـ schema

**⚠️ CRITICAL**: لا يمكن البدء بأي مرحلة أخرى قبل اكتمال هذه المرحلة

- [x] T005 تحديث `prisma/schema.prisma` لإضافة جداول: `Tenant`, `Branch`, `SubscriptionPlan`, `TenantSubscription`
  - `Tenant`: id, name, slug, status (TRIAL/ACTIVE/SUSPENDED/CANCELLED), createdAt
  - `Branch`: id, tenantId, name, address, phone, activationCode, isActive
  - `SubscriptionPlan`: id, name, maxBranches (-1 = unlimited), monthlyPrice, yearlyPrice, features (JSON)
  - `TenantSubscription`: id, tenantId, planId, status, startDate, endDate, trialEndDate

- [x] T006 تحديث جميع الجداول الحالية لإضافة `tenantId` و `branchId` (حيث ينطبق):
  - `User`: إضافة `tenantId`, `branchId` (nullable), `role` (SUPER_ADMIN/TENANT_ADMIN/BRANCH_MANAGER/CASHIER)
  - `Product`: إضافة `tenantId` (catalog-level)
  - `ProductUnit`, `ProductBatch`: إضافة `branchId` للمخزون
  - `Transaction`, `TransactionItem`: إضافة `tenantId`, `branchId`
  - `Customer`, `Supplier`: إضافة `tenantId`, `branchId`
  - `Expense`, `CashierShift`, `Offer`: إضافة `tenantId`, `branchId`
  - `StoreSettings`: إضافة `tenantId`, `branchId`

- [x] T007 إضافة جداول جديدة لنظام المزامنة والنقل:
  - `SyncQueue`: id, branchId, operation (INSERT/UPDATE/DELETE), tableName, recordId, payload (JSON), createdAt, syncedAt
  - `SyncLog`: id, branchId, startedAt, completedAt, status, recordsPushed, recordsPulled, conflicts (JSON)
  - `StockTransfer`: id, tenantId, fromBranchId, toBranchId, items (JSON), status (PENDING/APPROVED/COMPLETED/CANCELLED), requestedBy, approvedBy, createdAt

- [x] T008 إضافة جداول الإشعارات والتدقيق المطورة:
  - `Notification`: id, tenantId, userId (nullable), type, title, body, isRead, createdAt
  - تحديث `AuditLog`: إضافة `tenantId`, `branchId`

- [x] T009 كتابة migration script (`scripts/migrate-to-multitenant.ts`) لنقل بيانات `dev.db` الحالية للمستأجر الأول في PostgreSQL
  - إنشاء Tenant افتراضي مع slug: `default`
  - إنشاء Branch واحد مرتبط بجميع البيانات الحالية
  - نقل جميع Records مع تعيين `tenantId` و `branchId`

**Checkpoint**: Schema جاهز — يمكن البدء بالمراحل التالية بالتوازي

---

## Phase 2: Authentication Upgrade — ترقية نظام المصادقة (P1)

**Goal**: ترقية نظام المصادقة من SHA-256/cookies إلى bcrypt/JWT مع دعم multi-tenant

**Independent Test**: تسجيل الدخول بمستخدم، استلام JWT, استخدامه في API call محمية، تجديده بـ Refresh Token

### US6 - تسجيل الدخول وعزل البيانات

- [x] T010 [P] إنشاء `lib/auth.ts` جديد:
  - دالة `hashPassword(plain: string)` باستخدام bcrypt (rounds: 12)
  - دالة `verifyPassword(plain, hash)`
  - دالة `generateTokens(userId, tenantId, role)` → `{ accessToken, refreshToken }`
  - دالة `verifyAccessToken(token)` → payload أو throw
  - دالة `verifyRefreshToken(token)` → payload أو throw

- [x] T011 [P] إنشاء `lib/multi-tenant/prisma.ts`:
  - Prisma client مع middleware يُضيف `WHERE tenantId = ctx.tenantId` تلقائيًا لكل query
  - دالة `getTenantPrisma(tenantId: string)` → Prisma client مُقيَّد بالمستأجر

- [x] T012 إنشاء `lib/multi-tenant/middleware.ts`:
  - دالة `resolveTenant(request)` → تستخرج tenant slug من subdomain أو path
  - دالة `getTenantFromSlug(slug)` → بيانات المستأجر أو null

- [x] T013 تحديث `middleware.ts` الرئيسي:
  - إضافة منطق: استخراج JWT من `Authorization` header أو `auth-token` cookie
  - تحقق من صحة المستأجر وربطه بالطلب
  - تحقق من الصلاحيات (RBAC) بناءً على الدور والمسار
  - حماية مسارات Super Admin بـ `SUPER_ADMIN` role فقط

- [x] T014 تحديث `app/api/auth/login/route.ts`:
  - قبول `{ username, password, tenantSlug }`
  - التحقق من وجود المستأجر وحالته (ليس SUSPENDED/CANCELLED)
  - استخدام bcrypt للتحقق من كلمة المرور
  - منطق قفل الحساب بعد 5 محاولات فاشلة (حقل `failedAttempts` + `lockedUntil` في User)
  - إرجاع `{ accessToken, refreshToken, user, tenant }`

- [x] T015 إنشاء `app/api/auth/refresh/route.ts`:
  - قبول `{ refreshToken }`
  - التحقق من صحة الـ refresh token
  - إصدار access token جديد

- [x] T016 إنشاء `app/api/auth/logout/route.ts`:
  - إبطال الـ refresh token (حفظ قائمة المُبطَلة أو حذف من قاعدة البيانات)

- [x] T017 إنشاء `app/api/auth/super-admin/login/route.ts`:
  - تسجيل دخول مستقل للـ Super Admin (بدون tenantSlug)
  - تحقق من `role === 'SUPER_ADMIN'`

- [x] T018 سكريبت `scripts/upgrade-passwords.ts`:
  - قراءة جميع المستخدمين الحاليين
  - إعادة hash كلمات المرور بـ bcrypt (الحالية SHA-256 → bcrypt)

**Checkpoint**: نظام المصادقة الجديد يعمل — يمكن الاستمرار

---

## Phase 3: Super Admin Interface — واجهة مدير المنصة (P1)

**Goal**: لوحة تحكم كاملة للـ Super Admin لإدارة المنصة بأكملها

**Independent Test**: تسجيل دخول Super Admin، رؤية قائمة المستأجرين، إنشاء مستأجر جديد، تعليقه، رؤية الإحصائيات

### US1 - Super Admin يدير المنصة

#### API Routes

- [x] T019 [P] إنشاء `app/api/super-admin/stats/route.ts` (GET):
  - إجمالي المستأجرين (نشط/تجربة/معلق/ملغى)
  - إجمالي الفروع النشطة
  - المستأجرون الجدد هذا الشهر
  - اشتراكات تنتهي خلال 30 يوم

- [x] T020 [P] إنشاء `app/api/super-admin/tenants/route.ts` (GET/POST):
  - GET: قائمة المستأجرين مع pagination وبحث وفلترة بالحالة
  - POST: إنشاء مستأجر جديد مع: name, slug, plan, adminEmail, adminPassword, trialDays

- [x] T021 [P] إنشاء `app/api/super-admin/tenants/[id]/route.ts` (GET/PUT/DELETE):
  - GET: تفاصيل مستأجر مع إحصائياته
  - PUT: تعديل: name, status (ACTIVE/SUSPENDED/CANCELLED), planId, endDate
  - DELETE: أرشفة المستأجر (soft delete)

- [x] T022 [P] إنشاء `app/api/super-admin/plans/route.ts` (GET/POST) + `[id]/route.ts` (PUT/DELETE):
  - CRUD كامل لخطط الاشتراك

- [x] T023 [P] إنشاء `app/api/super-admin/monitoring/route.ts` (GET):
  - عدد المزامنات النشطة
  - آخر 50 خطأ في النظام
  - حالة قاعدة البيانات (response time)

- [x] T024 [P] إنشاء `app/api/super-admin/announcements/route.ts` (GET/POST):
  - إنشاء إعلانات للمستأجرين (كل المستأجرين أو مستأجر محدد)

#### UI Pages

- [x] T025 إنشاء `app/(super-admin)/layout.tsx`:
  - Sidebar للـ Super Admin: Dashboard, Tenants, Plans, Monitoring, Announcements
  - Header مع اسم المستخدم + logout
  - تحقق من role === SUPER_ADMIN

- [x] T026 [P] إنشاء `app/(super-admin)/dashboard/page.tsx`:
  - بطاقات إحصائيات: المستأجرون النشطون، في فترة التجربة، الاشتراكات المنتهية قريبًا
  - رسم بياني: نمو المستأجرين الجدد (آخر 12 شهر)
  - قائمة: اشتراكات تنتهي خلال 7 أيام

- [x] T027 [P] إنشاء `app/(super-admin)/tenants/page.tsx`:
  - جدول المستأجرين مع: الاسم، الـ Slug، الخطة، الحالة، عدد الفروع، تاريخ الإنشاء، إجراءات
  - بحث وفلترة بالحالة
  - زر "إضافة مستأجر" → Modal/Drawer

- [x] T028 [P] إنشاء `app/(super-admin)/tenants/[id]/page.tsx`:
  - تفاصيل المستأجر: الاسم، الخطة، الفروع، المستخدمون، إحصائيات الاستخدام
  - أزرار: تعليق/تفعيل/إلغاء الاشتراك، تعديل الخطة

- [x] T029 [P] إنشاء `app/(super-admin)/plans/page.tsx`:
  - جدول الخطط مع: الاسم، السعر، حد الفروع، عدد المستأجرين المشتركين
  - CRUD للخطط

- [x] T030 [P] إنشاء `app/(super-admin)/monitoring/page.tsx`:
  - مؤشرات صحة النظام
  - جدول آخر الأخطاء مع filter بالنوع والتاريخ

- [x] T031 إنشاء `app/super-admin/login/page.tsx`:
  - صفحة تسجيل دخول منفصلة للـ Super Admin

**Checkpoint**: Super Admin Interface يعمل بالكامل ✅

---

## Phase 4: Tenant & Branch Management — إدارة المستأجرين والفروع (P1)

**Goal**: Tenant Admin يدير فروعه ومستخدميه والكتالوج المركزي

**Independent Test**: Tenant Admin ينشئ فرعًا، يضيف منتجًا للكتالوج، يسند موظفًا للفرع، يرى التقارير

### US2 - مالك السلسلة يدير فروعه

#### API Routes

- [x] T03X [P] إنشاء `app/api/branches/route.ts` (GET/POST):
  - GET: قائمة فروع المستأجر الحالي
  - POST: إنشاء فرع جديد (مع التحقق من حد الخطة)، توليد `activationCode` عشوائي

- [x] T03X [P] إنشاء `app/api/branches/[id]/route.ts` (GET/PUT/DELETE):
  - GET: تفاصيل الفرع مع إحصائيات المخزون والمبيعات
  - PUT: تعديل: name, address, phone, settings
  - DELETE: أرشفة الفرع (soft delete) - يُرفض إن كان له مبيعات

- [x] T03X [P] إنشاء `app/api/branches/[id]/activate/route.ts` (POST):
  - التحقق من `activationCode` وربط الجهاز بالفرع
  - إرجاع `branchToken` للتطبيق المكتبي

- [x] T03X [P] تحديث `app/api/products/route.ts`:
  - المنتجات الآن على مستوى Tenant (كتالوج مشترك)
  - إضافة filter بـ `tenantId` في جميع queries

- [x] T03X [P] إنشاء `app/api/inventory/branch/route.ts` (GET/POST):
  - GET: مخزون منتج محدد في فرع محدد
  - POST: تحديث مخزون الفرع

- [x] T03X [P] إنشاء `app/api/transfers/route.ts` (GET/POST):
  - GET: قائمة طلبات نقل المخزون للمستأجر الحالي
  - POST: إنشاء طلب نقل جديد من فرع لآخر

- [x] T03X [P] إنشاء `app/api/transfers/[id]/route.ts` (GET/PUT):
  - GET: تفاصيل طلب النقل
  - PUT: تغيير الحالة (APPROVED/COMPLETED/CANCELLED) مع خصم/إضافة المخزون

- [x] T03X [P] تحديث `app/api/users/route.ts` (GET/POST):
  - إدارة مستخدمي المستأجر مع تحديد الفرع والدور

#### UI Pages

- [x] T040 إنشاء `app/(tenant)/[tenant]/layout.tsx`:
  - Sidebar المستأجر: Dashboard, Branches, Catalog, Sales, Purchases, Reports, Settings
  - بيانات المستأجر والخطة في الـ header

- [x] T041 [P] إنشاء `app/(tenant)/[tenant]/branches/page.tsx`:
  - بطاقات الفروع مع: الاسم، الحالة، آخر مزامنة، إجمالي المبيعات اليوم
  - زر "إضافة فرع" مع عرض رمز التفعيل

- [x] T042 [P] إنشاء `app/(tenant)/[tenant]/branches/[branchId]/page.tsx`:
  - تفاصيل الفرع: المستخدمون المنسوبون، المخزون، إحصائيات المبيعات
  - إعدادات الفرع

- [x] T043 [P] إنشاء `app/(tenant)/[tenant]/inventory/page.tsx` (الكتالوج المركزي):
  - إدارة كتالوج المنتجات على مستوى المستأجر
  - عرض مخزون كل فرع لكل منتج جنبًا إلى جنب

- [x] T044 [P] إنشاء `app/(tenant)/[tenant]/transfers/page.tsx`:
  - قائمة طلبات نقل المخزون بين الفروع
  - موافقة/رفض الطلبات
  - إنشاء طلب نقل جديد

- [x] T045 [P] إنشاء `app/(tenant)/[tenant]/subscription/page.tsx`:
  - تفاصيل الاشتراك الحالي: الخطة، الفروع المستخدمة/المتاحة، تاريخ التجديد
  - تاريخ الدفعات

**Checkpoint**: إدارة المستأجرين والفروع تعمل بالكامل ✅

---

## Phase 5: Sync Engine — محرك المزامنة (P1)

**Goal**: مزامنة ثنائية الاتجاه بين التطبيق المكتبي والسحابة

**Independent Test**: تشغيل التطبيق، قطع الإنترنت، إتمام 5 مبيعات، إعادة الاتصال، التحقق من وصول المبيعات للسحابة

### US3 - الكاشير يعمل بدون إنترنت

#### Sync API Routes (Cloud Side)

- [x] T046 [P] إنشاء `app/api/sync/pull/route.ts` (GET):
  - يقبل: `{ branchId, lastSyncAt, tables[] }`
  - يرجع: جميع السجلات المحدَّثة منذ `lastSyncAt` للجداول المطلوبة
  - يشمل: products, productUnits, categories, offers, storeSettings

- [x] T047 [P] إنشاء `app/api/sync/push/route.ts` (POST):
  - يقبل: `{ branchId, operations: [{ table, type, id, payload, timestamp }] }`
  - يطبق العمليات مع حل التعارضات
  - يرجع: `{ success, conflicts: [], applied: N }`

- [x] T048 [P] إنشاء `app/api/sync/status/route.ts` (GET):
  - يرجع حالة الفرع: `lastSyncAt`, `pendingConflicts`, `serverTime`

- [x] T049 إنشاء `lib/sync-engine/conflict-resolver.ts`:
  - `resolveConflict(table, localRecord, cloudRecord)` → الـ winner
  - قواعد:
    - transactions: localRecord wins (لا تُلغى مبيعات offline)
    - products/offers/settings: cloudRecord wins
    - productBatch (inventory): merge quantities + تسجيل تعارض

#### Sync Engine (Desktop/Electron Side)

- [x] T050 إنشاء `electron/sync-worker.js`:
  - يعمل كـ background process في Electron
  - يراقب حالة الإنترنت (polling كل 10 ثواني)
  - عند اكتشاف الاتصال: يبدأ دورة مزامنة كاملة
  - يُنفَّذ pull أولًا (catalog updates من السحابة) ثم push (local transactions للسحابة)

- [x] T051 إنشاء `electron/offline-queue.js`:
  - طابور في SQLite: `SyncQueue` table
  - دالة `enqueue(table, type, id, payload)` → تُضيف عملية للطابور
  - دالة `dequeue(n)` → تُرجع N عملية غير مُتزامنة
  - دالة `markSynced(ids[])` → يُحدِّث `syncedAt`

- [x] T052 تحديث `prisma/schema.local.prisma` لإضافة:
  - `SyncQueue` table: id, table, type, payload (JSON), createdAt, syncedAt, attempts
  - `SyncMeta` table: lastPullAt, lastPushAt, branchToken, tenantId, branchId

- [x] T053 تحديث `electron/main.js`:
  - قراءة `branchToken` من إعدادات التطبيق عند أول تشغيل
  - تشغيل `sync-worker.js` كـ background process بعد النجاح في بدء الخادم
  - إضافة IPC channel: `sync:status` → إرسال حالة المزامنة للـ renderer
  - إضافة IPC channel: `sync:force` → تشغيل مزامنة يدوية

- [x] T054 تحديث جميع API Routes المحلية في التطبيق المكتبي لتُضيف العمليات للـ SyncQueue:
  - `POST /api/transactions` → enqueue transaction + items
  - `PUT /api/inventory/batch` → enqueue batch update
  - `POST /api/customers` + `POST /api/customers/payment` → enqueue
  - `POST /api/suppliers/payment` → enqueue

- [x] T055 إنشاء مكون `components/SyncStatusBar.tsx`:
  - يظهر في شريط الحالة: أيقونة اتصال + "متصل/غير متصل" + عدد العمليات المنتظرة
  - زر "مزامنة الآن" يُطلق `sync:force` IPC event
  - يستمع لتحديثات `sync:status` من Electron main process

- [x] T056 إنشاء `app/activate/branch/page.tsx`:
  - صفحة لإدخال `activationCode` + `branchToken` عند أول تشغيل التطبيق المكتبي
  - تحفظ البيانات في إعدادات Electron (electron-store أو ملف JSON)

**Checkpoint**: المزامنة تعمل — التطبيق يعمل offline ويتزامن عند الاتصال ✅

---

## Phase 6: Branch-Aware Reports — التقارير المجمعة (P2)

**Goal**: تقارير على مستوى الفرع ومستوى السلسلة الكاملة

**Independent Test**: Tenant Admin يفتح "التقرير المجمع" ويرى إجمالي مبيعات فروعه مقارنةً ببعضها

### US4 - مدير الفرع يدير مخزونه + US2 التقارير المجمعة

- [x] T057 [P] تحديث `app/api/reports/analytics/route.ts`:
  - إضافة query param: `branchId` (للتقرير المحدد) أو `all` (مجمع لجميع الفروع)
  - التقرير المجمع يُجمع الأرقام من جميع فروع المستأجر

- [x] T058 [P] إنشاء `app/api/reports/branches/comparison/route.ts` (GET):
  - مقارنة أداء الفروع: المبيعات، الأرباح، عدد العمليات، متوسط قيمة الفاتورة
  - يقبل: `{ startDate, endDate }`
  - يرجع: مصفوفة أداء كل فرع

- [x] T059 [P] تحديث `app/api/reports/sales/route.ts`:
  - إضافة قدرة التصفية بـ `branchId` مع default = جميع فروع المستأجر

- [x] T060 [P] تحديث `app/api/reports/inventory/route.ts`:
  - إضافة قدرة التصفية بـ `branchId`
  - تقرير مجمع: المنتجات مع مجموع مخزونها عبر الفروع

- [x] T061 إنشاء `app/(tenant)/[tenant]/reports/page.tsx`:
  - لوحة تحكم التقارير مع قائمة dropdown لاختيار: "جميع الفروع" أو فرع محدد
  - بطاقات: إجمالي المبيعات، الأرباح، أفضل المنتجات

- [x] T062 إنشاء `app/(tenant)/[tenant]/reports/branches/page.tsx`:
  - مقارنة مرئية (رسوم بيانية) لأداء الفروع
  - جدول مقارنة مفصل

**Checkpoint**: التقارير المجمعة تعمل ✅

---

## Phase 7: Notifications — نظام الإشعارات (P2)

**Goal**: إشعارات داخلية وبريد إلكتروني للأحداث المهمة

**Independent Test**: إنشاء مستأجر تنتهي اشتراكه بعد 7 أيام، التحقق من وصول إشعار داخلي وبريد إلكتروني

### US5 - إدارة الاشتراكات والفوترة

- [x] T063 [P] إنشاء `lib/notifications/email.ts`:
  - دالة `sendSubscriptionExpirySoon(tenantAdmin, daysLeft)` باستخدام Resend
  - دالة `sendSubscriptionExpired(tenantAdmin)`
  - دالة `sendSyncFailureAlert(branchManager, branchName, failureCount)`
  - قوالب HTML/Text بالعربية

- [x] T064 [P] إنشاء `lib/notifications/in-app.ts`:
  - دالة `createNotification(tenantId, userId?, type, title, body)`
  - دالة `markAsRead(notificationId, userId)`
  - دالة `getUnread(userId)` → قائمة الإشعارات غير المقروءة

- [x] T065 [P] إنشاء `app/api/notifications/route.ts` (GET/PUT):
  - GET: قائمة إشعارات المستخدم الحالي (unread first)
  - PUT: تحديد إشعار كمقروء

- [x] T066 إنشاء `scripts/cron/check-expiring-subscriptions.ts`:
  - يعمل يوميًا (cron job)
  - يبحث عن اشتراكات تنتهي خلال 7 أيام أو 1 يوم
  - يُرسل إشعارات داخلية + بريد لمالكي هذه الاشتراكات

- [x] T067 إنشاء `components/NotificationBell.tsx`:
  - أيقونة جرس في الـ header تعرض عدد الإشعارات غير المقروءة
  - Dropdown يعرض آخر 10 إشعارات مع رابط لصفحة جميع الإشعارات

**Checkpoint**: نظام الإشعارات يعمل ✅

---

## Phase 8: Security Hardening + Branch Scope Enforcement (P1)

**Goal**: تطبيق عزل البيانات بشكل صارم لضمان لا تسريب بيانات بين المستأجرين

- [x] T068 إضافة Prisma middleware في `lib/multi-tenant/prisma.ts`:
  - لكل query: تحقق من أن `tenantId` في الـ where clause يطابق `currentTenant`
  - رمي خطأ إن حاول أي كود الوصول لـ tenantId مختلف

- [x] T069 [P] مراجعة وتحديث جميع API routes:
  - كل route يجب أن تستخدم `getTenantPrisma(tenantId)` لا Prisma المباشر
  - Branch Managers: الـ query تُضيف تلقائيًا `branchId` filter

- [x] T070 إضافة Rate Limiting على نقاط الـ API الحساسة:
  - `/api/auth/login`: 5 محاولات / 15 دقيقة لكل IP
  - `/api/sync/push`: حد مناسب لمنع الإغراق

- [x] T071 [P] إضافة حقلي `failedAttempts` و `lockedUntil` لـ User model وتطبيقهما في `/api/auth/login`

- [x] T072 تحديث `lib/audit.ts`:
  - إضافة `tenantId` و `branchId` لجميع سجلات التدقيق
  - تسجيل: Super Admin impersonation, tenant status changes, auth failures

**Checkpoint**: الأمان محكم — عزل البيانات مضمون ✅

---

## Phase 9: Migration Tools + Launch Prep

**Goal**: أدوات الهجرة، اختبارات نهائية، وإعداد النشر

- [x] T073 إنهاء وتوثيق `scripts/migrate-to-multitenant.ts`:
  - اختبار الهجرة على نسخة من `dev.db`
  - التحقق من اكتمال نقل جميع البيانات

- [x] T074 [P] إنشاء `scripts/seed-super-admin.ts`:
  - إنشاء حساب Super Admin الأول
  - إنشاء الخطط الافتراضية (Basic, Pro, Enterprise)

- [x] T075 [P] إنشاء `scripts/create-tenant.ts`:
  - سكريبت CLI لإنشاء مستأجر جديد يدويًا (للـ Super Admin)
  - يقبل: name, slug, adminEmail, planName

- [x] T076 [P] تحديث `next.config.ts`:
  - إضافة subdomain routing support
  - wildcard domains: `*.domain.com` → tenant routing

- [x] T077 [P] تحديث `electron/main.js`:
  - حذف نظام الترخيص القديم (JWT hardware-based)
  - استبدال بـ branch activation token من السحابة

- [x] T078 إنشاء `.env.production` مع توثيق جميع المتغيرات المطلوبة للنشر

- [x] T079 [P] تحديث `README.md` بتعليمات النشر والإعداد الأولي

- [x] T080 اختبار نهائي شامل:
  - اختبار تدفق كامل: إنشاء مستأجر → إنشاء فرع → تفعيل التطبيق المكتبي → مبيعات offline → مزامنة
  - اختبار عزل البيانات: مستأجران لا يريان بيانات بعضهما
  - اختبار انتهاء الاشتراك: التحول لوضع "قراءة فقط"

**Checkpoint**: النظام جاهز للإطلاق ✅

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 0 (Setup)
    ↓
Phase 1 (Schema) ← BLOCKS ALL
    ↓
Phase 2 (Auth) ──┬──────────────────────────────────┐
                 ↓                                  ↓
Phase 3 (Super Admin) ←───────── Phase 4 (Tenant/Branch)
                 ↓                                  ↓
              يمكن تطوير Phase 3 و 4 بالتوازي بعد Phase 2
                 ↓
Phase 5 (Sync Engine) ← يعتمد على Phase 4
                 ↓
Phase 6 (Reports) ←──────────────────────────────────
Phase 7 (Notifications) ← يمكن البدء مع Phase 6
Phase 8 (Security) ← يعمل بالتوازي مع Phase 6 و 7
                 ↓
Phase 9 (Launch Prep) ← بعد اكتمال كل شيء
```

### Parallel Opportunities

- **T010, T011, T012** (Phase 2): يمكن تطويرها معًا
- **T019-T024** (Super Admin APIs): جميعها مستقلة، يمكن توزيعها
- **T026-T031** (Super Admin UI): مستقلة، قابلة للتوزيع
- **T032-T039** (Tenant APIs): مستقلة بعد Phase 1
- **T046-T048** (Sync APIs): مستقلة، يمكن تطويرها مع Phase 5
- **T063-T064** (Notifications): مستقلتان، يمكن البدء مبكرًا

---

## Implementation Strategy

### MVP (الأولوية القصوى — P1 Stories)

1. ✅ Phase 0: Setup
2. ✅ Phase 1: Schema (BLOCKING)
3. ✅ Phase 2: Auth Upgrade
4. ✅ Phase 3: Super Admin UI ← يمكن للـ Super Admin إدارة المنصة
5. ✅ Phase 4: Tenant/Branch Management ← المستأجرون يمكنهم إدارة فروعهم
6. ✅ Phase 5: Sync Engine ← Offline POS يعمل مع مزامنة
7. ✅ Phase 8: Security (يجب دائمًا)

### Incremental Delivery (بعد MVP)

8. Phase 6: Multi-Branch Reports
9. Phase 7: Notifications
10. Phase 9: Launch Prep

---

## Notes

- [P] = يمكن تنفيذه بالتوازي مع tasks أخرى في نفس المرحلة
- كل Task يجب أن تُنهى قبل الانتقال للتالية المعتمدة عليها
- استخدم `getTenantPrisma()` دائمًا - لا تستخدم `prisma` المباشر في routes المستأجرين
- اختبر عزل البيانات بعد كل Phase تضيف فيها API routes جديدة
- الـ SyncQueue يجب أن يكون atomic: إما كل عملية تتزامن أو لا شيء
