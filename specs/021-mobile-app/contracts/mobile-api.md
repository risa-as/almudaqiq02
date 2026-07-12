# Contract: Endpoints Consumed by the Mobile App (021)

All requests: `Authorization: Bearer <accessToken>`, JSON bodies, base URL from `EXPO_PUBLIC_API_URL`. Tenant/branch scoping is derived server-side from the JWT — the client never sends tenantId. **Authoritative request/response shapes live in each route file**; implementation tasks must read the route before writing its typed caller. This table fixes *which* endpoints each interface uses.

## Shared (all roles)

| Endpoint | Method | Use |
|---|---|---|
| `/api/auth/login` | POST | `{ email, password }` + header `x-client-type: mobile` → tokens + user (see backend-changes.md) |
| `/api/auth/refresh` | POST | `{ refreshToken }` → `{ accessToken }` (on 401, single-flight) |
| `/api/auth/me` | GET | session restore: `{ user, features }` — feature gating source |

## Cashier `(cashier)` — all paths inside middleware's `CASHIER_ALLOWED`

| Endpoint | Method | Use |
|---|---|---|
| `/api/products/search` | GET | name/barcode server-side search (scan resolution + manual fallback) |
| `/api/products` | GET | paged browse (secondary) |
| `/api/offers` | GET | active offers to apply at sale |
| `/api/shifts` | GET/POST | current shift status / open shift with opening balance |
| `/api/shifts/close` | POST | close shift with counted cash |
| `/api/transactions` | GET/POST | current-shift invoices / create sale (cart lines, payment, customerId?) |
| `/api/transactions/return` | POST | per-line return |
| `/api/transactions/refund` | POST | refund |
| `/api/customers` | GET | lookup for credit sales (balance) |

## Stock keeper `(stock)` — all paths inside middleware's `STOCK_KEEPER_ALLOWED`

| Endpoint | Method | Use |
|---|---|---|
| `/api/inventory` | GET | products + quantities + batches |
| `/api/inventory/alerts` | GET | low-stock alerts |
| `/api/inventory/expiry` | GET | near-expiry batches |
| `/api/inventory/check-barcode` | GET | barcode → product resolution on scan |
| `/api/stocktake` | GET/POST | sessions list / start session |
| `/api/stocktake/[id]` | GET/PUT | session detail / submit counts |
| `/api/purchases/orders` | GET | pending purchase orders |
| `/api/purchases/orders/[id]` | GET/PUT | order lines / receive quantities+expiry |
| `/api/transfers` | GET/POST | list / create transfer (`stock_transfers` gated) |
| `/api/transfers/[id]` | PUT | confirm receipt |
| `/api/suppliers` | GET | read-only suppliers + balances |

## Manager `(admin)` — ADMIN unrestricted; BRANCH_MANAGER same list, server scopes to their branch

| Endpoint | Method | Use |
|---|---|---|
| `/api/reports/dashboard` | GET | KPIs for dashboard (today sales/profit/invoices) |
| `/api/reports/sales` | GET | sales report with period params |
| `/api/reports/abc-analysis` | GET | ABC report |
| `/api/reports/offers-performance` | GET | offers report |
| `/api/reports/supplier-payables` | GET | payables report |
| `/api/expenses` | GET | expenses list |
| `/api/shifts` | GET | open shifts monitoring |
| `/api/transactions` | GET | live invoices feed |
| `/api/inventory/alerts` + `/api/inventory/expiry` | GET | alert cards |
| `/api/transfers` / `/api/transfers/[id]` | GET/PUT | pending approvals / approve (`stock_transfers` gated) |
| `/api/purchases/orders` / `[id]` | GET/PUT | PO review/approve |
| `/api/users` | GET | staff list |
| `/api/audit` | GET | audit trail (`audit_log` gated) |
| `/api/branches` | GET | branch switcher (ADMIN only) |
| `/api/ai/chat` | POST | AI assistant (`ai_assistant` gated; streaming supported per feature 020) |
| `/api/ai/conversations` | GET | assistant history |

## Cross-cutting client rules

1. **401 handling**: one silent refresh + retry, then sign-out (contract in backend-changes.md).
2. **403 with feature error**: render the upgrade/locked state, never a crash (FR-017).
3. **Arabic errors**: server already returns Arabic `error` strings — surface them verbatim; only network-level failures get client-side Arabic messages (FR-018).
4. **Ambiguous write failures**: refetch the owning list before offering retry (research R9, FR-015).
