# Tasks: Route Restructuring & System Integration

**Input**: Design documents from `/specs/009-route-restructure/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup & Foundational 

**Purpose**: Project initialization and preparation for routing update.

- [x] T001 Verify `app/` folder structure correctness against `plan.md` (no subfolders to be moved, only Links to be updated).

---

## Phase 2: User Story 1 - Navigate Hierarchical Inventory Routes (Priority: P1) 🎯 MVP

**Goal**: Update all inventory-related links to ensure they naturally group under `/inventory`. This primarily targets the Sidebar but includes deep-link auditing.

**Independent Test**: Can be fully tested by clicking all links inside the Inventory section of the Sidebar.

### Implementation for User Story 1

- [x] T002 [US1] Update `href="/inventory"` occurrences inside `components/Sidebar.tsx` if not already standard.
- [x] T003 [US1] Audit `app/inventory/**/*.tsx` files for any programmatic router pushes or internal `<Link>` tags pointing to old inventory routes.

**Checkpoint**: At this point, User Story 1 is functional: Inventory navigation relies entirely on hierarchical paths.

---

## Phase 3: User Story 2 - Navigate Hierarchical Sales Routes (Priority: P1)

**Goal**: Ensure sales and customer pages are grouped under `/sales`.

**Independent Test**: Can be fully tested by navigating to invoices and customers in the application.

### Implementation for User Story 2

- [x] T004 [P] [US2] Update `href="/orders"` to `href="/sales/invoices"` inside `components/Sidebar.tsx`.
- [x] T005 [P] [US2] Update `href="/customers"` to `href="/sales/customers"` inside `components/Sidebar.tsx`.
- [x] T006 [US2] Perform codebase search for `href="/orders"` or `router.push('/orders')` and replace with `/sales/invoices`.
- [x] T007 [US2] Perform codebase search for `href="/customers"` or `router.push('/customers')` and replace with `/sales/customers`.

**Checkpoint**: At this point, Sales routing is hierarchical and functional.

---

## Phase 4: User Story 3 - Visual & Functional Continuity (Priority: P1)

**Goal**: Migrate all other detached modules (Purchases, Accounting, Marketing) and ensure zero layout breakages. Ensure 100% design harmony globally.

**Independent Test**: Visit all restructured pages and confirm layout/wrappers apply successfully.

### Implementation for User Story 3

- [x] T008 [P] [US3] Update `href="/suppliers"` to `href="/purchases/suppliers"` in `components/Sidebar.tsx`.
- [x] T009 [P] [US3] Update `href="/reports/expenses"` to `href="/accounting/expenses"` in `components/Sidebar.tsx`.
- [x] T010 [P] [US3] Update `href="/reports/shifts"` to `href="/accounting/shifts"` in `components/Sidebar.tsx`.
- [x] T011 [P] [US3] Update `href="/reports/financials"` to `href="/accounting/financials"` in `components/Sidebar.tsx`.
- [x] T012 [P] [US3] Update `href="/reports/bi"` to `href="/reports/analytics"` in `components/Sidebar.tsx`.
- [x] T013 [P] [US3] Update `href="/offers"` to `href="/marketing/offers"` in `components/Sidebar.tsx`.
- [x] T014 [US3] Global search for above obsolete routes internally and replace them with their respective hierarchical paths.
- [x] T015 [US3] Validate that global styles (`cairo` font, active states) function flawlessly across affected pages and Sidebar items.

**Checkpoint**: All routing is now logical and aligned visually.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T016 Run application locally and verify dashboard charts, tables, and nested pages resolve properly without 404 errors.
- [ ] T017 Update main `README.md` or internal documentation (if necessary) to reflect the new hierarchical structure of `/app/`.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **User Stories (Phase 2-4)**: Can proceed sequentially or in parallel (since they touch different route mappings).
- **Polish (Final Phase)**: Depends on all user stories being completed.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup
2. Complete Phase 2: US1 (Inventory Routing)
3. Validate US1 independently

### Incremental Delivery
Proceed to US2 (Sales) and then US3 (Remaining logic + Visual checks) one by one to prevent overarching bugs.
