# Feature Specification: Role-Based Mobile App (Manager / Cashier / Stock Keeper)

**Feature Branch**: `021-mobile-app`  
**Created**: 2026-07-11  
**Status**: Draft  
**Input**: User description: "تطبيق هاتف React Native (Expo) لنظام SuperMarket Cloud بثلاث واجهات حسب الدور: المدير، موظف البيع، أمين المخزن — يستهلك نفس Next.js API مع مصادقة JWT Bearer ودعم RTL وبوابة الميزات"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In and Land on My Role's Interface (Priority: P1)

Any employee (manager, cashier, or stock keeper) opens the mobile app, enters the same credentials they use on the web system, and is taken directly to the interface built for their role: the manager sees the monitoring dashboard, the cashier sees the selling screen, and the stock keeper sees the inventory list. They never see — and cannot reach — screens belonging to another role. On subsequent app launches they are signed in automatically without re-entering credentials, until their session genuinely expires or they sign out.

**Why this priority**: This is the foundation every other story stands on. It proves authentication against the existing system, secure session persistence, and the role-routing skeleton of all three interfaces.

**Independent Test**: Can be fully tested by signing in with one account of each role and verifying (a) the correct home screen appears, (b) navigation exposes only that role's sections, and (c) killing and reopening the app restores the session without a login prompt.

**Acceptance Scenarios**:

1. **Given** a user with the cashier role, **When** they sign in with valid credentials, **Then** the app opens directly on the selling screen and the navigation shows only cashier sections (البيع، ورديتي، فواتيري، حسابي).
2. **Given** a user with the stock keeper role, **When** they sign in, **Then** the app opens on the inventory screen and shows only stock sections (المخزون، الجرد، الاستلام، التحويلات).
3. **Given** a signed-in user, **When** they force-close and reopen the app within their session validity window, **Then** they land on their role's home screen without seeing the login screen.
4. **Given** a signed-in user whose account is deactivated or whose password is changed from the web admin panel, **When** their current access expires and renewal is attempted, **Then** they are returned to the login screen with a clear Arabic message.
5. **Given** invalid credentials, **When** the user attempts to sign in, **Then** a clear Arabic error message is shown and no session is created.

---

### User Story 2 - Cashier Sells with the Phone Camera as Barcode Scanner (Priority: P1)

A cashier opens their shift from the phone, then serves customers: they point the phone camera at a product's barcode (or search by name), the product drops into the cart, they adjust quantities, apply an active offer or discount, take payment (cash / card / customer credit), and the sale is recorded instantly in the same system the web and desktop apps use. At the end of the day they close the shift and see their totals. They can also look up an invoice from their current shift and process a return.

**Why this priority**: Selling is the revenue-generating action and the phone camera replaces a dedicated barcode gun — the single biggest practical win of a mobile client. It exercises product lookup, shift lifecycle, checkout, and returns end-to-end.

**Independent Test**: Can be fully tested by opening a shift, scanning a real product barcode with the camera, completing a cash sale, verifying the invoice appears in the web dashboard for the same branch, then processing a return for that invoice and closing the shift.

**Acceptance Scenarios**:

1. **Given** a cashier with no open shift, **When** they try to sell, **Then** the app requires opening a shift (with opening balance) first.
2. **Given** an open shift, **When** the cashier scans a known product barcode with the camera, **Then** the product is added to the cart with its correct current price within the same second.
3. **Given** a scanned barcode that matches no product in this tenant, **When** the scan completes, **Then** the app shows "المنتج غير موجود" and offers name search — nothing is added to the cart.
4. **Given** a cart with items, **When** the cashier completes payment, **Then** the sale is recorded against their branch, shift, and user identity, stock is decremented, and a receipt summary is shown.
5. **Given** a completed sale from the current shift, **When** the cashier processes a return for one line item, **Then** the return is recorded and stock is restored, exactly as it would be from the web POS.
6. **Given** an open shift with recorded sales, **When** the cashier closes the shift, **Then** the app shows expected vs. counted cash and records the closure.
7. **Given** the device loses connectivity mid-checkout, **When** the cashier confirms payment, **Then** the app clearly reports the failure and keeps the cart intact so the sale can be retried — no duplicate or half-recorded sale.

