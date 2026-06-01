# Research: AI Assistant Chat with Function Calling

**Branch**: `020-ai-assistant-chat` | **Date**: 2026-05-16

---

## Decision 1: AI Provider — Gemini 2.0 Flash

**Decision**: Use Google Gemini 2.0 Flash via `@google/generative-ai` SDK.

**Rationale**:
- Generous free tier (sufficient for dev + early production).
- Excellent Arabic language comprehension and generation.
- Native Function Calling support with automatic tool selection.
- `@google/generative-ai` is a lightweight npm package compatible with Next.js App Router edge/Node runtime.
- `gemini-2.0-flash` model balances speed and intelligence for conversational analytics.

**Alternatives considered**:
- GPT-4o-mini (OpenAI): Slightly cheaper per token but requires credit card setup; no free tier. Equally good Arabic support.
- Claude API (Anthropic): Best reasoning quality but higher cost; tool use has slightly different API shape.
- Chosen Gemini because of free tier and Arabic quality.

---

## Decision 2: Function Calling Architecture — Server-Side Tool Execution

**Decision**: All 6 tool calls are executed server-side inside `POST /api/ai/chat`. Gemini sends a `functionCall` response → server runs the Prisma query → sends `functionResponse` back to Gemini → Gemini writes the final Arabic answer.

**Rationale**:
- Database credentials never leave the server.
- Tenant isolation enforced in one place (the tool executor), not scattered across client code.
- The full Gemini multi-turn Function Calling loop fits in a single HTTP request (Gemini → tool → Gemini → final answer).
- No need for streaming in v1 (10-second budget is acceptable).

**Alternatives considered**:
- Client-side tool execution: Rejected — would expose DB queries and break tenant isolation.
- Streaming responses: Considered but adds complexity. Deferred to v2.

**Tool execution loop**:
```
POST /api/ai/chat
  ├─ Auth guard (getAuthContext)
  ├─ Call Gemini with message + history + tool definitions
  ├─ If response.functionCall → execute Prisma tool → send functionResponse to Gemini
  ├─ Repeat if Gemini calls another tool (max 5 rounds to prevent loops)
  └─ Return final text response to client
```

---

## Decision 3: Conversation History — React State (Session-Only)

**Decision**: Conversation history is stored in React `useState` in `ChatWidget.tsx`. It is passed to the API on every request as a `history` array. No database persistence in v1.

**Rationale**:
- Spec explicitly scopes v1 to session-only persistence.
- Eliminates need for a new DB table/migration.
- Reduces API complexity (no history fetch/save on every message).
- History clears on browser tab close — expected behavior per spec.

**Gemini history format**:
```typescript
type ChatHistory = {
  role: 'user' | 'model'
  parts: [{ text: string }]
}[]
```
Last 20 messages sent to Gemini to stay within context limits.

**Alternatives considered**:
- Server-side session (Redis/DB): Deferred to v2 for cross-device continuity.

---

## Decision 4: 6 Tool Definitions and Their Prisma Queries

### `get_sales_report`
**Parameters**: `{ start_date: string, end_date: string, branch_id?: string }`  
**Query**: `prisma.transaction.findMany` where `type = SALE`, `date between start/end`, optionally `branchId`.  
**Returns**: `{ total_revenue, total_transactions, items_sold, by_day: [{date, revenue}] }`

### `get_inventory_levels`
**Parameters**: `{ branch_id?: string, low_stock_only?: boolean }`  
**Query**: `prisma.product.findMany` with stock quantity, optionally filtered by `quantity <= reorderLevel`.  
**Returns**: `{ products: [{name, category, quantity, reorder_level, status}] }`

### `get_financial_summary`
**Parameters**: `{ start_date: string, end_date: string }`  
**Query**: Aggregate sales revenue from `transaction`, costs from `purchaseOrder`/expenses.  
**Returns**: `{ gross_revenue, total_cost, net_profit, profit_margin_pct }`

### `get_top_products`
**Parameters**: `{ period: 'today'|'week'|'month', limit?: number, branch_id?: string }`  
**Query**: `prisma.transactionItem.groupBy` on `productId`, sum `quantity`, join product name.  
**Returns**: `{ products: [{rank, name, category, units_sold, revenue}] }`

### `get_branch_stats`
**Parameters**: `{ start_date: string, end_date: string }`  
**Query**: `prisma.transaction.groupBy` on `branchId`, aggregate revenue, join branch name.  
**Returns**: `{ branches: [{name, total_revenue, total_transactions, avg_transaction}] }`

