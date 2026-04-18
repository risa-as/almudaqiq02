# Phase 0: Outline & Research

## Unknowns Resolved

- **Sidebar Links**: The links inside `components/Sidebar.tsx` reflect an older or flatter routing system. E.g. `/orders` instead of `/sales/invoices`.
- **System Integration**: The `app/` structure is already relatively hierarchical, containing `app/sales/customers`, `app/purchases/suppliers`, etc. The issue is purely navigational detechment rather than missing folders.

## Decisions

- **Decision**: Update all programmatic `<Link>` uses in `Sidebar.tsx` and all `useRouter().push` calls in index pages to reflect the existing directory structure inside `app/`.
- **Rationale**: Minimal structural displacement; retains the Next.js App Router conventions and keeps the global `layout.tsx` intact since components are already physically present inside their respective contexts.
- **Alternatives considered**: Moving `customers` outside of `sales`, which violates the spec. Re-styling the entire project, which violates the 100% design harmony constraint.
