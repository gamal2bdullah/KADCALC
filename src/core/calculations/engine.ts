// =======================================================================
//  Audit-Aware Multi-Layer Calculation Engine
//
//  Every metric carries:
//   - value (the result)
//   - policyId (the policy that produced it)
//   - formula (the formula used)
//   - source (input source)
//   - confidence (High/Medium/Low)
//   - timestamp
//   - trace (chain of derivation)
//
//  Layers (mandatory order):
//   1. Raw Input
//   2. Normalization
//   3. Engineering Rules (PF, Ku, DF, CF, Div, Surge, THD)
//   4. Derived Metrics (connected, running, demand, apparent, current, energy)
//   5. Interpretation (warnings, recommendations)
// =======================================================================

import type { Load } from '../../types';
import { getPolicy } from '../assumptions/policy';

export interface AuditMetadata {
  value: number | string;
  unit: string;
  policyId?: string;
  formula: string;
  inputs: Record<string, number | string>;
  confidence: 'High' | 'Medium' | 'Low';
  timestamp: string;
  trace: string[];
  source?: string;
  notes?: string;
}

export interface LoadCalculation {
  loadId: string;
  layer1_raw: { ratedPowerW: number; quantity: number; hoursTotal: number };
  layer2_normalized: { ratedPowerW: number; quantity: number; voltage: number; pf: number; ku: number; df: number; cf: number; div: number; efficiency: number; thd: number };
  layer3_rules: { ku: number; df: number; cf: number; div: number; pf: number; thdDerate: number };
  layer4_derived: {
    connected: AuditMetadata;
    running: AuditMetadata;
    demand: AuditMetadata;
    coincident: AuditMetadata;
    diversified: AuditMetadata;
    apparentKVA: AuditMetadata;
    reactiveKVAR: AuditMetadata;
    fullLoadCurrent: AuditMetadata;
    lockedRotorCurrent: AuditMetadata;
    surgePower: AuditMetadata;
    dailyEnergyWh: AuditMetadata;
    annualEnergyWh: AuditMetadata;
    loadFactor: AuditMetadata;
  };
  layer5_warnings: string[];
}

