import { useLoads, useSummary, useLoadMetrics } from '../context/LoadContext';
import { fmtW, fmtWh, fmtA, fmtKVA, fmtPct, calcDailyEnergy, calcRunningLoad, calcConnectedLoad, calcAnnualEnergy, SURGE_MULTIPLIERS, NEC_DEMAND_FACTORS, validateLoad } from '../utils/calculations';
import { generatePDFReport, generateSchedulePDF } from '../utils/pdfGenerator';
import { FileText, Download, AlertTriangle, CheckCircle2, BarChart3, Activity, Shield, ListChecks, FileDown, Loader2 } from 'lucide-react';
import { UI_VALUE_TINT } from '../theme/variants';
import { useState } from 'react';

// What each report covers — surfaced as progressive disclosure so the user
// understands scope before generating (instead of a wall of previews).
const REPORT_CATALOG: Record<string, { title: string; blurb: string; includes: string[] }> = {
  exec: {
    title: 'Executive Summary',
    blurb: 'Board-ready overview: headline KPIs, category breakdown, and design recommendations.',
    includes: ['KPI dashboard', 'Category breakdown', 'Design recommendations'],
  },
  demand: {
    title: 'Demand Analysis',
    blurb: 'Peak demand, NEC demand factors, surge multipliers, and top loads by connected power.',
    includes: ['Demand metrics', 'NEC factors', 'Surge reference', 'Top 15 loads'],
  },
  seasonal: {
    title: 'Seasonal Report',
    blurb: 'Summer vs winter energy, category distribution, and phase balance.',
    includes: ['Seasonal comparison', 'Category split', 'Phase balance'],
  },
  compliance: {
    title: 'Compliance',
    blurb: 'Validation status, phantom-load audit, and THD / power-quality warnings.',
    includes: ['Validation matrix', 'Phantom audit', 'THD warnings'],
  },
  custom: {
    title: 'Custom Report',
    blurb: 'Full engineering schedule with all parameters and a configurable section builder.',
    includes: ['Full schedule', 'Category summary', 'Section builder'],
  },
};

