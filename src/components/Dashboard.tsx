import { useState } from 'react';
import { useLoads, useSummary, useLoadMetrics } from '../context/LoadContext';
import { fmtW, fmtWh, fmtA, fmtKVA, fmtPct } from '../utils/calculations';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Zap, Sun, Battery, TrendingUp, AlertTriangle, Activity, Sparkles, ArrowRight, CheckCircle2, Gauge } from 'lucide-react';
import type { ViewKey } from '../App';
import { UI_ICON_TINT, UI_VALUE_TINT, UI_GRADIENT } from '../theme/variants';
import { TabBar } from './Workflow';

export function Dashboard({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { loads, projectName, expertLevel } = useLoads();
  const summary = useSummary();
  const metrics = useLoadMetrics();
  const [view, setView] = useState<'overview' | 'profile' | 'insights'>('overview');

  const hourlyData = summary.hourlyProfile.map((v, i) => ({
    hour: `${i}:00`,
    power: Math.round(v / 1000 * 10) / 10, // kW
    day: i >= 8 && i < 18 ? Math.round(v / 1000 * 10) / 10 : 0,
    night: (i < 8 || i >= 18) ? Math.round(v / 1000 * 10) / 10 : 0,
  }));

  const peakHour = summary.hourlyProfile.indexOf(Math.max(...summary.hourlyProfile));
  const peakPower = Math.max(...summary.hourlyProfile) / 1000;

  // Surge detection
  const highSurge = metrics.filter(m => m.surge > 2000).slice(0, 5);
  // Critical loads
  const critical = loads.filter(l => l.criticality === 'Critical').length;
  // Phantom
  const phantomLoads = loads.filter(l => l.phantomLoadW > 0).length;

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
      {/* Hero / Project Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border-medium/80 bg-gradient-to-br from-surface-2 via-surface-1 to-surface-base p-6 solar-glow">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-accent-2/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-accent text-xs font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>KAD Calculator Engineering Suite · {expertLevel} Mode</span>
            </div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">{projectName}</h1>
            <p className="text-text-tertiary mt-1 text-sm max-w-2xl">
              Advanced load analysis with time-based, hierarchical, scenario-driven multi-level engine.
              All calculations follow NEC/IEC industry practice.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => onNavigate('inventory')} className="px-4 py-2 rounded-lg bg-accent text-[color:var(--btn-primary-text)] text-sm font-semibold shadow-lg shadow-brand hover:shadow-brand transition flex items-center gap-2">
                <Zap className="w-4 h-4" /> Add Loads
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onNavigate('analysis')} className="px-4 py-2 rounded-lg bg-surface-2/60 border border-border-medium text-text-primary text-sm font-medium hover:bg-surface-3/60 transition">
                View Analysis
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-96">
            <BigMetric label="Total Connected" value={fmtW(summary.totalConnectedLoadW, 1)} icon={Zap} color="orange" />
            <BigMetric label="Max Demand" value={fmtW(summary.maximumDemandW, 1)} icon={Gauge} color="amber" />
            <BigMetric label="Daily Energy" value={fmtWh(summary.totalDailyEnergyWh, 1)} icon={Sun} color="emerald" />
            <BigMetric label="Annual" value={fmtWh(summary.annualEnergyKWh * 1000, 1)} icon={Battery} color="blue" />
          </div>
        </div>
      </div>

      {/* Progressive-disclosure view switch */}
      <TabBar
        tabs={[
          { key: 'overview', label: 'Overview', icon: <Gauge className="w-3.5 h-3.5" /> },
          { key: 'profile', label: 'Load Profile', icon: <Activity className="w-3.5 h-3.5" /> },
          { key: 'insights', label: 'Insights', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
        ]}
        active={view}
        onChange={(k) => setView(k as 'overview' | 'profile' | 'insights')}
      />

      {view === 'overview' && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI label="Peak Demand" value={fmtW(summary.peakDemandKW * 1000, 1)} sub="Maximum simultaneous" color="orange" icon={TrendingUp} />
            <KPI label="Peak kVA" value={fmtKVA(summary.peakDemandKVA)} sub="Apparent power" color="amber" icon={Activity} />
            <KPI label="Max Current" value={fmtA(summary.estimatedMaxCurrentA)} sub="Per phase" color="red" icon={Zap} />
            <KPI label="Max Surge" value={fmtW(summary.maximumSurgeKW * 1000, 1)} sub="Total starting" color="pink" icon={AlertTriangle} />
            <KPI label="Load Factor" value={fmtPct(summary.loadFactor)} sub="Avg/Peak ratio" color="cyan" icon={Gauge} />
            <KPI label="Loads" value={loads.length.toString()} sub={`${critical} critical`} color="purple" icon={CheckCircle2} />
          </div>

          {/* Stage cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <StageCard num="01" title="Connected Load" value={fmtW(summary.totalConnectedLoadW, 1)} sub="Sum of nameplate × qty" />
            <StageCard num="02" title="Maximum Demand" value={fmtW(summary.maximumDemandW, 1)} sub="Peak operating load" />
            <StageCard num="03" title="Daily Energy" value={fmtWh(summary.totalDailyEnergyWh, 1)} sub="24h consumption" />
            <StageCard num="04" title="Annual Energy" value={fmtWh(summary.annualEnergyKWh * 1000, 1)} sub="Yearly consumption" />
          </div>
        </>
      )}

      {view === 'profile' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* 24h Load Profile */}
          <div className="xl:col-span-2 rounded-xl border border-border-medium/80 bg-surface-1 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">24-Hour Load Profile</h3>
                <p className="text-xs text-text-tertiary">Aggregated operating load by hour · Peak at {peakHour}:00 → {peakPower.toFixed(2)} kW</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-accent/15 text-accent border border-accent/20 font-mono">
                  Peak {peakPower.toFixed(1)} kW
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" style={{ stopColor: 'var(--viz-cat-1)' }} stopOpacity={0.7} />
                    <stop offset="95%" style={{ stopColor: 'var(--viz-cat-1)' }} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" style={{ stopColor: 'var(--viz-cat-2)' }} stopOpacity={0.4} />
                    <stop offset="95%" style={{ stopColor: 'var(--viz-cat-2)' }} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" stroke="var(--viz-axis)" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="var(--viz-axis)" fontSize={10} tickLine={false} axisLine={false} unit=" kW" />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-medium)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: 'var(--accent)' }}
                  formatter={(v: any) => `${v.toFixed(2)} kW`}
                />
                <Area type="monotone" dataKey="power" stroke="var(--viz-cat-1)" strokeWidth={2.5} fill="url(#gradOrange)" style={{ stroke: 'var(--viz-cat-1)' }} />
                <Area type="monotone" dataKey="day" stackId="a" stroke="var(--viz-cat-2)" fill="url(#gradAmber)" style={{ stroke: 'var(--viz-cat-2)' }} />
                <Area type="monotone" dataKey="night" stackId="a" stroke="var(--viz-cat-4)" fill="url(#gradAmber)" fillOpacity={0.05} style={{ stroke: 'var(--viz-cat-4)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown */}
          <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Load Distribution</h3>
            <p className="text-xs text-text-tertiary mb-4">By category — daily energy share</p>
            {summary.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={summary.byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {summary.byCategory.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-medium)', borderRadius: 8 }}
                    formatter={(v: any) => fmtWh(v as number, 1)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 10, color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-text-tertiary text-sm">No data yet</div>
            )}
          </div>
        </div>
      )}

      {view === 'insights' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Day vs Night */}
          <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sun className="w-4 h-4 text-accent-2" />
              <h3 className="text-sm font-semibold text-text-primary">Day / Night Energy</h3>
            </div>
            <div className="space-y-3">
              <BarRow label="Day Energy" value={summary.dayEnergyWh} total={summary.totalDailyEnergyWh} tone="day" />
              <BarRow label="Night Energy" value={summary.nightEnergyWh} total={summary.totalDailyEnergyWh} tone="night" />
              <BarRow label="Critical Loads" value={summary.criticalLoadWh} total={summary.totalDailyEnergyWh} tone="critical" />
              <BarRow label="Deferrable" value={summary.deferrableLoadWh} total={summary.totalDailyEnergyWh} tone="deferrable" />
              <BarRow label="Phantom" value={summary.phantomLossWh} total={summary.totalDailyEnergyWh} tone="phantom" />
            </div>
          </div>

          {/* Critical Insights */}
          <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-text-primary">Engineering Insights</h3>
            </div>
            <div className="space-y-2.5">
              <Insight
                ok={summary.peakDemandKW < 50}
                text={summary.peakDemandKW < 50 ? 'Peak demand within residential scale' : 'Peak demand indicates commercial sizing'}
                sub={`${summary.peakDemandKW.toFixed(2)} kW peak`}
              />
              <Insight
                ok={summary.maximumSurgeKW < summary.peakDemandKW * 8}
                text={summary.maximumSurgeKW < summary.peakDemandKW * 8 ? 'Surge within design tolerance' : 'High inrush — oversize inverter'}
                sub={`${summary.maximumSurgeKW.toFixed(1)} kW max surge`}
              />
              <Insight
                ok={summary.loadFactor > 25}
                text={summary.loadFactor > 25 ? 'Healthy load factor — efficient utilization' : 'Low load factor — heavy peaks vs average'}
                sub={`${summary.loadFactor.toFixed(1)}% load factor`}
              />
              <Insight
                ok={phantomLoads < 6}
                text={phantomLoads === 0 ? 'No phantom loads detected' : `${phantomLoads} phantom loads — ${(summary.phantomLossWh / 1000).toFixed(1)} kWh/day wasted`}
                sub="Standby consumption check"
              />
              <Insight
                ok={highSurge.length < 4}
                text={highSurge.length === 0 ? 'No large surge loads' : `${highSurge.length} high-surge loads require soft-start`}
                sub="Motor starting analysis"
              />
            </div>
          </div>

          {/* Top loads */}
          <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Top Loads by Energy</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[...metrics].sort((a, b) => b.daily - a.daily).slice(0, 8).map(m => (
                <div key={m.load.id} className="flex items-center gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary truncate">{m.load.loadName || m.load.arabicName || '(unnamed)'}</div>
                    <div className="text-text-tertiary text-[10px]">{m.load.categoryMain} · ×{m.load.quantity}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-accent font-semibold">{fmtWh(m.daily, 0)}</div>
                    <div className="text-[10px] text-text-tertiary">{fmtW(m.connected, 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BigMetric({ label, value, icon: Icon, color }: any) {
  return (
    <div className="rounded-lg bg-surface-1/40 border border-border-medium p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
        <Icon className={`w-3 h-3 ${UI_ICON_TINT[color]}`} />
        {label}
      </div>
      <div className={`text-lg font-bold mono ${UI_VALUE_TINT[color]} mt-1`}>{value}</div>
    </div>
  );
}

function KPI({ label, value, sub, color, icon: Icon }: any) {
  return (
    <div className="rounded-xl border border-border-medium/80 bg-surface-1 p-4 hover:border-border-medium transition">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${UI_ICON_TINT[color]}`} />
      </div>
      <div className={`text-xl font-bold mono ${UI_VALUE_TINT[color]} mt-2`}>{value}</div>
      <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>
    </div>
  );
}

function BarRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: keyof typeof UI_GRADIENT }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const grad = UI_GRADIENT[tone];
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-tertiary">{fmtWh(value, 1)} <span className="text-text-tertiary">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full ${grad} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function Insight({ ok, text, sub }: { ok: boolean; text: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-1/40 border border-border-medium/50">
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-accent-2 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-text-primary leading-snug">{text}</div>
        <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function StageCard({ num, title, value, sub }: { num: string; title: string; value: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-medium/80 bg-gradient-to-br from-surface-2 to-surface-1 p-4">
      <div className="absolute right-2 top-2 text-5xl font-black text-text-primary/40 mono leading-none">{num}</div>
      <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">Stage {num}</div>
      <div className="text-sm font-semibold text-text-primary mt-1">{title}</div>
      <div className="text-2xl font-bold mono text-accent-2 mt-2">{value}</div>
      <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>
    </div>
  );
}
