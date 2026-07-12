# Implementation Plan: Role-Based Mobile App (Manager / Cashier / Stock Keeper)

**Branch**: `021-mobile-app` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-mobile-app/spec.md`

## Summary

A React Native (Expo) mobile client in a new `mobile/` folder of this repo, consuming the existing Next.js API unchanged except for one small auth enhancement. After login the app mounts exactly one of three expo-router route groups by JWT role: `(admin)` for ADMIN/BRANCH_MANAGER, `(cashier)` for CASHIER, `(stock)` for STOCK_KEEPER. The phone camera acts as the barcode scanner for selling, stocktake, and purchase-order receiving. Online-first, Arabic RTL throughout, plan-feature gating mirrored from `lib/features.ts` semantics via `/api/auth/me`.

**Backend delta (verified against current code, deliberately minimal)**:

1. `lib/api-helpers.ts` — `getAuthContext()` / `getTenantId()` read only the `auth-token` cookie today; add `Authorization: Bearer` header as first-choice token source. `middleware.ts` **already** accepts Bearer (line 97–101), so this is the only gap in the request path.
2. `app/api/auth/login/route.ts` — already returns `accessToken` + `user` in the JSON body; additionally return `refreshToken` (+ `branchId`, `username`) in the body **only** when the request carries `x-client-type: mobile`, so web browsers keep the httpOnly-cookie-only posture.
3. `app/api/auth/refresh/route.ts` — **no change needed**: it already accepts `{ refreshToken }` in the JSON body and returns `accessToken` in the body.
4. `app/api/auth/me/route.ts` — reads only the cookie today; switch it to the shared Bearer-or-cookie token extraction so mobile can fetch `{ user, features }` after login (this is the feature-gating source).

No schema changes, no new endpoints, no new server business logic.

## Technical Context

**Language/Version**: TypeScript 5.x (mobile); existing Next.js 16.1.6 backend untouched except the 3 files above  
**Primary Dependencies**: Expo SDK (latest stable at `create` time), expo-router, @tanstack/react-query v5, zustand, expo-secure-store, expo-camera (CameraView barcode scanning), react-native-gifted-charts, date-fns  
**Storage**: None on-device beyond SecureStore (tokens) and React Query in-memory cache; server PostgreSQL is the single source of truth  
**Testing**: Manual acceptance per spec scenarios via quickstart.md; `npx tsc --noEmit` + `npx expo-doctor` as CI-style gates  
**Target Platform**: Android 10+ (primary, validated); iOS buildable but not validated in v1  
**Project Type**: mobile-app client + 3-file backend touch  
**Performance Goals**: scan→cart under 1s on mid-range Android; app-open→working-screen under 5s (SC-005); 5-item sale under 60s (SC-001)  
**Constraints**: online-first (no offline queue, FR-019); Arabic RTL only (FR-018); tokens only in SecureStore (FR-003); no widening of existing role/tenant access (FR-014)  
**Scale/Scope**: ~25 screens across 3 role groups; catalogs up to 10k+ products (server-side search only, never catalog download)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unfilled template — no project-specific gates are defined. Applied the general defaults instead:

- **Simplicity**: PASS — one new client project, zero new endpoints, 3-file backend delta, no new entities.
- **No speculative work**: PASS — offline sync, push notifications, printing, iOS validation all explicitly deferred (FR-019/FR-020).
- **Security**: PASS — server remains the authority for role/tenant/feature checks (FR-007/FR-014/FR-017); refresh token exposed in body only to `x-client-type: mobile` callers; tokens stored in OS keystore.

Post-Phase-1 re-check: unchanged — PASS.

## Project Structure

### Documentation (this feature)

```text
specs/021-mobile-app/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── backend-changes.md   # exact contract of the 3-file backend delta
│   └── mobile-api.md        # every endpoint the app consumes, per interface
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
mobile/                          # NEW — Expo app (its own package.json, not in Next.js build)
├── app/                         # expo-router file-based routes
│   ├── _layout.tsx              # Root: QueryClientProvider + auth bootstrap + RTL + role redirect
│   ├── index.tsx                # Entry redirect (splash → login or role home)
│   ├── login.tsx                # Shared login screen (Arabic)
│   ├── (admin)/                 # ADMIN + BRANCH_MANAGER
│   │   ├── _layout.tsx          # Bottom tabs: الرئيسية | المبيعات | التقارير | المزيد
│   │   ├── dashboard.tsx        # KPIs + weekly chart + open shifts
│   │   ├── sales.tsx            # Live invoices + shifts monitoring
│   │   ├── reports/
│   │   │   ├── index.tsx        # Reports hub (feature-gated entries)
│   │   │   ├── sales.tsx        # /api/reports/sales
│   │   │   ├── abc.tsx          # /api/reports/abc-analysis
│   │   │   ├── offers.tsx       # /api/reports/offers-performance
│   │   │   ├── payables.tsx     # /api/reports/supplier-payables
│   │   │   └── expenses.tsx     # /api/expenses
│   │   ├── inventory.tsx        # Overview + low-stock/expiry alerts
│   │   ├── approvals.tsx        # Pending transfers + purchase orders
│   │   ├── users.tsx            # Users list + audit view (audit_log gated)
│   │   ├── assistant.tsx        # AI chat (ai_assistant gated)
│   │   └── settings.tsx         # Profile, branch switcher (ADMIN only), logout
│   ├── (cashier)/               # CASHIER
│   │   ├── _layout.tsx          # Tabs: البيع | ورديتي | فواتيري | حسابي
│   │   ├── sell.tsx             # Scan/search → cart → payment
│   │   ├── shift.tsx            # Open/close shift, running totals
│   │   ├── invoices.tsx         # Current-shift invoices + return/refund
│   │   └── profile.tsx
│   └── (stock)/                 # STOCK_KEEPER
│       ├── _layout.tsx          # Tabs: المخزون | الجرد | الاستلام | المزيد
│       ├── inventory.tsx        # Products + quantities + batch expiries
│       ├── stocktake/
│       │   ├── index.tsx        # Sessions list + start new
│       │   └── [id].tsx         # Scan-and-count + discrepancies
│       ├── receive/
│       │   ├── index.tsx        # Pending purchase orders
│       │   └── [id].tsx         # Per-line receive with scan
│       ├── transfers.tsx        # Create / confirm receipt (stock_transfers gated)
│       ├── suppliers.tsx        # Read-only suppliers + balances
│       └── more.tsx             # Alerts + profile + logout
├── src/
│   ├── api/
│   │   ├── client.ts            # fetch wrapper: base URL, Bearer, 401→refresh→retry-once
│   │   └── endpoints/           # typed callers per resource (auth, products, transactions, shifts, ...)
│   ├── stores/
│   │   ├── auth.ts              # zustand: session, user, features, hydrate from SecureStore
│   │   ├── cart.ts              # zustand: cashier cart (survives checkout failure)
│   │   └── branch.ts            # zustand: ADMIN-selected branch
│   ├── components/
│   │   ├── BarcodeScannerView.tsx  # CameraView + manual-entry fallback (shared by 3 screens)
│   │   ├── ProductSearchSheet.tsx  # server-side name search
│   │   ├── StatCard.tsx / Screen.tsx / ErrorState.tsx / EmptyState.tsx
│   │   └── ...
│   ├── hooks/                   # useProducts, useShift, useDashboard, ...
│   ├── i18n/ar.ts               # all Arabic strings
│   └── theme/                   # Indigo/Violet tokens matching web 019 redesign
├── app.json                     # name, RTL config, android package, permissions (CAMERA)
├── eas.json                     # build profiles (preview APK)
├── .env.example                 # EXPO_PUBLIC_API_URL
├── package.json
└── tsconfig.json

lib/api-helpers.ts               # MODIFIED — Bearer-or-cookie token extraction
app/api/auth/login/route.ts      # MODIFIED — refreshToken in body for x-client-type: mobile
app/api/auth/me/route.ts         # MODIFIED — use shared extraction (Bearer works)
```

**Structure Decision**: Option 3 (mobile + existing API). The Expo app is a sibling folder with its own toolchain; the Next.js project never imports from `mobile/` and vice-versa. Shared knowledge (feature keys, endpoint shapes) is duplicated as typed constants in `mobile/src` rather than cross-imported, keeping both builds independent (Turbopack constraint: no dynamic require tricks).

## Complexity Tracking

No constitution violations — table not required.
