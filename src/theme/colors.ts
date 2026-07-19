// ============================================================================
// KAD Calculator — Semantic Color Layers (single source of truth)
// INPUT  = anything the user controls (forms, controls, editor)
// OUTPUT = anything the app computes & displays (KPIs, charts, tables, PDF)
// Both Tailwind utilities (via tokens.css @theme) and inline code (charts,
// jsPDF) read from here so INPUT and OUTPUT stay perfectly in sync.
// ============================================================================

// OUTPUT: numeric KPI accent mapping (Dashboard / Schedule)
export const KPI_ACCENT: Record<string, string> = {
  connected:  'var(--accent)',
  demand:     'var(--accent-2)',
  energy:     'var(--green-500)',
  annual:     'var(--blue-500)',
  current:    'var(--red-500)',
  surge:      'var(--pink-500)',
  loadFactor: 'var(--cyan-500)',
  count:      'var(--violet-500)',
};

// OUTPUT: chart categorical palette — fixed order guarantees stable mapping
// across dashboard / analysis / reports.
export const CHART_PALETTE: string[] = [
  'var(--viz-cat-1)', 'var(--viz-cat-2)', 'var(--viz-cat-3)', 'var(--viz-cat-4)',
  'var(--viz-cat-5)', 'var(--viz-cat-6)', 'var(--viz-cat-7)', 'var(--viz-cat-8)',
  'var(--viz-cat-9)', 'var(--viz-cat-10)',
];

// OUTPUT: same palette as raw hex for Recharts (which needs paint strings)
export const CHART_HEX: string[] = [
  '#99F36C', '#1A2B6B', '#10b981', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1',
];

// INPUT: full lifecycle of any field / control
export const INPUT_STATE = {
  rest:    { bg: 'var(--input-bg)', border: 'var(--input-border)', text: 'var(--input-text)' },
  hover:   { bg: 'var(--input-bg-hover)', border: 'var(--input-border-hover)' },
  focus:   { border: 'var(--input-focus-border)', ring: 'var(--input-focus-ring)' },
  invalid: { border: 'var(--input-invalid-border)', ring: 'var(--input-invalid-ring)' },
  disabled:{ bg: 'var(--input-disabled-bg)', text: 'var(--input-disabled-text)' },
} as const;

// Surface ladder (container chrome + outputs), ordered by elevation depth.
export const SURFACES = {
  base: 'var(--surface-base)', sunken: 'var(--surface-sunken)', panel: 'var(--surface-1)',
  raised: 'var(--surface-2)', card: 'var(--surface-3)', overlay: 'var(--surface-overlay)',
  code: 'var(--surface-code)',
} as const;

// Feedback layer (validation, toasts, status pills).
export const FEEDBACK = {
  success: { fg: 'var(--success)', bg: 'var(--success-soft)', border: 'var(--success-border)' },
  warning: { fg: 'var(--warning)', bg: 'var(--warning-soft)', border: 'var(--warning-border)' },
  error:   { fg: 'var(--error)',   bg: 'var(--error-soft)',   border: 'var(--error-border)' },
  info:    { fg: 'var(--info)',    bg: 'var(--info-soft)',    border: 'var(--info-border)' },
  critical:{ fg: 'var(--critical)',bg: 'var(--critical-soft)',border: 'var(--critical-soft)' },
} as const;

// RGB tuples for jsPDF — keep 1:1 in sync with tokens.css.
export const PDF_RGB: Record<string, [number, number, number]> = {
  brand:    [153, 243, 108],
  sun:      [26, 43, 107],
  slate900: [10, 14, 26],
  slate800: [15, 20, 36],
  slate700: [30, 41, 59],
  slate500: [100, 116, 139],
  slate300: [203, 213, 225],
  green:    [16, 185, 129],
  blue:     [59, 130, 246],
  pink:     [236, 72, 153],
  cyan:     [6, 182, 212],
  error:    [239, 68, 68],
  warning:  [245, 158, 11],
  info:     [59, 130, 246],
  success:  [16, 185, 129],
  critical: [139, 92, 246],
};

// Tailwind v4 @theme bridge — emit these so utilities like bg-surface-1,
// text-text-secondary, border-border-subtle, bg-accent-soft are generated
// WITHOUT the old manual safelist hack.
export const TAILWIND_THEME = `
@theme {
  --color-surface-base:  var(--surface-base);
  --color-surface-1:     var(--surface-1);
  --color-surface-2:     var(--surface-2);
  --color-surface-3:     var(--surface-3);
  --color-surface-code:  var(--surface-code);
  --color-border-subtle: var(--border-subtle);
  --color-border-medium: var(--border-medium);
  --color-border-strong: var(--border-strong);
  --color-text-primary:   var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary:  var(--text-tertiary);
  --color-accent:         var(--accent);
  --color-accent-2:       var(--accent-2);
  --color-accent-soft:    var(--accent-soft);
  --color-success:        var(--success);
  --color-warning:        var(--warning);
  --color-error:          var(--error);
  --color-info:           var(--info);
}
`;
