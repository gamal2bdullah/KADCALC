import { useState } from 'react';
import { useLoads } from '../context/LoadContext';
import { Settings as SettingsIcon, RotateCcw, Trash2, Database, Save, AlertTriangle, Cpu, BookOpen } from 'lucide-react';
import type { ExpertLevel } from '../types';

export function Settings() {
  const { loads, clearAll, loadPreset, projectName, setProjectName, expertLevel, setExpertLevel } = useLoads();
  const [name, setName] = useState(projectName);

  const LEVELS: { v: ExpertLevel; l: string; d: string; features: string[] }[] = [
    { v: 'Basic', l: 'Level 1 · Basic Residential', d: 'Simplified inputs, nameplate only', features: ['Connected Load', 'Daily Energy', 'Basic Surge'] },
    { v: 'Professional', l: 'Level 2 · Professional', d: 'Advanced residential with duty cycle', features: ['Duty Cycle', 'Demand Factor', 'Day/Night Split', 'Criticality'] },
    { v: 'Commercial', l: 'Level 3 · Commercial/Industrial', d: 'Full NEC/IEC compliance mode', features: ['Coincidence/Diversity', 'Phase Balance', 'Verification', 'THD/PF Tracking'] },
    { v: 'Expert', l: 'Level 4 · Engineering Expert', d: 'Full engineering analysis mode', features: ['All Load Behavior', 'LRA / Surge Models', 'Harmonic Analysis', 'Custom Hourly Profiles', 'Seasonal Behavior'] },
  ];

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Project Settings</h2>
        <p className="text-xs text-text-tertiary">Configure project, calculation mode, and data management</p>
      </div>

      {/* Project name */}
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-accent" /> Project Information</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">Project Name</label>
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary" />
              <button onClick={() => setProjectName(name)} className="px-4 py-2 rounded-lg bg-accent text-[color:var(--btn-primary-text)] text-xs font-semibold flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expert level */}
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-accent" /> Expert Level</h3>
        <p className="text-xs text-text-tertiary mb-4">Select calculation depth — higher levels expose more engineering parameters</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LEVELS.map(l => (
            <button
              key={l.v}
              onClick={() => setExpertLevel(l.v)}
              className={`text-left p-4 rounded-lg border transition ${
                expertLevel === l.v
                  ? 'border-accent/60 bg-accent/10 shadow-lg shadow-brand'
                  : 'border-border-medium bg-surface-1/30 hover:border-border-medium'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`text-sm font-semibold ${expertLevel === l.v ? 'text-accent' : 'text-text-primary'}`}>{l.l}</div>
                {expertLevel === l.v && <span className="text-[10px] px-2 py-0.5 rounded bg-accent/30 text-accent border border-accent/50 mono">ACTIVE</span>}
              </div>
              <p className="text-xs text-text-tertiary mb-2">{l.d}</p>
              <div className="flex flex-wrap gap-1">
                {l.features.map(f => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-secondary">{f}</span>)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><Database className="w-4 h-4 text-accent" /> Load Presets</h3>
        <p className="text-xs text-text-tertiary mb-4">Load a preset configuration to get started quickly</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => { if (confirm('Replace current loads with Basic preset?')) loadPreset('basic'); }} className="text-left p-4 rounded-lg border border-border-medium bg-surface-1/30 hover:border-accent/50">
            <div className="text-sm font-semibold text-text-primary mb-1">🏠 Basic Home</div>
            <div className="text-[10px] text-text-tertiary mb-2">10 essential residential loads</div>
            <div className="text-[10px] mono text-accent">~ 5 kW connected</div>
          </button>
          <button onClick={() => { if (confirm('Replace current loads with Professional preset?')) loadPreset('professional'); }} className="text-left p-4 rounded-lg border border-border-medium bg-surface-1/30 hover:border-accent/50">
            <div className="text-sm font-semibold text-text-primary mb-1">🏡 Pro Home</div>
            <div className="text-[10px] text-text-tertiary mb-2">14 loads · EV, medical, servers</div>
            <div className="text-[10px] mono text-accent">~ 12 kW connected</div>
          </button>
          <button onClick={() => { if (confirm('Replace current loads with Commercial preset?')) loadPreset('commercial'); }} className="text-left p-4 rounded-lg border border-border-medium bg-surface-1/30 hover:border-accent/50">
            <div className="text-sm font-semibold text-text-primary mb-1">🏢 Commercial</div>
            <div className="text-[10px] text-text-tertiary mb-2">7 large 3-phase loads</div>
            <div className="text-[10px] mono text-accent">~ 75 kW connected</div>
          </button>
        </div>
      </div>

      {/* Data management */}
      <div className="rounded-xl border border-accent-2/30 bg-accent-2/5 p-5">
        <h3 className="text-sm font-semibold text-accent-2 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Data Management</h3>
        <p className="text-xs text-text-tertiary mb-4">Destructive actions — please be careful</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-1/40 border border-border-medium">
            <div>
              <div className="text-sm text-text-primary">Clear All Loads</div>
              <div className="text-[10px] text-text-tertiary">Remove all {loads.length} loads from this project</div>
            </div>
            <button onClick={() => { if (confirm('Delete all loads? This cannot be undone.')) clearAll(); }} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-500/30">
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-1/40 border border-border-medium">
            <div>
              <div className="text-sm text-text-primary">Reset to Default</div>
              <div className="text-[10px] text-text-tertiary">Reset to Basic Home preset (10 loads)</div>
            </div>
            <button onClick={() => { if (confirm('Reset to default preset?')) loadPreset('basic'); }} className="px-3 py-1.5 rounded-lg bg-accent-2/20 text-accent-2 border border-accent-2/30 text-xs font-semibold flex items-center gap-1.5 hover:bg-accent-2/30">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Engineering references */}
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" /> Engineering Standards & References</h3>
        <ul className="space-y-1.5 text-xs text-text-tertiary">
          <li className="flex items-start gap-2"><span className="text-accent">▸</span><span><strong className="text-text-secondary">NEC Demand Factors</strong>: First 3 kVA @ 100%, 3-20 kVA @ 35%, &gt;20 kVA @ 25% (Article 220)</span></li>
          <li className="flex items-start gap-2"><span className="text-accent">▸</span><span><strong className="text-text-secondary">IEC Coincidence Factors</strong>: 0.5-0.9 typical for residential, 0.6-0.8 for commercial</span></li>
          <li className="flex items-start gap-2"><span className="text-accent">▸</span><span><strong className="text-text-secondary">Inverter Sizing</strong>: Peak Demand × 1.25 (25% oversize for surge) per NEC 690.8</span></li>
          <li className="flex items-start gap-2"><span className="text-accent">▸</span><span><strong className="text-text-secondary">Power Factor</strong>: Resistive = 1.0, Inductive (motors) = 0.7-0.9, Electronic = 0.6-0.9</span></li>
          <li className="flex items-start gap-2"><span className="text-accent">▸</span><span><strong className="text-text-secondary">THD Limits</strong>: ≤5% individual, ≤8% THDv (IEEE 519)</span></li>
          <li className="flex items-start gap-2"><span className="text-accent">▸</span><span><strong className="text-text-secondary">Motor Starting</strong>: PSC 3-4×, Capacitor 5-6×, DOL 6-7× running current</span></li>
        </ul>
      </div>
    </div>
  );
}
