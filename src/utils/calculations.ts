import type { Load, SummaryMetrics } from '../types';

// =======================================================================
//  Professional Load Engine — Engineering Calculations
//  All formulas follow NEC/IEC industry practice for solar load analysis.
// =======================================================================

const COLORS = ['var(--viz-cat-2)', 'var(--viz-cat-1)', 'var(--viz-cat-3)', 'var(--viz-cat-4)', 'var(--viz-cat-5)', 'var(--viz-cat-6)', 'var(--viz-cat-7)', 'var(--viz-cat-8)', 'var(--error)', 'var(--viz-cat-3)', 'var(--viz-cat-5)', 'var(--viz-cat-7)', 'var(--viz-cat-1)', 'var(--viz-cat-8)'];

export const calcConnectedLoad = (load: Load): number =>
  (load.ratedPowerW || 0) * (load.quantity || 0);

export const calcRunningLoad = (load: Load): number =>
  (load.runningPowerW || load.ratedPowerW || 0) * (load.quantity || 0);

export const calcDemandLoad = (load: Load): number =>
  calcConnectedLoad(load) * (load.utilizationFactorKu || 0);

export const calcSurgePower = (load: Load): number =>
  (load.ratedPowerW || 0) * (load.surgeMultiplier || 1) * (load.quantity || 0);

export const calcApparentPower = (load: Load): number => {
  // kVA = (W × Qty) / (PF × 1000)
  const connected = calcConnectedLoad(load);
  const pf = load.powerFactor || 0.9;
  return connected / (pf * 1000);
};

export const calcReactivePower = (load: Load): number => {
  const kva = calcApparentPower(load);
  const kw = (load.ratedPowerW * load.quantity) / 1000;
  return Math.sqrt(Math.max(0, kva * kva - kw * kw));
};

export const calcFullLoadCurrent = (load: Load): number => {
  const connected = calcConnectedLoad(load);
  const pf = load.powerFactor || 0.9;
  const v = load.voltageNominal || 220;
  if (load.phaseType === '3Ø') {
    return connected / (Math.sqrt(3) * v * pf);
  }
  return connected / (v * pf);
};

export const calcLockedRotorCurrent = (load: Load): number => {
  // NOTE: calcFullLoadCurrent already includes `quantity` (connected load).
  // The LRA multiplier must NOT multiply by quantity again — that double-counted
  // LRA/Surge for multi-unit loads. The per-unit branch above is correct because
  // `lockedRotorCurrentA` is a single-unit rating.
  if (load.lockedRotorCurrentA > 0) return load.lockedRotorCurrentA * (load.quantity || 0);
  return calcFullLoadCurrent(load) * (load.surgeMultiplier || 1);
};

export const calcDailyEnergy = (load: Load, season: 'summer' | 'winter' = 'summer'): number => {
  // Energy = Running W × Qty × Ku × Hours × Duty% × Demand × Days/Week
  const running = calcRunningLoad(load);
  const ku = load.utilizationFactorKu || 1;
  const duty = (load.dutyCyclePercent || 100) / 100;
  const demand = load.demandFactor || 1;
  const dayHours = season === 'summer' ? (load.dayHoursSummer || 0) : (load.dayHoursWinter || 0);
  const nightHours = season === 'summer' ? (load.nightHoursSummer || 0) : (load.nightHoursWinter || 0);
  const days = (load.operatingDaysPerWeek || 7) / 7;
  return running * ku * duty * demand * (dayHours + nightHours) * days;
};

export const calcDayEnergy = (load: Load, season: 'summer' | 'winter' = 'summer'): number => {
  const running = calcRunningLoad(load);
  const ku = load.utilizationFactorKu || 1;
  const duty = (load.dutyCyclePercent || 100) / 100;
  const demand = load.demandFactor || 1;
  const dayHours = season === 'summer' ? (load.dayHoursSummer || 0) : (load.dayHoursWinter || 0);
  const days = (load.operatingDaysPerWeek || 7) / 7;
  return running * ku * duty * demand * dayHours * days;
};

