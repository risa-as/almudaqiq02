# Implementation Plan: Route Restructuring & System Integration

**Branch**: `009-route-restructure` | **Date**: 2026-02-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-route-restructure/spec.md`

## Summary

The goal of this restructuring is to ensure the URL paths hierarchically reflect their parent modules (e.g., `/sales/customers` instead of `/customers`), achieving 100% design harmony and eliminating broken links. According to our file system analysis, the `app/` directory is currently structured correctly in terms of folders (`app/sales/customers`, `app/purchases/suppliers`), but the application's internal links (Sidebar, buttons, and redirects) point to obsolete or non-hierarchical URLs (`/orders`, `/customers`, `/suppliers`, `/offers`). 

This plan addresses updating all programmatic and standard routing references to point to the correct internal paths while preserving the UI and UX consistency across the application.

## Technical Context

**Language/Version**: Next.js 16.1.6 (App Router), React 19, TypeScript
**Primary Dependencies**: `lucide-react`, `next/link`, `next/navigation`
**Target Platform**: Desktop Electron + Web App
**Project Type**: Next.js Web App
**Constraints**: 100% harmonious visual design matching the global layout. No broken internal links.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Design Consistency**: Changes will not touch global CSS unless absolutely necessary to preserve harmony.
- [x] **No Terminal Executions**: Adhering strictly to agent tool usage; user commands have been executed successfully.

## Project Structure

### Documentation (this feature)

```text
specs/009-route-restructure/
├── plan.md              
├── research.md          
├── data-model.md        
└── quickstart.md             
```

### Source Code

```text
app/
├── sales/
│   ├── invoices/      <-- Resolves Sidebar's /orders
│   └── customers/     <-- Resolves Sidebar's /customers
├── purchases/
│   └── suppliers/     <-- Resolves Sidebar's /suppliers
├── accounting/
│   ├── expenses/      <-- Resolves Sidebar's /reports/expenses
│   ├── shifts/        <-- Resolves Sidebar's /reports/shifts
│   └── financials/    <-- Resolves Sidebar's /reports/financials
├── reports/
│   ├── sales/
│   ├── stock-movement/
│   ├── inventory/
│   └── analytics/     <-- Resolves Sidebar's /reports/bi
└── marketing/
    └── offers/        <-- Resolves Sidebar's /offers
components/
└── Sidebar.tsx        <-- Needs the majority of Link updates
```

**Structure Decision**: No new folders need to be created. The `app` directory's hierarchy serves as the source of truth. All navigational links and router pushes throughout components will be aligned with this structure.
