# API Contract: AI Assistant Chat

**Branch**: `020-ai-assistant-chat` | **Date**: 2026-05-16  
**Endpoint**: `POST /api/ai/chat`

---

## Authentication

All requests must carry the existing `auth-token` httpOnly cookie (JWT, 8h expiry). Requests without a valid token receive `401 Unauthorized`.

The `tenantId` is extracted from the JWT — it is **never** accepted as a request parameter.

---

## POST /api/ai/chat

### Request

**Content-Type**: `application/json`

```json
{
  "message": "ما هي المبيعات هذا الأسبوع؟",
  "history": [
    { "role": "user",  "parts": [{ "text": "مرحباً" }] },
    { "role": "model", "parts": [{ "text": "أهلاً! كيف يمكنني مساعدتك؟" }] }
  ],
  "branchId": "uuid-optional"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | The admin's current question (1–2000 chars) |
| `history` | `GeminiHistoryEntry[]` | Yes | Previous conversation turns (max 20, can be empty `[]`) |
| `branchId` | `string` (UUID) | No | Active branch filter from UI. If omitted, data spans all tenant branches |

### Response — Success (200)

```json
{
  "reply": "مبيعات هذا الأسبوع بلغت 45,230 ريال عبر 312 فاتورة...",
  "toolsInvoked": ["get_sales_report"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reply` | `string` | AI-generated Arabic response |
| `toolsInvoked` | `string[]` | Names of the tool(s) the AI called to answer (can be empty) |

### Response — Auth Error (401)

```json
{ "error": "Unauthorized" }
```

### Response — Validation Error (400)

```json
{ "error": "Message is required and must be under 2000 characters" }
```

### Response — AI Service Error (503)

```json
{
  "error": "ai_unavailable",
  "reply": "عذراً، المساعد الذكي غير متاح حالياً. يرجى المحاولة مرة أخرى."
}
```

*The `reply` field is always populated even on `503` so the client can display a human-readable message.*

---

## Tool Definitions (Gemini Function Calling)

These are declared in `lib/ai/tools.ts` and passed to Gemini. They are **not HTTP endpoints** — they execute as server-side Prisma calls within the single `/api/ai/chat` request.

### Tool: `get_sales_report`
```json
{
  "name": "get_sales_report",
  "description": "Get sales data for a date range. Use this for questions about revenue, number of invoices, or sales trends.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string", "description": "Start date ISO format YYYY-MM-DD" },
      "end_date":   { "type": "string", "description": "End date ISO format YYYY-MM-DD" },
      "branch_id":  { "type": "string", "description": "Optional branch UUID to filter by branch" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_inventory_levels`
```json
{
  "name": "get_inventory_levels",
  "description": "Get current stock levels for all products. Use for questions about inventory, low-stock items, or out-of-stock products.",
  "parameters": {
    "type": "object",
    "properties": {
      "branch_id":      { "type": "string" },
      "low_stock_only": { "type": "boolean", "description": "If true, return only low-stock or out-of-stock products" }
    },
    "required": []
  }
}
```

### Tool: `get_financial_summary`
```json
{
  "name": "get_financial_summary",
  "description": "Get profit, revenue, and expense summary. Use for questions about net profit, margins, or financial performance.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_top_products`
```json
{
  "name": "get_top_products",
  "description": "Get best-selling products ranked by units sold. Use for questions about top products or product performance.",
  "parameters": {
    "type": "object",
    "properties": {
      "period":    { "type": "string", "enum": ["today", "week", "month"] },
      "limit":     { "type": "number", "description": "Number of products to return (default 10)" },
      "branch_id": { "type": "string" }
    },
    "required": ["period"]
  }
}
```

### Tool: `get_branch_stats`
```json
{
  "name": "get_branch_stats",
  "description": "Get performance statistics for all branches. Use for questions comparing branch performance or asking about a specific branch.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_recent_transactions`
```json
{
  "name": "get_recent_transactions",
  "description": "Get the most recent transactions. Use for questions about latest sales, recent activity, or last transactions.",
  "parameters": {
    "type": "object",
    "properties": {
      "limit":     { "type": "number", "description": "Number of transactions (default 10, max 50)" },
      "branch_id": { "type": "string" },
      "type":      { "type": "string", "enum": ["SALE", "REFUND", "PURCHASE"] }
    },
    "required": []
  }
}
```

### Tool: `get_shift_summary`
```json
{
  "name": "get_shift_summary",
  "description": "Get shift reports for cashiers. Use for questions about cashier sales, shift performance, or cash differences.",
  "parameters": {
    "type": "object",
    "properties": {
      "date":        { "type": "string", "description": "Specific date YYYY-MM-DD (default: today)" },
      "branch_id":   { "type": "string" },
      "cashier_id":  { "type": "string", "description": "Specific cashier UUID to filter" }
    },
    "required": []
  }
}
```

### Tool: `get_orders_analysis`
```json
{
  "name": "get_orders_analysis",
  "description": "Analyze orders by type (delivery, dine-in, takeaway). Use for questions about delivery orders, average order value, or peak ordering times.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" },
      "branch_id":  { "type": "string" },
      "type":       { "type": "string", "enum": ["DELIVERY", "DINE_IN", "TAKEAWAY"] }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_discount_report`
```json
{
  "name": "get_discount_report",
  "description": "Get discount usage report. Use for questions about total discounts given, who gave the most discounts, or discount impact on revenue.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" },
      "branch_id":  { "type": "string" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_staff_performance`
```json
{
  "name": "get_staff_performance",
  "description": "Get staff performance rankings. Use for questions about which cashier is fastest, how many orders each employee completed, or staff productivity.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" },
      "branch_id":  { "type": "string" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_customer_insights`
```json
{
  "name": "get_customer_insights",
  "description": "Get customer loyalty and spending insights. Use for questions about repeat customers, average customer spend, or top customers.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" }
    },
    "required": []
  }
}
```

### Tool: `get_delivery_stats`
```json
{
  "name": "get_delivery_stats",
  "description": "Get delivery performance statistics. Use for questions about average delivery time, late orders, or driver performance.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" },
      "branch_id":  { "type": "string" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_purchase_orders_summary`
```json
{
  "name": "get_purchase_orders_summary",
  "description": "Get purchase orders and supplier spending summary. Use for questions about purchasing costs, top suppliers, or most-purchased products.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

### Tool: `get_menu_performance`
```json
{
  "name": "get_menu_performance",
  "description": "Analyze product/menu performance. Use for questions about slow-moving products, dead stock, or whether offers increase sales.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date":   { "type": "string" },
      "end_date":     { "type": "string" },
      "branch_id":    { "type": "string" },
      "slow_only":    { "type": "boolean", "description": "If true, return only slow-moving items" }
    },
    "required": []
  }
}
```

### Tool: `get_hourly_heatmap`
```json
{
  "name": "get_hourly_heatmap",
  "description": "Get hourly transaction heatmap to identify peak and slow hours. Use for questions about the busiest hour, slowest period, or hourly traffic patterns.",
  "parameters": {
    "type": "object",
    "properties": {
      "date":      { "type": "string", "description": "Specific date YYYY-MM-DD, or omit for last 7 days average" },
      "days_back": { "type": "number", "description": "Number of days to average (default 7)" },
      "branch_id": { "type": "string" }
    },
    "required": []
  }
}
```

### Tool: `get_offers_effectiveness`
```json
{
  "name": "get_offers_effectiveness",
  "description": "Measure how effective promotions and offers are. Use for questions about offer usage, redemption rates, or whether a specific offer is working.",
  "parameters": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string" },
      "end_date":   { "type": "string" },
      "offer_id":   { "type": "string", "description": "Specific offer UUID to analyze" }
    },
    "required": []
  }
}
```

---

## Conversation History Contract

The client maintains an array of `GeminiHistoryEntry` objects. On each new message:
1. Append the new user message to the local state.
2. Send `history` = the **previous** turns (not including the current message) — max 20 entries.
3. On response, append the `reply` as a `model` turn to local state.

History is **never** sent to or persisted by the server.

---

## Security Constraints

- `tenantId` is always from JWT — never from request body.
- `branchId` from request body is validated to belong to `tenantId` before use.
- Tool call results are never leaked to the client — only the final `reply` text is returned.
- Max 5 Gemini tool-call rounds per request to prevent runaway loops.
- Message max length: 2000 characters.
- History max entries processed: 20 (older entries silently dropped).
