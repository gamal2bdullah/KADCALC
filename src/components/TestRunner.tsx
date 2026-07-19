import { useState } from 'react';
import { runAllTests, type TestSuite, type TestResult } from '../core/tests/calculations.test';
import { CheckCircle2, X, Play, Loader2, FileCode, Activity, Target, BarChart3, BookOpen, Zap, Shield } from 'lucide-react';
import { UI_VALUE_TINT } from '../theme/variants';

export function TestRunner() {
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'failed' | 'unit' | 'property' | 'golden' | 'regression' | 'formula' | 'integration'>('all');

  const run = async () => {
    setRunning(true);
    setSuite(null);
    await new Promise(r => setTimeout(r, 100));
    const result = await runAllTests();
    setSuite(result);
    setRunning(false);
  };

  const filtered = suite?.results.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'failed') return !r.passed;
    return r.category === filter;
  }) ?? [];

  return (
    <div className="p-6 space-y-5 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Test Suite — Self-Audit Engine</h2>
          <p className="text-xs text-text-tertiary">Unit · Property · Golden Dataset · Formula Registry · Regression · Integration</p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-accent text-[color:var(--btn-primary-text)] text-sm font-semibold shadow-lg shadow-brand flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Tests…</> : <><Play className="w-4 h-4" /> Run All Tests</>}
        </button>
      </div>

      {!suite && !running && (
        <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-12 text-center">
          <FileCode className="w-12 h-12 mx-auto mb-3 text-text-tertiary" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Test Suite Ready</h3>
          <p className="text-sm text-text-tertiary max-w-xl mx-auto">
            Run the full test suite to verify calculation engine, validation rules, phase balancer, profile builder, and policy registry are all behaving correctly. Tests include unit, property-based, golden dataset, regression, formula registry, and integration coverage.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6 max-w-2xl mx-auto text-left">
            <TestTypeInfo icon={Target} title="Unit" desc="Individual function behavior" />
            <TestTypeInfo icon={Activity} title="Property" desc="Invariants across random inputs" />
            <TestTypeInfo icon={BookOpen} title="Golden" desc="Known reference datasets" />
            <TestTypeInfo icon={Shield} title="Regression" desc="Locked values for change detection" />
            <TestTypeInfo icon={BarChart3} title="Formula" desc="Edge cases & out-of-range" />
            <TestTypeInfo icon={Zap} title="Integration" desc="End-to-end pipeline" />
          </div>
        </div>
      )}

      {suite && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Total Tests" value={suite.total.toString()} color="orange" />
            <SummaryCard label="Passed" value={suite.passed.toString()} sub={`${((suite.passed / Math.max(1, suite.total)) * 100).toFixed(1)}% pass rate`} color="emerald" />
            <SummaryCard label="Failed" value={suite.failed.toString()} sub={suite.failed === 0 ? 'All green ✓' : 'Needs investigation'} color={suite.failed === 0 ? 'emerald' : 'red'} />
            <SummaryCard label="Total Duration" value={`${suite.results.reduce((s, r) => s + r.duration, 0).toFixed(1)}ms`} sub="In-browser execution" color="blue" />
          </div>

          {/* By category */}
          <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Results by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {Object.entries(suite.byCategory).map(([cat, stats]) => {
                const total = stats.passed + stats.failed;
                const pct = total > 0 ? (stats.passed / total) * 100 : 0;
                return (
                  <div key={cat} className="rounded-lg bg-surface-1/40 border border-border-medium p-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">{cat}</div>
                    <div className="text-xl font-bold mono text-emerald-300 mt-1">{stats.passed}<span className="text-text-tertiary text-sm">/{total}</span></div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-2">
                      <div className={`h-full rounded-full ${stats.failed > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-surface-2/60 border border-border-medium/50 w-fit">
            {(['all', 'failed', 'unit', 'property', 'golden', 'regression', 'formula', 'integration'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-[11px] font-medium transition ${filter === f ? 'bg-accent text-[color:var(--btn-primary-text)]' : 'text-text-tertiary hover:text-text-primary'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'failed' && suite.failed > 0 ? `(${suite.failed})` : ''}
              </button>
            ))}
          </div>

          {/* Test results list */}
          <div className="rounded-xl border border-border-medium/80 bg-surface-1 overflow-hidden">
            <div className="divide-y divide-border-medium/50 max-h-[600px] overflow-y-auto">
              {filtered.map((r, idx) => (
                <TestRow key={idx} r={r} />
              ))}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-text-tertiary">No tests match the filter</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TestTypeInfo({ icon: Icon, title, desc }: any) {
  return (
    <div className="rounded-lg bg-surface-1/40 border border-border-medium p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-semibold text-text-primary">{title}</span>
      </div>
      <div className="text-[10px] text-text-tertiary">{desc}</div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: any) {
  return (
    <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">{label}</div>
      <div className={`text-2xl font-bold mono ${UI_VALUE_TINT[color]} mt-2`}>{value}</div>
      {sub && <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

function TestRow({ r }: { r: TestResult }) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="p-3 hover:bg-surface-2/20 transition">
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setShowDetails(s => !s)}>
        <div className="shrink-0 mt-0.5">
          {r.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-text-primary">{r.name}</span>
            <span className="text-[10px] text-text-tertiary mono uppercase">[{r.category}]</span>
            <span className="text-[10px] text-text-tertiary mono">{r.duration.toFixed(2)}ms</span>
          </div>
          {r.passed ? (
            <div className="text-[11px] text-emerald-400/80 mt-0.5">OK</div>
          ) : (
            <div className="text-[11px] text-red-300/80 mt-0.5">{r.message}</div>
          )}
          {showDetails && !r.passed && (
            <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-[11px]">
              <div><span className="text-text-tertiary">Expected:</span> <code className="mono text-text-primary">{String(r.expected)}</code></div>
              <div><span className="text-text-tertiary">Actual:</span> <code className="mono text-text-primary">{String(r.actual)}</code></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
