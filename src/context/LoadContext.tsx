import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { Load, ExpertLevel } from '../types';
import { computeSummary, calcDailyEnergy, calcRunningLoad, calcConnectedLoad, calcSurgePower } from '../utils/calculations';

interface LoadContextValue {
  loads: Load[];
  setLoads: (loads: Load[]) => void;
  addLoad: (load: Load) => void;
  updateLoad: (id: string, patch: Partial<Load>) => void;
  removeLoad: (id: string) => void;
  duplicateLoad: (id: string) => void;
  clearAll: () => void;
  loadPreset: (preset: 'basic' | 'professional' | 'commercial') => void;
  expertLevel: ExpertLevel;
  setExpertLevel: (l: ExpertLevel) => void;
  projectName: string;
  setProjectName: (n: string) => void;
}

// Clean, namespaced persistence keys.
const STORAGE_KEY = 'kad-loads-v1';
const LEVEL_KEY = 'kad-expert-level-v1';
const PROJECT_KEY = 'kad-project-name-v1';

// Legacy `itel-*` keys from earlier builds. We migrate on first read so any
// existing localStorage data is never lost (see readMigrated below).
const LEGACY = {
  loads: 'itel-solar-load-calc-v1',
  level: 'itel-solar-expert-level-v1',
  project: 'itel-solar-project-name-v1',
};

// Read from the new namespace, transparently falling back to (and migrating) the
// legacy key when the new one is absent.
function readMigrated(newKey: string, legacyKey: string): string | null {
  try {
    const current = localStorage.getItem(newKey);
    if (current !== null) return current;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(newKey, legacy);
      localStorage.removeItem(legacyKey);
      return legacy;
    }
  } catch { /* storage may be unavailable (private mode, quota, SSR) */ }
  return null;
}

const defaultLoad = (): Load => ({
  id: crypto.randomUUID(),
  loadId: '',
  loadTag: '',
  loadName: '',
  arabicName: '',
  categoryMain: 'Lighting',
  categorySub: '',
  spaceArea: 'Living Room',
  buildingLevel: 'Ground',
  distributionBoard: 'DB-1',
  circuitReference: '',
  description: '',
  electricalType: 'AC',
  voltageNominal: 220,
  frequency: '50Hz',
  phaseType: '1Ø',
  ratedPowerW: 0,
  runningPowerW: 0,
  measuredPowerW: 0,
  powerFactor: 0.9,
  efficiency: 85,
  thdPercent: 10,
  harmonicClass: 'Nonlinear',
  lockedRotorCurrentA: 0,
  surgeMultiplier: 1,
  surgePowerW: 0,
  quantity: 1,
  dutyCyclePercent: 60,
  utilizationFactorKu: 0.8,
  demandFactor: 0.9,
  coincidenceFactor: 0.7,
  diversityFactor: 1.2,
  continuousLoad: false,
  continuousHours: 0,
  criticality: 'Normal',
  deferrableLoad: false,
  shiftableToDaytime: false,
  smartControlled: false,
  autoStart: false,
  cyclingLoad: false,
  standbyLoad: false,
  phantomLoadW: 0,
  dayHoursSummer: 4,
  nightHoursSummer: 4,
  dayHoursWinter: 3,
  nightHoursWinter: 5,
  weekdayHours: 8,
  weekendHours: 10,
  operatingDaysPerWeek: 7,
  operatingDaysPerYear: 365,
  operatingMode: 'Scheduled',
  timeProfileType: 'Evening Peak',
  peakStartTime: '18:00',
  peakEndTime: '22:00',
  hourlyProfile: Array(24).fill(0),
  simultaneousGroup: '',
  maxSimultaneousUnits: 1,
  dataSource: 'Estimated',
  measurementMethod: 'Estimate',
  measurementDate: '',
  confidenceLevel: 'Medium',
  notes: '',
});

const LoadContext = createContext<LoadContextValue | null>(null);

