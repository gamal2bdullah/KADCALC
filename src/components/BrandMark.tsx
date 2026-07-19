import { BRAND } from '../theme/brand';

// Canonical brand lockup — replaces the inline brand block in Sidebar.
// Reads BRAND (single source) so name/version stay consistent everywhere.
export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center shadow-lg shadow-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-5 h-5">
            <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
          </svg>
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-surface-1 dark:border-surface-1" />
      </div>
      {!collapsed && (
        <div className="overflow-hidden">
          <div className="text-sm font-bold text-text-primary tracking-tight whitespace-nowrap">
            {BRAND.shortName} <span className="text-accent">{BRAND.logo.wordmarkSub}</span>
          </div>
          <div className="text-[10px] text-text-tertiary font-medium whitespace-nowrap">
            Load Calculator v{BRAND.version.split('.')[0]}.0
          </div>
        </div>
      )}
    </div>
  );
}
