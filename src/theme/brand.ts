// ============================================================================
// KAD Calculator — Brand Identity (single source of truth)
// Single, canonical identity consumed by every surface (UI, charts, PDF, Sidebar):
//   repo "KADCalculator" · wordmark "KAD Calculator" · package "react-vite-tailwind"
//   · Sidebar "KAD Calculator v4.0" · PDF header/footer "KAD Calculator · Load Analysis Engine v4.0"
// Every surface now imports BRAND instead of hard-coding a name/version.
// ============================================================================

export const BRAND = {
  name: 'KAD Calculator',
  shortName: 'KAD',
  tagline: 'Advanced Solar Load & Engineering Analysis Suite',
  version: '4.0.0',
  vendor: 'KAD Engineering',
  // Logo lockup (rendered by <BrandMark/>)
  logo: {
    mark: 'bolt' as 'bolt' | 'sun' | 'grid',
    wordmark: 'KAD',
    wordmarkSub: 'CALCULATOR',
  },
} as const;

// Motion & elevation constants shared by components and PDF.
export const MOTION = {
  durFast: 120,
  durBase: 200,
  durSlow: 320,
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)' as const,
};

// Z-index ladder — prevents the classic z-30/z-50 collisions.
export const Z = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  toast: 1400,
  tooltip: 1500,
  command: 1600,
} as const;

// Severity -> semantic token + behavior. Drives badges, validation, charts.
export const SEVERITY: Record<string, { token: string; label: string; blocks: boolean }> = {
  error:      { token: 'error',    label: 'Error',     blocks: true },
  warning:    { token: 'warning',  label: 'Warning',   blocks: false },
  advisory:   { token: 'info',     label: 'Advisory',  blocks: false },
  info:       { token: 'success',  label: 'Info',      blocks: false },
  assumption: { token: 'critical', label: 'Assumption',blocks: false },
};

// Criticality -> semantic token + rank (used for badges & sorting).
export const CRITICALITY: Record<string, { token: string; label: string; rank: number }> = {
  Critical:  { token: 'crit-critical', label: 'Critical',  rank: 0 },
  Essential: { token: 'crit-essential',label: 'Essential', rank: 1 },
  Normal:    { token: 'crit-normal',   label: 'Normal',    rank: 2 },
  Optional:  { token: 'crit-optional', label: 'Optional',  rank: 3 },
};
