# Implementation Plan: 014 Smart Purchasing Advisor

## 1. Backend API Implementation
- **File**: `app/api/purchases/smart-buy/route.ts`
- **Method**: `GET`
- **Logic**:
  - Fetch all products with their current `baseStock` and `minStock`.
  - Fetch purchase history (e.g., from `InventoryTransaction` where `type` is `STOCK_IN` or `PURCHASE`, including supplier details).
  - Process data in memory (Single pass over transactions to avoid N+1):
    - For each product, analyze purchase history to compute:
      - `lastPurchasePrice`
      - `lowestHistoricalPrice`
      - `bestSupplierId` and `bestSupplierName`
  - Construct payload separating data into:
    - `restockList`: Products where `baseStock <= minStock` (or some threshold) enriched with lowest price and supplier.
    - `priceHikes`: Recent purchases where `lastPurchasePrice > lowestHistoricalPrice` (by a certain margin) to detect supplier exploitation.
    - `supplierDeals`: Mapping of supplier IDs to products where they are historically the cheapest.
  - Return JSON payload.

## 2. Frontend Route & Layout
- **File**: `app/purchases/suppliers/smart-buy/page.tsx`
- **Setup**: React `use client` component.
- **State Management**: Tabs (Restock, Alerts, Supplier Deals).
- **Data Fetching**: Use `useEffect` or SWR to fetch from `api/purchases/smart-buy`.
- **UI Components**:
  - **Tabs Header**: 3 buttons to switch views.
  - **Tab 1 (Smart Restock List)**: Data table with columns `[Product, Current Stock, Last Price, Best Price, Recommended Supplier]`.
  - **Tab 2 (Price Hike Alerts)**: Data table highlighting the price difference (Red text for high prices).
  - **Tab 3 (Supplier Best-Deals)**: Select dropdown for Supplier -> Table of products they sell cheapest.

## 3. Sidebar/Navigation Update
- **File**: `components/Sidebar.tsx`
- **Action**: Add a new link to the "Smart Purchasing Advisor" under the Purchasing or Reports section.

## 4. Work Flow & Constraints
- [ ] Client Component for UI to ensure fast interactions without full page reloads.
- [ ] Efficient Prisma query + Server-side TS mapping to handle 1000+ products securely.
- [ ] Strictly no N+1 queries.
- [ ] Absolutely no terminal commands executed directly. Use PowerShell if completely necessary and strictly via prompts.
