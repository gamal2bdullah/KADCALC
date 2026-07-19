// =======================================================================
//  Multi-Layer Validation Engine
//  Severity levels: error > warning > advisory > info > assumption
//  Every result carries: ruleId, field, message, severity, source,
//  fixSuggestion, relatedFormula, affectedMetric
// =======================================================================

import type { Load } from '../../types';

export type Severity = 'error' | 'warning' | 'advisory' | 'info' | 'assumption';

export interface ValidationResult {
  ruleId: string;
  field: string;
  message: string;
  severity: Severity;
  source: string;
  fixSuggestion: string;
  relatedFormula?: string;
  affectedMetric?: string;
  loadId?: string;
  loadName?: string;
  autoFixable?: boolean;
}

export interface ValidationRule {
  ruleId: string;
  name: string;
  description: string;
  severity: Severity;
  autoFixable?: boolean;
  check: (load: Load) => ValidationResult | null;
}

// =======================================================================
//  THE RULES
// =======================================================================
export const RULES: ValidationRule[] = [
  // ---- ERRORS (block save) ----
  {
    ruleId: 'E001',
    name: 'Required Field: Load Name',
    description: 'Every load must have a name',
    severity: 'error',
    autoFixable: false,
    check: (l) => (!l.loadName ? {
      ruleId: 'E001', field: 'loadName', message: 'Load name is required', severity: 'error',
      source: 'Validation Engine v1.0', fixSuggestion: 'Provide a descriptive name (e.g., "AC Living Room 1")',
    } : null),
  },
  {
    ruleId: 'E002',
    name: 'Required Field: Rated Power',
    description: 'Rated power must be > 0',
    severity: 'error',
    autoFixable: false,
    check: (l) => (l.ratedPowerW <= 0 ? {
      ruleId: 'E002', field: 'ratedPowerW', message: `Rated power must be > 0 (got ${l.ratedPowerW})`, severity: 'error',
      source: 'Calculation Engine', fixSuggestion: 'Enter the nameplate rated power from the appliance spec',
      relatedFormula: 'connected = ratedPowerW × quantity',
    } : null),
  },
  {
    ruleId: 'E003',
    name: 'Power Factor Range',
    description: 'PF must be in (0, 1]',
    severity: 'error',
    autoFixable: true,
    check: (l) => (l.powerFactor <= 0 || l.powerFactor > 1 ? {
      ruleId: 'E003', field: 'powerFactor', message: `PF ${l.powerFactor} outside (0, 1]`, severity: 'error',
      source: 'IEEE 141', fixSuggestion: 'Use 0.85 for motors, 0.95 for resistive/LED, 0.65 for SMPS',
      relatedFormula: 'kVA = P / (PF × 1000)',
    } : null),
  },
  {
    ruleId: 'E004',
    name: 'Efficiency Range',
    description: 'Efficiency must be 0-100%',
    severity: 'error',
    autoFixable: true,
    check: (l) => (l.efficiency < 0 || l.efficiency > 100 ? {
      ruleId: 'E004', field: 'efficiency', message: `Efficiency ${l.efficiency}% outside 0-100`, severity: 'error',
      source: 'Physics', fixSuggestion: 'Use 85-95% for modern equipment',
    } : null),
  },
  {
    ruleId: 'E005',
    name: 'Quantity Positive',
    description: 'Quantity must be ≥ 1',
    severity: 'error',
    autoFixable: true,
    check: (l) => (l.quantity < 1 ? {
      ruleId: 'E005', field: 'quantity', message: `Quantity ${l.quantity} must be ≥ 1`, severity: 'error',
      source: 'Validation Engine', fixSuggestion: 'Use 1 or greater',
    } : null),
  },

  // ---- WARNINGS (visible but don't block) ----
  {
    ruleId: 'W001',
    name: 'Running Exceeds Rated',
    description: 'Running power should not exceed rated by >5%',
    severity: 'warning',
    autoFixable: true,
    check: (l) => (l.runningPowerW > l.ratedPowerW * 1.05 ? {
      ruleId: 'W001', field: 'runningPowerW', message: `Running ${l.runningPowerW}W exceeds rated ${l.ratedPowerW}W by ${(((l.runningPowerW / l.ratedPowerW) - 1) * 100).toFixed(0)}%`, severity: 'warning',
      source: 'Physics / Nameplate Convention', fixSuggestion: 'Re-verify: running should be ≤ rated. If actual over-rated, increase nameplate',
      relatedFormula: 'running ≤ rated',
    } : null),
  },
  {
    ruleId: 'W002',
    name: 'High THD — Harmonic Filter Recommended',
    description: 'THD > 15% requires filtering',
    severity: 'warning',
    autoFixable: false,
    check: (l) => (l.thdPercent > 15 ? {
      ruleId: 'W002', field: 'thdPercent', message: `THD ${l.thdPercent}% exceeds 15% policy threshold`, severity: 'warning',
      source: 'IEEE 519', fixSuggestion: 'Install passive/active harmonic filter or use low-THD equipment',
      relatedFormula: 'THD_derate = 0.9 if THD > 15%',
      affectedMetric: 'apparentKVA, fullLoadCurrent',
    } : null),
  },
  {
    ruleId: 'W003',
    name: 'Criticality Mismatch',
    description: 'Continuous load marked as Optional is inconsistent',
    severity: 'warning',
    autoFixable: true,
    check: (l) => (l.continuousLoad && l.criticality === 'Optional' ? {
      ruleId: 'W003', field: 'criticality', message: 'Continuous load marked as Optional — inconsistent', severity: 'warning',
      source: 'Validation Engine', fixSuggestion: 'Mark as Critical or Essential if load runs 24/7',
    } : null),
  },
  {
    ruleId: 'W004',
    name: 'Operating Hours Exceed 24',
    description: 'dayHours + nightHours > 24 indicates overlap',
    severity: 'warning',
    autoFixable: true,
    check: (l) => ((l.dayHoursSummer + l.nightHoursSummer) > 24 || (l.dayHoursWinter + l.nightHoursWinter) > 24 ? {
      ruleId: 'W004', field: 'hours', message: `Operating hours > 24: summer=${l.dayHoursSummer + l.nightHoursSummer}h, winter=${l.dayHoursWinter + l.nightHoursWinter}h`, severity: 'warning',
      source: 'Validation Engine', fixSuggestion: 'Verify day/night hours do not overlap',
    } : null),
  },
  {
    ruleId: 'W005',
    name: 'Simultaneous Units Exceed Quantity',
    description: 'maxSimultaneousUnits > quantity is impossible',
    severity: 'warning',
    autoFixable: true,
    check: (l) => (l.maxSimultaneousUnits > l.quantity ? {
      ruleId: 'W005', field: 'maxSimultaneousUnits', message: `maxSimultaneous=${l.maxSimultaneousUnits} > quantity=${l.quantity}`, severity: 'warning',
      source: 'Validation Engine', fixSuggestion: 'Set maxSimultaneousUnits ≤ quantity',
    } : null),
  },
  {
    ruleId: 'W006',
    name: 'Low Confidence Data Source',
    description: 'Estimated data should be verified',
    severity: 'warning',
    autoFixable: false,
    check: (l) => (l.dataSource === 'Estimated' ? {
      ruleId: 'W006', field: 'dataSource', message: 'Data source is Estimated — confidence is low', severity: 'warning',
      source: 'Data Quality Policy', fixSuggestion: 'Replace with measured or manufacturer data when possible',
    } : null),
  },
  {
    ruleId: 'W007',
    name: 'Surge Exceeds Inverter Tolerance',
    description: 'Surge > 5× peak demand suggests undersized inverter',
    severity: 'warning',
    autoFixable: false,
    check: (l) => (l.surgeMultiplier > 5 && l.ratedPowerW > 1000 ? {
      ruleId: 'W007', field: 'surgeMultiplier', message: `Surge ${l.surgeMultiplier}× for ${l.ratedPowerW}W load — verify inverter can handle`, severity: 'warning',
      source: 'NEC 690.8', fixSuggestion: 'Use soft-starter or VFD for large motor loads',
    } : null),
  },

  // ---- ADVISORIES (recommendations) ----
  {
    ruleId: 'A001',
    name: 'Phantom Load Without Standby Flag',
    description: 'Phantom > 0 but standbyLoad = false',
    severity: 'advisory',
    autoFixable: true,
    check: (l) => (l.phantomLoadW > 0 && !l.standbyLoad ? {
      ruleId: 'A001', field: 'standbyLoad', message: `${l.phantomLoadW}W phantom detected but not flagged as standby`, severity: 'advisory',
      source: 'Data Quality', fixSuggestion: 'Set standbyLoad = true to include in phantom audit',
    } : null),
  },
  {
    ruleId: 'A002',
    name: 'Deferrable Load Not Shifted',
    description: 'Deferrable loads should be flagged to shift to daytime',
    severity: 'advisory',
    autoFixable: false,
    check: (l) => (l.deferrableLoad && !l.shiftableToDaytime ? {
      ruleId: 'A002', field: 'shiftableToDaytime', message: 'Deferrable load not flagged shiftable-to-daytime', severity: 'advisory',
      source: 'Solar Optimization', fixSuggestion: 'Enable shiftableToDaytime to optimize for solar production',
    } : null),
  },
  {
    ruleId: 'A003',
    name: 'Demand Factor Near 1.0',
    description: 'DF > 0.95 may overestimate demand',
    severity: 'advisory',
    autoFixable: false,
    check: (l) => (l.demandFactor > 0.95 && l.dutyCyclePercent < 100 ? {
      ruleId: 'A003', field: 'demandFactor', message: `DF ${l.demandFactor} close to 1.0 with duty ${l.dutyCyclePercent}% — verify`, severity: 'advisory',
      source: 'NEC 220', fixSuggestion: 'DF should reflect the ratio of actual demand to connected load',
    } : null),
  },
  {
    ruleId: 'A004',
    name: 'Motor Without Defined Inrush',
    description: 'Motor loads should specify locked rotor current',
    severity: 'advisory',
    autoFixable: true,
    check: (l) => (l.surgeMultiplier > 1 && l.lockedRotorCurrentA === 0 ? {
      ruleId: 'A004', field: 'lockedRotorCurrentA', message: 'Motor load without LRA — using estimated surge', severity: 'advisory',
      source: 'NEC 430', fixSuggestion: 'Enter LRA from motor nameplate for precise surge calculation',
    } : null),
  },

  // ---- INFO (data facts) ----
  {
    ruleId: 'I001',
    name: 'High-Confidence Data',
    description: 'Data sourced from measured values',
    severity: 'info',
    autoFixable: false,
    check: (l) => (l.dataSource === 'Measured' ? {
      ruleId: 'I001', field: 'dataSource', message: 'High-confidence: data measured directly', severity: 'info',
      source: 'Data Quality', fixSuggestion: '—',
    } : null),
  },
  {
    ruleId: 'I002',
    name: 'Manufacturer Verified',
    description: 'Data sourced from manufacturer datasheet',
    severity: 'info',
    autoFixable: false,
    check: (l) => (l.dataSource === 'Manufacturer' ? {
      ruleId: 'I002', field: 'dataSource', message: 'Data verified from manufacturer', severity: 'info',
      source: 'Data Quality', fixSuggestion: '—',
    } : null),
  },
  {
    ruleId: 'I003',
    name: 'Smart Controlled',
    description: 'Load supports smart control',
    severity: 'info',
    autoFixable: false,
    check: (l) => (l.smartControlled ? {
      ruleId: 'I003', field: 'smartControlled', message: 'Smart-controlled — can be scheduled for demand response', severity: 'info',
      source: 'Smart Grid Policy', fixSuggestion: '—',
    } : null),
  },

  // ---- ASSUMPTIONS (declared defaults in use) ----
  {
    ruleId: 'AS001',
    name: 'Default Surge Multiplier Applied',
    description: 'Surge multiplier not user-specified — default used',
    severity: 'assumption',
    autoFixable: false,
    check: (l) => (l.surgeMultiplier === 1 && l.ratedPowerW > 0 && l.surgeMultiplier === 1 ? {
      ruleId: 'AS001', field: 'surgeMultiplier', message: 'Surge = 1× — assuming no inrush (resistive or PFC-equipped)', severity: 'assumption',
      source: 'Assumption Policy', fixSuggestion: 'For motors, set actual surge multiplier (3-7×)',
    } : null),
  },
  {
    ruleId: 'AS002',
    name: 'Default Operating Hours',
    description: 'Operating hours not fully specified — defaults used',
    severity: 'assumption',
    autoFixable: false,
    check: (l) => ((l.dayHoursSummer + l.nightHoursSummer) === 8 && (l.dayHoursWinter + l.nightHoursWinter) === 8 ? {
      ruleId: 'AS002', field: 'hours', message: 'Default 8h/day (4d + 4n) used for summer/winter', severity: 'assumption',
      source: 'PROFILE-DAY-SUMMER / PROFILE-NIGHT-SUMMER', fixSuggestion: 'Adjust to actual usage pattern',
    } : null),
  },
  // ---- ADDITIONAL RULES — 30+ ----
  {
    ruleId: 'W008',
    name: 'Inverter Cannot Handle Aggregate Surge',
    description: 'Sum of all surges exceeds 5× peak demand — inverter undersized',
    severity: 'warning',
    autoFixable: false,
    check: (l) => {
      // Per-load heuristic: surge > 5× and > 1000W
      if (l.surgeMultiplier >= 5 && l.ratedPowerW >= 1000) {
        return {
          ruleId: 'W008', field: 'surgePowerW', message: `Surge ${(l.ratedPowerW * l.surgeMultiplier * l.quantity).toFixed(0)}W from this single load may exceed inverter rating`, severity: 'warning',
          source: 'NEC 690.8', fixSuggestion: 'Oversize inverter to 1.5× peak or use soft-starter',
          relatedFormula: 'inverter ≥ 1.25 × peak demand',
        };
      }
      return null;
    },
  },
  {
    ruleId: 'W009',
    name: 'Demand Factor Too Close to 1.0',
    description: 'DF ≥ 0.95 with low duty cycle is inconsistent',
    severity: 'warning',
    autoFixable: false,
    check: (l) => (l.demandFactor >= 0.95 && l.dutyCyclePercent < 30 ? {
      ruleId: 'W009', field: 'demandFactor', message: `DF ${l.demandFactor} but duty only ${l.dutyCyclePercent}% — re-check`, severity: 'warning',
      source: 'NEC 220.42', fixSuggestion: 'DF should reflect actual simultaneity; low duty = lower DF',
    } : null),
  },
  {
    ruleId: 'W010',
    name: 'Negative Energy Risk',
    description: 'Hours × duty would result in negative or zero energy',
    severity: 'warning',
    autoFixable: false,
    check: (l) => ((l.dayHoursSummer + l.nightHoursSummer) === 0 ? {
      ruleId: 'W010', field: 'hours', message: 'No operating hours defined — will produce 0 energy', severity: 'warning',
      source: 'Validation Engine', fixSuggestion: 'Set day/night operating hours',
    } : null),
  },
  {
    ruleId: 'A005',
    name: 'Cycling Load Without Auto-Start',
    description: 'Cycling loads typically need auto-start',
    severity: 'advisory',
    autoFixable: true,
    check: (l) => (l.cyclingLoad && !l.autoStart ? {
      ruleId: 'A005', field: 'autoStart', message: 'Cycling load without auto-start — may not restart after trip', severity: 'advisory',
      source: 'Control Engineering', fixSuggestion: 'Enable autoStart for cycling loads',
    } : null),
  },
  {
    ruleId: 'A006',
    name: 'Critical Load Should Be Deferrable-False',
    description: 'Critical loads should not be deferrable',
    severity: 'advisory',
    autoFixable: true,
    check: (l) => (l.criticality === 'Critical' && l.deferrableLoad ? {
      ruleId: 'A006', field: 'deferrableLoad', message: 'Critical load marked deferrable — may cause outage if shifted', severity: 'advisory',
      source: 'Reliability Engineering', fixSuggestion: 'Set deferrableLoad = false for critical loads',
    } : null),
  },
  {
    ruleId: 'A007',
    name: '3-Phase Load Without Phase Type',
    description: 'High-power load should specify 3Ø if applicable',
    severity: 'advisory',
    autoFixable: true,
    check: (l) => (l.ratedPowerW > 3000 && l.phaseType === '1Ø' ? {
      ruleId: 'A007', field: 'phaseType', message: `${l.ratedPowerW}W 1Ø load — consider 3Ø for balance`, severity: 'advisory',
      source: 'Phase Balancer', fixSuggestion: 'Use 3Ø variant if available',
    } : null),
  },
  {
    ruleId: 'I004',
    name: 'Measured vs Nameplate Match',
    description: 'Measured power should be within 20% of nameplate',
    severity: 'info',
    autoFixable: false,
    check: (l) => {
      if (!(l.measuredPowerW > 0 && l.ratedPowerW > 0)) return null;
      const dev = Math.abs(l.measuredPowerW - l.ratedPowerW) / l.ratedPowerW;
      if (dev > 0.2) {
        return { ruleId: 'I004', field: 'measuredPowerW', message: `Measured ${l.measuredPowerW}W deviates ${(dev*100).toFixed(0)}% from rated ${l.ratedPowerW}W`, severity: 'info' as const, source: 'Data Quality', fixSuggestion: 'Verify nameplate accuracy' };
      }
      return null;
    },
  },
  {
    ruleId: 'AS003',
    name: 'Default Power Factor Used',
    description: 'PF is generic 0.9 — load-specific value recommended',
    severity: 'assumption',
    autoFixable: false,
    check: (l) => (l.powerFactor === 0.9 && (l.ratedPowerW > 100 || l.categoryMain !== 'Lighting') ? {
      ruleId: 'AS003', field: 'powerFactor', message: 'Generic PF 0.9 in use — load-specific recommended for accuracy', severity: 'assumption',
      source: 'PF-RES-MIXED (default)', fixSuggestion: 'Use 0.95 for LED, 0.82 for motors, 0.65 for SMPS',
    } : null),
  },
  {
    ruleId: 'AS004',
    name: 'Estimated Confidence',
    description: 'Using Estimated data source — low confidence',
    severity: 'assumption',
    autoFixable: false,
    check: (l) => (l.confidenceLevel === 'Low' ? {
      ruleId: 'AS004', field: 'confidenceLevel', message: 'Low confidence data — use cautiously for high-stakes decisions', severity: 'assumption',
      source: 'Data Quality Policy', fixSuggestion: 'Replace with measured values when possible',
    } : null),
  },
  {
    ruleId: 'E006',
    name: 'Invalid Voltage',
    description: 'Voltage must be positive',
    severity: 'error',
    autoFixable: true,
    check: (l) => (l.voltageNominal <= 0 ? {
      ruleId: 'E006', field: 'voltageNominal', message: `Voltage ${l.voltageNominal} invalid`, severity: 'error',
      source: 'Validation Engine', fixSuggestion: 'Use 220V (1Ø) or 380V (3Ø) typical',
    } : null),
  },
  {
    ruleId: 'E007',
    name: 'THD Out of Range',
    description: 'THD must be 0-100%',
    severity: 'error',
    autoFixable: true,
    check: (l) => (l.thdPercent < 0 || l.thdPercent > 100 ? {
      ruleId: 'E007', field: 'thdPercent', message: `THD ${l.thdPercent}% outside 0-100`, severity: 'error',
      source: 'Validation Engine', fixSuggestion: 'Set to typical 5-15% for electronic loads',
    } : null),
  },
];

