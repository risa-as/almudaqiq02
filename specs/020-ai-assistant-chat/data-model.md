# Data Model: AI Assistant Chat with Function Calling

**Branch**: `020-ai-assistant-chat` | **Date**: 2026-05-16

---

## Overview

This feature adds **no new database tables** in v1. Conversation history is session-scoped (React state). All data accessed by the AI tools comes from existing Prisma models, queried through the tenant-scoped Prisma client.

---

## Client-Side Data Structures (TypeScript)

### ChatMessage
The unit of conversation stored in React state.

```typescript
interface ChatMessage {
  id: string                        // nanoid() or crypto.randomUUID()
  role: 'user' | 'assistant'
  content: string                   // Rendered text shown in UI
  timestamp: Date
  toolsInvoked?: string[]           // e.g. ['get_sales_report'] — for debug display
  isLoading?: boolean               // true while waiting for assistant response
  isError?: boolean                 // true if AI call failed
}
```

### ChatHistory (sent to API)
Trimmed to last 20 messages before sending. Matches Gemini's expected format.

```typescript
type GeminiHistoryEntry = {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

type ChatHistoryPayload = GeminiHistoryEntry[]  // max 20 entries
```

### ChatRequest (POST body to `/api/ai/chat`)

```typescript
interface ChatRequest {
  message: string                   // Current user message
  history: ChatHistoryPayload       // Previous messages (max 20)
  branchId?: string                 // Active branch from BranchContext (optional)
}
```

### ChatResponse (API response)

```typescript
interface ChatResponse {
  reply: string                     // AI-generated Arabic text
  toolsInvoked: string[]            // Which tools were called (for transparency)
  error?: string                    // Present only on failure
}
```

---

## Tool Input/Output Schemas

### get_sales_report

**Input**:
```typescript
{
  start_date: string    // ISO date: "2026-05-01"
  end_date: string      // ISO date: "2026-05-16"
  branch_id?: string    // UUID, optional — omit for all branches
}
```

**Output** (returned to Gemini as functionResponse):
```typescript
{
  total_revenue: number           // in tenant's currency
  total_transactions: number
  items_sold: number
  by_day: Array<{
    date: string
    revenue: number
    transactions: number
  }>
}
```

**Existing Prisma models used**: `Transaction` (type=SALE), `TransactionItem`

---

### get_inventory_levels

**Input**:
```typescript
{
  branch_id?: string
  low_stock_only?: boolean    // default: false
}
```

**Output**:
```typescript
{
  total_products: number
  low_stock_count: number
  products: Array<{
    name: string
    category: string
    quantity: number
    reorder_level: number
    status: 'ok' | 'low' | 'out'
  }>
}
```

**Existing Prisma models used**: `Product`, `Category`, `Inventory`/`Batch`

---

### get_financial_summary

**Input**:
```typescript
{
  start_date: string
  end_date: string
}
```

**Output**:
```typescript
{
  gross_revenue: number
  total_cost: number          // purchase costs
  total_expenses: number      // operational expenses
  net_profit: number          // gross_revenue - total_cost - total_expenses
  profit_margin_pct: number   // 0-100
}
```

**Existing Prisma models used**: `Transaction` (SALE), `PurchaseOrder`, `Expense`

---

### get_top_products

**Input**:
```typescript
{
  period: 'today' | 'week' | 'month'
  limit?: number     // default: 10
  branch_id?: string
}
```

**Output**:
```typescript
{
  period: string
  products: Array<{
    rank: number
    name: string
    category: string
    units_sold: number
    revenue: number
  }>
}
```

**Existing Prisma models used**: `TransactionItem`, `Product`, `Category`

---

### get_branch_stats

**Input**:
```typescript
{
  start_date: string
  end_date: string
}
```

**Output**:
```typescript
{
  branches: Array<{
    name: string
    total_revenue: number
    total_transactions: number
    avg_transaction_value: number
    rank: number
  }>
}
```

**Existing Prisma models used**: `Transaction`, `Branch`

---

### get_recent_transactions

**Input**:
```typescript
{
  limit?: number                         // default: 10, max: 50
  branch_id?: string
  type?: 'SALE' | 'REFUND' | 'PURCHASE'
}
```

**Output**:
```typescript
{
  transactions: Array<{
    id: string
    date: string            // ISO datetime
    type: string
    amount: number
    branch_name: string
    cashier_name?: string
    items_count: number
  }>
}
```

**Existing Prisma models used**: `Transaction`, `Branch`, `User`

### get_shift_summary

**Input**: `{ date?: string, branch_id?: string, cashier_id?: string }`

**Output**:
```typescript
{
  shifts: Array<{
    cashier_name: string
    branch_name: string
    date: string
    opening_cash: number
    closing_cash: number
    total_sales: number
    total_transactions: number
    cash_difference: number    // closing - opening - total_sales
    status: 'ok' | 'surplus' | 'shortage'
  }>
  summary: {
    total_shifts: number
    total_sales: number
    total_difference: number
  }
}
```
**Existing Prisma models used**: `Shift`, `User`, `Transaction` — verify field names

---

### get_orders_analysis

**Input**: `{ start_date: string, end_date: string, branch_id?: string, type?: string }`