export function Reports() {
  const { loads, projectName, expertLevel } = useLoads();
  const summary = useSummary();
  const metrics = useLoadMetrics();
  const [reportType, setReportType] = useState<'exec' | 'demand' | 'seasonal' | 'compliance' | 'custom'>('exec');
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    if (loads.length === 0) {
      alert('No loads defined. Please add at least one load before generating a report.');
      return;
    }
    setGenerating(true);
    try {
      // small delay to allow UI update
      await new Promise(r => setTimeout(r, 50));
      generatePDFReport(reportType, loads, summary, projectName, expertLevel);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadSchedule = async () => {
    if (loads.length === 0) {
      alert('No loads defined. Please add at least one load before generating a schedule.');
      return;
    }
    setGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      generateSchedulePDF(loads, summary, projectName, expertLevel);
    } catch (err) {
      console.error('Schedule PDF generation failed:', err);
      alert('PDF generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const allIssues = loads.flatMap(l => validateLoad(l).map(i => ({ ...i, loadName: l.loadName })));
  const errors = allIssues.filter(i => i.type === 'error');
  const warnings = allIssues.filter(i => i.type === 'warning');

  const phaseImbalance = (() => {
    const phases = [0, 0, 0];
    loads.forEach(l => {
      const conn = calcConnectedLoad(l);
      if (l.phaseType === '3Ø') {
        phases[0] += conn / 3;
        phases[1] += conn / 3;
        phases[2] += conn / 3;
      } else {
        phases[(loads.indexOf(l)) % 3] += conn;
      }
    });
    const max = Math.max(...phases);
    const min = Math.min(...phases);
    return { phases, imbalance: max > 0 ? ((max - min) / max) * 100 : 0 };
  })();

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Engineering Reports</h2>
          <p className="text-xs text-text-tertiary">Professional technical documentation for compliance & design</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-surface-2/60 border border-border-medium/50">
            {[
              { k: 'exec', l: 'Executive Summary', i: FileText },
              { k: 'demand', l: 'Demand Analysis', i: BarChart3 },
              { k: 'seasonal', l: 'Seasonal Report', i: Activity },
              { k: 'compliance', l: 'Compliance', i: Shield },
              { k: 'custom', l: 'Custom Report', i: ListChecks },
            ].map(t => {
              const I = t.i;
              return (
                <button key={t.k} onClick={() => setReportType(t.k as any)} className={`px-3 py-1.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition ${reportType === t.k ? 'bg-accent text-[color:var(--btn-primary-text)] shadow-md' : 'text-text-tertiary hover:text-text-primary'}`}>
                  <I className="w-3.5 h-3.5" /> {t.l}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleDownloadSchedule}
            disabled={generating || loads.length === 0}
            className="px-3 py-2 rounded-lg bg-surface-2 border border-border-medium text-text-primary text-xs font-medium hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Download complete load schedule as PDF"
          >
            <FileDown className="w-3.5 h-3.5" /> Schedule PDF
          </button>
          <button
            onClick={handleDownload}
            disabled={generating || loads.length === 0}
            className="px-4 py-2 rounded-lg bg-accent text-[color:var(--btn-primary-text)] text-xs font-semibold shadow-lg shadow-brand flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-brand transition"
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
            ) : (
              <><Download className="w-3.5 h-3.5" /> Download PDF</>
            )}
          </button>
        </div>
      </div>

      {/* Progressive disclosure: reveal report scope before generating */}
      <div className="rounded-xl border border-border-medium/60 bg-surface-1/60 p-4 mb-4">
        <div className="text-sm font-semibold text-text-primary">{REPORT_CATALOG[reportType].title}</div>
        <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{REPORT_CATALOG[reportType].blurb}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {REPORT_CATALOG[reportType].includes.map((s) => (
            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">{s}</span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-6 print:bg-white print:text-black">
        {/* Report header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-medium">
          <div>
            <h3 className="text-2xl font-bold text-text-primary">{projectName}</h3>
            <p className="text-xs text-text-tertiary mt-1">KAD Calculator Engineering Suite · Load Analysis Report · Generated {new Date().toLocaleString()}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-text-tertiary font-semibold">Project Mode</div>
            <div className="text-sm text-accent mono font-semibold">{expertLevel}</div>
          </div>
        </div>

        {reportType === 'exec' && (
          <div className="space-y-5 text-sm text-text-primary">
            <Section title="1. Executive Summary">
              <p className="text-text-secondary leading-relaxed">
                This report presents a comprehensive analysis of the electrical load profile for <strong className="text-text-primary">{projectName}</strong>. 
                The analysis covers {loads.length} loads across {summary.byCategory.length} categories, with a total connected load of <strong className="text-accent">{fmtW(summary.totalConnectedLoadW, 1)}</strong> and 
                a maximum demand of <strong className="text-accent">{fmtW(summary.maximumDemandW, 1)}</strong>. The total daily energy consumption is <strong className="text-accent-2">{fmtWh(summary.totalDailyEnergyWh, 1)}</strong>, 
                of which {((summary.dayEnergyWh / Math.max(1, summary.totalDailyEnergyWh)) * 100).toFixed(0)}% occurs during daytime hours.
              </p>
            </Section>

            <Section title="2. Key Performance Indicators">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI2 label="Total Connected" value={fmtW(summary.totalConnectedLoadW, 1)} color="orange" />
                <KPI2 label="Max Demand" value={fmtW(summary.maximumDemandW, 1)} color="amber" />
                <KPI2 label="Daily Energy" value={fmtWh(summary.totalDailyEnergyWh, 1)} color="emerald" />
                <KPI2 label="Annual" value={fmtWh(summary.annualEnergyKWh * 1000, 0)} color="blue" />
                <KPI2 label="Peak kVA" value={fmtKVA(summary.peakDemandKVA)} color="cyan" />
                <KPI2 label="Max Current" value={fmtA(summary.estimatedMaxCurrentA)} color="red" />
                <KPI2 label="Max Surge" value={fmtW(summary.maximumSurgeKW * 1000, 0)} color="pink" />
                <KPI2 label="Load Factor" value={fmtPct(summary.loadFactor)} color="purple" />
              </div>
            </Section>

            <Section title="3. Load Categories Breakdown">
              <table className="w-full text-xs">
                <thead className="text-text-tertiary border-b border-border-medium">
                  <tr>
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Loads</th>
                    <th className="text-right py-2">Connected</th>
                    <th className="text-right py-2">Daily</th>
                    <th className="text-right py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCategory.map(c => (
                    <tr key={c.name} className="border-b border-border-medium/40">
                      <td className="py-2"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: c.color }} />{c.name}</td>
                      <td className="text-right mono">{loads.filter(l => l.categoryMain === c.name).length}</td>
                      <td className="text-right mono text-accent">{fmtW(loads.filter(l => l.categoryMain === c.name).reduce((s, l) => s + calcConnectedLoad(l), 0), 0)}</td>
                      <td className="text-right mono text-accent-2">{fmtWh(c.value, 0)}</td>
                      <td className="text-right mono">{((c.value / summary.totalDailyEnergyWh) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="4. Design Recommendations">
              <ul className="space-y-2 text-text-secondary">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /><span>Peak demand: <strong className="text-text-primary">{fmtW(summary.maximumDemandW, 1)}</strong> — size inverter at minimum <strong className="text-text-primary">{fmtW(summary.maximumDemandW * 1.25, 1)}</strong> (NEC 25% oversize rule)</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /><span>Total surge: <strong className="text-text-primary">{fmtW(summary.maximumSurgeKW * 1000, 0)}</strong> — verify inverter surge rating or use soft-starters for motor loads</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /><span>Day energy: <strong className="text-text-primary">{fmtWh(summary.dayEnergyWh, 0)}</strong> ({((summary.dayEnergyWh / Math.max(1, summary.totalDailyEnergyWh)) * 100).toFixed(0)}%) — Night: <strong className="text-text-primary">{fmtWh(summary.nightEnergyWh, 0)}</strong> — Optimize shiftable loads to daytime</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /><span>Critical loads: <strong className="text-text-primary">{fmtWh(summary.criticalLoadWh, 0)}/day</strong> — required battery backup capacity</span></li>
                {phaseImbalance.imbalance > 15 && (
                  <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-accent-2 mt-0.5 shrink-0" /><span>Phase imbalance: <strong className="text-accent-2">{phaseImbalance.imbalance.toFixed(1)}%</strong> — consider redistributing 1Ø loads across phases</span></li>
                )}
              </ul>
            </Section>
          </div>
        )}

        {reportType === 'demand' && (
          <div className="space-y-5 text-sm text-text-primary">
            <Section title="Maximum Demand Analysis">
              <table className="w-full text-xs">
                <tbody>
                  <TR label="Total Connected Load" value={fmtW(summary.totalConnectedLoadW, 1)} />
                  <TR label="Maximum Demand (Operating Peak)" value={fmtW(summary.maximumDemandW, 1)} highlight />
                  <TR label="Demand / Connected Ratio" value={fmtPct((summary.maximumDemandW / Math.max(1, summary.totalConnectedLoadW)) * 100)} />
                  <TR label="Coincident Peak Load" value={fmtW(summary.coincidentPeakLoadW, 1)} />
                  <TR label="Diversified Load" value={fmtW(summary.diversifiedLoadW, 1)} />
                  <TR label="Peak Demand (kW)" value={fmtW(summary.peakDemandKW * 1000, 1)} />
                  <TR label="Peak Demand (kVA)" value={fmtKVA(summary.peakDemandKVA)} />
                  <TR label="Estimated Max Current" value={fmtA(summary.estimatedMaxCurrentA)} />
                  <TR label="Maximum Aggregate Surge" value={fmtW(summary.maximumSurgeKW * 1000, 1)} />
                  <TR label="Load Factor" value={fmtPct(summary.loadFactor)} />
                </tbody>
              </table>
            </Section>

            <Section title="NEC Demand Factors Reference">
              <table className="w-full text-xs">
                <thead className="text-text-tertiary border-b border-border-medium">
                  <tr><th className="text-left py-2">Description</th><th className="text-right py-2">Factor</th></tr>
                </thead>
                <tbody>
                  {NEC_DEMAND_FACTORS.map((f, i) => (
                    <tr key={i} className="border-b border-border-medium/40">
                      <td className="py-2">{f.description}</td>
                      <td className="text-right mono text-accent">{(f.factor * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Surge Multipliers Reference (Motor Loads)">
              <table className="w-full text-xs">
                <thead className="text-text-tertiary border-b border-border-medium">
                  <tr><th className="text-left py-2">Load Type</th><th className="text-right py-2">Multiplier</th><th className="text-left py-2 pl-3">Description</th></tr>
                </thead>
                <tbody>
                  {SURGE_MULTIPLIERS.map((s, i) => (
                    <tr key={i} className="border-b border-border-medium/40">
                      <td className="py-2">{s.name}</td>
                      <td className="text-right mono text-pink-300">{s.multiplier}×</td>
                      <td className="pl-3 text-text-tertiary">{s.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Top 10 Loads by Connected Power">
              <table className="w-full text-xs">
                <thead className="text-text-tertiary border-b border-border-medium">
                  <tr>
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Rated</th>
                    <th className="text-right py-2">Connected</th>
                    <th className="text-right py-2">Surge</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics].sort((a, b) => b.connected - a.connected).slice(0, 10).map((m, i) => (
                    <tr key={m.load.id} className="border-b border-border-medium/40">
                      <td className="py-2 mono text-text-tertiary">{i + 1}</td>
                      <td className="py-2">{m.load.loadName}</td>
                      <td className="text-right mono">{m.load.quantity}</td>
                      <td className="text-right mono">{m.load.ratedPowerW}</td>
                      <td className="text-right mono text-accent">{fmtW(m.connected, 0)}</td>
                      <td className="text-right mono text-pink-300">{fmtW(m.surge, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {reportType === 'seasonal' && (
          <div className="space-y-5 text-sm text-text-primary">
            <Section title="Seasonal Behavior Analysis">
              <table className="w-full text-xs">
                <thead className="text-text-tertiary border-b border-border-medium">
                  <tr>
                    <th className="text-left py-2">Period</th>
                    <th className="text-right py-2">Day Energy</th>
                    <th className="text-right py-2">Night Energy</th>
                    <th className="text-right py-2">Total Daily</th>
                    <th className="text-right py-2">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border-medium/40">
                    <td className="py-2">Summer (Apr-Sep)</td>
                    <td className="text-right mono text-accent-2">{fmtWh(loads.reduce((s, l) => s + (l.dayHoursSummer * calcRunningLoad(l) * (l.dutyCyclePercent/100) * l.utilizationFactorKu * l.demandFactor * l.operatingDaysPerWeek/7), 0), 0)}</td>
                    <td className="text-right mono text-indigo-300">{fmtWh(summary.nightEnergyWh, 0)}</td>
                    <td className="text-right mono text-emerald-300">{fmtWh(summary.totalDailyEnergyWh, 0)}</td>
                    <td className="text-right mono text-blue-300">{fmtWh(summary.annualEnergyKWh * 1000 * 0.55, 0)}</td>
                  </tr>
                  <tr className="border-b border-border-medium/40">
                    <td className="py-2">Winter (Oct-Mar)</td>
                    <td className="text-right mono text-accent-2">{fmtWh(loads.reduce((s, l) => s + (l.dayHoursWinter * calcRunningLoad(l) * (l.dutyCyclePercent/100) * l.utilizationFactorKu * l.demandFactor * l.operatingDaysPerWeek/7), 0), 0)}</td>
                    <td className="text-right mono text-indigo-300">{fmtWh(loads.reduce((s, l) => s + (l.nightHoursWinter * calcRunningLoad(l) * (l.dutyCyclePercent/100) * l.utilizationFactorKu * l.demandFactor * l.operatingDaysPerWeek/7), 0), 0)}</td>
                    <td className="text-right mono text-emerald-300">{fmtWh(loads.reduce((s, l) => s + calcDailyEnergy(l, 'winter'), 0), 0)}</td>
                    <td className="text-right mono text-blue-300">{fmtWh(loads.reduce((s, l) => s + calcAnnualEnergy(l), 0) * 0.45, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section title="Phase Balance Analysis">
              <table className="w-full text-xs">
                <thead className="text-text-tertiary border-b border-border-medium">
                  <tr><th className="text-left py-2">Phase</th><th className="text-right py-2">Connected Load</th><th className="text-right py-2">Percentage</th></tr>
                </thead>
                <tbody>
                  {phaseImbalance.phases.map((p, i) => (
                    <tr key={i} className="border-b border-border-medium/40">
                      <td className="py-2">Phase {['L1', 'L2', 'L3'][i]}</td>
                      <td className="text-right mono text-accent">{fmtW(p, 0)}</td>
                      <td className="text-right mono">{((p / Math.max(1, phaseImbalance.phases.reduce((a, b) => a + b, 0))) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-text-tertiary mt-3">Phase Imbalance: <strong className={phaseImbalance.imbalance > 15 ? 'text-accent-2' : 'text-emerald-300'}>{phaseImbalance.imbalance.toFixed(1)}%</strong> {phaseImbalance.imbalance > 15 ? '(exceeds 15% — recommend redistribution)' : '(within acceptable range)'}</p>
            </Section>
          </div>
        )}

        {reportType === 'compliance' && (
          <div className="space-y-5 text-sm text-text-primary">
            <Section title="Data Quality & Validation Issues">
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-sm text-emerald-200 font-semibold">Validation Passed</div>
                    <div className="text-xs text-emerald-300/80">{errors.length} errors · {warnings.length} warnings</div>
                  </div>
                </div>
                {errors.slice(0, 5).map((i, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-red-200 font-semibold">{i.loadName} — {i.field}</div>
                      <div className="text-xs text-red-300/80">{i.message}</div>
                    </div>
                  </div>
                ))}
                {warnings.slice(0, 5).map((i, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-accent-2/10 border border-accent-2/30">
                    <AlertTriangle className="w-4 h-4 text-accent-2 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-accent-2 font-semibold">{i.loadName} — {i.field}</div>
                      <div className="text-xs text-accent-2/80">{i.message}</div>
                    </div>
                  </div>
                ))}
                {errors.length === 0 && warnings.length === 0 && (
                  <div className="text-center text-emerald-300 text-sm py-4">All loads pass validation — no issues detected.</div>
                )}
              </div>
            </Section>

            <Section title="Phantom Load Audit">
              <table className="w-full text-xs">
                <thead className="text-text-tertiary border-b border-border-medium">
                  <tr><th className="text-left py-2">Load</th><th className="text-right py-2">Phantom W</th><th className="text-right py-2">24h Loss</th><th className="text-right py-2">Annual</th></tr>
                </thead>
                <tbody>
                  {loads.filter(l => l.phantomLoadW > 0).map(l => (
                    <tr key={l.id} className="border-b border-border-medium/40">
                      <td className="py-2">{l.loadName}</td>
                      <td className="text-right mono text-violet-300">{l.phantomLoadW}</td>
                      <td className="text-right mono">{fmtWh(l.phantomLoadW * 24, 0)}</td>
                      <td className="text-right mono text-emerald-300">{fmtWh(l.phantomLoadW * 24 * 365 / 1000, 1)} kWh</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="THD & Power Quality Warning">
              <div className="space-y-1.5">
                {loads.filter(l => l.thdPercent > 15).map(l => (
                  <div key={l.id} className="flex items-center justify-between p-2 rounded bg-accent-2/10 border border-accent-2/30 text-xs">
                    <span className="text-accent-2">{l.loadName}</span>
                    <span className="mono text-accent-2 font-semibold">THD {l.thdPercent}%</span>
                  </div>
                ))}
                {loads.filter(l => l.thdPercent > 15).length === 0 && (
                  <div className="text-emerald-300 text-xs text-center py-3">No high-THD loads detected.</div>
                )}
              </div>
            </Section>
          </div>
        )}

        {reportType === 'custom' && (
          <div className="space-y-4 text-sm text-text-primary">
            <Section title="Custom Report Builder">
              <p className="text-text-tertiary text-xs mb-4">Configure and export a custom report with selected sections.</p>
              <div className="grid grid-cols-2 gap-2">
                {['Connected Load', 'Running Load', 'Demand Load', 'Coincident', 'Diversified', 'Daily Energy', 'Monthly', 'Annual', '24h Profile', 'Surge', 'Phantom', 'Critical'].map(s => (
                  <label key={s} className="flex items-center gap-2 p-2 rounded bg-surface-1/40 border border-border-medium cursor-pointer hover:border-accent/30">
                    <input type="checkbox" defaultChecked className="accent-[var(--accent)]" />
                    <span className="text-xs">{s}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleDownload}
                disabled={generating || loads.length === 0}
                className="mt-4 px-4 py-2 rounded-lg bg-accent text-[color:var(--btn-primary-text)] text-xs font-semibold shadow-lg shadow-brand flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Download className="w-3.5 h-3.5" /> Generate Custom Report (PDF)</>}
              </button>
            </Section>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-border-medium flex items-center justify-between text-[10px] text-text-tertiary">
          <div>KAD Calculator Engineering Suite · Load Analysis Engine v4.0 · NEC/IEC compliant</div>
          <div>{loads.length} loads · {summary.byCategory.length} categories · Generated by {expertLevel} Mode</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-base font-bold text-text-primary mb-3 border-l-2 border-accent pl-3">{title}</h4>
      {children}
    </div>
  );
}

function TR({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr className={`border-b border-border-medium/40 ${highlight ? 'bg-accent/10' : ''}`}>
      <td className="py-2 text-text-secondary">{label}</td>
      <td className={`py-2 text-right mono font-semibold ${highlight ? 'text-accent' : 'text-text-primary'}`}>{value}</td>
    </tr>
  );
}

function KPI2({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-surface-1/40 border border-border-medium p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">{label}</div>
      <div className={`text-lg mono font-bold ${UI_VALUE_TINT[color]} mt-1`}>{value}</div>
    </div>
  );
}
