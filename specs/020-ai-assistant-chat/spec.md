# Feature Specification: AI Assistant Chat with Function Calling

**Feature Branch**: `020-ai-assistant-chat`  
**Created**: 2026-05-16  
**Status**: Draft  
**Input**: User description: "AI Assistant Chat with Function Calling — مساعد ذكي للأدمن يستخدم Gemini 2.0 Flash مع Function Calling"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask About Sales Performance (Priority: P1)

The tenant admin opens the AI assistant chat (floating button or dedicated page), types a question in Arabic or English such as "ما هي مبيعات هذا الأسبوع؟" or "What are this week's sales?". The assistant fetches real sales data for the admin's tenant, then replies with a clear Arabic analytical summary including totals, comparisons, and trends.

**Why this priority**: Sales data is the most critical business metric. This story proves the core Function Calling pipeline end-to-end (question → tool selection → data fetch → AI response).

**Independent Test**: Can be fully tested by submitting a sales question and verifying the response reflects actual DB data for the authenticated tenant only.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant admin is on any page, **When** they click the floating chat button and ask "ما هي مبيعات اليوم؟", **Then** the assistant calls `get_sales_report` with today's date range and returns a formatted Arabic summary with correct totals.
2. **Given** the admin asks a sales question, **When** the assistant responds, **Then** the response data must match the actual sales records for that tenant (not another tenant's data).
3. **Given** the admin asks about a date range with zero sales, **When** the assistant fetches the data, **Then** it responds with a helpful message indicating no sales were recorded for that period.

---

### User Story 2 - Ask About Inventory & Stock Levels (Priority: P2)

The admin asks "ما هي المنتجات التي تنفد من المخزن؟" or "أكثر المنتجات مبيعًا هذا الشهر؟". The assistant uses `get_inventory_levels` and `get_top_products` tools to fetch inventory state and product performance, then returns an organized Arabic response with product names, quantities, and alerts.

**Why this priority**: Inventory management is the second most common admin concern. Validates multi-tool selection logic.

**Independent Test**: Can be tested by asking a stock or product question and verifying the assistant correctly identifies low-stock items or top sellers from the tenant's inventory.

**Acceptance Scenarios**:

1. **Given** the admin asks about low-stock products, **When** the assistant responds, **Then** it lists products with quantity below the defined threshold with their current stock levels.
2. **Given** the admin asks "أكثر 5 منتجات مبيعًا هذا الشهر", **When** the assistant responds, **Then** it returns the correct top 5 products ranked by sales volume for the current month.

---

### User Story 3 - Ask About Financial Summary & Expenses (Priority: P2)

The admin asks "ما هو صافي الربح هذا الشهر؟" or "كم مجموع المصاريف؟". The assistant calls `get_financial_summary` to fetch revenue, cost, and profit data, returning a structured Arabic breakdown with figures and percentage margins.

**Why this priority**: Financial insight is a top management need. Tests that financial data is calculated server-side and only exposed to authorized admins.

**Independent Test**: Can be tested by asking a profit/expense question and verifying the returned figures match the accounting records for that tenant.

**Acceptance Scenarios**:

1. **Given** the admin asks about monthly profit, **When** the assistant responds, **Then** it returns gross revenue, total cost, and net profit with correct values.
2. **Given** a user without admin role attempts to use the assistant, **When** they submit a question, **Then** they receive an authorization error and no financial data is exposed.

---

### User Story 4 - Multi-Turn Conversation Within Session (Priority: P3)

The admin asks a follow-up question referencing the previous answer, e.g., first asks "ما هي المبيعات هذا الأسبوع؟" then asks "وما هي مقارنتها بالأسبوع الماضي؟". The assistant maintains conversation history within the session and provides contextually coherent responses.

**Why this priority**: Conversational continuity improves the experience but is not required for core value delivery.

**Independent Test**: Can be tested by sending two sequential messages and verifying the second response is coherent and references the first exchange.

**Acceptance Scenarios**:

1. **Given** the admin has already asked about sales, **When** they ask a follow-up comparative question, **Then** the assistant understands the context and responds meaningfully without requiring the admin to repeat context.
2. **Given** the admin closes the chat widget and reopens it, **When** they view the chat, **Then** conversation history from the current browser session is preserved.

---

### User Story 5 - Branch-Level Statistics (Priority: P3)

The admin asks "ما هو أداء كل فرع هذا الشهر؟". The assistant calls `get_branch_stats` to retrieve per-branch performance metrics and returns a comparative Arabic summary ranking branches by sales, profit, or transaction count.

**Why this priority**: Multi-branch analytics is valuable for franchise-model tenants. Depends on P1 pipeline being functional.

**Independent Test**: Can be tested by asking a branch comparison question and verifying the assistant returns data for all branches belonging to the tenant.

**Acceptance Scenarios**:

1. **Given** a tenant with multiple branches, **When** the admin asks about branch performance, **Then** the assistant returns metrics for all of the tenant's branches only.
2. **Given** a tenant with a single branch, **When** the admin asks the same question, **Then** the assistant provides single-branch data without error.

---

### Edge Cases

- What happens when the AI service (Gemini) is unavailable or returns an error?
- What if the admin asks a question completely unrelated to the business system (e.g., "What is the weather?")?
- What if the database query returns no data (empty tenant, new account)?
- What if the admin's question is ambiguous and could call multiple tools simultaneously?
- What happens when the conversation history grows very long within one session?
- What if the tenant's subscription is expired — should they still access the assistant?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a floating chat button accessible from every page within the tenant dashboard layout.
- **FR-002**: System MUST provide a dedicated full-page chat interface as an alternative to the floating widget.
- **FR-003**: System MUST accept questions in both Arabic and English and respond primarily in Arabic.
- **FR-004**: System MUST use Function Calling to dynamically select and invoke the appropriate data-fetching tool(s) based on the admin's question.
- **FR-005**: System MUST expose the following tools to the AI: `get_sales_report`, `get_inventory_levels`, `get_financial_summary`, `get_top_products`, `get_branch_stats`, `get_recent_transactions`.
- **FR-006**: Each tool MUST enforce tenant isolation — data returned must belong exclusively to the authenticated tenant.
- **FR-007**: System MUST authenticate every chat request using the existing JWT-based session; unauthenticated requests must be rejected.
- **FR-008**: System MUST maintain conversation history within the current browser session (messages persist through page navigation until tab is closed).
- **FR-009**: System MUST display a loading/thinking indicator while the AI is processing.
- **FR-010**: System MUST gracefully handle AI service failures with a user-friendly Arabic error message and a retry option.
- **FR-011**: System MUST NOT expose raw database queries, internal IDs, or technical error details in the chat response.
- **FR-012**: System MUST limit conversation history sent to the AI to a reasonable window to prevent context overflow (last 20 messages).
- **FR-013**: When the admin asks a question outside the system's domain, the assistant MUST respond politely in Arabic explaining it can only answer questions about the store's data.

### Key Entities

- **ChatMessage**: Represents a single message in the conversation — role (user/assistant), content (text), timestamp, and optionally the tool(s) invoked.
- **ConversationSession**: A collection of messages belonging to one browser session, scoped to a tenant and user.
- **AITool**: A named function with a defined parameter schema that the AI can call to retrieve specific business data (e.g., `get_sales_report` with `{ start_date, end_date, branch_id? }`).
- **ToolResult**: The structured data returned by an AITool invocation, passed back to the AI to generate the final response.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can receive an accurate, data-driven answer to a business question within 10 seconds of submitting it.
- **SC-002**: 100% of tool invocations enforce tenant isolation — no cross-tenant data leakage in any scenario.
- **SC-003**: The assistant correctly identifies and calls the right tool(s) for at least 90% of common business questions (sales, inventory, finance, branches).
- **SC-004**: Admin can complete a 3-turn conversation (ask, follow up, follow up again) without loss of context or coherence.
- **SC-005**: The chat widget is accessible from every tenant page within 1 click without navigating away.
- **SC-006**: AI service failures result in a graceful error message — no unhandled exceptions exposed to the user.
- **SC-007**: Questions outside the system domain are redirected politely without exposing system internals.

---

## Assumptions

- Gemini 2.0 Flash API key will be provided as an environment variable and is not stored in code.
- The existing JWT authentication middleware will be reused without modification for securing chat API routes.
- Conversation history is session-scoped (browser tab) only — no persistence to database in v1.
- Tool parameter date ranges default to sensible periods (today, this week, this month) when not specified by the admin.
- The floating chat button will be integrated into the existing tenant layout component.
- All six tools (`get_sales_report`, `get_inventory_levels`, `get_financial_summary`, `get_top_products`, `get_branch_stats`, `get_recent_transactions`) have corresponding existing API routes or database queries that can be reused.
- RTL layout is already handled globally in the project; chat UI follows the same direction.
- Mobile responsiveness is required for the chat widget (the project already targets mobile).
- The feature is available to tenant admins only; cashier/staff roles are out of scope for v1.
