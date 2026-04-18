# Feature 011: Advanced Analytics Executive Dashboard

## 1. Overview
The goal is to transform the Analytical Statistics page (`/reports/analytics` or similar) into an "Executive Dashboard" that rivals world-class accounting systems (like Odoo, Zoho, QuickBooks) targeting retail sectors (Supermarkets and Clothing). The dashboard must be visually captivating using a Bento Grid Style or modern Cards layout (shadows, rounded corners), answering deep business questions: when we sell the most, average basket size, and most profitable departments.

## 2. Requirements

### 2.1 UI/UX & Layout
- **Visual Style:** Highly attractive, using Bento Grid or Cards layout.
- **Aesthetics:** Modern shadows, rounded corners, clean padding, and responsive design.
- **Time Filters:** Quick filters available at the top (Today, This Week, This Month, This Year, Custom).

### 2.2 Key Performance Indicators (KPI Cards - Top Row)
Four top-level metric cards indicating current performance and a "Growth/Decline" percentage compared to the previous period (e.g., green arrow +5%).
1. **Total Revenue** (إجمالي الإيرادات)
2. **Net Profit** (صافي الربح)
3. **Average Order Value (AOV)** (متوسط قيمة الفاتورة): Total Revenue / Total Transactions. Helps understand customer purchasing power.
4. **Total Transactions** (إجمالي الفواتير): Indicates footfall and customer volume.

### 2.3 Visual Charts (Recharts)
- **Sales vs. Profit Trend (Area Chart):** Compares sales movement against profits over time to analyze seasonality and strong days.
- **Sales by Department/Category (Doughnut/Pie Chart):** E.g., Groceries 60%, Clothing 40%. Shows the owner which departments generate the most cash.
- **Peak Hours (Bar Chart):** Sales distributed by "Hour of the Day" (e.g., peak is 6 PM to 8 PM). Critical for supermarket managers to organize cashier shifts.

### 2.4 Actionable Insights (Tables/Lists - Bottom Row)
- **Top 5 Best Sellers:** Products ranked by quantity sold and total profit value.
- **Dead Stock / Slow Moving:** Products with zero or very low sales over a specific period despite having high inventory stock.

### 2.5 Technical Requirements
- **API Aggregation (`api/reports/analytics/route.ts` or similar):** The backend must efficiently perform aggregations to feed the charts (e.g., grouping by `HOUR(date)` for peak times, grouping by category, calculating period-over-period growth).
- **Client Component:** The dashboard page must be a `"use client"` component to utilize `Recharts` and handle interactive date filtering.
- **Performance:** Ensure heavy database queries are optimized.

## 3. Constraints & Architecture
- **Terminal Execution:** The AI must NEVER execute terminal commands directly.
- **SQLite Limitations:** Due to Prisma/SQLite limitations with date functions like `HOUR()`, fetch all data for the date range and perform the aggregation (Grouping by hour, category, etc.) in Javascript/TypeScript within the `route.ts` API before sending the JSON response.
- **Component Architecture:** The UI must NOT be a monolithic `page.tsx`. It MUST be split into a cohesive component structure within `app/reports/analytics/components/`:
  - `KpiCards.tsx`: For the top row KPI cards and growth percentages.
  - `TrendAreaChart.tsx`: For the Area Chart mapping sales vs profits.
  - `CategoryPieChart.tsx`: For the pie/doughnut chart of section sales.
  - `PeakHoursBarChart.tsx`: For the peak hours bar chart.
  - `ActionableInsights.tsx`: For the tables displaying Top 5 and Dead stock.
- `app/reports/analytics/page.tsx` will act purely as a State Container managing date filters and passing data down as props.
