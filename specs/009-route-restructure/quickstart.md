# Quickstart: Route Restructuring

To apply and review this feature:

1. The goal is to bind all non-hierarchical internal references in `components/Sidebar.tsx` to the existing functional modules inside `/app/`.
2. All components have been verified to stay within their `app/` modules, ensuring the root `layout.tsx` wrapper naturally catches them and styling is preserved 100%.

Next step: run `/speckit.tasks` to generate the exact file-by-file update checklist.
