# Phase 1: Design & Contracts

## Entity Modifications
No Prisma / SQLite entities were modified during this route restructuring. All modifications are strictly confined to URL path updates and Link prop resolutions inside React components.

## Routing Contracts Updated

The following internal navigation contracts have been formally updated and approved for this feature:

- `href="/orders"` -> **`/sales/invoices`**
- `href="/customers"` -> **`/sales/customers`**
- `href="/inventory"` -> **`/inventory`**
- `href="/suppliers"` -> **`/purchases/suppliers`**
- `href="/reports/expenses"` -> **`/accounting/expenses`**
- `href="/reports/shifts"` -> **`/accounting/shifts`**
- `href="/reports/financials"` -> **`/accounting/financials`**
- `href="/reports/bi"` -> **`/reports/analytics`**
- `href="/offers"` -> **`/marketing/offers`**