// =======================================================================
//  RUNNER
// =======================================================================
const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0, warning: 1, advisory: 2, info: 3, assumption: 4,
};

export function validateLoad(load: Load): ValidationResult[] {
  return RULES
    .map(rule => rule.check(load))
    .filter((r): r is ValidationResult => r !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function validateAllLoads(loads: Load[]): ValidationResult[] {
  return loads.flatMap(l => validateLoad(l).map(r => ({ ...r, loadId: l.id, loadName: l.loadName || '(unnamed)' })));
}

export function getValidationMatrix(loads: Load[]) {
  const results = validateAllLoads(loads);
  return {
    error: results.filter(r => r.severity === 'error'),
    warning: results.filter(r => r.severity === 'warning'),
    advisory: results.filter(r => r.severity === 'advisory'),
    info: results.filter(r => r.severity === 'info'),
    assumption: results.filter(r => r.severity === 'assumption'),
  };
}

export function getValidationSummary(loads: Load[]): {
  by: Record<Severity, number>;
  total: number;
  blockingErrors: number;
} {
  const matrix = getValidationMatrix(loads);
  const by = {
    error: matrix.error.length,
    warning: matrix.warning.length,
    advisory: matrix.advisory.length,
    info: matrix.info.length,
    assumption: matrix.assumption.length,
  };
  return { by, total: count(matrix.error) + count(matrix.warning) + count(matrix.advisory) + count(matrix.info) + count(matrix.assumption), blockingErrors: matrix.error.length };
}

// Helper: count array
const count = (arr: unknown[]): number => arr.length;
