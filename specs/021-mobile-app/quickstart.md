# Quickstart: Mobile App (021)

## Prerequisites

- Node 20+, the Expo Go app on an Android phone (same Wi-Fi as the dev machine), and the cloud repo's dev server running.
- The three backend files from `contracts/backend-changes.md` merged (branch `021-mobile-app`).

## Run against local backend

```bash
# 1. Backend (repo root) — note: phone must reach your machine's LAN IP, not localhost
npm run dev

# 2. Mobile
cd mobile
npm install
# .env — use your machine's LAN IP:
echo EXPO_PUBLIC_API_URL=http://192.168.1.X:3000 > .env
npx expo start        # scan the QR with Expo Go
```

## Gates (run before considering any task done)

```bash
cd mobile
npx tsc --noEmit      # type-check
npx expo-doctor       # dependency/config sanity
```

## Acceptance walkthrough (maps to spec user stories)

1. **US1 – roles**: sign in as CASHIER → lands on البيع; as STOCK_KEEPER → المخزون; as ADMIN → لوحة التحكم. Kill + reopen app → no login prompt. Sign in as SUPER_ADMIN → refused with Arabic message.
2. **US2 – selling**: open shift → scan a real EAN-13 → item in cart <1s → cash checkout → invoice visible in web dashboard (same branch) → return one line → close shift. Airplane-mode during checkout → Arabic error, cart intact.
3. **US3 – warehouse**: start stocktake → scan 3 products with wrong counts → discrepancies shown before submit. Open pending PO → scan + receive a line with expiry → batch appears in web inventory.
4. **US4 – manager**: dashboard numbers == web dashboard (same branch/day). ADMIN switches branch → all figures change. Approve a pending transfer → status changes on web. Ask assistant "ما هي مبيعات اليوم؟".
5. **US5 – gating**: sign into a tenant whose plan lacks `ai_assistant` → no assistant tab; API still 403s if called directly.

## Build the distributable APK

```bash
cd mobile
npx eas build --profile preview --platform android
```

`eas.json`'s `preview` profile outputs an installable `.apk` (not `.aab`). Set `EXPO_PUBLIC_API_URL` to the production URL in `eas.json` env for that profile.
