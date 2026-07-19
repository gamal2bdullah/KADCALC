import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ViewKey } from '../App';
import { NAV_ITEMS, NAV_GROUPS } from './nav';
import { BrandMark } from './BrandMark';

interface SidebarProps {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  open: boolean;
  setOpen: (b: boolean | ((p: boolean) => boolean)) => void;
}

export function Sidebar({ view, setView, open, setOpen }: SidebarProps) {
  return (
    <aside className={`${open ? 'w-64' : 'w-16'} transition-all duration-300 shrink-0 border-r border-border-medium/80 bg-surface-1 flex flex-col`}>
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-border-medium/80">
        <BrandMark collapsed={!open} />
      </div>

      {/* Nav (grouped) */}
      <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group}>
            {open && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                {group}
              </div>
            )}
            <div className="space-y-1">
              {NAV_ITEMS.filter(i => i.group === group).map(item => {
                const Icon = item.icon;
                const active = view === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setView(item.key)}
                    className={`nav-item ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && <span className="nav-bar" />}
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : ''}`} />
                    {open && (
                      <div className="flex-1 text-left overflow-hidden">
                        <div className="text-sm font-medium whitespace-nowrap">{item.label}</div>
                        <div className="text-[10px] text-text-tertiary whitespace-nowrap">{item.desc}</div>
                      </div>
                    )}
                    {!open && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-surface-2 text-text-primary text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border-medium">
                        {item.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / collapse */}
      <div className="p-2 border-t border-border-medium/80">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-text-tertiary hover:bg-surface-2/40 hover:text-text-primary transition"
        >
          {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {open && <span className="text-xs font-medium">Collapse</span>}
        </button>
        {open && (
          <div className="mt-2 px-3 py-2 text-[10px] text-text-tertiary leading-relaxed">
            Engineering-grade load analysis for solar PV system design.
          </div>
        )}
      </div>
    </aside>
  );
}