// ============== Presets ===============
const presetBasic = (): Load[] => {
  const make = (overrides: Partial<Load>): Load => {
    const base = defaultLoad();
    base.loadId = `LD-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    return { ...base, ...overrides } as Load;
  };
  return [
    make({ loadId: 'LD-1001', loadTag: 'LIT-LR-01', loadName: 'LED Bulb 12W', arabicName: 'لمبة LED 12 واط', categoryMain: 'Lighting', categorySub: 'LED Bulb', ratedPowerW: 12, runningPowerW: 12, quantity: 8, dayHoursSummer: 2, nightHoursSummer: 5, dayHoursWinter: 2, nightHoursWinter: 6, timeProfileType: 'Evening Peak' }),
    make({ loadId: 'LD-1002', loadTag: 'AC-LR-01', loadName: 'Split AC 1.5 Ton', arabicName: 'مكيف سبليت 1.5 طن', categoryMain: 'HVAC', categorySub: 'Split Inverter', ratedPowerW: 1500, runningPowerW: 1100, surgeMultiplier: 3, powerFactor: 0.92, quantity: 2, dayHoursSummer: 9, nightHoursSummer: 4, dayHoursWinter: 2, nightHoursWinter: 1, timeProfileType: 'Noon Peak', criticality: 'Essential', operatingMode: 'Continuous', continuousLoad: true }),
    make({ loadId: 'LD-1003', loadTag: 'KIT-FR-01', loadName: 'Refrigerator (Inverter)', arabicName: 'ثلاجة انفرتر', categoryMain: 'Kitchen', categorySub: 'Refrigerator Inverter', ratedPowerW: 200, runningPowerW: 90, surgeMultiplier: 3, quantity: 1, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, timeProfileType: '24/7', criticality: 'Critical', continuousLoad: true, operatingMode: 'Continuous' }),
    make({ loadId: 'LD-1004', loadTag: 'KIT-TV-01', loadName: 'TV LED 55"', arabicName: 'تلفاز LED 55 بوصة', categoryMain: 'IT', categorySub: 'TV', ratedPowerW: 120, runningPowerW: 95, quantity: 1, dayHoursSummer: 2, nightHoursSummer: 4, dayHoursWinter: 3, nightHoursWinter: 5, timeProfileType: 'Evening Peak', criticality: 'Optional' }),
    make({ loadId: 'LD-1005', loadTag: 'PMP-WT-01', loadName: 'Water Pump 1 HP', arabicName: 'مضخة مياه 1 حصان', categoryMain: 'Pump', categorySub: 'Surface Pump', ratedPowerW: 750, runningPowerW: 700, surgeMultiplier: 5, powerFactor: 0.82, quantity: 1, dayHoursSummer: 1.5, nightHoursSummer: 0.5, dayHoursWinter: 1, nightHoursWinter: 0.5, timeProfileType: 'Morning Peak', criticality: 'Essential' }),
    make({ loadId: 'LD-1006', loadTag: 'WTR-HT-01', loadName: 'Water Heater 50L', arabicName: 'سخان مياه 50 لتر', categoryMain: 'Water', categorySub: 'Water Heater', ratedPowerW: 2000, runningPowerW: 2000, quantity: 1, dayHoursSummer: 2, nightHoursSummer: 0, dayHoursWinter: 3, nightHoursWinter: 0, timeProfileType: 'Morning Peak', criticality: 'Essential', deferrableLoad: true, shiftableToDaytime: true }),
    make({ loadId: 'LD-1007', loadTag: 'LIT-FN-01', loadName: 'Ceiling Fan', arabicName: 'مروحة سقف', categoryMain: 'HVAC', categorySub: 'Ceiling Fan', ratedPowerW: 75, runningPowerW: 60, surgeMultiplier: 1.5, powerFactor: 0.85, quantity: 4, dayHoursSummer: 10, nightHoursSummer: 6, dayHoursWinter: 1, nightHoursWinter: 0, timeProfileType: 'Day Load', criticality: 'Normal', continuousLoad: true }),
    make({ loadId: 'LD-1008', loadTag: 'KIT-MW-01', loadName: 'Microwave Oven', arabicName: 'فرن ميكروويف', categoryMain: 'Kitchen', categorySub: 'Microwave', ratedPowerW: 1200, runningPowerW: 1200, quantity: 1, dayHoursSummer: 0.5, nightHoursSummer: 0, dayHoursWinter: 0.5, nightHoursWinter: 0, timeProfileType: 'Morning Peak', criticality: 'Normal' }),
    make({ loadId: 'LD-1009', loadTag: 'LND-WM-01', loadName: 'Washing Machine', arabicName: 'غسالة ملابس', categoryMain: 'Laundry', categorySub: 'Washing Machine', ratedPowerW: 500, runningPowerW: 350, surgeMultiplier: 3, powerFactor: 0.85, quantity: 1, dayHoursSummer: 1, nightHoursSummer: 0, dayHoursWinter: 1, nightHoursWinter: 0, timeProfileType: 'Day Load', criticality: 'Normal', deferrableLoad: true }),
    make({ loadId: 'LD-1010', loadTag: 'SEC-CAM-01', loadName: 'CCTV System', arabicName: 'نظام كاميرات', categoryMain: 'Security', categorySub: 'CCTV', ratedPowerW: 60, runningPowerW: 50, quantity: 1, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, timeProfileType: '24/7', criticality: 'Critical', continuousLoad: true, operatingMode: 'Continuous' }),
  ];
};

const presetProfessional = (): Load[] => {
  const base = presetBasic();
  return [
    ...base,
    {
      ...defaultLoad(), loadId: 'LD-2001', loadTag: 'LIT-OUT-01', loadName: 'LED Floodlight 100W', arabicName: 'كشاف LED 100 واط', categoryMain: 'Lighting', categorySub: 'Floodlight', ratedPowerW: 100, runningPowerW: 100, quantity: 4, dayHoursSummer: 0, nightHoursSummer: 10, dayHoursWinter: 0, nightHoursWinter: 12, timeProfileType: 'Night Load', criticality: 'Normal', operatingMode: 'Sensor-Based',
    },
    {
      ...defaultLoad(), loadId: 'LD-2002', loadTag: 'IT-SRV-01', loadName: 'Server (Small)', arabicName: 'سيرفر صغير', categoryMain: 'IT', categorySub: 'Server', ratedPowerW: 600, runningPowerW: 450, surgeMultiplier: 1.5, powerFactor: 0.95, quantity: 1, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, timeProfileType: '24/7', criticality: 'Critical', continuousLoad: true, harmonicClass: 'High Harmonics', thdPercent: 15,
    },
    {
      ...defaultLoad(), loadId: 'LD-2003', loadTag: 'MED-CPAP-01', loadName: 'CPAP Machine', arabicName: 'جهاز CPAP', categoryMain: 'Medical', categorySub: 'CPAP', ratedPowerW: 80, runningPowerW: 70, quantity: 1, dayHoursSummer: 0, nightHoursSummer: 8, dayHoursWinter: 0, nightHoursWinter: 8, timeProfileType: 'Night Load', criticality: 'Critical', continuousLoad: true, operatingMode: 'Continuous',
    },
    {
      ...defaultLoad(), loadId: 'LD-2004', loadTag: 'EV-CHR-01', loadName: 'EV Charger Level 2', arabicName: 'شاحن سيارة كهربائية', categoryMain: 'EV', categorySub: 'EV Charger', ratedPowerW: 7000, runningPowerW: 6800, surgeMultiplier: 1, powerFactor: 0.98, quantity: 1, dayHoursSummer: 0, nightHoursSummer: 6, dayHoursWinter: 0, nightHoursWinter: 6, timeProfileType: 'Night Load', criticality: 'Optional', deferrableLoad: true, shiftableToDaytime: true,
    },
  ] as Load[];
};

const presetCommercial = (): Load[] => {
  const make = (overrides: Partial<Load>): Load => {
    const base = defaultLoad();
    base.loadId = `LD-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    return { ...base, ...overrides } as Load;
  };
  return [
    make({ loadId: 'LD-3001', loadTag: 'LT-OF-01', loadName: 'LED Panel 40W', arabicName: 'لوحة LED 40 واط', categoryMain: 'Lighting', categorySub: 'LED Panel', ratedPowerW: 40, runningPowerW: 40, quantity: 30, dayHoursSummer: 9, nightHoursSummer: 2, dayHoursWinter: 9, nightHoursWinter: 2, timeProfileType: 'Day Load', criticality: 'Essential' }),
    make({ loadId: 'LD-3002', loadTag: 'AC-OF-01', loadName: 'Central AC 3 Ton', arabicName: 'تكييف مركزي 3 طن', categoryMain: 'HVAC', categorySub: 'Central AC', ratedPowerW: 4500, runningPowerW: 3500, surgeMultiplier: 5, voltageNominal: 380, phaseType: '3Ø', powerFactor: 0.88, quantity: 4, dayHoursSummer: 10, nightHoursSummer: 2, dayHoursWinter: 4, nightHoursWinter: 0, timeProfileType: 'Day Load', criticality: 'Essential', continuousLoad: true }),
    make({ loadId: 'LD-3003', loadTag: 'IND-MTR-01', loadName: '3Ø Motor 10 HP', arabicName: 'موتور 3 فاز 10 حصان', categoryMain: 'Industrial', categorySub: 'Motor 3Ø', ratedPowerW: 7500, runningPowerW: 7000, surgeMultiplier: 7, voltageNominal: 380, phaseType: '3Ø', powerFactor: 0.86, quantity: 2, dayHoursSummer: 8, nightHoursSummer: 0, dayHoursWinter: 8, nightHoursWinter: 0, timeProfileType: 'Day Load', criticality: 'Critical', continuousLoad: true }),
    make({ loadId: 'LD-3004', loadTag: 'IND-CMP-01', loadName: 'Air Compressor 3Ø', arabicName: 'ضاغط هواء 3 فاز', categoryMain: 'Industrial', categorySub: 'Compressor 3Ø', ratedPowerW: 7500, runningPowerW: 6000, surgeMultiplier: 7, voltageNominal: 380, phaseType: '3Ø', powerFactor: 0.85, quantity: 1, dayHoursSummer: 6, nightHoursSummer: 0, dayHoursWinter: 6, nightHoursWinter: 0, timeProfileType: 'Day Load', criticality: 'Critical', continuousLoad: true, cyclingLoad: true }),
    make({ loadId: 'LD-3005', loadTag: 'IT-PC-01', loadName: 'Desktop Computer', arabicName: 'كمبيوتر مكتبي', categoryMain: 'IT', categorySub: 'Desktop', ratedPowerW: 300, runningPowerW: 180, surgeMultiplier: 1.2, quantity: 20, dayHoursSummer: 9, nightHoursSummer: 0, dayHoursWinter: 9, nightHoursWinter: 0, timeProfileType: 'Day Load', criticality: 'Essential', continuousLoad: true }),
    make({ loadId: 'LD-3006', loadTag: 'OFC-PRT-01', loadName: 'Photocopier', arabicName: 'آلة تصوير', categoryMain: 'Office', categorySub: 'Copier', ratedPowerW: 1500, runningPowerW: 800, surgeMultiplier: 2, quantity: 2, dayHoursSummer: 4, nightHoursSummer: 0, dayHoursWinter: 4, nightHoursWinter: 0, timeProfileType: 'Day Load', criticality: 'Normal' }),
    make({ loadId: 'LD-3007', loadTag: 'LIT-EM-01', loadName: 'Emergency LED', arabicName: 'إضاءة طوارئ LED', categoryMain: 'Lighting', categorySub: 'Emergency', ratedPowerW: 15, runningPowerW: 15, quantity: 12, dayHoursSummer: 0, nightHoursSummer: 12, dayHoursWinter: 0, nightHoursWinter: 12, timeProfileType: 'Night Load', criticality: 'Critical', continuousLoad: true, operatingMode: 'Continuous' }),
  ];
};