---

### User Story 3 - Stock Keeper Counts and Receives Goods by Scanning (Priority: P2)

A stock keeper walks the warehouse with their phone. For a stocktake, they start a counting session, scan each product's barcode, enter the counted quantity, and the system computes discrepancies against recorded stock. For receiving, they open a pending purchase order, scan each arriving product, confirm quantities and expiry dates, and the goods enter stock as new batches. They can also create a transfer request to another branch or confirm receipt of an incoming transfer, and consult any product's current quantity and batch expiry dates on the spot.

**Why this priority**: This replaces the paper-and-pen workflow in the warehouse — high operational value, but it depends on the same scanning foundation proven in Story 2 and serves a smaller user group than selling.

**Independent Test**: Can be fully tested by starting a stocktake session, scanning 3 products with deliberately wrong counts, verifying the discrepancy report, then receiving a purchase order line by line and confirming the new batch quantities appear in web inventory.

**Acceptance Scenarios**:

1. **Given** an active stocktake session, **When** the stock keeper scans a product and enters a count different from recorded stock, **Then** the discrepancy (difference and value) is computed and shown before submission.
2. **Given** a purchase order awaiting receipt, **When** the stock keeper scans an ordered product and confirms quantity and expiry, **Then** the received quantity is recorded against that order line and stock increases accordingly.
3. **Given** a scanned product that is not on the open purchase order, **When** the scan completes, **Then** the app warns that the item is not on this order and does not silently add it.
4. **Given** low-stock or near-expiry products in the stock keeper's branch, **When** they open the alerts screen, **Then** they see products below minimum stock and batches expiring soon.
5. **Given** an incoming transfer from another branch, **When** the stock keeper confirms receipt, **Then** quantities move into their branch's stock.

---

### User Story 4 - Manager Monitors the Business from Anywhere (Priority: P2)

An owner (ADMIN) or branch manager opens the app away from the office and immediately sees today's numbers: sales, profit, invoice count, open shifts and who is working now, and comparisons across branches (owner only). They drill into reports (sales, ABC analysis, offers performance, supplier payables, expenses), review and approve pending actions (inter-branch transfers, purchase orders), check low-stock alerts, and ask the built-in AI assistant free-form questions in Arabic like "كم بعنا أمس في فرع الرياض؟". The owner can switch between branches; a branch manager is locked to their own branch.

**Why this priority**: The manager interface is primarily read-and-approve. It delivers strong perceived value but consumes existing reports rather than creating new operational data, so it follows the two data-producing stories.

**Independent Test**: Can be fully tested by signing in as ADMIN, verifying dashboard numbers match the web dashboard for the same day and branch, switching branches, approving a pending transfer, and receiving a correct AI answer about yesterday's sales.

**Acceptance Scenarios**:

1. **Given** a signed-in ADMIN, **When** they open the dashboard, **Then** today's sales, profit, and invoice counts match the web dashboard for the same tenant, branch, and time window.
2. **Given** an ADMIN with multiple branches, **When** they switch the selected branch, **Then** all figures and lists update to that branch's data.
3. **Given** a BRANCH_MANAGER, **When** they use the app, **Then** they see only their own branch's data and no branch switcher.
4. **Given** a pending inter-branch transfer, **When** the manager approves it from the phone, **Then** its status updates system-wide exactly as if approved from the web.
5. **Given** the manager asks the AI assistant "ما هي مبيعات اليوم؟", **When** the assistant responds, **Then** the answer reflects the same tenant-scoped data as the web assistant.

---

### User Story 5 - Subscription Plan Gates Features on Mobile Too (Priority: P3)

A tenant on a plan that excludes certain features (e.g., AI assistant, advanced reports, transfers) uses the mobile app. Sections not included in their plan do not appear in the app's navigation, and any direct attempt to use them is refused — mirroring exactly what the web interface does.

**Why this priority**: Commercially required for the SaaS model, but it modifies visibility of features delivered in Stories 1–4 rather than adding new capability.

