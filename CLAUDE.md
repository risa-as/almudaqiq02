# SuperMarket Cloud — Development Guidelines

Auto-generated from feature plans. Last updated: 2026-07-11

## Active Technologies
- TypeScript 5.x (mobile); existing Next.js 16.1.6 backend untouched except the 3 files above + Expo SDK (latest stable at `create` time), expo-router, @tanstack/react-query v5, zustand, expo-secure-store, expo-camera (CameraView barcode scanning), react-native-gifted-charts, date-fns (021-mobile-app)
- None on-device beyond SecureStore (tokens) and React Query in-memory cache; server PostgreSQL is the single source of truth (021-mobile-app)

- **Framework**: Next.js 16.1.6 (App Router, TypeScript)
- **Database**: PostgreSQL + Prisma 5.22 (multi-tenant scoped client)
- **Auth**: JWT via `jose` v6, httpOnly `auth-token` cookie (8h access / 30d refresh)
- **AI**: `@google/generative-ai` — Gemini 2.0 Flash with Function Calling
- **Styling**: TailwindCSS v4 + RTL (Arabic) support
- **State**: React Context (`BranchContext`, `ThemeContext`)
- **Charts**: Recharts v3
- **Notifications**: react-hot-toast
- **Validation**: Zod v3
- **Dates**: date-fns v4
- **Icons**: lucide-react

## Project Structure

```text
app/
├── (tenant)/           # Tenant dashboard (auth-protected)
│   ├── layout.tsx      # Injects <ChatWidget /> — BranchContext + ThemeContext available
│   ├── dashboard/
│   ├── inventory/
│   ├── sales/
│   ├── purchases/
│   ├── accounting/
│   ├── reports/
│   ├── branches/
│   ├── marketing/
│   ├── transfers/
│   ├── settings/
│   └── assistant/      # NEW: full-page AI chat
├── (super-admin)/      # Platform admin routes
├── api/
│   ├── auth/           # login / logout / refresh
│   ├── reports/        # sales / inventory / branches / shifts / stock-movement
│   ├── products/
│   ├── inventory/
│   ├── branches/
│   ├── orders/
│   ├── offers/
│   ├── shifts/
│   ├── audit/
│   ├── sync/
│   ├── transactions/
│   └── ai/
│       └── chat/       # NEW: POST — Gemini Function Calling endpoint
├── pos/
└── login/

lib/
├── auth.ts             # JWT sign/verify, token payload types
├── api-helpers.ts      # getAuthContext() — reads JWT from cookie
├── multi-tenant/
│   └── prisma.ts       # getTenantPrisma(tenantId), getBranchPrisma(tenantId, branchId)
└── ai/                 # NEW
    ├── gemini.ts       # Gemini client singleton
    ├── tools.ts        # 6 Function Calling tool definitions + Prisma executors
    └── prompts.ts      # Arabic system prompt

components/
└── ai-assistant/       # NEW
    ├── ChatWidget.tsx  # Floating FAB + slide-up panel
    ├── ChatMessage.tsx # Message bubble (user/assistant)
    └── ChatInput.tsx   # Textarea + send button

contexts/
├── BranchContext.tsx   # selectedBranch, branches[], isOwner
└── ThemeContext.tsx    # dark/light mode
```

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
npx prisma studio # Browse database
npx prisma migrate dev --name <name>  # Create migration
```

## Auth Pattern (use in every new API route)

```typescript
import { getAuthContext } from '@/lib/api-helpers'
import { getTenantPrisma } from '@/lib/multi-tenant/prisma'

export async function GET/POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tenantId, userId, role, branchId } = auth
  const db = getTenantPrisma(tenantId)  // auto-scopes all queries to tenantId
  // ...
}
```

## AI Chat Pattern (for feature 020)

```typescript
// All 6 tools are defined in lib/ai/tools.ts
// Tool executors receive (args, auth) — tenantId always from auth, never from args
// Max 5 tool-call rounds per request to prevent loops
// History trimmed to last 20 messages before sending to Gemini
```

## Recent Features

- **019 — Premium UI Redesign**: Complete Indigo/Violet theme overhaul across all pages + TypeScript fixes
- **018 — Roles & Auth Overhaul**: Multi-role JWT system (SUPER_ADMIN, ADMIN, BRANCH_MANAGER, CASHIER, STOCK_KEEPER)
- **020 — AI Assistant Chat**: Gemini 2.0 Flash + Function Calling, 6 data tools, floating widget in tenant layout

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
