# Feature 014: Smart Purchasing Advisor (مستشار المشتريات الذكي)

## Overview
A business intelligence feature designed to help the purchasing manager/owner make proactive and cost-effective restock decisions without manual and tedious searching among 1000+ products.

## UI/UX Route
- **Path**: `app/purchases/suppliers/smart-buy/page.tsx`
- **Type**: React Client Component for fast interactive switching.
- **Layout**: Modern UI with Cards and Data Tables, divided into 3 main tabs/sections.

## Smart Insights (Features)

1. **Smart Restock List (قائمة النواقص الموجهة)**
   - Table showing products that reached their stock minimum threshold.
   - For each product: Last Purchase Price, Lowest Historical Price, Recommended Supplier (who offered the lowest price).
   - Allows immediate decision making.

2. **Price Hike Alerts (تنبيهات استغلال الموردين)**
   - Table showing recently purchased products where the purchase price was noticeably higher than the historical best price.
   - Highlight the price difference in Red.

3. **Supplier Best-Deals (نقاط قوة المورد)**
   - A dropdown to select a specific supplier.
   - Displays a list of products where this selected supplier provides the absolute cheapest price in the market based on historical data.

## Backend Logic & API
- **Endpoint**: `app/api/purchases/smart-buy/route.ts`
- **Data Gathering**: Fetch past transactions (Stock In / Purchases) and aggregate to find Latest Price, Lowest Price, and corresponding Best Supplier per product. Merge with Current Stock.
- **Performance Constraints**: Avoid N+1 queries. Fetch aggregated data efficiently via Prisma, process complex comparisons in memory via JS/TS on the server, and return a clean payload to the client.

## Constraints
- **Strictly No Terminal Execution**. Provide Windows PowerShell commands only if manual execution is absolutely required.
- **Wait for User Approval**: Plan and Specs must be approved before execution.
