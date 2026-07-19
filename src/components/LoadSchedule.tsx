import { useState } from 'react';
import { useLoads } from '../context/LoadContext';
import { Download, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { UI_TEXT_ALIGN } from '../theme/variants';
import { TabBar } from './Workflow';
import { fmtW, fmtWh, calcConnectedLoad, calcRunningLoad, calcDailyEnergy, calcDayEnergy, calcNightEnergy, calcAnnualEnergy, calcApparentPower, calcFullLoadCurrent, calcSurgePower, calcDemandLoad, calcDiversifiedLoad, calcCoincidentLoad } from '../utils/calculations';

export function LoadSchedule() {
  const { loads, projectName } = useLoads();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [showAdv, setShowAdv] = useState(false);
  const [sortBy, setSortBy] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'loadId', dir: 'asc' });
  const [vt, setVt] = useState<'full' | 'phase' | 'critical'>('full');

  const filtered = loads.filter(l => {
    const matchSearch = !search || l.loadName.toLowerCase().includes(search.toLowerCase()) || l.loadTag.toLowerCase().includes(search.toLowerCase()) || l.loadId.toLowerCase().includes(search.toLowerCase()) || l.arabicName.includes(search);
    const matchCat = cat === 'All' || l.categoryMain === cat;
    return matchSearch && matchCat;
  }).sort((a, b) => {
    const dir = sortBy.dir === 'asc' ? 1 : -1;
    const va = (a as any)[sortBy.key] ?? '';
    const vb = (b as any)[sortBy.key] ?? '';
    if (typeof va === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  // Progressive-disclosure summaries (computed from the same filtered set).
  const phaseSummary = (() => {
    const phases = [0, 0, 0];
    filtered.forEach((l, i) => {
      const conn = calcConnectedLoad(l);
      if (l.phaseType === '3Ø') { phases[0] += conn / 3; phases[1] += conn / 3; phases[2] += conn / 3; }
      else phases[i % 3] += conn;
    });
    const total = phases.reduce((a, b) => a + b, 0);
    return phases.map((p, i) => ({
      phase: ['L1', 'L2', 'L3'][i],
      conn: p,
      pct: total > 0 ? (p / total) * 100 : 0,
      loads: filtered.filter((l, idx) => l.phaseType !== '3Ø' && idx % 3 === i).length,
    }));
  })();
  const threePhaseCount = filtered.filter((l) => l.phaseType === '3Ø').length;
  const critGroups = (['Critical', 'Essential', 'Normal', 'Optional'] as const).map((c) => {
    const group = filtered.filter((l) => l.criticality === c);
    return { c, count: group.length, daily: group.reduce((s, l) => s + calcDailyEnergy(l), 0) };
  });

  const sort = (key: string) => setSortBy(p => ({ key, dir: p.key === key && p.dir === 'asc' ? 'desc' : 'asc' }));
  const SortH = ({ k, children, align = 'left' }: { k: string; children: React.ReactNode; align?: 'left' | 'right' | 'center' }) => (
    <th onClick={() => sort(k)} className={`px-2 py-2 ${UI_TEXT_ALIGN[align]} font-semibold uppercase tracking-wider text-[10px] cursor-pointer hover:text-accent select-none whitespace-nowrap`}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortBy.key === k && (sortBy.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );

  const exportCSV = () => {
    const headers = ['ID', 'Tag', 'Name', 'Category', 'Space', 'Qty', 'Rated (W)', 'Running (W)', 'PF', 'Ku', 'Demand', 'Coincidence', 'Diversity', 'Hours/Day', 'Duty%', 'Surge (W)', 'Connected (W)', 'Daily (Wh)', 'Annual (kWh)'];
    const rows = filtered.map(l => [
      l.loadId, l.loadTag, l.loadName, l.categoryMain, l.spaceArea, l.quantity, l.ratedPowerW, l.runningPowerW, l.powerFactor, l.utilizationFactorKu, l.demandFactor, l.coincidenceFactor, l.diversityFactor, (l.dayHoursSummer + l.nightHoursSummer), l.dutyCyclePercent, calcSurgePower(l), calcConnectedLoad(l), calcDailyEnergy(l), calcAnnualEnergy(l) / 1000,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '-')}-load-schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4 max-w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Master Load Schedule</h2>
          <p className="text-xs text-text-tertiary">{filtered.length} of {loads.length} loads · Engineering data sheet with 70+ columns</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowAdv(s => !s)} className="px-3 py-2 rounded-lg bg-surface-2/60 border border-border-medium text-text-primary text-xs font-medium hover:bg-surface-3/60">
            {showAdv ? 'Hide' : 'Show'} Advanced Columns
          </button>
          <button onClick={exportCSV} className="px-3 py-2 rounded-lg bg-accent text-[color:var(--btn-primary-text)] text-xs font-semibold shadow-lg shadow-brand flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search loads…" className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <select value={cat} onChange={e => setCat(e.target.value)} className="pl-9 pr-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary">
            <option value="All">All</option>
            <option>Lighting</option><option>HVAC</option><option>Kitchen</option><option>Pump</option><option>Medical</option><option>IT</option><option>Industrial</option><option>EV</option><option>Security</option><option>Water</option><option>Office</option><option>Laundry</option><option>Other</option>
          </select>
        </div>
      </div>

      <TabBar
        tabs={[
          { key: 'full', label: 'Full Schedule' },
          { key: 'phase', label: 'By Phase' },
          { key: 'critical', label: 'By Criticality' },
        ]}
        active={vt}
        onChange={(k) => setVt(k as 'full' | 'phase' | 'critical')}
      />

      {vt === 'full' && (
      <div className="rounded-xl border border-border-medium/80 bg-surface-1 overflow-hidden">
        <div className="overflow-x-auto table-scroll" style={{ maxHeight: '70vh' }}>
          <table className="w-full text-[11px]">
            <thead className="bg-surface-1/80 text-text-tertiary sticky top-0 z-10 backdrop-blur">
              <tr>
                <SortH k="loadId">ID</SortH>
                <SortH k="loadTag">Tag</SortH>
                <SortH k="loadName">Name</SortH>
                <SortH k="categoryMain">Category</SortH>
                <SortH k="spaceArea">Space</SortH>
                <SortH k="quantity" align="right">Qty</SortH>
                <SortH k="ratedPowerW" align="right">Rated W</SortH>
                <SortH k="runningPowerW" align="right">Run W</SortH>
                <SortH k="powerFactor" align="right">PF</SortH>
                <SortH k="utilizationFactorKu" align="right">Ku</SortH>
                <SortH k="demandFactor" align="right">DF</SortH>
                {showAdv && <SortH k="coincidenceFactor" align="right">Coinc.</SortH>}
                {showAdv && <SortH k="diversityFactor" align="right">Div.</SortH>}
                <SortH k="dutyCyclePercent" align="right">Duty%</SortH>
                <SortH k="surgeMultiplier" align="right">Surge×</SortH>
                <SortH k="operateHours" align="right">Hrs/d</SortH>
                <SortH k="criticality">Crit.</SortH>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-accent">Conn (W)</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-accent">Run (W)</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-accent-2">Demand (W)</th>
                {showAdv && <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-accent-2">Div. (W)</th>}
                {showAdv && <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-accent-2">Coinc. (W)</th>}
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-pink-300">Surge (W)</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-cyan-300">FLC (A)</th>
                {showAdv && <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-cyan-300">kVA</th>}
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-emerald-300">Day (Wh)</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-indigo-300">Night (Wh)</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-emerald-300">Daily (Wh)</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-emerald-300">Annual (kWh)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const conn = calcConnectedLoad(l);
                const run = calcRunningLoad(l);
                const demand = calcDemandLoad(l);
                const coinc = calcCoincidentLoad(l);
                const div = calcDiversifiedLoad(l);
                const flc = calcFullLoadCurrent(l);
                const kva = calcApparentPower(l);
                const surge = calcSurgePower(l);
                const daily = calcDailyEnergy(l);
                const day = calcDayEnergy(l);
                const night = calcNightEnergy(l);
                const annual = calcAnnualEnergy(l);
                const hours = l.dayHoursSummer + l.nightHoursSummer;
                return (
                  <tr key={l.id} className="border-t border-border-medium/40 hover:bg-surface-2/30">
                    <td className="px-2 py-1.5 mono text-text-tertiary">{l.loadId}</td>
                    <td className="px-2 py-1.5 mono text-accent">{l.loadTag}</td>
                    <td className="px-2 py-1.5 text-text-primary">{l.loadName}</td>
                    <td className="px-2 py-1.5 text-text-tertiary">{l.categoryMain}</td>
                    <td className="px-2 py-1.5 text-text-tertiary">{l.spaceArea}</td>
                    <td className="px-2 py-1.5 text-right mono">{l.quantity}</td>
                    <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.ratedPowerW}</td>
                    <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.runningPowerW}</td>
                    <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.powerFactor.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.utilizationFactorKu.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.demandFactor.toFixed(2)}</td>
                    {showAdv && <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.coincidenceFactor.toFixed(2)}</td>}
                    {showAdv && <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.diversityFactor.toFixed(2)}</td>}
                    <td className="px-2 py-1.5 text-right mono text-text-secondary">{l.dutyCyclePercent}</td>
                    <td className="px-2 py-1.5 text-right mono text-pink-300">{l.surgeMultiplier}×</td>
                    <td className="px-2 py-1.5 text-right mono text-text-secondary">{hours.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-text-tertiary">{l.criticality[0]}</td>
                    <td className="px-2 py-1.5 text-right mono text-accent font-semibold">{fmtW(conn, 0)}</td>
                    <td className="px-2 py-1.5 text-right mono text-accent">{fmtW(run, 0)}</td>
                    <td className="px-2 py-1.5 text-right mono text-accent-2 font-semibold">{fmtW(demand, 0)}</td>
                    {showAdv && <td className="px-2 py-1.5 text-right mono text-accent-2">{fmtW(div, 0)}</td>}
                    {showAdv && <td className="px-2 py-1.5 text-right mono text-accent-2">{fmtW(coinc, 0)}</td>}
                    <td className="px-2 py-1.5 text-right mono text-pink-300 font-semibold">{fmtW(surge, 0)}</td>
                    <td className="px-2 py-1.5 text-right mono text-cyan-300">{flc.toFixed(2)}</td>
                    {showAdv && <td className="px-2 py-1.5 text-right mono text-cyan-200">{kva.toFixed(2)}</td>}
                    <td className="px-2 py-1.5 text-right mono text-emerald-300">{fmtWh(day, 0)}</td>
                    <td className="px-2 py-1.5 text-right mono text-indigo-300">{fmtWh(night, 0)}</td>
                    <td className="px-2 py-1.5 text-right mono text-emerald-300 font-semibold">{fmtWh(daily, 0)}</td>
                    <td className="px-2 py-1.5 text-right mono text-emerald-200">{(annual / 1000).toFixed(1)}</td>
                  </tr>
                );
              })}
              {filtered.length > 0 && (
                <tr className="border-t-2 border-accent/40 bg-surface-1/40 font-bold">
                  <td colSpan={5} className="px-2 py-2 text-accent uppercase text-[10px]">Totals · {filtered.length} loads</td>
                  <td className="px-2 py-2 text-right mono text-accent">{filtered.reduce((s, l) => s + l.quantity, 0)}</td>
                  <td className="px-2 py-2 text-right mono text-text-secondary">{fmtW(filtered.reduce((s, l) => s + l.ratedPowerW * l.quantity, 0), 0)}</td>
                  <td colSpan={9}></td>
                  <td className="px-2 py-2 text-right mono text-accent">{fmtW(filtered.reduce((s, l) => s + calcConnectedLoad(l), 0), 0)}</td>
                  <td className="px-2 py-2 text-right mono text-accent">{fmtW(filtered.reduce((s, l) => s + calcRunningLoad(l), 0), 0)}</td>
                  <td className="px-2 py-2 text-right mono text-accent-2">{fmtW(filtered.reduce((s, l) => s + calcDemandLoad(l), 0), 0)}</td>
                  {showAdv && <td className="px-2 py-2 text-right mono text-accent-2">{fmtW(filtered.reduce((s, l) => s + calcDiversifiedLoad(l), 0), 0)}</td>}
                  {showAdv && <td className="px-2 py-2 text-right mono text-accent-2">{fmtW(filtered.reduce((s, l) => s + calcCoincidentLoad(l), 0), 0)}</td>}
                  <td className="px-2 py-2 text-right mono text-pink-300">{fmtW(filtered.reduce((s, l) => s + calcSurgePower(l), 0), 0)}</td>
                  <td className="px-2 py-2 text-right mono text-cyan-300">{filtered.reduce((s, l) => s + calcFullLoadCurrent(l), 0).toFixed(1)}</td>
                  {showAdv && <td className="px-2 py-2 text-right mono text-cyan-200">{filtered.reduce((s, l) => s + calcApparentPower(l), 0).toFixed(1)}</td>}
                  <td className="px-2 py-2 text-right mono text-emerald-300">{fmtWh(filtered.reduce((s, l) => s + calcDayEnergy(l), 0), 0)}</td>
                  <td className="px-2 py-2 text-right mono text-indigo-300">{fmtWh(filtered.reduce((s, l) => s + calcNightEnergy(l), 0), 0)}</td>
                  <td className="px-2 py-2 text-right mono text-emerald-300">{fmtWh(filtered.reduce((s, l) => s + calcDailyEnergy(l), 0), 0)}</td>
                  <td className="px-2 py-2 text-right mono text-emerald-200">{(filtered.reduce((s, l) => s + calcAnnualEnergy(l), 0) / 1000).toFixed(0)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>)}

      {vt === 'phase' && (
        <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Loads by Phase</h3>
          <table className="w-full text-xs">
            <thead className="text-text-tertiary border-b border-border-medium">
              <tr><th className="text-left py-2">Phase</th><th className="text-right py-2">Connected</th><th className="text-right py-2">Share</th><th className="text-right py-2">Loads</th></tr>
            </thead>
            <tbody>
              {phaseSummary.map((p) => (
                <tr key={p.phase} className="border-b border-border-medium/40">
                  <td className="py-2 text-text-primary font-medium">{p.phase}</td>
                  <td className="py-2 text-right mono text-accent font-semibold">{fmtW(p.conn, 0)}</td>
                  <td className="py-2 text-right mono text-text-secondary">{p.pct.toFixed(1)}%</td>
                  <td className="py-2 text-right mono text-text-tertiary">{p.loads}</td>
                </tr>
              ))}
              {threePhaseCount > 0 && (
                <tr><td colSpan={4} className="py-2 text-[10px] text-text-tertiary">+ {threePhaseCount} three-phase load(s) span all phases</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {vt === 'critical' && (
        <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Loads by Criticality</h3>
          <table className="w-full text-xs">
            <thead className="text-text-tertiary border-b border-border-medium">
              <tr><th className="text-left py-2">Criticality</th><th className="text-right py-2">Loads</th><th className="text-right py-2">Daily Energy</th></tr>
            </thead>
            <tbody>
              {critGroups.map((g) => (
                <tr key={g.c} className="border-b border-border-medium/40">
                  <td className="py-2 text-text-primary">{g.c}</td>
                  <td className="py-2 text-right mono text-text-secondary">{g.count}</td>
                  <td className="py-2 text-right mono text-accent-2 font-semibold">{fmtWh(g.daily, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[10px] text-text-tertiary leading-relaxed">
        <strong className="text-text-tertiary">Legend:</strong> Conn = Connected Load (Rated × Qty) · Run = Running Load · Demand = Connected × Ku · 
        Coinc. = Coincident Load (Demand × CF) · Div. = Diversified Load (Coinc. / DF) · 
        Surge = Rated × Surge× · FLC = Full Load Current · kVA = kW/PF · 
        Day = Daytime energy · Night = Nighttime energy · Daily = Total energy.
      </div>
    </div>
  );
}