**Independent Test**: Can be tested by signing into a tenant on a restricted plan and verifying gated sections are absent from navigation, then upgrading the plan and verifying they appear.

**Acceptance Scenarios**:

1. **Given** a tenant whose plan excludes the AI assistant, **When** a manager uses the mobile app, **Then** the assistant tab is not shown and the assistant cannot be reached.
2. **Given** a tenant's plan is upgraded, **When** the app refreshes its session, **Then** newly included features appear without reinstalling the app.

---

### Edge Cases

- Camera permission denied: scanning screens must offer manual barcode entry and name search as a full fallback, with a clear prompt to enable the camera in settings.
- Access token expires mid-action (e.g., mid-checkout): the app must renew the session transparently and retry once; only if renewal fails does it return to login — without losing the cart or the stocktake session in progress.
- Connectivity loss: every write action (sale, return, count submission, receipt, approval) must fail loudly, preserve the user's entered data locally in the screen, and be safely retryable without creating duplicates.
- A user's role is changed while signed in: on the next session renewal, the app must re-route them to the interface of the new role.
- Cashier device clock differs from server: all business timestamps come from the server, never the device.
- Same account signed into two devices: both remain valid; the system's existing session rules apply unchanged.
- RTL correctness: all three interfaces render right-to-left in Arabic, including mirrored navigation, icons with direction, and numerals.
- Barcode formats: the scanner must read the common retail formats used by the tenant's existing products (EAN-13, EAN-8, Code 128, QR).
- Very large product catalogs (10k+ products): product search must remain responsive by searching server-side, not by downloading the catalog.
- SUPER_ADMIN (platform operator) accounts: the mobile app is a tenant tool; platform operators are told to use the web platform and are not offered a mobile interface.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Session**

- **FR-001**: The app MUST authenticate users with the same credentials and account store as the existing web system; no separate mobile accounts exist.
- **FR-002**: The system MUST accept authenticated mobile requests via a standard authorization header, alongside the existing cookie mechanism used by the web, with identical authorization semantics (tenant scoping, role checks, feature gating).
- **FR-003**: The app MUST store session tokens in the device's secure, encrypted storage — never in plain preferences or files.
- **FR-004**: The app MUST renew expiring sessions automatically and transparently; the user re-authenticates only when renewal is no longer possible (expired long-term session, deactivated account, or explicit sign-out).
- **FR-005**: Signing out MUST erase all locally stored tokens and cached business data for that account.

**Role-Based Interfaces**

