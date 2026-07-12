# Tasks: Role-Based Mobile App (Manager / Cashier / Stock Keeper)

**Input**: Design documents from `/specs/021-mobile-app/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/backend-changes.md, contracts/mobile-api.md, quickstart.md

**Tests**: Not requested — acceptance is via quickstart.md walkthrough + `npx tsc --noEmit` / `npx expo-doctor` gates.

**Organization**: Grouped by user story. All mobile paths are under `mobile/`; backend paths are repo-root relative.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring the Expo project into existence with the agreed stack.

- [X] T001 Scaffold Expo app: `npx create-expo-app@latest mobile --template default` (TypeScript + expo-router), then strip example screens to a bare `mobile/app/` per plan.md structure
- [X] T002 Install runtime deps in `mobile/package.json`: `@tanstack/react-query`, `zustand`, `expo-secure-store`, `expo-camera`, `react-native-gifted-charts` (+ its peer `react-native-linear-gradient`/`expo-linear-gradient`), `date-fns`
- [X] T003 [P] Configure `mobile/app.json`: app name (Arabic display name), `android.package: com.supermarket.cloud`, CAMERA permission, `supportsRTL: true` (expo `extra`/`locales` as needed)
- [X] T004 [P] Create `mobile/.env.example` with `EXPO_PUBLIC_API_URL=` and `mobile/eas.json` with a `preview` profile building an installable APK (per research R10)
- [X] T005 [P] Create theme tokens in `mobile/src/theme/index.ts` (Indigo/Violet palette matching web 019 redesign: colors, spacing, radii, typography)
- [X] T006 [P] Create Arabic strings module `mobile/src/i18n/ar.ts` (login, tabs, common actions, error fallbacks) — all UI text imports from here

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend Bearer support + the mobile auth/API core every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Backend: add Bearer-or-cookie token extraction in `lib/api-helpers.ts` — private `getRequestToken()` using `headers()` then `cookies()`; wire into `getTenantId()`, `getAuthContext()`, `getSuperAdminContext()` exactly per contracts/backend-changes.md §1
- [X] T008 [P] Backend: in `app/api/auth/login/route.ts`, when header `x-client-type: mobile` — include `refreshToken`, `user.username`, `user.branchId` in `issueLocalLoginResponse` JSON; return 403 (Arabic message, use web platform) for SuperAdmin matches; byte-identical response without the header (contracts/backend-changes.md §2)
- [X] T009 [P] Backend: switch `app/api/auth/me/route.ts` to `getAuthContext()` so Bearer works; keep `{ user, features, isElectron }` shape (contracts/backend-changes.md §3)
- [X] T010 Backend verification: run `npm run build` (Turbopack) at repo root and confirm the three changed files compile; manually verify with curl that (a) cookie-only web login flow is unchanged, (b) `x-client-type: mobile` login returns refreshToken in body, (c) a protected route accepts `Authorization: Bearer`
- [X] T011 Mobile: API client in `mobile/src/api/client.ts` — base URL from `EXPO_PUBLIC_API_URL`, JSON helpers, `Authorization: Bearer`, `x-client-type: mobile` on auth calls, 401 → single-flight refresh (POST `/api/auth/refresh` with stored refreshToken) → retry once → sign-out callback on failure (research R3)
- [X] T012 Mobile: secure token persistence in `mobile/src/api/tokens.ts` — SecureStore keys `sm.access`/`sm.refresh`, get/set/clear
- [X] T013 Mobile: auth store in `mobile/src/stores/auth.ts` per data-model.md — `status/session/user/features`, actions `signIn` (POST `/api/auth/login`), `restore` (tokens → GET `/api/auth/me`), `signOut` (wipe SecureStore + `queryClient.clear()`); duplicate the 7 feature keys as a typed constant in `mobile/src/features.ts`
- [X] T014 Mobile: root layout `mobile/app/_layout.tsx` — RTL bootstrap (`I18nManager.allowRTL/forceRTL` + one-time restart guard, research R7), `QueryClientProvider`, auth `restore()` on mount, and role-based redirect: signedOut→`/login`, ADMIN/BRANCH_MANAGER→`(admin)`, CASHIER→`(cashier)`, STOCK_KEEPER→`(stock)`; plus `mobile/app/index.tsx` entry redirect
- [X] T015 [P] Mobile: shared UI primitives in `mobile/src/components/` — `Screen.tsx` (safe-area + RTL container), `ErrorState.tsx` (Arabic message + retry), `EmptyState.tsx`, `StatCard.tsx`, `LoadingView.tsx`

**Checkpoint**: `npx tsc --noEmit` passes; app boots to login screen in Expo Go.

---

## Phase 3: User Story 1 — Sign In and Land on My Role's Interface (Priority: P1) 🎯 MVP

**Goal**: Real login against the cloud API, persistent session, and the three role shells with correct tab sets.

**Independent Test**: quickstart.md walkthrough step 1 (three roles land correctly, session survives app restart, SUPER_ADMIN refused, Arabic errors on bad credentials).

- [X] T016 [US1] Login screen `mobile/app/login.tsx` — email/username + password, Arabic labels/errors from `src/i18n/ar.ts`, calls `authStore.signIn`, surfaces server Arabic `error` strings verbatim (423 lock, 403 subscription, 401)
- [X] T017 [P] [US1] Admin tab shell `mobile/app/(admin)/_layout.tsx` — bottom tabs الرئيسية/المبيعات/التقارير/المزيد with placeholder screens `dashboard.tsx`, `sales.tsx`, `reports/index.tsx`, `settings.tsx`
- [X] T018 [P] [US1] Cashier tab shell `mobile/app/(cashier)/_layout.tsx` — tabs البيع/ورديتي/فواتيري/حسابي with placeholders `sell.tsx`, `shift.tsx`, `invoices.tsx`, `profile.tsx`
- [X] T019 [P] [US1] Stock tab shell `mobile/app/(stock)/_layout.tsx` — tabs المخزون/الجرد/الاستلام/المزيد with placeholders `inventory.tsx`, `stocktake/index.tsx`, `receive/index.tsx`, `more.tsx`
- [X] T020 [US1] Route-group guards: each group `_layout.tsx` redirects to the correct group when `user.role` doesn't match (deep-link safety, FR-007); SUPER_ADMIN handled at login with Arabic refusal message (FR-006)
- [X] T021 [US1] Sign-out action in `(cashier)/profile.tsx`, `(stock)/more.tsx`, `(admin)/settings.tsx` — calls `authStore.signOut`, returns to `/login` (FR-005)

**Checkpoint**: US1 acceptance scenarios 1–5 pass on device.

---

## Phase 4: User Story 2 — Cashier Sells with Camera Barcode (Priority: P1)

**Goal**: Full selling loop: shift open → scan → cart → pay → invoices/returns → shift close.

**Independent Test**: quickstart.md step 2 against a real product with EAN-13.

- [X] T022 [US2] Shared scanner `mobile/src/components/BarcodeScannerView.tsx` — expo-camera `CameraView` with `barcodeTypes: ['ean13','ean8','code128','qr']`, scan throttle/dedupe, torch toggle, permission-denied fallback rendering manual code entry (research R4, FR-011/FR-012)
- [X] T023 [P] [US2] Typed endpoint callers `mobile/src/api/endpoints/products.ts` (GET `/api/products/search` — read route file first for param names), `offers.ts` (GET `/api/offers`), `customers.ts` (GET `/api/customers`)
- [X] T024 [P] [US2] Typed endpoint callers `mobile/src/api/endpoints/shifts.ts` (GET/POST `/api/shifts`, POST `/api/shifts/close`) and `transactions.ts` (GET/POST `/api/transactions`, POST `/api/transactions/return`, POST `/api/transactions/refund`) — read each route file for authoritative request/response shapes
- [X] T025 [US2] Cart store `mobile/src/stores/cart.ts` per data-model.md — lines/discount/customer/paymentMethod, `submitting` single-flight guard, cart preserved on failure (research R9)
- [X] T026 [US2] Shift screen `mobile/app/(cashier)/shift.tsx` — no-shift state → open with opening balance; open state → running totals; close flow with counted cash vs expected (US2-AS1/AS6)
- [X] T027 [US2] Sell screen `mobile/app/(cashier)/sell.tsx` — scanner + `ProductSearchSheet` (`mobile/src/components/ProductSearchSheet.tsx`, server-side search), cart list with qty steppers, offer/discount application, payment sheet (نقد/شبكة/آجل with customer picker), POST sale, Arabic receipt summary; blocks selling with no open shift (FR-016); "المنتج غير موجود" on unknown barcode (US2-AS3)
- [X] T028 [US2] Invoices screen `mobile/app/(cashier)/invoices.tsx` — current-shift invoices list, invoice detail, per-line return + refund flows; refetch-before-retry on ambiguous checkout failures (FR-015, research R9)

**Checkpoint**: US2 acceptance scenarios 1–7 pass; sale visible on web dashboard.

---

## Phase 5: User Story 3 — Stock Keeper Counts & Receives by Scanning (Priority: P2)

**Goal**: Warehouse loop: browse stock, stocktake with discrepancies, receive POs, transfers, suppliers, alerts.

**Independent Test**: quickstart.md step 3.

- [X] T029 [P] [US3] Typed endpoint callers `mobile/src/api/endpoints/inventory.ts` (GET `/api/inventory`, `/api/inventory/alerts`, `/api/inventory/expiry`, `/api/inventory/check-barcode`), `stocktake.ts` (GET/POST `/api/stocktake`, GET/PUT `/api/stocktake/[id]`), `purchaseOrders.ts` (GET `/api/purchases/orders`, GET/PUT `/api/purchases/orders/[id]`), `transfers.ts` (GET/POST `/api/transfers`, PUT `/api/transfers/[id]`), `suppliers.ts` (GET `/api/suppliers`) — read each route file for authoritative shapes
- [X] T030 [US3] Inventory screen `mobile/app/(stock)/inventory.tsx` — paged product list with quantities, batch expiries drill-in, barcode-scan lookup via shared scanner
- [X] T031 [US3] Stocktake list `mobile/app/(stock)/stocktake/index.tsx` (sessions + start new) and session screen `mobile/app/(stock)/stocktake/[id].tsx` — scan → count entry → live discrepancy per data-model.md CountEntry; counts survive failed submit; submit posts to `/api/stocktake/[id]` (US3-AS1)
- [X] T032 [US3] Receiving list `mobile/app/(stock)/receive/index.tsx` (pending POs) and detail `mobile/app/(stock)/receive/[id].tsx` — per-line receive with scan match, quantity + expiry confirmation, warning when scanned item is not on the order (US3-AS2/AS3)
- [X] T033 [P] [US3] Transfers screen `mobile/app/(stock)/transfers.tsx` — create transfer + confirm incoming receipt (`stock_transfers` feature-gated tab)
- [X] T034 [P] [US3] More screen `mobile/app/(stock)/more.tsx` — alerts section (low-stock + near-expiry from `/api/inventory/alerts|expiry`), read-only suppliers list `mobile/app/(stock)/suppliers.tsx`, profile/sign-out

**Checkpoint**: US3 acceptance scenarios 1–5 pass; received batch visible in web inventory.

---

## Phase 6: User Story 4 — Manager Monitors from Anywhere (Priority: P2)

**Goal**: Dashboard, live monitoring, reports, approvals, users/audit, AI assistant, branch switching.

**Independent Test**: quickstart.md step 4 (numbers match web; approval propagates; assistant answers).

- [X] T035 [P] [US4] Typed endpoint callers `mobile/src/api/endpoints/reports.ts` (GET `/api/reports/dashboard`, `/api/reports/sales`, `/api/reports/abc-analysis`, `/api/reports/offers-performance`, `/api/reports/supplier-payables`), `expenses.ts` (GET `/api/expenses`), `users.ts` (GET `/api/users`), `audit.ts` (GET `/api/audit`), `branches.ts` (GET `/api/branches`), `ai.ts` (POST `/api/ai/chat`, GET `/api/ai/conversations`) — read each route file for authoritative shapes
- [X] T036 [US4] Branch store `mobile/src/stores/branch.ts` per data-model.md — ADMIN switchable, BRANCH_MANAGER pinned to `user.branchId`; all manager query keys include `selectedBranchId` (US4-AS2/AS3)
- [X] T037 [US4] Dashboard `mobile/app/(admin)/dashboard.tsx` — today KPIs (StatCards), weekly trend chart (react-native-gifted-charts), open shifts card, low-stock/expiry alert cards; pull-to-refresh; `staleTime: 0` (SC-004)
- [X] T038 [P] [US4] Sales monitoring `mobile/app/(admin)/sales.tsx` — live invoices feed (GET `/api/transactions`) + open shifts (GET `/api/shifts`)
- [X] T039 [P] [US4] Reports hub `mobile/app/(admin)/reports/index.tsx` + screens `reports/sales.tsx`, `reports/abc.tsx`, `reports/offers.tsx`, `reports/payables.tsx`, `reports/expenses.tsx` with period filters and simple charts/tables
- [X] T040 [P] [US4] Approvals `mobile/app/(admin)/approvals.tsx` — pending transfers (PUT approve) + purchase orders review (US4-AS4)
- [X] T041 [P] [US4] Users & audit `mobile/app/(admin)/users.tsx` — staff list; audit trail section rendered only with `audit_log` feature
- [X] T042 [US4] AI assistant `mobile/app/(admin)/assistant.tsx` — chat UI over POST `/api/ai/chat` (match the web request contract from `hooks/useChat.ts`; render text responses; `ai_assistant` gated)
- [X] T043 [US4] Settings `mobile/app/(admin)/settings.tsx` — profile, branch switcher (ADMIN only, from `/api/branches`), inventory overview link `mobile/app/(admin)/inventory.tsx`, sign-out

**Checkpoint**: US4 acceptance scenarios 1–5 pass.

---

## Phase 7: User Story 5 — Plan Feature Gating on Mobile (Priority: P3)

**Goal**: Gated tabs/screens hidden per tenant plan; graceful locked states.

**Independent Test**: quickstart.md step 5.

- [ ] T044 [US5] Gating hook `mobile/src/hooks/useFeature.ts` reading `authStore.features`; apply to: assistant tab (`ai_assistant`), transfers tab/screens (`stock_transfers`), audit section (`audit_log`) — hidden tabs, and a locked `UpgradeState` component `mobile/src/components/UpgradeState.tsx` for direct navigation attempts (FR-017)
- [ ] T045 [US5] Refresh features on session restore and on foreground (`AppState` listener re-fires `/api/auth/me` when app returns to foreground after >5 min) so plan upgrades appear without reinstall (US5-AS2)

**Checkpoint**: US5 acceptance scenarios 1–2 pass.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T046 [P] RTL + Arabic audit across every screen: row directions, chevrons, numerals, toasts — fix violations (SC-007, FR-018)
- [ ] T047 [P] Global error handling polish: network-offline banner (FR-019 messaging), server Arabic errors surfaced verbatim, retry affordances on all queries
- [ ] T048 Run gates: `npx tsc --noEmit` and `npx expo-doctor` in `mobile/` — fix all findings
- [ ] T049 Execute full quickstart.md acceptance walkthrough (steps 1–5) against local backend and record results in `specs/021-mobile-app/checklists/acceptance.md`
- [ ] T050 [P] Write `mobile/README.md` — setup, env, run, EAS APK build (condensed from quickstart.md)
- [ ] T051 Modern design pass (user request 2026-07-11): SHEIN-like contemporary styling across all screens — pill CTA buttons, card grids with soft shadows, chip filters, gradient hero header on dashboard/login, bolder typography scale, consistent 16–20px radii; applied via `mobile/src/theme` token upgrades + targeted screen polish after US2–US5 land

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 (US1)** are strictly sequential gates.
- **US2 (Phase 4)** depends on US1 shells; **US3 (Phase 5)** depends on T022 (shared scanner) from US2 but not on the rest of the cashier flow; **US4 (Phase 6)** depends only on US1; **US5 (Phase 7)** touches tabs created in US3/US4.
- Suggested delivery order: US1 → US2 (MVP release) → US3 → US4 → US5 → Polish.

### Parallel opportunities

- Phase 1: T003/T004/T005/T006 after T002.
- Phase 2: T007/T008/T009 (backend, different files) in parallel; T015 parallel to T011–T014.
- Phase 3: T017/T018/T019 in parallel.
- Phase 4: T023/T024 in parallel before screens.
- Phases 5–6: endpoint-caller tasks (T029/T035) parallel; most screens parallel per file.

### MVP scope

Phases 1–4 (T001–T028): login + role routing + full cashier selling loop — releasable to a pilot tenant.