export const calcNightEnergy = (load: Load, season: 'summer' | 'winter' = 'summer'): number => {
  const running = calcRunningLoad(load);
  const ku = load.utilizationFactorKu || 1;
  const duty = (load.dutyCyclePercent || 100) / 100;
  const demand = load.demandFactor || 1;
  const nightHours = season === 'summer' ? (load.nightHoursSummer || 0) : (load.nightHoursWinter || 0);
  const days = (load.operatingDaysPerWeek || 7) / 7;
  return running * ku * duty * demand * nightHours * days;
};

export const calcAnnualEnergy = (load: Load): number => {
  const days = load.operatingDaysPerYear || 365;
  // Average of summer/winter (each ~half year)
  const summer = calcDailyEnergy(load, 'summer');
  const winter = calcDailyEnergy(load, 'winter');
  return ((summer * 183) + (winter * 182)) * (days / 365);
};

export const calcCoincidentLoad = (load: Load): number =>
  calcDemandLoad(load) * (load.coincidenceFactor || 1);

export const calcDiversifiedLoad = (load: Load): number =>
  calcCoincidentLoad(load) / (load.diversityFactor || 1);

// Generate hourly operating load (W) considering profile, hours, and Ku
export const calcHourlyOperatingLoad = (load: Load): number[] => {
  const running = calcRunningLoad(load);
  const ku = load.utilizationFactorKu || 1;
  const duty = (load.dutyCyclePercent || 100) / 100;
  const totalHours = (load.dayHoursSummer || 0) + (load.nightHoursSummer || 0);
  if (totalHours === 0) return Array(24).fill(0);
  // Build a 24h profile based on timeProfileType and hours per bucket
  const profile = load.hourlyProfile && load.hourlyProfile.length === 24 ? load.hourlyProfile : defaultProfileForType(load.timeProfileType);
  const total = profile.reduce((s, v) => s + v, 0) || 1;
  return profile.map(v => (running * ku * duty * v) / total * totalHours);
};

