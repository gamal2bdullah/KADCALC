import { useState } from 'react';
import { APPLIANCE_LIBRARY, CATEGORY_OPTIONS } from '../data/appliances';
import { Search, Filter, Plus, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useLoads } from '../context/LoadContext';
import type { Load, CategoryMain } from '../types';

export function ApplianceLibrary() {
  const { addLoad } = useLoads();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'category' | 'motor' | 'critical'>('category');

  const filtered = APPLIANCE_LIBRARY.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.arabicName.includes(search) || t.categorySub.toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === 'All' || t.categoryMain === cat;
    return matchSearch && matchCat;
  });

  const grouped = filtered.reduce((acc, t) => {
    let key: string = t.categoryMain;
    if (groupBy === 'motor') key = t.isMotor ? 'Motor Loads' : 'Non-Motor Loads';
    if (groupBy === 'critical') key = t.criticality;
    (acc[key] = acc[key] || []).push(t);
    return acc;
  }, {} as Record<string, typeof APPLIANCE_LIBRARY>);

  const addToProject = (t: typeof APPLIANCE_LIBRARY[0]) => {
    const newLoad: Load = {
      id: crypto.randomUUID(),
      loadId: `LD-${Math.floor(Math.random() * 9000 + 1000)}`,
      loadTag: `${t.categorySub.toUpperCase().replace(/\s+/g, '-')}-01`,
      loadName: t.name,
      arabicName: t.arabicName,
      categoryMain: t.categoryMain as CategoryMain,
      categorySub: t.categorySub,
      spaceArea: 'Living Room',
      buildingLevel: 'Ground',
      distributionBoard: 'DB-1',
      circuitReference: '',
      description: '',
      electricalType: t.electricalType,
      voltageNominal: t.voltageNominal,
      frequency: t.frequency,
      phaseType: t.phaseType,
      ratedPowerW: t.ratedPowerW,
      runningPowerW: t.runningPowerW,
      measuredPowerW: 0,
      powerFactor: t.powerFactor,
      efficiency: t.efficiency,
      thdPercent: t.thdPercent,
      harmonicClass: t.harmonicClass,
      lockedRotorCurrentA: 0,
      surgeMultiplier: t.surgeMultiplier,
      surgePowerW: 0,
      quantity: 1,
      dutyCyclePercent: t.dutyCyclePercent,
      utilizationFactorKu: t.utilizationFactorKu,
      demandFactor: t.demandFactor,
      coincidenceFactor: 0.7,
      diversityFactor: 1.2,
      continuousLoad: t.continuousLoad,
      continuousHours: 0,
      criticality: t.criticality,
      deferrableLoad: false,
      shiftableToDaytime: false,
      smartControlled: false,
      autoStart: false,
      cyclingLoad: t.isCyclic,
      standbyLoad: t.hasStandby,
      phantomLoadW: t.phantomLoadW,
      dayHoursSummer: t.typicalDayHours,
      nightHoursSummer: t.typicalNightHours,
      dayHoursWinter: t.typicalDayHours,
      nightHoursWinter: t.typicalNightHours,
      weekdayHours: t.typicalDayHours + t.typicalNightHours,
      weekendHours: t.typicalDayHours + t.typicalNightHours,
      operatingDaysPerWeek: 7,
      operatingDaysPerYear: 365,
      operatingMode: t.operatingMode,
      timeProfileType: t.timeProfileType,
      peakStartTime: '18:00',
      peakEndTime: '22:00',
      hourlyProfile: t.hourlyProfile,
      simultaneousGroup: '',
      maxSimultaneousUnits: 1,
      dataSource: 'Manufacturer',
      measurementMethod: 'Datasheet',
      measurementDate: '',
      confidenceLevel: 'High',
      notes: `Imported from library: ${t.name}`,
    };
    addLoad(newLoad);
  };

  return (
    <div className="p-6 space-y-4 max-w-[1800px] mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Appliance Master Library</h2>
        <p className="text-xs text-text-tertiary">{APPLIANCE_LIBRARY.length} pre-configured templates · Engineering-grade reference data · Click "Add" to insert into your project</p>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search appliances…" className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <select value={cat} onChange={e => setCat(e.target.value)} className="pl-9 pr-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary">
            <option value="All">All Categories</option>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="px-3 py-2 rounded-lg bg-surface-1/50 border border-border-medium text-sm text-text-primary">
          <option value="category">Group by Category</option>
          <option value="motor">Group by Motor/Non-motor</option>
          <option value="critical">Group by Criticality</option>
        </select>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="rounded-xl border border-border-medium/80 bg-surface-1 overflow-hidden">
            <div className="px-5 py-3 border-b border-border-medium bg-surface-1/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{group}</h3>
              <span className="text-[10px] text-text-tertiary mono">{items.length} items</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
              {items.map((t, i) => {
                const isOpen = expanded === `${group}-${i}`;
                return (
                  <div key={i} className="rounded-lg border border-border-medium bg-surface-1/40 hover:border-accent/40 transition">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{t.name}</div>
                          <div className="text-[10px] text-text-tertiary" dir="rtl">{t.arabicName}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold mono text-accent">{t.ratedPowerW}W</div>
                          <div className="text-[10px] text-text-tertiary mono">{t.categorySub}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.isMotor && <Tag color="pink" icon={Zap}>Motor</Tag>}
                        {t.surgeMultiplier > 1 && <Tag color="pink">Surge {t.surgeMultiplier}×</Tag>}
                        {t.phantomLoadW > 0 && <Tag color="violet">Phantom {t.phantomLoadW}W</Tag>}
                        {t.continuousLoad && <Tag color="red">24/7</Tag>}
                        <Tag color={t.criticality === 'Critical' ? 'red' : t.criticality === 'Essential' ? 'amber' : 'slate'}>{t.criticality}</Tag>
                        <Tag color="slate">η {t.efficiency}%</Tag>
                        <Tag color="slate">PF {t.powerFactor}</Tag>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => addToProject(t)} className="flex-1 px-2.5 py-1.5 rounded bg-accent text-[color:var(--btn-primary-text)] text-[11px] font-semibold shadow flex items-center justify-center gap-1">
                          <Plus className="w-3 h-3" /> Add to Project
                        </button>
                        <button onClick={() => setExpanded(isOpen ? null : `${group}-${i}`)} className="px-2 py-1.5 rounded bg-surface-2 text-text-secondary text-[11px] hover:bg-surface-3">
                          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-border-medium px-3 py-2 bg-surface-base/40 text-[10px] text-text-tertiary space-y-1">
                        <div className="flex justify-between"><span>Voltage</span><span className="mono text-text-primary">{t.voltageNominal}V {t.phaseType} {t.frequency}</span></div>
                        <div className="flex justify-between"><span>Running Power</span><span className="mono text-text-primary">{t.runningPowerW}W</span></div>
                        <div className="flex justify-between"><span>THD</span><span className="mono text-text-primary">{t.thdPercent}%</span></div>
                        <div className="flex justify-between"><span>Harmonic Class</span><span className="mono text-text-primary">{t.harmonicClass}</span></div>
                        <div className="flex justify-between"><span>Duty Cycle</span><span className="mono text-text-primary">{t.dutyCyclePercent}%</span></div>
                        <div className="flex justify-between"><span>Utilization Ku</span><span className="mono text-text-primary">{t.utilizationFactorKu}</span></div>
                        <div className="flex justify-between"><span>Demand Factor</span><span className="mono text-text-primary">{t.demandFactor}</span></div>
                        <div className="flex justify-between"><span>Operating Mode</span><span className="mono text-text-primary">{t.operatingMode}</span></div>
                        <div className="flex justify-between"><span>Profile</span><span className="mono text-text-primary">{t.timeProfileType}</span></div>
                        <div className="flex justify-between"><span>Day/Night hrs</span><span className="mono text-text-primary">{t.typicalDayHours}h / {t.typicalNightHours}h</span></div>
                        <div className="mt-2">
                          <div className="text-[9px] uppercase text-text-tertiary font-semibold mb-1">24h Profile</div>
                          <div className="flex items-end gap-0.5 h-8">
                            {t.hourlyProfile.map((v, idx) => (
                              <div key={idx} className={`flex-1 rounded-sm ${v > 0 ? 'bg-accent' : 'bg-surface-2'}`} style={{ height: `${Math.max(2, v * 100)}%` }} title={`${idx}:00`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tag({ children, color = 'slate', icon: Icon }: { children: React.ReactNode; color?: string; icon?: any }) {
  const colors: Record<string, string> = {
    orange: 'bg-accent/20 text-accent border-accent/30',
    pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    violet: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    amber: 'bg-accent-2/20 text-accent-2 border-accent-2/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    slate: 'bg-surface-3/40 text-text-tertiary border-border-medium/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border ${colors[color]}`}>
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {children}
    </span>
  );
}
