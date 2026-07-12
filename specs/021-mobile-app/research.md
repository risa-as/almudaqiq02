# Research: Role-Based Mobile App (021)

**Date**: 2026-07-11 · All Technical Context unknowns resolved; no NEEDS CLARIFICATION remain.

## R1. App framework & navigation

- **Decision**: Expo (managed workflow, latest stable SDK) + expo-router with role route groups `(admin)`, `(cashier)`, `(stock)`.
- **Rationale**: File-based routing mirrors the Next.js App Router mental model already used in this repo; route groups give hard separation of the three interfaces with one redirect point at the root layout. Expo Go covers day-to-day dev; EAS produces the Android APK for direct distribution (spec assumption). expo-secure-store and expo-camera both work in Expo Go, so no custom dev client is needed.
- **Alternatives considered**: Bare React Native + React Navigation — more control, but slower setup, manual native config for camera/keystore, and no OTA story; rejected for a v1 built by a solo developer.

## R2. Auth token transport & backend delta

- **Decision**: `Authorization: Bearer <accessToken>` on every mobile request. Backend delta limited to 3 files: `lib/api-helpers.ts` (accept Bearer before cookie), `app/api/auth/login/route.ts` (include `refreshToken` in JSON body only when `x-client-type: mobile` header present), `app/api/auth/me/route.ts` (shared extraction).
- **Rationale**: Verified in code: `middleware.ts` lines 97–101 already prefer Bearer over the cookie, and `app/api/auth/refresh/route.ts` lines 8–9 already accept `{ refreshToken }` in the body and return `accessToken` in the body. Login already returns `accessToken` in the body (`issueLocalLoginResponse`). The only missing pieces are Bearer support in `getAuthContext()` and body delivery of the refresh token. Gating the refresh-token-in-body on `x-client-type: mobile` preserves the web's httpOnly-only posture (XSS on the web app still cannot read a refresh token).
- **Alternatives considered**: Cookie jar in the mobile HTTP client — fragile across RN fetch implementations and app restarts; always returning refreshToken in body — needless exposure to web clients. Both rejected.

## R3. Token storage & refresh strategy

- **Decision**: `expo-secure-store` for `accessToken` + `refreshToken` (+ cached `user`/`features` JSON in plain AsyncStorage-equivalent is NOT used — user/features are refetched from `/api/auth/me` on cold start). Client wrapper: on 401 → single-flight POST `/api/auth/refresh` with stored refresh token → retry original request once → on refresh failure, clear SecureStore and route to `/login`.
- **Rationale**: SecureStore maps to Android Keystore/iOS Keychain (FR-003). Access tokens live 8h, refresh 30d (existing policy, SC-006). Single-flight prevents refresh stampedes when several queries 401 together.
- **Alternatives considered**: Persisting the React Query cache for instant cold-start — deferred; adds staleness risk for money figures with little v1 benefit.

## R4. Barcode scanning

- **Decision**: `expo-camera`'s `CameraView` with `barcodeScannerSettings: { barcodeTypes: ['ean13', 'ean8', 'code128', 'qr'] }`, wrapped in one shared `BarcodeScannerView` component with: throttle/dedupe of repeated reads, torch toggle, and a permission-denied fallback exposing manual code entry + name search (FR-012).
- **Rationale**: `expo-barcode-scanner` is deprecated; expo-camera is the maintained path and supports all four required formats on Android. One shared component guarantees selling/stocktake/receiving behave identically.
- **Alternatives considered**: `react-native-vision-camera` + MLKit — faster scanning on low-end devices but requires a custom dev client and native config; revisit only if field performance disappoints.

## R5. Server state & local state

- **Decision**: TanStack Query v5 for all server data (queries keyed per branch + params, `staleTime` tuned per screen); Zustand for auth session, cashier cart, and ADMIN-selected branch.
- **Rationale**: The cart must survive checkout failure (edge case in spec) — a Zustand store detached from request lifecycles does that naturally. React Query gives retry/backoff and pull-to-refresh semantics for dashboards.
- **Alternatives considered**: Redux Toolkit — more ceremony for the same result; React Context alone — re-render storms on cart updates in a scan-heavy screen.

## R6. Charts (manager dashboard)

- **Decision**: `react-native-gifted-charts` for the dashboard bar/line charts.
- **Rationale**: Pure-JS + reanimated only, no Skia dependency, RTL-tolerant, sufficient for KPI trends. victory-native (XL) requires react-native-skia — heavier install and native surface for marginal gain here.
- **Alternatives considered**: victory-native — rejected for dependency weight; SVG hand-rolling — rejected for effort.

## R7. Arabic RTL

- **Decision**: `I18nManager.allowRTL(true); I18nManager.forceRTL(true)` applied at app bootstrap with a one-time restart guard; all strings centralized in `src/i18n/ar.ts`; layouts written RTL-first (row directions, text alignment, chevron/mirror icons audited per screen — SC-007).
- **Rationale**: The product is Arabic-only (FR-018), matching the web. Centralizing strings keeps future i18n possible without committing to it now.
- **Alternatives considered**: Per-component `direction: 'rtl'` styles without I18nManager — breaks native components (tab bars, back gestures); rejected.

## R8. Feature gating on mobile

- **Decision**: After login (and on session restore), call `/api/auth/me` → `{ user, features }`; store the `FeatureMap` in the auth store; tab/screen registration consults it (e.g., assistant tab requires `ai_assistant`, transfers requires `stock_transfers`, audit view requires `audit_log`). Feature keys duplicated as a typed constant in `mobile/src` — no cross-import from `lib/features.ts`.
- **Rationale**: `/api/auth/me` already returns exactly this map (verified); server routes keep enforcing 403 regardless (FR-017), so the client map is cosmetic-only. Duplicating 7 string keys is cheaper than entangling the two builds.
- **Alternatives considered**: Shared npm workspace package for feature keys — overkill for 7 constants; rejected.

## R9. Write-safety without server idempotency keys

- **Decision**: Client-side protections only in v1: every mutation button enters a pending state (single submission), the cart/stocktake input is preserved on failure, and after an ambiguous failure (timeout after send) the app refetches the relevant list (current-shift invoices / session counts) so the user can see whether the write landed before retrying.
- **Rationale**: The existing API has no idempotency-key mechanism, and adding one violates the "no new server logic" boundary. Honest limitation documented: a timeout-after-commit can still require the user to check the invoice list before retrying — the refetch flow makes that a one-tap check (FR-015's "safely retryable" is met procedurally).
- **Alternatives considered**: Server idempotency keys — right long-term answer, deferred to a future backend feature; client-generated invoice IDs — schema change, rejected for v1.

## R10. Environment & distribution

- **Decision**: `EXPO_PUBLIC_API_URL` env var (`.env` per environment) consumed in `src/api/client.ts`; EAS `preview` profile producing an installable APK for tenants; Android package id `com.supermarket.cloud`.
- **Rationale**: Matches the spec assumption of direct APK distribution; keeps store publication out of scope.
- **Alternatives considered**: Hardcoded production URL — kills local testing against `npm run dev`; rejected.
