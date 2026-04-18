# Implementation Plan: منصة SaaS لإدارة المتاجر المتكاملة

**Branch**: `016-saas-multitenant-platform` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)

---

## Summary

تحويل نظام إدارة السوبر ماركت الحالي (Next.js + Electron + SQLite) إلى منصة SaaS متعددة المستأجرين تدعم الفروع المتعددة، مع الحفاظ على التطبيق المكتبي بوضع Offline-First ومزامنة تلقائية مع السحابة.

**المنهجية**: هجرة تدريجية من الـ single-tenant الحالي إلى multi-tenant، مع 7 مراحل تطوير متسلسلة.

---

## Technical Context

**Language/Version**: TypeScript 5 / Node.js 20+
**Primary Dependencies**: Next.js 15, Prisma ORM, PostgreSQL (Neon/Supabase), SQLite (local), Electron 40, JWT (jose), bcrypt, Zod (validation), Resend (email)
**Storage**: PostgreSQL (cloud) + SQLite (local per-branch device)
**Testing**: Jest + Playwright (E2E)
**Target Platform**: Web (Vercel/VPS) + Windows 10+ (Electron)
**Project Type**: SaaS Web Application + Desktop App (Electron)
**Performance Goals**: مزامنة 500 عملية < 60 ثانية، تحميل لوحة التحكم < 3 ثواني، استجابة POS < 2 ثانية
**Constraints**: offline-capable (SQLite)، عزل بيانات كامل بين المستأجرين، دعم RTL كامل
**Scale/Scope**: حتى 1000 مستأجر، كل مستأجر حتى 50 فرع، كل فرع حتى 100 ألف منتج

---

## Project Structure

### Documentation (this feature)

```text
specs/016-saas-multitenant-platform/
├── spec.md                    # Feature specification
├── plan.md                    # This file
├── data-model.md              # Database schema design
├── checklists/
│   └── requirements.md
└── tasks.md                   # Implementation tasks
```

### Source Code Layout (post-migration)

```text
# Cloud (Next.js SaaS Backend + Web Frontend)
app/
├── (super-admin)/             # Super Admin واجهة مستقلة
│   ├── dashboard/
│   ├── tenants/
│   ├── plans/
│   ├── licenses/
│   └── monitoring/
├── (tenant)/                  # Tenant واجهات المستأجرين
│   ├── [tenant]/              # Dynamic routing by subdomain/slug
│   │   ├── dashboard/
│   │   ├── branches/
│   │   ├── inventory/         # Catalog management (central)
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── reports/           # Aggregated + per-branch
│   │   ├── settings/
│   │   └── subscription/
├── api/
│   ├── super-admin/           # Super Admin API routes
│   ├── tenants/               # Tenant management APIs
│   ├── branches/              # Branch management APIs
│   ├── sync/                  # Sync engine endpoints
│   │   ├── push/              # Desktop → Cloud
│   │   ├── pull/              # Cloud → Desktop
│   │   └── status/
│   ├── auth/                  # JWT auth (upgraded)
│   ├── products/              # Tenant catalog APIs
│   ├── inventory/             # Branch inventory APIs
│   ├── transactions/
│   ├── transfers/             # Stock transfers between branches
│   ├── reports/
│   └── notifications/
├── login/                     # Tenant-aware login
└── super-admin/login/         # Super Admin login (separate)

lib/
├── tenant.ts                  # Tenant context resolution
├── auth.ts                    # JWT + bcrypt (upgraded)
├── sync-engine/               # Sync logic
│   ├── push.ts
│   ├── pull.ts
│   └── conflict-resolver.ts
├── multi-tenant/
│   ├── prisma.ts              # Tenant-scoped Prisma client
│   └── middleware.ts
└── notifications/
    ├── email.ts
    └── in-app.ts

prisma/
├── schema.prisma              # Cloud schema (PostgreSQL, multi-tenant)
└── schema.local.prisma        # Local schema (SQLite, single-branch)

electron/
├── main.js                    # Electron entry (updated)
├── sync-worker.js             # Background sync process
└── offline-queue.js           # Offline operations queue

middleware.ts                  # Updated: tenant detection + auth + license
```