// =======================================================================
//  THE ENGINE
// =======================================================================
export function calculateLoadAudited(load: Load): LoadCalculation {
  const ts = new Date().toISOString();
  const trace: string[] = [];
  const warnings: string[] = [];

  // --- LAYER 1: Raw Input (verbatim)
  const raw = {
    ratedPowerW: load.ratedPowerW,
    quantity: load.quantity,
    hoursTotal: (load.dayHoursSummer || 0) + (load.nightHoursSummer || 0),
  };

  // --- LAYER 2: Normalization (clean & cap)
  // PF can never be ≤ 0 physically; floor it at a small positive value so the
  // downstream apparent-power / FLC divisions (÷ pf) stay finite instead of → Infinity.
  const PF_FLOOR = 0.05;
  const pf = clamp(load.powerFactor || getPolicy('PF-RES-MIXED')?.defaultValue as number || 0.9, PF_FLOOR, 1);
  const ku = clamp(load.utilizationFactorKu ?? 0.8, 0, 1);
  const df = clamp(load.demandFactor ?? 0.9, 0, 1);
  const cf = clamp(load.coincidenceFactor ?? 0.7, 0, 1);
  const div = Math.max(1, load.diversityFactor ?? 1.2);
  const eff = clamp(load.efficiency || 85, 1, 100) / 100;
  const thd = clamp(load.thdPercent || 0, 0, 100);
  const v = load.voltageNominal || 220;

  // PF validity check
  if (load.powerFactor <= 0 || load.powerFactor > 1) {
    warnings.push(`PF_OUT_OF_RANGE: ${load.powerFactor} — clamped to ${pf.toFixed(2)}`);
  }

  // THD-based derate
  const thdPolicy = getPolicy('THD-DERATE-FACTOR');
  const thdDerate = thd > 15 ? (thdPolicy?.defaultValue as number || 0.9) : 1.0;
  if (thd > 15) warnings.push(`HIGH_THD: ${thd}% — capacity derated to ${(thdDerate * 100).toFixed(0)}%`);

  // --- LAYER 3: Engineering Rules (just record what rules applied)
  trace.push(`PF=${pf} (policy: load-defined) | Ku=${ku} (Ku policy) | DF=${df} (DF policy) | CF=${cf} (CF policy) | Div=${div} (Div policy)`);

  // --- LAYER 4: Derived Metrics (each is audited)

  // 4.1 Connected Load
  const connected = load.ratedPowerW * load.quantity;
  const connectedAudit: AuditMetadata = {
    value: connected,
    unit: 'W',
    formula: 'connected = ratedPowerW × quantity',
    inputs: { ratedPowerW: load.ratedPowerW, quantity: load.quantity },
    confidence: load.confidenceLevel || 'Medium',
    timestamp: ts,
    trace: [...trace, 'Layer 4.1'],
    source: load.dataSource,
    notes: 'Sum of all nameplate ratings × unit count',
  };

  // 4.2 Running Load
  const running = (load.runningPowerW || load.ratedPowerW) * load.quantity;
  const runningAudit: AuditMetadata = {
    value: running,
    unit: 'W',
    formula: 'running = runningPowerW × quantity',
    inputs: { runningPowerW: load.runningPowerW, quantity: load.quantity },
    confidence: load.confidenceLevel || 'Medium',
    timestamp: ts,
    trace: [...trace, 'Layer 4.2'],
    notes: 'Actual power under typical operation (not start)',
  };

  // 4.3 Demand Load
  const demand = connected * ku;
  const demandAudit: AuditMetadata = {
    value: demand,
    unit: 'W',
    formula: 'demand = connected × Ku',
    inputs: { connected, ku },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.3'],
    policyId: 'KU-RES-CONTINUOUS',
    notes: 'Maximum demand assuming utilization Ku',
  };

  // 4.4 Coincident Load
  const coincident = demand * cf;
  const coincidentAudit: AuditMetadata = {
    value: coincident,
    unit: 'W',
    formula: 'coincident = demand × CF',
    inputs: { demand, cf },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.4'],
    policyId: 'CF-RES-MIXED',
  };

  // 4.5 Diversified Load
  const diversified = coincident / div;
  const diversifiedAudit: AuditMetadata = {
    value: diversified,
    unit: 'W',
    formula: 'diversified = coincident / Div',
    inputs: { coincident, div },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.5'],
    policyId: 'DIV-MAXIMUM',
  };

  // 4.6 Apparent Power
  const apparentKVA = connected / (pf * 1000) * thdDerate;
  const apparentAudit: AuditMetadata = {
    value: apparentKVA,
    unit: 'kVA',
    formula: 'kVA = (connected / (PF × 1000)) × THD-derate',
    inputs: { connected, pf, thdDerate },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.6'],
    notes: `Includes THD derate of ${(thdDerate * 100).toFixed(0)}% for ${thd}% THD`,
  };

  // 4.7 Reactive Power
  const kW = connected / 1000;
  const reactiveKVAR = Math.sqrt(Math.max(0, apparentKVA * apparentKVA - kW * kW));
  const reactiveAudit: AuditMetadata = {
    value: reactiveKVAR,
    unit: 'kVAR',
    formula: 'kVAR = √(kVA² − kW²)',
    inputs: { apparentKVA, kW },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.7'],
  };

  // 4.8 Full-Load Current
  const flc = load.phaseType === '3Ø' ? (connected / (Math.sqrt(3) * v * pf)) : (connected / (v * pf));
  const flcAudit: AuditMetadata = {
    value: flc,
    unit: 'A',
    formula: load.phaseType === '3Ø' ? 'I = P / (√3 × V × PF)' : 'I = P / (V × PF)',
    inputs: { connected, v, pf, phaseType: load.phaseType },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.8'],
  };

  // 4.9 Locked-Rotor Current
  const lrcPolicy = getPolicy(load.ratedPowerW > 3730 ? 'SURGE-DOL-LARGE' : load.ratedPowerW > 746 ? 'SURGE-CAPACITOR-MED' : 'SURGE-PSC-SMALL');
  const lrcMult = load.surgeMultiplier || (lrcPolicy?.defaultValue as number) || 3;
  const lrc = flc * lrcMult * load.quantity;
  const lrcAudit: AuditMetadata = {
    value: lrc,
    unit: 'A',
    formula: 'LRC = FLC × surgeMultiplier × quantity',
    inputs: { flc, surgeMultiplier: lrcMult, quantity: load.quantity },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.9'],
    policyId: lrcPolicy?.policyId,
    notes: `Surge multiplier from policy: ${lrcPolicy?.name || 'custom'} (${lrcMult}×)`,
  };

  // 4.10 Surge Power
  const surgePower = load.ratedPowerW * lrcMult * load.quantity;
  const surgeAudit: AuditMetadata = {
    value: surgePower,
    unit: 'W',
    formula: 'surge = ratedPowerW × surgeMultiplier × quantity',
    inputs: { ratedPowerW: load.ratedPowerW, surgeMultiplier: lrcMult, quantity: load.quantity },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.10'],
    policyId: lrcPolicy?.policyId,
  };

  // 4.11 Daily Energy
  const summerDaily = running * ku * (load.dutyCyclePercent / 100) * df * (load.operatingDaysPerWeek / 7) * (load.dayHoursSummer + load.nightHoursSummer);
  const winterDaily = running * ku * (load.dutyCyclePercent / 100) * df * (load.operatingDaysPerWeek / 7) * (load.dayHoursWinter + load.nightHoursWinter);
  const dailyEnergy = (summerDaily * 183 + winterDaily * 182) / 365;
  const dailyAudit: AuditMetadata = {
    value: dailyEnergy,
    unit: 'Wh',
    formula: 'daily = avg(summer × 183, winter × 182) / 365',
    inputs: { summerDaily, winterDaily, running, ku, dutyCyclePercent: load.dutyCyclePercent, df },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.11'],
    policyId: 'PROFILE-DAY-SUMMER',
    notes: `Summer: ${summerDaily.toFixed(0)} Wh, Winter: ${winterDaily.toFixed(0)} Wh`,
  };

  // 4.12 Annual Energy
  const annualEnergy = dailyEnergy * (load.operatingDaysPerYear || 365);
  const annualAudit: AuditMetadata = {
    value: annualEnergy,
    unit: 'Wh',
    formula: 'annual = daily × operatingDaysPerYear',
    inputs: { daily: dailyEnergy, operatingDaysPerYear: load.operatingDaysPerYear },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.12'],
  };

  // 4.13 Load Factor
  const dailyHours = Math.max(1, load.dayHoursSummer + load.nightHoursSummer);
  const avgW = dailyEnergy / 24;
  const lf = connected > 0 ? (avgW / connected) * 100 : 0;
  const lfAudit: AuditMetadata = {
    value: lf,
    unit: '%',
    formula: 'LF = (dailyEnergy / 24) / connected × 100',
    inputs: { daily: dailyEnergy, connected },
    confidence: 'High',
    timestamp: ts,
    trace: [...trace, 'Layer 4.13'],
  };

  // --- LAYER 5: Warnings / Validation
  if (load.runningPowerW > load.ratedPowerW * 1.05) {
    warnings.push(`RUN_EXCEEDS_RATED: running ${load.runningPowerW}W > rated ${load.ratedPowerW}W by ${(((load.runningPowerW / load.ratedPowerW) - 1) * 100).toFixed(0)}%`);
  }
  if (dailyHours > 24) {
    warnings.push(`HOURS_EXCEED_24: ${dailyHours}h/day — day + night overlap detected`);
  }
  if (load.continuousLoad && load.criticality === 'Optional') {
    warnings.push(`CRITICALITY_MISMATCH: continuous load marked as Optional — review`);
  }
  if (load.phantomLoadW > 0 && !load.standbyLoad) {
    warnings.push(`PHANTOM_NO_STANDBY: ${load.phantomLoadW}W phantom detected but not flagged as standby`);
  }
  if (load.maxSimultaneousUnits > load.quantity) {
    warnings.push(`SIMULT_OVER_QTY: maxSimultaneous=${load.maxSimultaneousUnits} > quantity=${load.quantity}`);
  }

  return {
    loadId: load.id,
    layer1_raw: raw,
    layer2_normalized: {
      ratedPowerW: load.ratedPowerW,
      quantity: load.quantity,
      voltage: v,
      pf, ku, df, cf, div,
      efficiency: eff * 100,
      thd,
    },
    layer3_rules: { ku, df, cf, div, pf, thdDerate },
    layer4_derived: {
      connected: connectedAudit,
      running: runningAudit,
      demand: demandAudit,
      coincident: coincidentAudit,
      diversified: diversifiedAudit,
      apparentKVA: apparentAudit,
      reactiveKVAR: reactiveAudit,
      fullLoadCurrent: flcAudit,
      lockedRotorCurrent: lrcAudit,
      surgePower: surgeAudit,
      dailyEnergyWh: dailyAudit,
      annualEnergyWh: annualAudit,
      loadFactor: lfAudit,
    },
    layer5_warnings: warnings,
  };
}

