// ============================================================================
//  Static UI Variant Maps — single source of truth for color-driven classes.
//
//  WHY: components previously built Tailwind class names at runtime via string
//  interpolation (e.g. `text-${color}-400`). That pattern is fragile: Tailwind's
//  static scanner cannot guarantee coverage and it leaks presentation tokens into
//  business logic. Every value below is a LITERAL class string (resolved from the
//  token-driven safelist in tokens.css), so the scanner always generates it and
//  the component reads purely semantic tokens.
// ============================================================================

export type UiColor =
  | 'orange' | 'amber' | 'emerald' | 'blue' | 'red' | 'pink' | 'cyan'
  | 'purple' | 'green' | 'indigo' | 'violet' | 'teal' | 'yellow'
  | 'fuchsia' | 'sky' | 'rose';

export type UiRisk = 'red' | 'amber' | 'emerald';
export type UiAlign = 'left' | 'right' | 'center';

// Icon tint (was `text-${color}-400`)
export const UI_ICON_TINT: Record<string, string> = {
  orange: 'text-orange-400', amber: 'text-amber-400', emerald: 'text-emerald-400',
  blue: 'text-blue-400', red: 'text-red-400', pink: 'text-pink-400',
  cyan: 'text-cyan-400', purple: 'text-purple-400', green: 'text-emerald-400',
  indigo: 'text-indigo-400', violet: 'text-violet-400', teal: 'text-teal-400',
  yellow: 'text-yellow-400', fuchsia: 'text-fuchsia-400', sky: 'text-sky-400',
  rose: 'text-rose-400',
};

// Value tint (was `text-${color}-300`)
export const UI_VALUE_TINT: Record<string, string> = {
  orange: 'text-orange-300', amber: 'text-amber-300', emerald: 'text-emerald-300',
  blue: 'text-blue-300', red: 'text-red-300', pink: 'text-pink-300',
  cyan: 'text-cyan-300', purple: 'text-purple-300', green: 'text-emerald-300',
  indigo: 'text-indigo-300', violet: 'text-violet-300', teal: 'text-teal-300',
  yellow: 'text-yellow-300', fuchsia: 'text-fuchsia-300', sky: 'text-sky-300',
  rose: 'text-rose-300',
};

// Gradient presets for horizontal bars (was `bg-gradient-to-r ${color}` where
// color was a hand-built literal gradient string).
export const UI_GRADIENT: Record<string, string> = {
  day: 'bg-gradient-to-r from-accent to-accent-2',
  night: 'bg-gradient-to-r from-indigo-500 to-blue-500',
  critical: 'bg-gradient-to-r from-red-500 to-pink-500',
  deferrable: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  phantom: 'bg-gradient-to-r from-purple-500 to-violet-500',
};

// Risk badges (was `bg-${riskColor}-500/15 text-${riskColor}-300 border-${riskColor}-500/30`)
export const UI_RISK_BADGE: Record<UiRisk, string> = {
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

// Text alignment (was `text-${align}`)
export const UI_TEXT_ALIGN: Record<UiAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};
