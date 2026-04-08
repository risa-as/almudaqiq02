# Tasks: إعادة تصميم شاملة للواجهة — Premium SaaS UI

**Feature Branch**: `019-premium-ui-redesign`
**Spec**: [spec.md](./spec.md)
**Created**: 2026-04-08

---

## Phase 1: Setup

- [x] T001 [P] قراءة وتوثيق globals.css الحالي
- [x] T002 [P] قراءة components/Sidebar.tsx الحالي
- [x] T003 [P] قراءة app/(tenant)/dashboard/page.tsx الحالي
- [x] T004 [P] قراءة app/login/page.tsx الحالي

---

## Phase 2: US1 — Design System Foundation

- [x] T005 [US1] تحديث `app/globals.css` — نظام CSS variables جديد: Indigo/Violet/Amber، mesh gradient، glow effects، shimmer animation، premium shadows
- [x] T006 [US1] `app/layout.tsx` — Cairo font موجود ومُطبّق (لا تعديل مطلوب)

---

## Phase 3: US2 — Sidebar Redesign

- [x] T007 [US2] تحديث `components/Sidebar.tsx` — Header: indigo gradient background + logo glow
- [x] T008 [US2] تحديث `components/Sidebar.tsx` — Nav links: أيقونة gradient ملونة + active glow state + smooth hover
- [x] T009 [US2] تحديث `components/Sidebar.tsx` — Footer: avatar ملون حسب الدور + role badge + logout button

---

## Phase 4: US3 — Login Page Redesign

- [x] T010 [US3] تحديث `app/login/page.tsx` — خلفية mesh gradient متحرك + بطاقة glassmorphism مركزية + input fields مع icons فاخرة

---

## Phase 5: US4 — Shared UI Components

- [x] T011 [P] [US4] تحديث `components/ui/PageHeader.tsx` — gradient icon badge + gradient text title + action button slot
- [x] T012 [P] [US4] تحديث `components/ui/StatCard.tsx` — gradient background فريد + أيقونة + trend indicator بـ TrendingUp/Down
- [x] T013 [P] [US4] إنشاء `components/ui/FilterBar.tsx` — شريط فلترة موحد بـ glass effect
- [x] T014 [P] [US4] إنشاء `components/ui/LoadingSkeleton.tsx` — shimmer effect متحرك للبطاقات والجداول

---

## Phase 6: US5 — Dashboard Redesign

- [x] T015 [US5] تحديث `app/(tenant)/dashboard/page.tsx` — KPI cards بـ gradients فريدة + Quick Actions بـ gradient + recent transactions premium

---

## Phase 7: US6 — Inventory Pages

- [x] T016 [P] [US6] تحديث `app/(tenant)/inventory/page.tsx` — StatCard gradients updated
- [ ] T017 [P] [US6] تحديث `app/(tenant)/inventory/batches/page.tsx` — PageHeader gradient
- [ ] T018 [P] [US6] تحديث `app/(tenant)/inventory/stock-in/page.tsx` — PageHeader gradient
- [ ] T019 [P] [US6] تحديث `app/(tenant)/inventory/categories/page.tsx` — PageHeader gradient
- [ ] T020 [P] [US6] تحديث `app/(tenant)/inventory/new/page.tsx` — PageHeader gradient
- [ ] T021 [P] [US6] تحديث `app/(tenant)/inventory/edit/[id]/page.tsx` — PageHeader gradient

---

## Phase 8: US7 — Sales Pages

- [ ] T022 [P] [US7] تحديث `app/(tenant)/sales/invoices/page.tsx` — PageHeader + DataTable premium
- [ ] T023 [P] [US7] تحديث `app/(tenant)/sales/customers/page.tsx` — PageHeader + DataTable
- [ ] T024 [P] [US7] تحديث `app/(tenant)/sales/customers/[id]/page.tsx` — PageHeader + detail card premium

---

## Phase 9: US8 — Purchases & Suppliers Pages

- [ ] T025 [P] [US8] تحديث `app/(tenant)/purchases/suppliers/page.tsx` — gradient header
- [ ] T026 [P] [US8] تحديث `app/(tenant)/purchases/suppliers/[id]/ledger/page.tsx` — gradient header
- [ ] T027 [P] [US8] تحديث `app/(tenant)/purchases/suppliers/smart-buy/page.tsx` — gradient header

---

## Phase 10: US9 — Reports Pages