### `get_recent_transactions`
**Parameters**: `{ limit?: number, branch_id?: string, type?: 'SALE'|'REFUND'|'PURCHASE' }`  
**Query**: `prisma.transaction.findMany` ordered by `createdAt DESC`, limit N.  
**Returns**: `{ transactions: [{id, date, type, amount, branch, cashier}] }`

---

## Decision 5: System Prompt Language — Arabic-First

**Decision**: System prompt instructs Gemini to always respond in Arabic, use a friendly professional tone, and decline off-topic questions politely.

**System prompt key directives**:
1. Always respond in Arabic (العربية) regardless of input language.
2. You are a business assistant for a supermarket management system.
3. Only answer questions about sales, inventory, purchases, finances, and branches.
4. For off-topic questions, respond: "أنا متخصص فقط في بيانات متجرك. هل لديك سؤال عن المبيعات أو المخزون؟"
5. Format numbers with Arabic locale separators when helpful.
6. If data is empty, say so clearly and suggest the admin check their records.

---

## Decision 7: Multi-Provider Architecture — Switchable via Environment Variable

**Decision**: Add a provider abstraction layer (`lib/ai/providers/`) so the AI backend can be switched between **Gemini 2.0 Flash** (default) and **OpenAI GPT-4o-mini** by setting a single env var: `AI_PROVIDER=gemini` or `AI_PROVIDER=openai`.

**Architecture**:
```
lib/ai/
├── providers/
│   ├── interface.ts      # Shared AIProvider interface + ToolDefinition/ConversationTurn types
│   ├── gemini.ts         # Gemini 2.0 Flash implementation (uses @google/generative-ai)
│   └── openai.ts         # GPT-4o-mini implementation (uses openai SDK)
├── factory.ts            # getAIProvider() — reads AI_PROVIDER, returns correct provider
├── tools.ts              # 16 tool definitions (provider-agnostic ToolDefinition[]) + executors
└── prompts.ts            # Arabic system prompt (shared)
```

**Common AIProvider interface**:
```typescript
interface AIProvider {
  name: string
  generateResponse(params: {
    message: string
    history: ConversationTurn[]
    toolDefinitions: ToolDefinition[]
    systemPrompt: string
    executeToolCall: (name: string, args: unknown) => Promise<unknown>
  }): Promise<{ reply: string; toolsInvoked: string[] }>
}
```

Each provider handles its own format differences internally:
- **Gemini**: `functionDeclarations` format, `role: 'user'|'model'`, `functionCall`/`functionResponse` parts
- **OpenAI**: `tools: [{type:'function', function:{...}}]` format, `role: 'user'|'assistant'`, `tool_calls` in response

The chat API route (`app/api/ai/chat/route.ts`) only talks to the `AIProvider` interface — zero provider-specific code in the route.

**Rationale**:
- One env var change is all that's needed to switch AI providers — no code changes.
- Both providers are fully isolated; adding a third (e.g., Claude API) only requires creating a new file in `providers/`.
- Tool definitions and executors are shared — no duplication.
- Arabic quality tested: both Gemini 2.0 Flash and GPT-4o-mini produce high-quality Arabic.

**Environment variables**:
```bash
AI_PROVIDER=gemini        # default — can be 'gemini' or 'openai'
GEMINI_API_KEY=...        # required when AI_PROVIDER=gemini
OPENAI_API_KEY=...        # required when AI_PROVIDER=openai
```

**Provider comparison**:
| | Gemini 2.0 Flash | GPT-4o-mini |
|--|--|--|
| Default | ✅ Yes | No |
| Free tier | ✅ Yes | No (pay-per-use) |
| Arabic quality | Excellent | Excellent |
| Cost (paid) | ~$0.075/1M tokens | ~$0.15/1M tokens |
| Function Calling | Native | Native |
| SDK | `@google/generative-ai` | `openai` |

---

## Decision 6: Floating Widget Injection Point

**Decision**: Inject `<ChatWidget />` as the last child of the `<main>` element in `app/(tenant)/layout.tsx`. This places it in the stacking context of the tenant layout, above the sidebar but below any modals.

**Rationale**: The layout already wraps all tenant pages. A single injection point means the widget is available everywhere without touching individual pages. The `BranchContext` and auth are available via hooks.

**Z-index**: Widget uses `z-50` (Tailwind). Existing modals in the project use `z-50` too — widget will use `z-[60]` to stay on top.

---

## Environment Variables Required

```bash
GEMINI_API_KEY=your-gemini-api-key-here
```

Add to `.env.local` and document in `.env.example`.