- **FR-006**: After sign-in, the app MUST present exactly one of three interfaces determined by the user's role: Manager (ADMIN, BRANCH_MANAGER), Cashier (CASHIER), Stock Keeper (STOCK_KEEPER). SUPER_ADMIN is refused with a message directing them to the web platform.
- **FR-007**: Navigation MUST expose only the signed-in role's sections; screens of other roles MUST be unreachable on the device, and the server MUST continue to enforce role authorization on every request regardless of what the client shows.
- **FR-008**: The Manager interface MUST provide: dashboard (today's sales, profit, invoice count, open shifts), sales monitoring (live invoices, shifts), reports (sales, ABC analysis, offers performance, supplier payables, expenses), inventory overview with low-stock/expiry alerts, approvals (inter-branch transfers, purchase orders), users list with audit trail view, AI assistant chat, and settings with branch switching for ADMIN only.
- **FR-009**: The Cashier interface MUST provide: shift open/close with opening balance and closing count, a selling screen (scan/search → cart → discounts and offers → payment by cash, card, or customer credit → receipt summary), current-shift invoice list with per-invoice return/refund, and customer lookup with credit balance for on-credit sales.
- **FR-010**: The Stock Keeper interface MUST provide: inventory browsing with quantities and batch expiry dates, stocktake sessions with scan-and-count and discrepancy computation, purchase order receiving with per-line quantity and expiry confirmation, inter-branch transfer creation and receipt confirmation, supplier list with balances (read-only), and low-stock/near-expiry alerts.

**Barcode Scanning**

- **FR-011**: The app MUST scan product barcodes using the device camera on the selling, stocktake, and receiving screens, resolving the code to a product of the signed-in tenant only.
- **FR-012**: Every scanning screen MUST offer manual code entry and server-side name search as complete alternatives when the camera is unavailable or permission is denied.

**Data Integrity & Parity**

- **FR-013**: All business operations performed on mobile MUST produce exactly the same records, stock movements, and audit entries as the equivalent web operation — web and mobile views of the same data MUST always agree.
- **FR-014**: All data access MUST be scoped to the signed-in user's tenant and (per existing rules) branch; no mobile pathway may widen existing access.
- **FR-015**: Write operations MUST be safe to retry after a connectivity failure without producing duplicate sales, counts, receipts, or approvals.
- **FR-016**: The app MUST require an open shift before any cashier sale and MUST attribute every sale to the shift, branch, and user that produced it.

**Feature Gating & Localization**

- **FR-017**: The app MUST hide navigation entries for features excluded from the tenant's subscription plan, and the server MUST refuse gated operations regardless of client state.
- **FR-018**: The entire app MUST be presented in Arabic with correct right-to-left layout across all three interfaces; user-facing errors MUST be clear Arabic messages, not technical codes.

**Out of Scope (v1)**

- **FR-019**: Offline operation (selling or counting without connectivity) is explicitly out of scope for v1; the app requires an active connection for all business operations and MUST say so clearly when disconnected.
- **FR-020**: Push notifications, receipt printing from the phone, and platform-operator (SUPER_ADMIN) screens are out of scope for v1.

### Key Entities

No new business entities are introduced. The app is a client over the existing system's entities, the relevant ones being:

- **User / Role**: existing accounts and the five-role model; mobile serves ADMIN, BRANCH_MANAGER, CASHIER, STOCK_KEEPER.
- **Shift**: cashier work session with opening balance, sales attribution, and closing count.
- **Sale / Invoice / Return**: transactions produced from the selling screen, identical to web-produced ones.
- **Product / Batch**: catalog items and their dated stock batches, looked up by barcode.
- **Stocktake Session**: counting session with per-product counted vs. recorded quantities and discrepancies.
- **Purchase Order**: supplier order whose lines are received on mobile.
- **Transfer**: inter-branch stock movement created/received by stock keepers and approved by managers.
- **Subscription Plan / Features**: the tenant's plan determining which sections the app shows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cashier can complete a 5-item sale — from first scan to recorded payment — in under 60 seconds using only the phone.
- **SC-002**: 100% of role-boundary checks hold: in testing, no account of any role can view or perform an action belonging to another role's interface from the mobile app.
- **SC-003**: A 100-product stocktake performed by scanning completes in under 20 minutes and yields a discrepancy report with zero manual arithmetic.
- **SC-004**: Figures shown on the mobile manager dashboard match the web dashboard for the same tenant, branch, and period in 100% of comparison checks.
- **SC-005**: A signed-in user reaches their role's working screen within 5 seconds of opening the app on a mid-range Android device.
- **SC-006**: Users sign in at most once per 30 days of regular use; sessions renew silently otherwise.
- **SC-007**: Every screen of all three interfaces renders correctly in Arabic RTL with no clipped, wrongly mirrored, or left-aligned layouts in visual review.
- **SC-008**: Zero cross-tenant or cross-branch data exposures attributable to mobile pathways in security review.

## Assumptions

- The existing production system (web + API) is the single source of truth; the mobile app adds no server-side business logic beyond accepting the standard authorization header (FR-002).
- Android is the primary target (staff devices); iOS support is kept technically open but Android is what v1 is validated on.
- Distribution is direct (installable package shared with tenants) for v1; app-store publication is a later concern.
- The app is online-first: stable connectivity at the point of sale/warehouse is assumed, with graceful failure (FR-015, FR-019) rather than offline queuing.
- Session lifetimes follow the existing system policy (short-lived access, ~30-day renewal window) unchanged.
- The user explicitly mandated the mobile technology direction (React Native / Expo); this constrains implementation planning but does not alter the user-facing requirements above.
- Existing per-plan feature definitions already cover everything the mobile app gates; no new plan flags are needed.
- Tenant products already carry barcodes in common retail formats; the app does not generate or print barcodes.
