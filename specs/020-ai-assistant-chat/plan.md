# Implementation Plan: AI Assistant Chat with Function Calling

**Branch**: `020-ai-assistant-chat` | **Date**: 2026-05-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/020-ai-assistant-chat/spec.md`

## Summary

Build an AI-powered chat assistant for tenant admins that uses Gemini 2.0 Flash with Function Calling to answer business questions in Arabic/English. The assistant dynamically selects and invokes data tools (`get_sales_report`, `get_inventory_levels`, `get_financial_summary`, `get_top_products`, `get_branch_stats`, `get_recent_transactions`) against the tenant's own Prisma-scoped database, then returns analytical Arabic summaries. A floating widget is injected into the existing `(tenant)/layout.tsx`; a standalone `/assistant` page is also provided.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20 (Next.js 16.1.6 App Router)  
**Primary Dependencies**: `@google/generative-ai` (Gemini SDK), `openai` (OpenAI SDK), Prisma 5.22, `jose` (JWT), Next.js App Router API routes  
**Storage**: PostgreSQL via Prisma (existing) — conversation history is session-only (no new DB table in v1)  
**Testing**: Manual + Postman/curl for API routes; component testing via existing project patterns  
**Target Platform**: Web (desktop + mobile RTL)  
**Project Type**: Web service — Next.js full-stack SaaS  
**Performance Goals**: AI response delivered within 10 seconds end-to-end  
**Constraints**: Strict tenant isolation on every tool call; no cross-tenant data leakage; API keys via env vars only (`GEMINI_API_KEY`, `OPENAI_API_KEY`); `AI_PROVIDER` env var selects active provider (default: `gemini`)  
**Scale/Scope**: One AI API call per user message; provider-agnostic via `AIProvider` interface; tool calls execute as Prisma queries within the same request

---

## Constitution Check

*Constitution template is unfilled for this project — no project-specific gates defined. Applying general software quality gates:*

| Gate | Status | Notes |
|------|--------|-------|
| Tenant isolation on all data access | PASS | Every tool call uses `getAuthContext()` + `getTenantPrisma(tenantId)` |
| Auth on every API route | PASS | `getAuthContext()` guard on `POST /api/ai/chat` |
| No secrets in code | PASS | `GEMINI_API_KEY` from `.env` only |
| No new DB schema in v1 | PASS | Chat history is client-session only (React state) |
| Follows existing API route pattern | PASS | Same `getAuthContext → getTenantPrisma → response` pattern |

No violations. Proceed.

---

## Project Structure

### Documentation (this feature)

```text
specs/020-ai-assistant-chat/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── ai-chat-api.md   ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── api/
│   └── ai/
│       └── chat/
│           └── route.ts               # POST — provider-agnostic chat endpoint
│
├── (tenant)/
│   └── assistant/
│       └── page.tsx                   # Full-page chat interface

lib/
└── ai/
    ├── providers/
    │   ├── interface.ts               # AIProvider interface + shared types
    │   ├── gemini.ts                  # Gemini 2.0 Flash implementation
    │   └── openai.ts                  # GPT-4o-mini implementation
    ├── factory.ts                     # getAIProvider() — reads AI_PROVIDER env var
    ├── tools.ts                       # 16 tool definitions (provider-agnostic) + executors
    └── prompts.ts                     # Arabic system prompt (shared)

components/
└── ai-assistant/
    ├── ChatWidget.tsx                 # Floating button + slide-up panel
    ├── ChatMessage.tsx                # RTL message bubble
    └── ChatInput.tsx                  # Textarea + send button

hooks/
└── useChat.ts                         # Shared chat state/logic

app/(tenant)/layout.tsx                # MODIFIED: inject <ChatWidget />
```

**Structure Decision**: Provider abstraction via `lib/ai/providers/` — adding a new AI provider only requires creating one file. The chat route and all tool executors are 100% provider-agnostic. Both SDKs installed (`@google/generative-ai` + `openai`); active provider controlled by `AI_PROVIDER` env var.

---

## Complexity Tracking

No constitution violations — table not required.

---

## Implementation Phases

### Phase A — Core Pipeline (P1, P2 stories)
*Deliverable: Admin can ask a question and get a real data-backed AI answer via either Gemini or OpenAI.*

1. Install both SDKs: `npm install @google/generative-ai openai`
2. Create `lib/ai/providers/interface.ts` — `AIProvider` interface + shared `ToolDefinition`, `ConversationTurn` types
3. Create `lib/ai/providers/gemini.ts` — Gemini 2.0 Flash implementation of `AIProvider`
4. Create `lib/ai/providers/openai.ts` — GPT-4o-mini implementation of `AIProvider`
5. Create `lib/ai/factory.ts` — `getAIProvider()` reads `AI_PROVIDER` env var (default: `'gemini'`)
6. Create `lib/ai/tools.ts` — 16 provider-agnostic tool schemas + `executeToolCall()` dispatcher
7. Create `app/api/ai/chat/route.ts` — calls `getAIProvider().generateResponse(...)`, zero provider-specific code
8. Smoke test: set `AI_PROVIDER=gemini`, ask sales question → reply. Set `AI_PROVIDER=openai`, same question → reply.

### Phase B — Chat UI (floating widget)
*Deliverable: Accessible chat widget on every tenant page.*

6. Create `components/ai-assistant/ChatMessage.tsx`
7. Create `components/ai-assistant/ChatInput.tsx`
8. Create `components/ai-assistant/ChatWidget.tsx` — floating FAB + slide-up panel, session history in React state
9. Inject `<ChatWidget />` into `app/(tenant)/layout.tsx`

### Phase C — Full-Page Chat + Polish
*Deliverable: Standalone `/assistant` page + error handling + out-of-scope replies.*

10. Create `app/(tenant)/assistant/page.tsx` — full-page chat using same components
11. Add graceful error UI (AI unavailable message in Arabic)
12. Add "outside domain" detection to system prompt
13. Add loading/thinking indicator in ChatWidget
14. Add conversation window limit (last 20 messages sent to Gemini)
