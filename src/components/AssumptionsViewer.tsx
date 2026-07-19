import { useState, useMemo } from 'react';
import { POLICY_PACK, getPolicyStats, getPoliciesByConfidence } from '../core/assumptions/policy';
import { useLoads, useSummary } from '../context/LoadContext';
import { generateAuditPDF } from '../utils/auditReports';
import { Search, BookOpen, FileCheck, AlertCircle, ShieldCheck, ChevronDown, ChevronUp, Database, Lock, Unlock, Download, Loader2 } from 'lucide-react';
import { UI_ICON_TINT, UI_VALUE_TINT } from '../theme/variants';

const SEVERITY_COLORS: Record<string, string> = {
  NEC: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  IEC: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  IEEE: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'IEC 60364': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  NFPA: 'bg-red-500/20 text-red-300 border-red-500/30',
  ASHRAE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Manufacturer: 'bg-accent-2/20 text-accent-2 border-accent-2/30',
  Datasheet: 'bg-accent/20 text-accent border-accent/30',
  Empirical: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Engineering: 'bg-surface-3/20 text-text-secondary border-border-subtle/30',
  'Solar-Specific': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  High: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Medium: 'bg-accent-2/20 text-accent-2 border-accent-2/30',
  Low: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export function AssumptionsViewer() {
  const [search, setSearch] = useState('');
  const [filterConfidence, setFilterConfidence] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { loads, projectName, expertLevel } = useLoads();
  const summary = useSummary();

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      generateAuditPDF('assumptions', loads, summary, projectName, expertLevel);
    } finally { setGenerating(false); }
  };

  const stats = getPolicyStats();
  const policies = useMemo(() => {
    return POLICY_PACK.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.policyId.toLowerCase().includes(search.toLowerCase()) || p.scope.toLowerCase().includes(search.toLowerCase());
      const matchConf = filterConfidence === 'All' || p.confidenceLevel === filterConfidence;
      const matchSrc = filterSource === 'All' || p.sourceType === filterSource;
      return matchSearch && matchConf && matchSrc;
    });
  }, [search, filterConfidence, filterSource]);

  return (
    <div className="p-6 space-y-5 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Engineering Assumptions Policy Registry</h2>
          <p className="text-xs text-text-tertiary">Every default value used in calculations is a versioned, traceable policy — not a magic number</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={generating}
          className="px-3 py-2 rounded-lg bg-accent text-[color:var(--btn-primary-text)] text-xs font-semibold shadow-lg shadow-brand flex items-center gap-1.5 disabled:opacity-50"
        >
          {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Download className="w-3.5 h-3.5" /> Audit PDF</>}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Database} label="Total Policies" value={stats.total.toString()} color="orange" />
        <StatCard icon={ShieldCheck} label="High Confidence" value={stats.byConfidence.High.toString()} sub={`${Math.round((stats.byConfidence.High / stats.total) * 100)}% of policies`} color="emerald" />
        <StatCard icon={AlertCircle} label="Need Review" value={(stats.byConfidence.Medium + stats.byConfidence.Low).toString()} sub="Medium + Low confidence" color="amber" />
        <StatCard icon={FileCheck} label="Last Reviewed" value={stats.lastReviewed} sub="All policies current" color="blue" />
      </div>

      {/* Confidence breakdown */}
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Confidence Distribution</h3>
        <div className="grid grid-cols-3 gap-3">
          {(['High', 'Medium', 'Low'] as const).map(level => {
            const count = getPoliciesByConfidence(level).length;
            const pct = (count / stats.total) * 100;
            return (
              <div key={level} className="rounded-lg bg-surface-1/40 border border-border-medium p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded border ${CONFIDENCE_COLORS[level]}`}>{level}</span>
                  <span className="text-text-secondary font-semibold mono">{count}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className={`h-full rounded-full ${level === 'High' ? 'bg-emerald-500' : level === 'Medium' ? 'bg-accent-2' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-text-tertiary mt-1">{pct.toFixed(1)}% of policies</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source breakdown */}
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Source Standards</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.bySource).map(([src, count]) => (
            <div key={src} className={`px-3 py-1.5 rounded border text-xs ${SEVERITY_COLORS[src] || SEVERITY_COLORS.Engineering}`}>
              <span className="font-semibold">{src}</span>
              <span className="ml-2 mono opacity-80">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search policies by name, ID, or scope…" className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary" />
        </div>
        <select value={filterConfidence} onChange={e => setFilterConfidence(e.target.value)} className="px-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary">
          <option value="All">All Confidence</option>
          <option>High</option><option>Medium</option><option>Low</option>
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="px-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary">
          <option value="All">All Sources</option>
          {Object.keys(stats.bySource).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Policies table */}
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-1/80 text-text-tertiary">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">ID</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Name</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Scope</th>
                <th className="text-right px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Default</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Range</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Source</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Conf.</th>
                <th className="text-center px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Over.</th>
                <th className="text-center px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Details</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(p => {
                const isOpen = expanded === p.policyId;
                return (
                  <>
                    <tr key={p.policyId} className="border-t border-border-medium/40 hover:bg-surface-2/30 cursor-pointer" onClick={() => setExpanded(isOpen ? null : p.policyId)}>
                      <td className="px-3 py-2 mono text-text-tertiary">{p.policyId}</td>
                      <td className="px-3 py-2 text-text-primary font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-text-tertiary text-[10px] mono">{p.scope}</td>
                      <td className="px-3 py-2 text-right mono text-accent font-semibold">{p.defaultValue} {p.unit}</td>
                      <td className="px-3 py-2 text-text-tertiary mono text-[10px]">{p.allowedRange.min}–{p.allowedRange.max}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${SEVERITY_COLORS[p.sourceType] || SEVERITY_COLORS.Engineering}`}>{p.sourceType}</span></td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_COLORS[p.confidenceLevel]}`}>{p.confidenceLevel[0]}</span></td>
                      <td className="px-3 py-2 text-center">{p.overrideAllowed === 'Yes' ? <Unlock className="w-3 h-3 text-emerald-400 inline" /> : <Lock className="w-3 h-3 text-text-tertiary inline" />}</td>
                      <td className="px-3 py-2 text-center">{isOpen ? <ChevronUp className="w-3.5 h-3.5 text-text-tertiary inline" /> : <ChevronDown className="w-3.5 h-3.5 text-text-tertiary inline" />}</td>
                    </tr>
                    {isOpen && (
                      <tr key={p.policyId + '-detail'} className="bg-surface-1/40">
                        <td colSpan={9} className="px-6 py-4 text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] uppercase text-accent font-semibold mb-1">Engineering Rationale</div>
                              <p className="text-text-secondary leading-relaxed">{p.engineeringRationale}</p>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-accent font-semibold mb-1">Source Reference</div>
                              <p className="text-text-secondary leading-relaxed">{p.sourceReference}</p>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-accent font-semibold mb-1">Audit Trail</div>
                              <div className="text-text-secondary space-y-0.5">
                                <div>Last Reviewed: <span className="mono text-text-primary">{p.lastReviewed}</span></div>
                                <div>Override: <span className={`mono ${p.overrideAllowed === 'Yes' ? 'text-emerald-300' : p.overrideAllowed === 'No' ? 'text-red-300' : 'text-accent-2'}`}>{p.overrideAllowed}</span></div>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-accent font-semibold mb-1">Review Notes</div>
                              <p className="text-text-secondary leading-relaxed">{p.reviewNotes}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-accent-2/30 bg-accent-2/5 p-4">
        <div className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-accent-2 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-accent-2">How to Use This Registry</div>
            <p className="text-xs text-accent-2/80 mt-1 leading-relaxed">
              Every calculation in the system references one of these policies. The <strong>policyId</strong> appears in audit metadata so any result can be traced back to its underlying assumption. To change a default value, edit the policy in <code className="mono text-[10px] bg-surface-2/60 px-1 rounded">src/core/assumptions/policy.ts</code> — never embed a magic number in a calculation function.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-4">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${UI_ICON_TINT[color]}`} />
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">{label}</span>
      </div>
      <div className={`text-xl font-bold mono ${UI_VALUE_TINT[color]} mt-2`}>{value}</div>
      {sub && <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}