const defaultProfileForType = (type: string): number[] => {
  switch (type) {
    case 'Morning Peak': return [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    case 'Noon Peak': return [0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0];
    case 'Evening Peak': return [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0];
    case 'Night Load': return [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1];
    case '24/7': return Array(24).fill(1);
    case 'Base Load': return Array(24).fill(1);
    case 'Day Load':
    default: return [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0];
  }
};

// =======================================================================
//  Master Summary Engine — Aggregate metrics across all loads
// =======================================================================
export function computeSummary(loads: Load[]): SummaryMetrics {
  if (loads.length === 0) {
    const empty: SummaryMetrics = {
      totalConnectedLoadW: 0, totalRunningLoadW: 0, maximumDemandW: 0,
      diversifiedLoadW: 0, coincidentPeakLoadW: 0,
      totalDailyEnergyWh: 0, dayEnergyWh: 0, nightEnergyWh: 0,
      monthlyEnergyKWh: 0, annualEnergyKWh: 0,
      peakDemandKW: 0, peakDemandKVA: 0, estimatedMaxCurrentA: 0,
      maximumSurgeKW: 0, loadFactor: 0, phantomLossWh: 0,
      criticalLoadWh: 0, deferrableLoadWh: 0,
      byCategory: [], byCriticality: [], hourlyProfile: Array(24).fill(0),
      hourlyOperatingProfile: Array(24).fill(0),
    };
    return empty;
  }

  // Connected & Running
  const totalConnected = loads.reduce((s, l) => s + calcConnectedLoad(l), 0);
  const totalRunning = loads.reduce((s, l) => s + calcRunningLoad(l), 0);

  // Hourly operating profile (W) summed across all loads
  const hourlyProfile = Array(24).fill(0);
  loads.forEach(l => {
    const profile = calcHourlyOperatingLoad(l);
    profile.forEach((v, i) => { hourlyProfile[i] += v; });
  });

  // Maximum demand = peak of hourly operating profile (since that's when all are actually on)
  // However max demand also applies demand/diversity factors - use the higher of raw peak or max simultaneous
  const maxHourly = Math.max(...hourlyProfile);
  const maximumDemand = maxHourly; // operating peak IS the demand

  // Diversified & Coincident
  const coincidentPeak = loads.reduce((s, l) => s + calcCoincidentLoad(l), 0);
  const diversified = loads.reduce((s, l) => s + calcDiversifiedLoad(l), 0);

  // Energy
  const totalDaily = hourlyProfile.reduce((s, v) => s + v, 0);
  const dayEnergy = hourlyProfile.slice(8, 18).reduce((s, v) => s + v, 0);
  const nightEnergy = totalDaily - dayEnergy;

  // Surge
  const maxSurge = loads.reduce((s, l) => s + calcSurgePower(l), 0);

  // Peak demand
  const peakKW = maximumDemand / 1000;
  const peakKVA = peakKW / 0.85; // assume 0.85 PF
  const maxCurrent = peakKVA * 1000 / (220 * Math.sqrt(loads.some(l => l.phaseType === '3Ø') ? 3 : 1));

  // Load factor = avg load / peak load
  const avgLoad = totalDaily / 24;
  const loadFactor = maxHourly > 0 ? (avgLoad / maxHourly) * 100 : 0;

  // Phantom
  const phantomLoss = loads.reduce((s, l) => {
    return s + (l.phantomLoadW || 0) * (l.quantity || 0) * 24;
  }, 0);

  // Critical
  const criticalLoadWh = loads
    .filter(l => l.criticality === 'Critical' || l.criticality === 'Essential')
    .reduce((s, l) => s + calcDailyEnergy(l), 0);

  const deferrableLoadWh = loads
    .filter(l => l.deferrableLoad)
    .reduce((s, l) => s + calcDailyEnergy(l), 0);

  // By category — energy
  const catMap = new Map<string, number>();
  loads.forEach(l => {
    const e = calcDailyEnergy(l);
    catMap.set(l.categoryMain, (catMap.get(l.categoryMain) || 0) + e);
  });
  const byCategory = Array.from(catMap.entries())
    .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  // By criticality
  const critMap = new Map<string, number>();
  loads.forEach(l => {
    const e = calcDailyEnergy(l);
    critMap.set(l.criticality, (critMap.get(l.criticality) || 0) + e);
  });
  const byCriticality = Array.from(critMap.entries())
    .map(([name, value], i) => ({ name, value, color: ['var(--error)', 'var(--accent-2)', 'var(--blue-500)', 'var(--text-tertiary)'][i] }));

  return {
    totalConnectedLoadW: totalConnected,
    totalRunningLoadW: totalRunning,
    maximumDemandW: maximumDemand,
    diversifiedLoadW: diversified,
    coincidentPeakLoadW: coincidentPeak,
    totalDailyEnergyWh: totalDaily,
    dayEnergyWh: dayEnergy,
    nightEnergyWh: nightEnergy,
    monthlyEnergyKWh: (totalDaily * 30) / 1000,
    annualEnergyKWh: (totalDaily * 365) / 1000,
    peakDemandKW: peakKW,
    peakDemandKVA: peakKVA,
    estimatedMaxCurrentA: maxCurrent,
    maximumSurgeKW: maxSurge / 1000,
    loadFactor,
    phantomLossWh: phantomLoss,
    criticalLoadWh,
    deferrableLoadWh,
    byCategory,
    byCriticality,
    hourlyProfile,
    hourlyOperatingProfile: hourlyProfile,
  };
}

// =======================================================================
//  Smart Auto-Estimation — Suggest typical values when user is unsure
// =======================================================================
export function getAutoEstimate(categoryMain: string): Partial<Load> {
  const presets: Record<string, Partial<Load>> = {
    'Lighting': { powerFactor: 0.9, efficiency: 90, thdPercent: 12, harmonicClass: 'Nonlinear', surgeMultiplier: 1, dutyCyclePercent: 60, utilizationFactorKu: 0.8, demandFactor: 0.9 },
    'HVAC': { powerFactor: 0.9, efficiency: 85, thdPercent: 8, harmonicClass: 'Nonlinear', surgeMultiplier: 4, dutyCyclePercent: 60, utilizationFactorKu: 0.75, demandFactor: 0.85, criticality: 'Essential' },
    'Kitchen': { powerFactor: 0.9, efficiency: 85, thdPercent: 10, harmonicClass: 'Nonlinear', surgeMultiplier: 1.5, dutyCyclePercent: 30, utilizationFactorKu: 0.5, demandFactor: 0.7 },
    'Pump': { powerFactor: 0.82, efficiency: 78, thdPercent: 6, harmonicClass: 'Linear', surgeMultiplier: 6, dutyCyclePercent: 25, utilizationFactorKu: 0.5, demandFactor: 0.7, criticality: 'Essential' },
    'Medical': { powerFactor: 0.9, efficiency: 88, thdPercent: 8, harmonicClass: 'Nonlinear', surgeMultiplier: 1.5, dutyCyclePercent: 60, utilizationFactorKu: 0.7, demandFactor: 0.9, criticality: 'Critical' },
    'IT': { powerFactor: 0.95, efficiency: 88, thdPercent: 10, harmonicClass: 'Nonlinear', surgeMultiplier: 1.2, dutyCyclePercent: 70, utilizationFactorKu: 0.7, demandFactor: 0.85 },
    'Industrial': { powerFactor: 0.85, efficiency: 85, thdPercent: 8, harmonicClass: 'Nonlinear', surgeMultiplier: 6, dutyCyclePercent: 50, utilizationFactorKu: 0.7, demandFactor: 0.8, criticality: 'Critical' },
    'EV': { powerFactor: 0.98, efficiency: 95, thdPercent: 5, harmonicClass: 'Nonlinear', surgeMultiplier: 1, dutyCyclePercent: 20, utilizationFactorKu: 0.6, demandFactor: 0.8, criticality: 'Optional' },
    'Security': { powerFactor: 0.9, efficiency: 88, thdPercent: 8, harmonicClass: 'Nonlinear', surgeMultiplier: 1, dutyCyclePercent: 100, utilizationFactorKu: 0.9, demandFactor: 1, criticality: 'Critical' },
    'Water': { powerFactor: 1, efficiency: 95, thdPercent: 3, harmonicClass: 'Linear', surgeMultiplier: 1, dutyCyclePercent: 20, utilizationFactorKu: 0.6, demandFactor: 0.7, criticality: 'Essential' },
    'Office': { powerFactor: 0.95, efficiency: 85, thdPercent: 10, harmonicClass: 'Nonlinear', surgeMultiplier: 1.5, dutyCyclePercent: 30, utilizationFactorKu: 0.5, demandFactor: 0.6 },
    'Laundry': { powerFactor: 0.9, efficiency: 80, thdPercent: 10, harmonicClass: 'Nonlinear', surgeMultiplier: 2, dutyCyclePercent: 8, utilizationFactorKu: 0.4, demandFactor: 0.6 },
    'Other': { powerFactor: 0.9, efficiency: 85, thdPercent: 8, harmonicClass: 'Linear', surgeMultiplier: 1.5, dutyCyclePercent: 50, utilizationFactorKu: 0.7, demandFactor: 0.8 },
  };
  return presets[categoryMain] || presets['Other'];
}

// =======================================================================
//  Validation / Conflict Detection
// =======================================================================
export interface ValidationIssue {
  type: 'warning' | 'error' | 'info';
  field: string;
  message: string;
  loadId?: string;
}

export function validateLoad(load: Load): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!load.loadName) issues.push({ type: 'error', field: 'loadName', message: 'Load name is required', loadId: load.id });
  if (load.ratedPowerW <= 0) issues.push({ type: 'error', field: 'ratedPowerW', message: 'Rated power must be > 0', loadId: load.id });
  if (load.powerFactor <= 0 || load.powerFactor > 1) issues.push({ type: 'error', field: 'powerFactor', message: 'Power factor must be between 0 and 1', loadId: load.id });
  if (load.efficiency < 0 || load.efficiency > 100) issues.push({ type: 'error', field: 'efficiency', message: 'Efficiency must be 0-100%', loadId: load.id });
  if (load.dutyCyclePercent < 0 || load.dutyCyclePercent > 100) issues.push({ type: 'error', field: 'dutyCyclePercent', message: 'Duty cycle must be 0-100%', loadId: load.id });
  if (load.utilizationFactorKu < 0 || load.utilizationFactorKu > 1) issues.push({ type: 'error', field: 'utilizationFactorKu', message: 'Ku must be 0-1', loadId: load.id });
  if (load.demandFactor < 0 || load.demandFactor > 1) issues.push({ type: 'error', field: 'demandFactor', message: 'Demand factor must be 0-1', loadId: load.id });
  if (load.runningPowerW > load.ratedPowerW) issues.push({ type: 'warning', field: 'runningPowerW', message: 'Running power exceeds rated power', loadId: load.id });
  if (load.thdPercent > 20) issues.push({ type: 'warning', field: 'thdPercent', message: 'High THD may require harmonic filtering', loadId: load.id });
  if (load.continuousLoad && load.criticality === 'Optional') issues.push({ type: 'warning', field: 'criticality', message: 'Continuous load should not be Optional', loadId: load.id });
  if ((load.dayHoursSummer + load.nightHoursSummer) > 24) issues.push({ type: 'warning', field: 'hours', message: 'Total hours exceed 24', loadId: load.id });
  if (load.phantomLoadW > 0 && !load.standbyLoad) issues.push({ type: 'info', field: 'phantomLoadW', message: 'Phantom load detected — consider marking as standby', loadId: load.id });

  return issues;
}

