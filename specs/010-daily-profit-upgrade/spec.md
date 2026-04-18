# Feature 010: Daily P&L (Profit & Loss) Upgrade

## 1. Overview
The current Income Statement (P&L) page accurately calculates Revenue, COGS, Operating Expenses, and Net Profit for the current month. The goal of Feature 010 is to upgrade this page to support dynamic date filtering (daily, monthly, custom) and to display detailed drill-down tables when a single day is selected.

## 2. Requirements

### 2.1 Date Filter
- Add a Date Filter UI at the top of the P&L page (`app/accounting/financials/page.tsx`).
- Options should include at minimum: "اليوم" (Today), "الأمس" (Yesterday), "هذا الشهر" (This Month), and "فترة مخصصة" (Custom Period).
- Default selection should be "هذا الشهر" (This Month).
- Data on the dashboard cards (Revenue, COGS, Expenses, Net Profit) must reactively update based on the selected date range.

### 2.2 Comprehensive UI/UX Overhaul
- Visually elevate `app/accounting/financials/page.tsx` making it highly professional and easy to read.
- Enhance contrast, margins, paddings, and implement modern card designs (glassmorphism/subtle shadows/borders) aligned with current aesthetics.

### 2.3 Interactive Profit Trend Line Chart
- Introduce a dynamic, reactive `Recharts` Line Chart below the summary cards.
- **X-Axis:** Dates/Days in the selected period.
- **Y-Axis:** Financial Amounts (representing Profit/Revenue).
- The chart must fluently update along with the date filter selections.

### 2.4 Daily Details Sections
- Introduce two new tables below the chart:
  - **جدول مبيعات اليوم** (Sales Table): Shows products sold during the selected day (Name, Quantity, Price, Cost).
  - **جدول مصروفات اليوم** (Expenses Table): Shows operational expenses recorded during the selected day (Title, Category, Amount).
- **Visibility Logic**: These tables must *only* be visible when the selected date range spans exactly **one day** (e.g., "Today", "Yesterday", or a custom period where the start date equals the end date). They must be hidden for multi-day aggregated periods (like "This Month") to prevent data clutter.

### 2.5 API Updates
- The endpoint `api/reports/financials/route.ts` must accurately process `startDate` and `endDate` query parameters.
- **Details Payload:** Return the aggregated `financials` object alongside two arrays: `salesList` (extracted and flattened from `TransactionItem` with related `Product` data) and `expensesList`.
- **Chart Data Payload:** Analyze and group Profit and Sales mathematically per day within the requested date band. Return an aggregated `chartData` array of objects (e.g., `[{ date: '2026-02-01', profit: 15000 }, ...]`) optimized for immediate ingestion by Recharts.

## 3. Constraints
- **No new routes**: Modify the existing `app/accounting/financials/page.tsx`.
- **UI Consistency**: Preserve the existing Tailwind CSS UI patterns, color schemes, and glassmorphism styling.
- **Terminal Execution**: AI must not execute commands. Only provide PowerShell compatible commands to the user if absolutely necessary.
