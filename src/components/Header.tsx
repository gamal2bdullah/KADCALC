import { useState } from 'react';
import { Command, Sun, Moon } from 'lucide-react';
import type { ViewKey } from '../App';
import { useLoads, useSummary } from '../context/LoadContext';
import { fmtW, fmtWh } from '../utils/calculations';

const TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Engineering Dashboard', subtitle: 'Real-time load & demand analysis' },
  inventory: { title: 'Load Inventory', subtitle: 'Add, edit & manage your electrical loads' },
  schedule: { title: 'Master Load Schedule', subtitle: '75+ column engineering data sheet' },
  analysis: { title: 'Analysis Engine', subtitle: 'Profiles, peaks, surges & seasonal behavior' },
  reports: { title: 'Engineering Reports', subtitle: 'Compliance & technical documentation' },
  library: { title: 'Appliance Master Library', subtitle: 'Reference database of common appliances' },
  settings: { title: 'Project Settings', subtitle: 'Configure your solar load project' },
  assumptions: { title: 'Assumptions Policy Registry', subtitle: 'All engineering policies, sources & rationale' },
  validation: { title: 'Validation Matrix', subtitle: '5-severity rule engine · 30+ validation rules' },
  phase: { title: 'Phase Balancing Engine', subtitle: 'Multi-pass 3-phase distribution optimizer' },
  tests: { title: 'Test Suite', subtitle: 'Self-audit engine · 6 test categories' },
  docs: { title: 'Engineering Documentation', subtitle: 'Architecture, formulas, policies, methods' },
};

const LEVELS = [
  { value: 'Basic', label: 'Basic', desc: 'Residential' },
  { value: 'Professional', label: 'Pro', desc: 'Advanced home' },
  { value: 'Commercial', label: 'Comm.', desc: 'Commercial' },
  { value: 'Expert', label: 'Expert', desc: 'Full engineering' },
] as const;

export function Header({
  onToggleSidebar, view, theme, onToggleTheme, onOpenPalette,
}: {
  onToggleSidebar: () => void; view: ViewKey;
  theme: 'dark' | 'light'; onToggleTheme: () => void; onOpenPalette: () => void;
}) {
  const { expertLevel, setExpertLevel, projectName, setProjectName, loads } = useLoads();
  const summary = useSummary();
  const [editingName, setEditingName] = useState(false);

  const { title, subtitle } = TITLES[view];

  return (
    <header className="h-16 shrink-0 border-b border-border-medium/80 bg-surface-base/80 backdrop-blur-md flex items-center px-4 gap-4 z-30">
      <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-lg hover:bg-surface-2 text-text-secondary">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              className="bg-surface-2/60 border border-border-medium rounded px-2 py-0.5 text-sm font-semibold text-text-primary outline-none focus:border-accent"
            />
          ) : (
            <h1 onClick={() => setEditingName(true)} className="text-sm font-semibold text-text-primary tracking-tight cursor-text hover:text-accent transition truncate">
              {projectName}
            </h1>
          )}
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
            ● LIVE
          </span>
        </div>
        <div className="text-[11px] text-text-tertiary">{title} · {subtitle}</div>
      </div>

      {/* Quick KPIs in header */}
      <div className="hidden md:flex items-center gap-3 px-3 border-l border-border-medium">
        <div className="text-right">
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Connected</div>
          <div className="text-sm font-bold text-text-primary mono">{fmtW(summary.totalConnectedLoadW, 1)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Max Demand</div>
          <div className="text-sm font-bold text-accent mono">{fmtW(summary.maximumDemandW, 1)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Daily</div>
          <div className="text-sm font-bold text-accent-2 mono">{fmtWh(summary.totalDailyEnergyWh, 1)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Loads</div>
          <div className="text-sm font-bold text-emerald-400 mono">{loads.length}</div>
        </div>
      </div>

      {/* Command palette + theme toggle */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2/60 border border-border-medium/50 text-text-tertiary hover:text-text-primary hover:border-border-medium transition text-[11px] font-medium"
          title="Command palette (⌘K)"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="hidden md:inline">⌘K</span>
        </button>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg bg-surface-2/60 border border-border-medium/50 text-text-tertiary hover:text-text-primary hover:border-border-medium transition"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Expert level selector */}
      <div className="hidden lg:flex items-center gap-1 p-1 rounded-lg bg-surface-2/60 border border-border-medium/50">
        {LEVELS.map(l => (
          <button
            key={l.value}
            onClick={() => setExpertLevel(l.value as any)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              expertLevel === l.value
                ? 'bg-accent text-[color:var(--btn-primary-text)] shadow-md shadow-brand'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
            title={l.desc}
          >
            {l.label}
          </button>
        ))}
      </div>
    </header>
  );
}