// Surge library — typical multipliers by motor/appliance type
export const SURGE_MULTIPLIERS: { name: string; multiplier: number; description: string }[] = [
  { name: 'Resistive Heater', multiplier: 1, description: 'No surge — pure resistance load' },
  { name: 'LED Lighting', multiplier: 1, description: 'Negligible inrush' },
  { name: 'Incandescent', multiplier: 1.5, description: 'Hot tungsten filament inrush' },
  { name: 'Small Motor (<1 HP)', multiplier: 3, description: 'PSC, shaded-pole, split-phase' },
  { name: 'Standard Motor (1-5 HP)', multiplier: 5, description: 'Capacitor-start, induction' },
  { name: 'Large Motor (>5 HP)', multiplier: 7, description: 'Three-phase induction DOL' },
  { name: 'Compressor / Refrigerator', multiplier: 5, description: 'Hermetic compressor LRA' },
  { name: 'Welding Machine', multiplier: 3, description: 'Transformer inrush' },
  { name: 'X-Ray / Medical Imaging', multiplier: 7, description: 'Capacitor discharge systems' },
  { name: 'EV Charger', multiplier: 1, description: 'Electronic soft-start built in' },
  { name: 'UPS System', multiplier: 1.5, description: 'Battery + inverter soft-start' },
  { name: 'Server / SMPS', multiplier: 1.5, description: 'Bulk capacitor inrush' },
];

// NEC Demand Factors (Lighting & Receptacle)
export const NEC_DEMAND_FACTORS: { description: string; factor: number }[] = [
  { description: 'First 3 kVA @ 100%', factor: 1.0 },
  { description: '3 kVA to 20 kVA @ 35%', factor: 0.35 },
  { description: 'Remainder over 20 kVA @ 25%', factor: 0.25 },
];

// Format helpers
export const fmtW = (w: number, digits = 0) => {
  if (w >= 1000000) return (w / 1000000).toFixed(2) + ' MW';
  if (w >= 1000) return (w / 1000).toFixed(digits || 2) + ' kW';
  return w.toFixed(digits) + ' W';
};

export const fmtWh = (wh: number, digits = 0) => {
  if (wh >= 1000000) return (wh / 1000000).toFixed(2) + ' MWh';
  if (wh >= 1000) return (wh / 1000).toFixed(digits || 2) + ' kWh';
  return wh.toFixed(digits) + ' Wh';
};

export const fmtA = (a: number, digits = 1) => a.toFixed(digits) + ' A';
export const fmtKVA = (kva: number, digits = 2) => kva.toFixed(digits) + ' kVA';
export const fmtPct = (n: number, digits = 1) => n.toFixed(digits) + '%';