---

## Architecture Decisions

### استراتيجية Multi-Tenancy: Row-Level Security

**الاختيار**: Row-Level Security (RLS) - إضافة `tenantId` لكل جدول رئيسي.

**السبب**: يناسب قاعدة بيانات واحدة PostgreSQL، أسهل في الإدارة والهجرة، أداء كافٍ للحجم المستهدف (< 1000 مستأجر).

**الضمانة**: Prisma middleware يُضيف `WHERE tenantId = currentTenant` لكل query تلقائيًا.

---

### استراتيجية المزامنة: Delta Sync مع Timestamp

**الاختيار**: كل سجل له `updatedAt` + `syncVersion`. عند المزامنة يُرسَل فقط ما تغيّر منذ `lastSyncAt`.

**قواعد حل التعارضات**:
- المبيعات: الفرع أولوية (لا تُرفض مبيعات offline)
- الكتالوج/الأسعار: السحابة أولوية
- المخزون: يُجمع الرقمان مع تنبيه لمدير الفرع

---

### استراتيجية Tenant Routing: Subdomain + Path

**الاختيار**: `tenant-slug.domain.com` أو `domain.com/t/tenant-slug`

**السبب**: Subdomain هو الأفضل تجربةً، ولكن Path-based أسهل للنشر على Vercel في المرحلة الأولى.

**التطبيق**: الـ middleware يقرأ الـ subdomain أو الـ path ويضع `tenantId` في الـ request context.

---

## Migration Strategy (الهجرة من النظام الحالي)

### الهجرة من SQLite الحالي للنظام الجديد:

1. **نقل البيانات**: سكريبت يقرأ `dev.db` وينشئ مستأجرًا جديدًا في PostgreSQL مع نقل كل البيانات
2. **إنشاء الفرع الأول**: البيانات الحالية تُصبح الفرع الأول للمستأجر الأول
3. **الربط بالتطبيق المكتبي**: التطبيق يحصل على رمز فرع للمزامنة مع السحابة

---

## Phases of Implementation

### Phase 0: Database Schema Redesign (الأساس)
تحديث Prisma schema لإضافة: Tenant, Branch, SubscriptionPlan, SyncQueue, SyncLog مع إضافة `tenantId` و `branchId` لجميع الجداول الحالية.

### Phase 1: Authentication Upgrade + Tenant Context
ترقية نظام المصادقة (SHA-256 → bcrypt، cookies → JWT)، إضافة Tenant middleware، Super Admin auth منفصل.

### Phase 2: Super Admin Interface
لوحة التحكم الكاملة للـ Super Admin: إدارة المستأجرين، الخطط، التراخيص، المراقبة.

### Phase 3: Tenant + Branch Management
واجهات إدارة الفروع للـ Tenant Admin، كتالوج مركزي، نقل المخزون بين الفروع.

### Phase 4: Sync Engine
محرك المزامنة: Push/Pull APIs، قائمة الانتظار المحلية في Electron، Conflict Resolution.

### Phase 5: Multi-Branch Reports + Notifications
التقارير المجمعة على مستوى السلسلة، مقارنة أداء الفروع، نظام الإشعارات.

### Phase 6: Migration Tools + Launch Prep
أدوات نقل البيانات من النظام الحالي، اختبارات شاملة، إعداد النشر.

---

## Complexity Tracking

| Complexity Factor | Why Needed | Simpler Alternative Rejected Because |
|-------------------|------------|--------------------------------------|
| Row-Level Security على كل query | عزل بيانات متعدد المستأجرين | Schema-per-tenant أعقد في الإدارة والهجرة |
| Bidirectional Sync Engine | الـ Offline-First desktop يحتاج مزامنة ثنائية | One-way sync لا يكفي لتعديلات الفرع |
| JWT + Refresh Tokens | حماية sessions وإمكانية إنهائها عن بُعد | Cookie-only لا يناسب بيئة SaaS متعددة النطاقات |
| Delta Sync (incremental) | الأداء مع كميات كبيرة من البيانات | Full sync في كل مرة يُبطئ المزامنة بشكل كبير |