export function LoadProvider({ children }: { children: ReactNode }) {
  const [loads, setLoadsState] = useState<Load[]>(() => {
    try {
      const raw = readMigrated(STORAGE_KEY, LEGACY.loads);
      if (raw) return JSON.parse(raw);
    } catch {}
    return presetBasic();
  });
  const [expertLevel, setExpertLevelState] = useState<ExpertLevel>(() => {
    try { return (readMigrated(LEVEL_KEY, LEGACY.level) as ExpertLevel) || 'Professional'; } catch { return 'Professional'; }
  });
  const [projectName, setProjectNameState] = useState<string>(() => {
    try { return readMigrated(PROJECT_KEY, LEGACY.project) || 'My Solar Project'; } catch { return 'My Solar Project'; }
  });

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loads)); } catch {} }, [loads]);
  useEffect(() => { try { localStorage.setItem(LEVEL_KEY, expertLevel); } catch {} }, [expertLevel]);
  useEffect(() => { try { localStorage.setItem(PROJECT_KEY, projectName); } catch {} }, [projectName]);

  const setLoads = useCallback((l: Load[]) => setLoadsState(l), []);
  const addLoad = useCallback((load: Load) => {
    setLoadsState(prev => {
      const idNum = prev.length + 1;
      const newLoad = { ...load, id: crypto.randomUUID(), loadId: load.loadId || `LD-${String(idNum).padStart(4, '0')}` };
      return [...prev, newLoad];
    });
  }, []);
  const updateLoad = useCallback((id: string, patch: Partial<Load>) => {
    setLoadsState(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const removeLoad = useCallback((id: string) => setLoadsState(prev => prev.filter(l => l.id !== id)), []);
  const duplicateLoad = useCallback((id: string) => {
    setLoadsState(prev => {
      const orig = prev.find(l => l.id === id);
      if (!orig) return prev;
      const idNum = prev.length + 1;
      return [...prev, { ...orig, id: crypto.randomUUID(), loadId: `LD-${String(idNum).padStart(4, '0')}`, loadTag: orig.loadTag + '-CPY' }];
    });
  }, []);
  const clearAll = useCallback(() => setLoadsState([]), []);
  const loadPreset = useCallback((preset: 'basic' | 'professional' | 'commercial') => {
    if (preset === 'basic') setLoadsState(presetBasic());
    else if (preset === 'professional') setLoadsState(presetProfessional());
    else setLoadsState(presetCommercial());
  }, []);
  const setExpertLevel = useCallback((l: ExpertLevel) => setExpertLevelState(l), []);
  const setProjectName = useCallback((n: string) => setProjectNameState(n), []);

  return (
    <LoadContext.Provider value={{
      loads, setLoads, addLoad, updateLoad, removeLoad, duplicateLoad, clearAll, loadPreset,
      expertLevel, setExpertLevel, projectName, setProjectName,
    }}>
      {children}
    </LoadContext.Provider>
  );
}

export function useLoads() {
  const ctx = useContext(LoadContext);
  if (!ctx) throw new Error('useLoads must be inside LoadProvider');
  return ctx;
}

export function useSummary() {
  const { loads } = useLoads();
  return useMemo(() => computeSummary(loads), [loads]);
}

export function useLoadMetrics() {
  const { loads } = useLoads();
  return useMemo(() => loads.map(l => ({
    load: l,
    connected: calcConnectedLoad(l),
    running: calcRunningLoad(l),
    daily: calcDailyEnergy(l),
    surge: calcSurgePower(l),
  })), [loads]);
}
