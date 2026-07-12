# Data Model: Role-Based Mobile App (021)

**No server-side entities are added or modified.** The mobile app is a pure client of the existing Prisma schema (User/Role, CashierShift, Transaction, Product, ProductBatch, StocktakeSession, PurchaseOrder, StockTransfer, Supplier, SubscriptionPlan features). This document defines the **client-side** state models only.

## Auth store (zustand, hydrated from SecureStore + `/api/auth/me`)

```ts
type Session = {
  accessToken: string          // JWT, ~8h — SecureStore key 'sm.access'
  refreshToken: string         // JWT, 30d — SecureStore key 'sm.refresh'
}

type AuthUser = {
  id: string
  role: 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER' | 'STOCK_KEEPER'   // SUPER_ADMIN → rejected at login
  tenantId: string
  branchId: string | null      // null for ADMIN (org-wide)
}

type FeatureMap = Partial<Record<
  'stock_transfers' | 'branch_comparison' | 'advanced_analytics' |
  'stock_movement' | 'ai_assistant' | 'ai_smart_buy' | 'audit_log',
  boolean
>>   // mirror of lib/features.ts FEATURE_KEYS — duplicated constant, no cross-import

type AuthState = {
  status: 'booting' | 'signedOut' | 'signedIn'
  session: Session | null
  user: AuthUser | null
  features: FeatureMap
  // actions: signIn(credentials), restore(), refresh(), signOut() — signOut wipes SecureStore + query cache (FR-005)
}
```

**Transitions**: `booting → signedIn` (valid stored session, `/api/auth/me` ok) · `booting → signedOut` (no/invalid session) · `signedIn → signedOut` (explicit logout, refresh failure, 401-after-refresh). Role is re-read on every restore/refresh — a changed role re-routes to the new interface (spec edge case).

## Cart store (cashier, zustand — survives request failures, cleared only on confirmed success)

```ts
type CartLine = {
  productId: string
  name: string                 // display snapshot
  barcode: string | null
  unitPrice: number            // server price at scan time; server re-validates at checkout
  qty: number
  offerId?: string             // applied offer
}

type CartState = {
  lines: CartLine[]
  discount: number             // invoice-level discount
  customerId: string | null    // for credit sales
  paymentMethod: 'CASH' | 'CARD' | 'CREDIT'
  submitting: boolean          // single-flight guard (R9)
}
```

**Invariants**: qty ≥ 1; a failed checkout never mutates `lines`; `submitting` blocks a second POST until the first resolves; on ambiguous failure the shift-invoices list is refetched before retry is offered.

## Branch store (manager only)

```ts
type BranchState = {
  branches: { id: string; name: string }[]   // from /api/branches
  selectedBranchId: string | null            // ADMIN: switchable; BRANCH_MANAGER: fixed = user.branchId, no switcher UI
}
```

All manager queries include the selected branch in their React Query key, so switching branch refetches everything (US4-AS2).

## Stocktake session screen state (local to `(stock)/stocktake/[id]`)

```ts
type CountEntry = {
  productId: string
  name: string
  recordedQty: number          // server stock at session start
  countedQty: number | null    // entered after scan
  // discrepancy = countedQty - recordedQty (computed, shown before submit — US3-AS1)
}
```

Preserved in component/zustand state across scan cycles and across a failed submit (edge case: token expiry mid-session must not lose counts).

## React Query cache (server state, not persisted)

- Keys are namespaced `[resource, tenant-scope-free params, branchId]` — tenant scoping is server-side from the JWT, never a client parameter (FR-014).
- Money/stock figures use `staleTime: 0` + refetch-on-focus (dashboards must match web — SC-004); reference lists (suppliers, branches) use minutes-level `staleTime`.
- `signOut()` calls `queryClient.clear()` (FR-005).
