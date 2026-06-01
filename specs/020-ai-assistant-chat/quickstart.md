# Quickstart: AI Assistant Chat with Function Calling

**Branch**: `020-ai-assistant-chat` | **Date**: 2026-05-16

---

## Prerequisites

- Node.js 20+, existing project dependencies installed (`npm install`)
- PostgreSQL running with existing Prisma schema (no new migration needed)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

---

## Step 1: Add Environment Variables

Add to your `.env.local`:

```bash
# Required: choose the AI provider ('gemini' or 'openai', default is 'gemini')
AI_PROVIDER=gemini

# Required when AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key-here

# Required when AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here
```

To switch providers, change `AI_PROVIDER` and restart the dev server. No code changes needed.

---

## Step 2: Install AI SDKs

```bash
npm install @google/generative-ai openai
```

---

## Step 3: Run the Dev Server

```bash
npm run dev
```

---

## Step 4: Test the API

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -b "auth-token=YOUR_JWT_TOKEN" \
  -d '{
    "message": "ما هي مبيعات اليوم؟",
    "history": [],
    "branchId": null
  }'
```

Expected response:
```json
{
  "reply": "مبيعات اليوم بلغت ...",
  "toolsInvoked": ["get_sales_report"]
}
```

---

## Step 5: Use the Chat Widget

1. Navigate to any tenant page (e.g., `/dashboard`).
2. Look for the floating chat button in the bottom-right corner (💬 icon).
3. Click to open the chat panel.
4. Type a question in Arabic or English.

---

## Example Questions to Test

| Question | Expected Tool Called |
|----------|---------------------|
| "ما هي مبيعات هذا الأسبوع؟" | `get_sales_report` |
| "أكثر 5 منتجات مبيعًا هذا الشهر" | `get_top_products` |
| "ما هي المنتجات التي تنفد من المخزن؟" | `get_inventory_levels` |
| "كم صافي الربح هذا الشهر؟" | `get_financial_summary` |
| "ما أداء كل فرع هذا الأسبوع؟" | `get_branch_stats` |
| "آخر 10 فواتير مبيعات" | `get_recent_transactions` |
| "ما هو الطقس اليوم؟" | *(none — polite decline)* |

---

## File Map

| File | Purpose |
|------|---------|
| `lib/ai/gemini.ts` | Gemini client + model instance |
| `lib/ai/tools.ts` | 6 tool definitions + Prisma executors |
| `lib/ai/prompts.ts` | Arabic system prompt |
| `app/api/ai/chat/route.ts` | POST endpoint |
| `components/ai-assistant/ChatWidget.tsx` | Floating UI |
| `components/ai-assistant/ChatMessage.tsx` | Message bubble |
| `components/ai-assistant/ChatInput.tsx` | Input field |
| `app/(tenant)/assistant/page.tsx` | Full-page chat |

---

## Troubleshooting

**"عذراً، المساعد الذكي غير متاح"**: Check that `GEMINI_API_KEY` is set correctly in `.env.local` and the server was restarted after adding it.

**Empty data responses**: Ensure the authenticated user's tenant has transactions in the DB. Test with a tenant that has existing sales data.

**Wrong tenant data**: Verify `getAuthContext()` is returning the correct `tenantId` from the JWT. Check the `auth-token` cookie.
