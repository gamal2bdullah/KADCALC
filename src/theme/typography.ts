// ============================================================================
// KAD Calculator — Typography System (single source of truth)
// Replaces ad-hoc text-sm/text-xs/text-[10px]/text-[11px] with a named ramp.
// Step = 1.200 (minor third) on Inter; JetBrains Mono for numerics/labels.
// ============================================================================

export const FONT = {
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

// Modular type scale (px). `mono` marks numeric/engineering usage.
export const TYPE = {
  display: { size: 30, lh: 1.15, weight: 800, mono: false },
  h1:      { size: 24, lh: 1.2,  weight: 700, mono: false },
  h2:      { size: 20, lh: 1.25, weight: 700, mono: false },
  h3:      { size: 16, lh: 1.35, weight: 600, mono: false },
  body:    { size: 14, lh: 1.55, weight: 400, mono: false },
  bodySm:  { size: 13, lh: 1.5,  weight: 400, mono: false },
  caption: { size: 12, lh: 1.4,  weight: 500, mono: false },
  micro:   { size: 11, lh: 1.35, weight: 500, mono: false },
  nano:    { size: 10, lh: 1.3,  weight: 600, mono: false, uppercase: true },
  num:     { size: 28, lh: 1.1,  weight: 700, mono: true },
  numSm:   { size: 14, lh: 1.2,  weight: 600, mono: true },
} as const;

// Where each step is used (enforces consistency across the app).
export const TYPE_USAGE: Record<string, string> = {
  display: 'Dashboard hero project name',
  h1:      '—',
  h2:      'Component page titles',
  h3:      'Card / panel headers',
  body:    'Paragraphs, descriptions',
  bodySm:  'Helper text',
  caption: 'Field labels, badges, nav items',
  micro:   'Table data cells, axis labels',
  nano:    'Eyebrow / section kickers (STAGE 1, LIVE)',
  num:     'KPI big numbers',
  numSm:   'Inline computed metrics',
};
