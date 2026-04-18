# Implementation Plan: Superadmin UI Refresh

**Branch**: `017-superadmin-ui-refresh` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/017-superadmin-ui-refresh/spec.md`

## Summary

This plan details the technical approach to entirely redesign the superadmin user interface, implement custom loading micro-animations, and establish a newly centralized styling framework applicable to both superadmin and client pages.

## Technical Context

**Language/Version**: TypeScript, React 19, Next.js 16.1.6
**Primary Dependencies**: Tailwind CSS v4, shadcn/ui (if applicable), lucide-react
**Storage**: N/A (Frontend Reskin)
**Testing**: N/A
**Target Platform**: Electron (Windows Desktop App) & Web Browser
**Project Type**: Next.js Web App / Desktop App
**Performance Goals**: Instant transitions, 0ms blocking layout shifts
**Constraints**: Must match existing functional requirements
**Scale/Scope**: Refactoring ~10 superadmin pages, global layout layout.tsx, and extracting ~15 components.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
No violations. The application currently uses Tailwind, so creating a unified folder logic does not violate any current architectures.

## Project Structure

### Documentation (this feature)

```text
specs/017-superadmin-ui-refresh/
├── spec.md              
├── checklists/requirements.md
├── plan.md              # This file
└── tasks.md             # Tasks definition
```

### Source Code (repository root)

```text
app/
├── (super-admin)/
│   └── super-admin/     # Redesigned pages (dashboard, licenses, etc.)
├── (tenant)/            # Minimal styling updates to inherit globals
├── globals.css          # Centralized style definitions
components/
├── ui/                  # Unified atomic components
└── loading/             # New skeleton loaders and custom SVG animations
```

**Structure Decision**: The project is a Next.js 14+ App Router. The shared components will reside in `components/ui` and `components/loading`. Global styles will be fully refactored in `app/globals.css`.
