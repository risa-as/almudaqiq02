# Contract: Backend Changes for Mobile (021)

Exactly three files change. No schema, middleware, or new endpoints. Web behavior is byte-identical for requests that lack the new header.

## 1. `lib/api-helpers.ts` — Bearer-or-cookie token extraction

**Current**: `getTenantId()`, `getAuthContext()`, `getSuperAdminContext()` read only `cookies().get('auth-token')`.

**New contract**: a private `getRequestToken()` helper resolves the token as:

1. `headers().get('authorization')` starting with `Bearer ` → the remainder, else
2. `cookies().get('auth-token')?.value`, else `null`.

All three exported functions use it. Verification and payload mapping are unchanged (`verifyAccessToken`, tenantId/sub/role/branchId). Precedence (header first) matches `middleware.ts` lines 97–101, so middleware and route handlers always agree on which token authenticates a request.

## 2. `app/api/auth/login/route.ts` — refresh token in body for mobile clients

**Trigger**: request header `x-client-type: mobile` (exact, case-insensitive value `mobile`).

**Change**: in `issueLocalLoginResponse` (tenant users) only — the response JSON additionally includes:

```jsonc
{
  "accessToken": "…",           // unchanged
  "refreshToken": "…",          // NEW — mobile only
  "user": {
    "id": "…", "email": "…", "role": "…",
    "username": "…",            // NEW — mobile only (display)
    "branchId": "…|null"        // NEW — mobile only (routing)
  },
  "tenant": { "id": "…", "name": "…" },   // unchanged
  "redirectTo": "…"             // unchanged (ignored by mobile)
}
```

Cookies are still set (harmless to mobile). **SUPER_ADMIN branch of login never includes refreshToken in the body** — the mobile app refuses that role client-side, and the server does not hand its refresh token to a client that declares itself mobile: when `x-client-type: mobile` and the matched account is a SuperAdmin, return `403 { error }` directing to the web platform (FR-006).

Without the header: response is byte-identical to today.

## 3. `app/api/auth/me/route.ts` — accept Bearer

**Change**: replace direct cookie read with the same shared extraction as (1) — via `getAuthContext()` plus `getTenantFeatures`. Response shape unchanged:

```jsonc
{ "user": { "id", "role", "tenantId", "branchId" }, "features": { "<FeatureKey>": true|false, … }, "isElectron": false }
```

`{ "user": null }` when unauthenticated — mobile treats that as session-invalid.

## Explicit non-changes (verified already sufficient)

- `middleware.ts` — already prefers `Authorization: Bearer` over the cookie for every protected path, and its CASHIER/STOCK_KEEPER path allowlists already cover every endpoint the mobile app calls for those roles.
- `app/api/auth/refresh/route.ts` — already accepts `{ "refreshToken": "…" }` in the JSON body (cookie takes precedence when present; mobile sends no cookies) and returns `{ "accessToken": "…" }` in the body. Refresh tokens are not rotated — the 30-day token stays valid until expiry/revocation (existing policy, SC-006).
- Logout: mobile logout is client-side wipe (SecureStore + caches). No server call required; the refresh token simply ages out or can be revoked from existing admin tooling.