- [x] T028 [P] [US9] تحديث `app/(tenant)/reports/sales/page.tsx` — KPI cards + charts بألوان indigo + data-table
- [ ] T029 [P] [US9] تحديث `app/(tenant)/reports/inventory/page.tsx` — PageHeader + KPI cards
- [x] T030 [P] [US9] تحديث `app/(tenant)/reports/analytics/components/KpiCards.tsx` — premium gradient cards
- [ ] T031 [P] [US9] تحديث `app/(tenant)/reports/stock-movement/page.tsx` — PageHeader + DataTable
- [ ] T032 [P] [US9] تحديث `app/(tenant)/reports/audit/page.tsx` — PageHeader + DataTable
- [ ] T033 [P] [US9] تحديث `app/(tenant)/reports/branches/page.tsx` — PageHeader + cards

---

## Phase 11: US10 — Accounting & Settings Pages

- [x] T034 [P] [US10] تحديث `app/(tenant)/accounting/expenses/page.tsx` — StatCard gradient fixed
- [ ] T035 [P] [US10] تحديث `app/(tenant)/accounting/shifts/page.tsx` — PageHeader gradient
- [ ] T036 [P] [US10] تحديث `app/(tenant)/accounting/financials/page.tsx` — PageHeader + KPI cards
- [ ] T037 [P] [US10] تحديث `app/(tenant)/settings/page.tsx` — ROLE_LABELS type fix ✅
- [ ] T038 [P] [US10] تحديث `app/(tenant)/branches/page.tsx` — PageHeader gradient

---

## Phase 12: US11 — Super Admin Pages

- [x] T039 [P] [US11] تحديث `app/(super-admin)/super-admin/dashboard/page.tsx` — KPI header + cards
- [x] T040 [P] [US11] تحديث `app/(super-admin)/super-admin/tenants/page.tsx` — gradient header + stats cards + filter bar premium
- [ ] T041 [P] [US11] تحديث `app/(super-admin)/super-admin/tenants/[id]/page.tsx` — premium detail
- [ ] T042 [P] [US11] تحديث `app/(super-admin)/super-admin/plans/page.tsx` — pricing cards
- [ ] T043 [P] [US11] تحديث `app/(super-admin)/super-admin/monitoring/page.tsx` — header + stats
- [ ] T044 [P] [US11] تحديث `app/(super-admin)/super-admin/announcements/page.tsx` — header + list
- [ ] T045 [P] [US11] تحديث `app/(super-admin)/super-admin/licenses/page.tsx` — header + table

---

## Phase 13: US12 — POS Polish

- [ ] T046 [US12] تحديث `app/pos/page.tsx` — ألوان indigo للـ accent buttons

---

## Phase 14: Polish

- [x] T047 [P] تحديث `app/(tenant)/layout.tsx` — indigo dark sidebar + premium nav
- [x] T048 [P] تحديث `app/(super-admin)/layout.tsx` — ultra-dark sidebar + violet theme
- [x] T049 [P] تحديث `app/(tenant)/marketing/offers/page.tsx` — gradient fixed + isSubmitting bugfix
- [ ] T050 [P] تحديث `app/(tenant)/transfers/page.tsx` — PageHeader gradient
- [x] T051 TypeScript errors من UI changes: جميعها مُصلحة ✅

---

## ما تم إنجازه

**الأساسيات (100%)**:
- ✅ globals.css — نظام تصميم كامل جديد (Indigo/Violet/Amber)
- ✅ Sidebar — تدرج داكن فاخر، active glow، role avatars
- ✅ Login page — mesh gradient background + glassmorphism card
- ✅ Tenant layout — dark indigo sidebar
- ✅ Super admin layout — ultra-dark violet sidebar

**المكونات المشتركة (100%)**:
- ✅ PageHeader — gradient icon badge + gradient text
- ✅ StatCard — gradient icon background + TrendIcon
- ✅ FilterBar — glass effect search bar
- ✅ LoadingSkeleton — shimmer animations

**الصفحات المحدّثة**:
- ✅ Dashboard — KPI gradients + premium transactions
- ✅ Inventory — StatCard gradients
- ✅ Reports/Sales — premium header + indigo chart + data-table
- ✅ Reports/Analytics/KpiCards — premium gradient cards
- ✅ Super Admin Dashboard — premium header
- ✅ Super Admin Tenants — gradient header + stats + filter bar
