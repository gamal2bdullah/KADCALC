# KAD Calculator — Advanced Solar Load & Engineering Analysis Suite

> **World-class, production-ready** electrical load calculator for solar PV system
> design. Engineering-grade calculations (NEC/IEC/IEEE) wrapped in a token-driven,
> accessible, dark/light UI.

## What's inside
- **Multi-layer calculation engine** (5 audit layers) with full traceability.
- **Real algorithms**: 3-phase balancing, surge/LRA modeling (VFD/soft-start),
  harmonic (THD) analysis, power-factor correction, seasonal & calendar profiles.
- **Versioned assumption registry** (NEC/IEC/IEEE) — every default is traceable.
- **30+ validation rules** across 5 severities; self-audit test suite.
- **12 workspaces**: Dashboard, Inventory, Schedule, Analysis, Phase Balancer,
  Validation, Assumptions, Reports (PDF), Library, Tests, Docs, Settings.
- **PDF & CSV export** for engineering deliverables.

## Design system (this release)
All visuals are driven by a **single source of truth** in `src/theme/`:
- `tokens.css` — 9 layered token layers (primitive → surface → border → text →
  accent → feedback → input-state → data-viz → motion) + dark/light themes.
- `brand.ts` — canonical brand (name/version/logo) + severity & criticality maps.
- `colors.ts` — semantic INPUT ↔ OUTPUT color layers + `PDF_RGB` (1:1 with CSS).
- `typography.ts` — named type ramp (Inter + JetBrains Mono).

Components consume **only semantic tokens** (`bg-surface-1`, `text-text-secondary`,
`border-border-subtle`, `bg-accent-soft`, …) — never raw hex. Light/dark is toggled
via `[data-theme]` on `<html>` and persisted.

### Reusable primitives
`BrandMark` · `KpiCard` (bound to `KPI_ACCENT`) · `StatusPill`/`CriticalityBadge`
· `EmptyState` · `ErrorBoundary` · `CommandPalette` (⌘K) · `.ipt` input state machine.

## Run it
```bash
npm install
npm run dev      # local dev
npm run build    # production single-file build → dist/index.html
```
Open `dist/index.html` directly — it is fully self-contained.

## Keyboard
- `⌘K` / `Ctrl+K` — Command palette (navigate + actions)
- Theme toggle in the header (persists)

## Tech
React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS v4 · Recharts · jsPDF