// =======================================================================
//  SYSTEM-LEVEL AGGREGATION (with full audit)
// =======================================================================
export interface SystemAudit {
  totalConnected: AuditMetadata;
  totalRunning: AuditMetadata;
  totalDemand: AuditMetadata;
  totalCoincident: AuditMetadata;
  totalDiversified: AuditMetadata;
  totalDailyEnergy: AuditMetadata;
  totalAnnualEnergy: AuditMetadata;
  peakDemand: AuditMetadata;
  estimatedMaxCurrent: AuditMetadata;
  totalSurge: AuditMetadata;
  loadFactor: AuditMetadata;
  phantomLoss: AuditMetadata;
  criticalLoadEnergy: AuditMetadata;
  deferrableEnergy: AuditMetadata;
  policiesUsed: string[];
  confidenceBreakdown: { High: number; Medium: number; Low: number };
}

export function calculateSystemAudit(perLoadAudits: LoadCalculation[]): SystemAudit {
  const ts = new Date().toISOString();
  const sum = (key: keyof LoadCalculation['layer4_derived']): number =>
    perLoadAudits.reduce((s, l) => s + (l.layer4_derived[key].value as number), 0);
  void sum;

  const connected = sum('connected');
  const running = sum('running');
  const demand = sum('demand');
  const coincident = sum('coincident');
  const diversified = sum('diversified');
  const daily = sum('dailyEnergyWh');
  const annual = sum('annualEnergyWh');
  const surge = sum('surgePower');

  const peakHourly = perLoadAudits.reduce((max, l) => Math.max(max, l.layer4_derived.connected.value as number), 0);
  const lf = daily / 24 / Math.max(1, peakHourly) * 100;

  const policiesUsed = Array.from(new Set(perLoadAudits.flatMap(l => Object.values(l.layer4_derived).map(m => m.policyId).filter((p): p is string => Boolean(p)))));
  const confBreakdown = { High: 0, Medium: 0, Low: 0 };
  perLoadAudits.forEach(l => {
    const c = l.layer4_derived.connected.confidence;
    if (c in confBreakdown) confBreakdown[c as keyof typeof confBreakdown]++;
  });

  const meta = (formula: string, inputs: Record<string, number | string>, value: number, unit: string, conf: 'High' | 'Medium' | 'Low' = 'High', policyId?: string): AuditMetadata => ({
    value, unit, formula, inputs, confidence: conf, timestamp: ts, trace: ['System-level aggregation'], policyId,
  });

  return {
    totalConnected: meta('Σ connected_i', { loads: perLoadAudits.length }, connected, 'W'),
    totalRunning: meta('Σ running_i', { loads: perLoadAudits.length }, running, 'W'),
    totalDemand: meta('Σ demand_i', { loads: perLoadAudits.length }, demand, 'W'),
    totalCoincident: meta('Σ coincident_i', { loads: perLoadAudits.length }, coincident, 'W'),
    totalDiversified: meta('Σ diversified_i', { loads: perLoadAudits.length }, diversified, 'W'),
    totalDailyEnergy: meta('Σ daily_i', { loads: perLoadAudits.length }, daily, 'Wh'),
    totalAnnualEnergy: meta('Σ annual_i', { loads: perLoadAudits.length }, annual, 'Wh'),
    peakDemand: meta('max(connected_i)', { loads: perLoadAudits.length }, peakHourly, 'W'),
    estimatedMaxCurrent: meta('peakDemand / (V × PF × √3 if 3Ø)', { peakHourly, v: 220 }, peakHourly / (220 * 0.85 * 1.732), 'A'),
    totalSurge: meta('Σ surge_i', { loads: perLoadAudits.length }, surge, 'W'),
    loadFactor: meta('(daily / 24) / peak × 100', { daily, peakHourly }, lf, '%'),
    phantomLoss: meta('Σ (phantom × qty × 24)', {}, 0, 'Wh', 'High'),
    criticalLoadEnergy: meta('Σ daily where criticality ∈ {Critical, Essential}', { loads: perLoadAudits.length }, 0, 'Wh'),
    deferrableEnergy: meta('Σ daily where deferrableLoad=true', { loads: perLoadAudits.length }, 0, 'Wh'),
    policiesUsed,
    confidenceBreakdown: confBreakdown,
  };
}

function clamp(v: number, min: number, max: number): number {
  if (isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}
