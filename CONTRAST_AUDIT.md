# KAD Calculator — WCAG Contrast Audit & Remediation

Full-site contrast audit (WCAG 2.1 AA) of every semantic pairing across **dark** and **light** themes,
driven by the single-source token system in `src/theme/tokens.css`. Ratios computed with the
relative-luminance formula; alpha backgrounds composited over their parent surface.

## Result
- **Every rendered text, badge, button, chart series, axis/legend/tooltip text and UI border now passes AA**
  (≥ 4.5:1 normal text, ≥ 3:1 large text / UI components / graphical objects).
- The only remaining low-contrast items are **intentional and spec-compliant** (see Exceptions).

## Root causes found & fixed
1. **Navy (`#1A2B6B` / `#3a4f9c`) is invisible on the near-black dark background (≈1.36:1).**
   Lightened the dark-mode navy primitives to luminous tints — `--sun-400 #3a4f9c→#8ba3e8`,
   `--sun-500 #1A2B6B→#6f8be0`, and the hardcoded `c-amber-300/400` navy → same tints.
   This single fix repairs `accent-2` text, the `viz-cat-2` chart series, warning pills,
   and the KPI amber/orange labels in dark mode. Light-mode navy is kept (visible on white).
2. **Bright green (`#99F36C`) is invisible on white (≈1.36:1).**
   Darkened the light-mode data-viz series & feedback colors: `viz-cat-1→#15803d`, `viz-cat-3→#047857`,
   `viz-cat-7→#0e7490`, `viz-cat-8→#4d7c0f`, and feedback `success→#047857`, `error→#b91c1c`, `info→#1d4ed8`.
   The brand green is kept in dark mode (visible on dark) and warning stays green per spec.
3. **Primary button: white text on a bright-green gradient end = 1.36:1 (catastrophic).**
   Replaced all 15 `bg-gradient-to-r from-accent to-accent-2 text-white` buttons with
   `bg-accent text-[color:var(--btn-primary-text)]` + new `--btn-primary-text` token
   (near-black on green in dark, white on navy in light → 13–14:1).
4. **Chart axis ticks, legend & tooltip text defaulted to `#333` / old `#6b7a9c` → invisible on dark.**
   Added theme-aware CSS so Recharts text resolves `var(--viz-axis)` (ticks), `var(--text-secondary)`
   (legend) and `var(--text-primary)` (tooltip); chart grid/axis lines resolve `var(--viz-grid)`.
   Also removed a hardcoded green chart-dot fill in favour of the theme-aware series colour.
5. **Pills (same-colour text on its own tint) were sub-AA.** Lightened feedback colours in dark and
   darkened them in light; nudged two soft-bg alphas; the light warning pill uses a darker green
   (`#15803d`) for legibility while keeping the warning semantic = green.
6. **Borders / grid lines failed WCAG 1.4.11 (3:1) in both themes.** Strengthened every structural
   border so all meet 3:1+: dark `border-subtle→#54688f`, `border-medium→#6b7ea6`, `border-strong→#8497bd`;
   light `border-subtle→#8794a8`, `border-medium→#6b7a90`, `border-strong→#4a5a73`. Chart grids follow
   `viz-grid` so they are now 3:1 too.

## Exceptions (intentional, WCAG-compliant)
- **`--text-disabled`** fails 4.5:1 on purpose. WCAG 1.4.3 explicitly exempts *inactive/disabled UI
  components* — raising it would make disabled controls look enabled (harmful UX). Left as-is.
- **Light warning pill** token value shows low in the raw audit, but is overridden at the component
  level by `[data-theme='light'] .pill-warning { color:#15803d }` (verified ≥ 4.5:1).

## Verification
`python3 contrast_check.py` — after remediation, zero FAILs on rendered content (only the two
exempt/overridden items above remain flagged, both by design).