**Output**:
```typescript
{
  total_orders: number
  avg_order_value: number
  by_type: Array<{
    type: 'DELIVERY' | 'DINE_IN' | 'TAKEAWAY'
    count: number
    revenue: number
    percentage: number
  }>
  peak_hours: Array<{ hour: number, label: string, count: number }>
  peak_day: string
}
```
**Existing Prisma models used**: `Transaction`/`Order` with `orderType` — verify field names

---

### get_discount_report

**Input**: `{ start_date: string, end_date: string, branch_id?: string }`

**Output**:
```typescript
{
  total_discount_amount: number
  discount_impact_pct: number     // discount / gross_revenue * 100
  total_discounted_transactions: number
  by_cashier: Array<{
    cashier_name: string
    discount_count: number
    total_discount: number
    avg_discount: number
  }>
  by_type: Array<{
    type: string
    count: number
    total_amount: number
  }>
}
```
**Existing Prisma models used**: `Transaction` (`discountAmount` field), `User` — verify field names

---

### get_staff_performance

**Input**: `{ start_date: string, end_date: string, branch_id?: string }`

**Output**:
```typescript
{
  period: string
  staff: Array<{
    rank: number
    name: string
    role: string
    branch_name: string
    total_transactions: number
    total_revenue: number
    avg_transaction_value: number
  }>
}
```
**Existing Prisma models used**: `Transaction`, `User`, `Branch`

---

### get_customer_insights

**Input**: `{ start_date?: string, end_date?: string }`

**Output**:
```typescript
{
  total_customers: number
  repeat_customers: number       // purchases > 1
  repeat_rate_pct: number
  avg_customer_spend: number
  new_customers_period: number   // joined in date range
  top_customers: Array<{
    name: string
    phone?: string
    total_purchases: number
    last_purchase_date: string
  }>
}
```
**Existing Prisma models used**: `Customer`, `Transaction`

---

### get_delivery_stats

**Input**: `{ start_date: string, end_date: string, branch_id?: string }`

**Output**:
```typescript
{
  total_delivery_orders: number
  avg_delivery_time_minutes: number
  late_orders_count: number
  late_rate_pct: number
  drivers: Array<{
    name: string
    orders_count: number
    avg_time_minutes: number
    late_count: number
    on_time_rate_pct: number
  }>
}
```
**Existing Prisma models used**: Delivery-related model or `Transaction` with delivery fields — verify schema

---

### get_purchase_orders_summary

**Input**: `{ start_date: string, end_date: string }`

**Output**:
```typescript
{
  total_spent: number
  total_orders: number
  avg_order_value: number
  by_supplier: Array<{
    supplier_name: string
    orders_count: number
    total_spent: number
    percentage: number
  }>
  top_purchased_products: Array<{
    product_name: string
    quantity: number
    total_cost: number
  }>
}
```
**Existing Prisma models used**: `PurchaseOrder`, `Supplier`, `Product`

---

### get_menu_performance

**Input**: `{ start_date?: string, end_date?: string, branch_id?: string, slow_only?: boolean }`

**Output**:
```typescript
{
  slow_movers: Array<{
    product_name: string
    category: string
    units_sold_period: number
    days_since_last_sale: number
    stock_level: number
  }>
  offer_impact: {
    with_offer_revenue: number
    without_offer_revenue: number
    lift_pct: number
    offers_analyzed: number
  }
}
```
**Existing Prisma models used**: `Product`, `TransactionItem`, `Offer`

---

### get_hourly_heatmap

**Input**: `{ date?: string, days_back?: number, branch_id?: string }`

**Output**:
```typescript
{
  hours: Array<{
    hour: number              // 0–23
    label: string             // "8 صباحًا", "3 مساءً"
    count: number
    revenue: number
    is_peak: boolean
  }>
  peak_hour: { hour: number, label: string, count: number }
  slowest_hour: { hour: number, label: string, count: number }
  avg_per_hour: number
  days_analyzed: number
}
```
**Existing Prisma models used**: `Transaction` (aggregated by hour)

---

### get_offers_effectiveness

**Input**: `{ start_date?: string, end_date?: string, offer_id?: string }`

**Output**:
```typescript
{
  offers: Array<{
    offer_name: string
    offer_type: string
    redemption_count: number
    total_discount_given: number
    revenue_with_offer: number
    redemption_rate_pct: number
    active: boolean
  }>
  most_used_offer: string
  least_used_offer: string
  total_redemptions: number
}
```
**Existing Prisma models used**: `Offer`, `Transaction` or `OfferUsage` — verify schema

---

## Tenant Isolation Rules

Every tool executor function receives `tenantId` from `getAuthContext()` and passes it to `getTenantPrisma(tenantId)`. The Prisma client auto-injects `WHERE tenantId = ?` on all queries. No tool accepts `tenantId` as a parameter — it is always injected server-side from the JWT.

```typescript
// Pattern used in every tool executor:
async function executeTool(toolName: string, args: unknown, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  // All queries via `db` are automatically scoped to auth.tenantId
}
```

---

## No Schema Changes Required

The existing Prisma schema already contains all models needed (`Transaction`, `TransactionItem`, `Product`, `Category`, `Branch`, `PurchaseOrder`, `Expense`, `User`). No `prisma migrate` is required for v1.
