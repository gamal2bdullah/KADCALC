import { useState } from 'react';
import { GitBranch, Shield, Database, Calculator, Layers, TestTube, FileText, Lightbulb, ListChecks, Wrench } from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: any;
  content: { heading: string; body: string | string[]; code?: string }[];
}

const DOCS: DocSection[] = [
  {
    id: 'architecture',
    title: 'Architecture Overview',
    icon: Layers,
    content: [
      { heading: 'Five-Layer Calculation Engine', body: ['Every calculation flows through 5 mandatory layers:', '1. Raw Input — user-supplied values', '2. Normalization — clamping, unit conversion, defaults', '3. Engineering Rules — PF, Ku, DF, CF, Div, Surge, THD', '4. Derived Metrics — 13 standardized outputs with audit metadata', '5. Interpretation — warnings, recommendations, risk assessment'] },
      { heading: 'Module Map', body: ['src/core/assumptions — Policy registry & override tracking', 'src/core/calculations — Multi-layer audit engine', 'src/core/validation — 30+ rule engine with 5 severity levels', 'src/core/phase — 3-phase balancing algorithm', 'src/core/profiles — 4-level time profile builder', 'src/core/surge — Surge decision engine', 'src/core/harmonics — THD effect modeling', 'src/core/pf — Power factor decision engine', 'src/core/tests — Comprehensive test suite', 'src/utils/pdfGenerator + auditReports — PDF export', 'src/components — UI layer (read-only consumers of core)'] },
    ],
  },
  {
    id: 'policies',
    title: 'Assumptions Policy',
    icon: Shield,
    content: [
      { heading: 'What is a Policy?', body: 'Every default value used in calculations is registered in POLICY_PACK with: policyId, name, scope, defaultValue, allowedRange, sourceType, sourceReference, confidenceLevel, engineeringRationale, overrideAllowed, lastReviewed, reviewNotes.' },
      { heading: 'Override Tracking', body: 'When a user deviates from a default, the override is recorded with timestamp, reason, field, and auto-assessed risk. Pending overrides can be reviewed and approved/rejected for audit.' },
      { heading: 'Confidence Levels', body: ['High: peer-reviewed standards (IEEE, NEC) with measured validation', 'Medium: industry conventions with empirical backing', 'Low: estimates requiring user verification'] },
    ],
  },
  {
    id: 'validation',
    title: 'Validation Engine',
    icon: ListChecks,
    content: [
      { heading: '5 Severity Levels', body: ['error — blocks save, must be fixed', 'warning — engineering review needed', 'advisory — optimization recommendation', 'info — informational note about data', 'assumption — default value is in use, document if critical'] },
      { heading: 'Rule Structure', body: 'Every rule has: ruleId, name, description, severity, autoFixable flag, and a check(load) function. Results include: fixSuggestion, relatedFormula, affectedMetric, source.' },
      { heading: '30+ Rules Coverage', body: 'E001-E007 errors, W001-W010 warnings, A001-A007 advisories, I001-I004 info, AS001-AS004 assumptions. Total 32+ rules with auto-fixable flag for batch repair.' },
    ],
  },
  {
    id: 'formulas',
    title: 'Formula Registry',
    icon: Calculator,
    content: [
      { heading: 'Mandatory Calculation Order', body: ['1. connected = ratedPowerW × quantity', '2. running = runningPowerW × quantity', '3. demand = connected × Ku', '4. coincident = demand × CF', '5. diversified = coincident / Div', '6. kVA = P / (PF × 1000) × THD-derate', '7. kVAR = √(kVA² − kW²)', '8. I = P / (V × PF) [or √3 × V × PF for 3Ø]', '9. LRC = FLC × surgeMultiplier × qty', '10. surge = ratedPowerW × surge× × qty', '11. daily = avg(summer × 183, winter × 182) / 365', '12. annual = daily × operatingDaysPerYear', '13. LF = (daily / 24) / peak × 100'] },
      { heading: 'Out-of-Range Behavior', body: 'All inputs are normalized: PF clamped to (0, 1], efficiency to [1, 100], quantity ≥ 1, hours ≥ 0, THD to [0, 100]. Out-of-range generates a warning, not silent acceptance.' },
    ],
  },
  {
    id: 'phase',
    title: 'Phase Balancer',
    icon: GitBranch,
    content: [
      { heading: 'Algorithm', body: 'Multi-pass greedy + 50-iteration refinement. Critical 1Ø loads spread across all 3 phases. High-surge loads placed first to avoid stacking. Same-group loads co-located for clarity. Refinement pass swaps largest non-critical load if it reduces imbalance.' },
      { heading: 'Surge Stacking', body: 'For each phase, computes total aggregate LRA and stacking risk (high if 3+ motors start simultaneously). Recommendation engine suggests sequential start with delay = 10s × multiplier.' },
    ],
  },
  {
    id: 'time',
    title: 'Time & Energy Model',
    icon: Database,
    content: [
      { heading: '4-Level Profile', body: ['Hourly — 24-value operating array per load', 'Daily — total, day (8-18h), night, peak hour', 'Seasonal — summer vs winter with variance', 'Calendar — weekday vs weekend vs holiday (per-region)'] },
      { heading: 'Peak Window Detection', body: 'Detects contiguous hours where load ≥ 70% of daily peak. Returns start, end, average power for each window. Useful for demand response planning.' },
      { heading: 'Holiday Calendar', body: 'Built-in holiday set with regional support (SA, AE, EG, GLOBAL). Each holiday has load multiplier and class (religious/national/commercial). Annual calendar profile generated for any year.' },
    ],
  },
  {
    id: 'surge',
    title: 'Surge Engine',
    icon: Wrench,
    content: [
      { heading: 'Surge Model', body: 'Beyond simple multiplier: detects VFD/soft-starter from notes, applies reduction factor, computes LRC, recommends start strategy (simultaneous/sequential/grouped/VFD-controlled), sets delay and group window.' },
      { heading: 'System-Level Aggregation', body: 'Total aggregate LRA if all start simultaneously. Worst-case = top 3 loads\' LRA summed. Recommendations: oversize inverter ≥1.5×, sequential start for high-surge groups, soft-starter for unmitigated motors.' },
    ],
  },
  {
    id: 'harmonics',
    title: 'Harmonic Engine',
    icon: GitBranch,
    content: [
      { heading: 'THD Effects', body: 'THD > 5% triggers capacity derate (1% per 5% above limit, min 0.7×). Non-linear loads require neutral conductor sized 1.73× phase. Filter recommendation: passive (8-20% THD), active (>20%), K-rated transformer for severe cases.' },
      { heading: 'Severity Classification', body: ['clean: ≤5%', 'mild: 5-8%', 'moderate: 8-20%', 'severe: 20-30%', 'critical: >30%'] },
    ],
  },
  {
    id: 'pf',
    title: 'Power Factor Engine',
    icon: Calculator,
    content: [
      { heading: 'PF Effects Chain', body: 'PF affects: apparent power (kVA), current (1/PF penalty), inverter sizing, cable sizing. Below 0.95, correction capacitor is recommended. Below 0.8, utility penalties may apply.' },
      { heading: 'Correction Sizing', body: 'kVAr to add = current_kvar − (kW × tan(acos(target_PF))). Default target = 0.95. Three correction strategies: individual-capacitor, bulk-capacitor-bank, active-filter.' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: FileText,
    content: [
      { heading: '9 Report Types', body: ['Executive Summary — cover + KPIs + recommendations', 'Demand Analysis — 10 metrics + NEC factors + surge multipliers', 'Seasonal — summer vs winter + phase balance', 'Compliance — validation + phantom + THD', 'Custom — full schedule + category summary', 'Master Schedule — 24-column landscape', 'Assumptions Audit — all 30+ policies with rationale', 'Validation Matrix — all 30+ rules with issues', 'Phase Balance — algorithm output + recommendations', 'Calculation Audit Trail — formula + confidence per metric'] },
      { heading: 'Report Standards', body: 'Every report includes: overview, method, assumptions used, data quality summary, key metrics, warnings, design notes, limitations, recommendations.' },
    ],
  },
  {
    id: 'tests',
    title: 'Test Strategy',
    icon: TestTube,
    content: [
      { heading: '6 Test Types', body: ['Unit — individual function behavior', 'Property — invariants over random inputs (PF ∈ (0,1], energy ≥ 0, hours ≤ 24, etc.)', 'Golden Dataset — known reference fixtures (residential, industrial, high-harmonic, critical)', 'Regression — locked values to detect future changes', 'Formula Registry — edge cases & out-of-range behavior', 'Integration — end-to-end pipeline from raw load → audit → summary → validation'] },
      { heading: 'Running Tests', body: 'Tests run in-browser via the Test Suite page. No external runner needed. Each test reports: name, category, pass/fail, expected vs actual, message, duration.' },
    ],
  },
  {
    id: 'limitations',
    title: 'Known Limitations',
    icon: Lightbulb,
    content: [
      { heading: 'Current Scope', body: ['Does NOT size PV panels, batteries, or inverters (separate tools needed)', 'Profile distributions are heuristic; for critical systems use measured 24h data', 'Phase balancer uses greedy algorithm — not guaranteed optimal for all topologies', 'Holiday calendar is representative; not exhaustive for all regions', 'VFD/soft-starter detection is heuristic from notes field'] },
      { heading: 'Future Enhancements', body: ['Monte Carlo scenario analysis for parameter sensitivity', 'Bayesian confidence weighting on policy defaults', 'Integration with measured data imports (CSV/JSON)', 'Time-series simulation with state variables', 'Multi-currency cost optimization'] },
    ],
  },
];

export function Documentation() {
  const [activeId, setActiveId] = useState(DOCS[0].id);
  const active = DOCS.find(d => d.id === activeId)!;

  return (
    <div className="p-6 space-y-5 max-w-[1800px] mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Engineering Documentation</h2>
        <p className="text-xs text-text-tertiary">Architecture, formulas, policies, validation, reports — versioned with the engine</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-2">
          {DOCS.map(d => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                onClick={() => setActiveId(d.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition ${
                  activeId === d.id ? 'bg-accent/15 text-accent border border-accent/30' : 'text-text-secondary hover:bg-surface-2/40'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-medium">{d.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-6">
            <div className="flex items-center gap-2 pb-3 border-b border-border-medium mb-4">
              <active.icon className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-bold text-text-primary">{active.title}</h3>
            </div>
            <div className="space-y-5">
              {active.content.map((c, idx) => (
                <div key={idx}>
                  <h4 className="text-sm font-semibold text-accent mb-2">{c.heading}</h4>
                  {Array.isArray(c.body) ? (
                    <ul className="space-y-1.5 text-sm text-text-secondary">
                      {c.body.map((b, i) => <li key={i} className="leading-relaxed">{b}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-secondary leading-relaxed">{c.body}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
