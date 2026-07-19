// ============================================================================
//  Workflow primitives — progressive disclosure building blocks.
//  Used to turn dense "all-at-once" screens into guided, decision-oriented
//  workflows. All class names are static literals (no runtime interpolation).
// ============================================================================
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

const TAB_SIZE: Record<'sm' | 'md', string> = {
  sm: 'text-[11px]',
  md: 'text-xs',
};

export function TabBar({
  tabs,
  active,
  onChange,
  size = 'md',
}: {
  tabs: TabItem[];
  active: string;
  onChange: (k: string) => void;
  size?: 'sm' | 'md';
}) {
  const sizeCls = TAB_SIZE[size];
  return (
    <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-surface-2/50 border border-border-medium/60">
      {tabs.map(t => {
        const Icon = t.icon;
        const activeNow = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${sizeCls} ${activeNow ? 'bg-accent text-[color:var(--btn-primary-text)] shadow-md shadow-brand' : 'text-text-tertiary hover:text-text-primary hover:bg-surface-3/50'}`}
          >
            {Icon}
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Disclosure({
  title,
  subtitle,
  defaultOpen = false,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border-medium/80 bg-surface-1 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-1/80 hover:bg-surface-2/40 transition text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          {subtitle && <div className="text-[11px] text-text-tertiary mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-border-medium/60">{children}</div>}
    </div>
  );
}
