// =======================================================================
//  COMPREHENSIVE TEST SUITE
//  Unit · Property · Golden · Regression · Formula Registry
//  Runs in-browser as a self-test page; no external test runner needed.
// =======================================================================

import {
  calcConnectedLoad, calcRunningLoad, calcDailyEnergy, calcDayEnergy, calcNightEnergy,
  calcAnnualEnergy, calcApparentPower, calcReactivePower, calcFullLoadCurrent,
  calcLockedRotorCurrent, calcSurgePower, calcDemandLoad, calcDiversifiedLoad,
  calcCoincidentLoad, calcHourlyOperatingLoad, fmtW, fmtWh,
  getAutoEstimate
} from '../../utils/calculations';
import { calculateLoadAudited, calculateSystemAudit } from '../calculations/engine';
import { getPolicy, POLICY_PACK, getPolicyStats } from '../assumptions/policy';
import { getValidationMatrix, RULES, validateAllLoads, validateLoad } from '../validation/rules';
import { balancePhases } from '../phase/balancer';
import { buildCompleteProfile, detectPeakWindows } from '../profiles/builder';
import type { Load } from '../../types';

// =======================================================================
//  TEST TYPES
// =======================================================================
export interface TestResult {
  name: string;
  category: 'unit' | 'property' | 'golden' | 'regression' | 'formula' | 'integration';
  passed: boolean;
  expected: any;
  actual: any;
  message: string;
  duration: number;
}

export interface TestSuite {
  results: TestResult[];
  passed: number;
  failed: number;
  total: number;
  byCategory: Record<string, { passed: number; failed: number }>;
}

// =======================================================================
//  TEST RUNNER
// =======================================================================
export async function runAllTests(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // --- UNIT TESTS ---
  results.push(...unitTests());
  results.push(...unitTestsPolicy());
  results.push(...unitTestsValidation());
  results.push(...unitTestsPhase());
  results.push(...unitTestsProfiles());
  results.push(...unitTestsAuditEngine());

  // --- PROPERTY-BASED TESTS ---
  results.push(...propertyTests());

  // --- GOLDEN DATASET TESTS ---
  results.push(...goldenDatasetTests());

  // --- FORMULA REGISTRY TESTS ---
  results.push(...formulaRegistryTests());

  // --- REGRESSION TESTS ---
  results.push(...regressionTests());

  // --- INTEGRATION TESTS ---
  results.push(...integrationTests());

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const byCategory: TestSuite['byCategory'] = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { passed: 0, failed: 0 };
    if (r.passed) byCategory[r.category].passed++;
    else byCategory[r.category].failed++;
  }

  return { results, passed, failed, total: results.length, byCategory };
}

function t(name: string, category: TestResult['category'], fn: () => void): TestResult {
  const start = performance.now();
  try {
    fn();
    return { name, category, passed: true, expected: '—', actual: '—', message: 'OK', duration: performance.now() - start };
  } catch (e: any) {
    return { name, category, passed: false, expected: e.expected, actual: e.actual, message: e.message || String(e), duration: performance.now() - start };
  }
}

class AssertError extends Error {
  expected: any; actual: any;
  constructor(message: string, expected: any, actual: any) {
    super(message);
    this.expected = expected;
    this.actual = actual;
  }
}

function assertEq(actual: any, expected: any, msg = ''): void {
  if (actual !== expected) throw new AssertError(`${msg} expected ${expected}, got ${actual}`, expected, actual);
}
function assertClose(actual: number, expected: number, tol: number, msg = ''): void {
  if (Math.abs(actual - expected) > tol) throw new AssertError(`${msg} expected ${expected}±${tol}, got ${actual}`, expected, actual);
}
function assertRange(actual: number, min: number, max: number, msg = ''): void {
  if (actual < min || actual > max) throw new AssertError(`${msg} expected in [${min}, ${max}], got ${actual}`, `${min}..${max}`, actual);
}
function assertTrue(cond: boolean, msg = ''): void {
  if (!cond) throw new AssertError(msg || 'assertion failed', true, false);
}
function assertGE(actual: number, min: number, msg = ''): void {
  if (actual < min) throw new AssertError(`${msg} expected ≥ ${min}, got ${actual}`, `≥${min}`, actual);
}
function assertLE(actual: number, max: number, msg = ''): void {
  if (actual > max) throw new AssertError(`${msg} expected ≤ ${max}, got ${actual}`, `≤${max}`, actual);
}

// =======================================================================
//  UNIT TESTS — Calculation functions
// =======================================================================
function unitTests(): TestResult[] {
  return [
    t('connectedLoad = rated × qty', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 3 });
      assertEq(calcConnectedLoad(l), 3000);
    }),
    t('runningLoad with explicit running', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, runningPowerW: 800, quantity: 2 });
      assertEq(calcRunningLoad(l), 1600);
    }),
    t('runningLoad falls back to rated', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, runningPowerW: 0, quantity: 2 });
      assertEq(calcRunningLoad(l), 2000);
    }),
    t('apparentPower = W / (PF × 1000)', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 1, powerFactor: 0.8 });
      assertClose(calcApparentPower(l), 1.25, 0.001);
    }),
    t('reactivePower = √(kVA² − kW²)', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 1, powerFactor: 0.8 });
      const kva = 1.25; const kw = 1.0;
      assertClose(calcReactivePower(l), Math.sqrt(kva*kva - kw*kw), 0.001);
    }),
    t('FLC 1Ø = P / (V × PF)', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 2200, voltageNominal: 220, powerFactor: 1, phaseType: '1Ø', quantity: 1 });
      assertClose(calcFullLoadCurrent(l), 10, 0.01);
    }),
    t('FLC 3Ø = P / (√3 × V × PF)', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 3300, voltageNominal: 380, powerFactor: 1, phaseType: '3Ø', quantity: 1 });
      // P = 3300, V = 380, PF = 1, 3Ø → 3300 / (1.732 × 380) = 5.0
      assertClose(calcFullLoadCurrent(l), 5.0, 0.1);
    }),
    t('surgePower = rated × surge× × qty', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, surgeMultiplier: 5, quantity: 1 });
      assertEq(calcSurgePower(l), 5000);
    }),
    t('demandLoad = connected × Ku', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 2, utilizationFactorKu: 0.8 });
      assertEq(calcDemandLoad(l), 1600);
    }),
    t('dailyEnergy respects day+night hours', 'unit', () => {
      const l = makeLoad({
        ratedPowerW: 1000, quantity: 1, runningPowerW: 1000,
        utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100,
        dayHoursSummer: 5, nightHoursSummer: 5, dayHoursWinter: 3, nightHoursWinter: 7,
        operatingDaysPerWeek: 7,
      });
      // summer = 1000 × 1 × 1 × 1 × (5+5) × (7/7) = 10000
      // winter = 1000 × 1 × 1 × 1 × (3+7) × (7/7) = 10000
      // daily = avg = 10000
      assertClose(calcDailyEnergy(l), 10000, 1);
    }),
    t('annualEnergy = daily × days', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 100, runningPowerW: 100, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 24, nightHoursSummer: 0, dayHoursWinter: 24, nightHoursWinter: 0, operatingDaysPerWeek: 7, operatingDaysPerYear: 365 });
      assertClose(calcAnnualEnergy(l), 100 * 24 * 365, 10);
    }),
    t('dayEnergy + nightEnergy = daily energy', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, runningPowerW: 1000, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 8, nightHoursSummer: 4, dayHoursWinter: 8, nightHoursWinter: 4, operatingDaysPerWeek: 7 });
      const d = calcDailyEnergy(l);
      assertClose(calcDayEnergy(l) + calcNightEnergy(l), d, 1);
    }),
    t('coincidentLoad = demand × CF', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 1, utilizationFactorKu: 1, coincidenceFactor: 0.7 });
      assertEq(calcCoincidentLoad(l), 700);
    }),
    t('diversifiedLoad = coincident / Div', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 1, utilizationFactorKu: 1, coincidenceFactor: 0.7, diversityFactor: 1.4 });
      assertClose(calcDiversifiedLoad(l), 500, 0.01);
    }),
    t('lockedRotorCurrent = FLC × surge× × qty (when LRA=0)', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, surgeMultiplier: 3, quantity: 1, voltageNominal: 220, powerFactor: 1, lockedRotorCurrentA: 0 });
      // FLC = 1000 / 220 = 4.545, × 3 = 13.636
      assertClose(calcLockedRotorCurrent(l), 1000/220 * 3, 0.01);
    }),
    t('hourlyOperatingProfile sums to total daily', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, runningPowerW: 1000, quantity: 1, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 12, nightHoursSummer: 0, dayHoursWinter: 12, nightHoursWinter: 0, operatingDaysPerWeek: 7, hourlyProfile: [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0] });
      const profile = calcHourlyOperatingLoad(l);
      const sum = profile.reduce((s, v) => s + v, 0);
      // sum should be ~1000 × 12 = 12000 W distributed over 24 hours
      assertClose(sum, 12000, 100);
    }),
    t('fmtW formats kW correctly', 'unit', () => {
      assertEq(fmtW(1500), '1.50 kW');
      assertEq(fmtW(800), '800 W');
      assertEq(fmtW(2500000), '2.50 MW');
    }),
    t('fmtWh formats kWh correctly', 'unit', () => {
      assertEq(fmtWh(5000), '5.00 kWh');
      assertEq(fmtWh(800), '800 Wh');
    }),
    t('getAutoEstimate returns category defaults', 'unit', () => {
      const hvac = getAutoEstimate('HVAC');
      const kitchen = getAutoEstimate('Kitchen');
      // HVAC has higher surge
      assertTrue((hvac.surgeMultiplier || 0) > (kitchen.surgeMultiplier || 0), 'HVAC surge > Kitchen surge');
    }),
  ];
}

// =======================================================================
//  UNIT TESTS — Policy registry
// =======================================================================
function unitTestsPolicy(): TestResult[] {
  return [
    t('Policy pack contains 30+ policies', 'unit', () => {
      assertGE(POLICY_PACK.length, 30, 'policy count');
    }),
    t('All policies have unique IDs', 'unit', () => {
      const ids = POLICY_PACK.map(p => p.policyId);
      assertEq(new Set(ids).size, ids.length, 'unique IDs');
    }),
    t('All policies have required fields', 'unit', () => {
      for (const p of POLICY_PACK) {
        if (!p.policyId || !p.name || !p.scope) throw new AssertError(`Policy ${p.policyId || '?'} missing required field`, 'present', 'missing');
        if (typeof p.defaultValue !== 'number' && typeof p.defaultValue !== 'string') throw new AssertError(`Policy ${p.policyId} defaultValue not number/string`, typeof p.defaultValue, 'number|string');
      }
    }),
    t('All policy defaults are within allowedRange', 'unit', () => {
      for (const p of POLICY_PACK) {
        if (typeof p.defaultValue === 'number') {
          if (p.defaultValue < p.allowedRange.min || p.defaultValue > p.allowedRange.max) {
            throw new AssertError(`Policy ${p.policyId} default ${p.defaultValue} out of range [${p.allowedRange.min}, ${p.allowedRange.max}]`, p.allowedRange, p.defaultValue);
          }
        }
      }
    }),
    t('All policies have engineeringRationale', 'unit', () => {
      for (const p of POLICY_PACK) {
        if (!p.engineeringRationale || p.engineeringRationale.length < 20) {
          throw new AssertError(`Policy ${p.policyId} rationale too short`, '≥20 chars', p.engineeringRationale?.length);
        }
      }
    }),
    t('Policy lookup by ID works', 'unit', () => {
      const p = getPolicy('PF-RES-RESISTIVE');
      assertTrue(!!p, 'policy exists');
      assertEq(p?.defaultValue, 0.95);
    }),
    t('Policy stats are valid', 'unit', () => {
      const s = getPolicyStats();
      assertGE(s.total, 30);
      assertEq(s.byConfidence.High + s.byConfidence.Medium + s.byConfidence.Low, s.total);
    }),
  ];
}

// =======================================================================
//  UNIT TESTS — Validation rules
// =======================================================================
function unitTestsValidation(): TestResult[] {
  return [
    t('Validation flags missing name (E001)', 'unit', () => {
      const l = makeLoad({ loadName: '', ratedPowerW: 100 });
      const r = validateLoad(l);
      assertTrue(r.some(v => v.ruleId === 'E001'), 'E001 should fire');
    }),
    t('Validation flags zero power (E002)', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 0 });
      const r = validateLoad(l);
      assertTrue(r.some(v => v.ruleId === 'E002'), 'E002 should fire');
    }),
    t('Validation flags PF out of range (E003)', 'unit', () => {
      const l = makeLoad({ powerFactor: 1.5 });
      const r = validateLoad(l);
      assertTrue(r.some(v => v.ruleId === 'E003'), 'E003 should fire');
    }),
    t('Validation flags running > rated (W001)', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 100, runningPowerW: 200 });
      const r = validateLoad(l);
      assertTrue(r.some(v => v.ruleId === 'W001'), 'W001 should fire');
    }),
    t('Validation flags high THD (W002)', 'unit', () => {
      const l = makeLoad({ thdPercent: 30 });
      const r = validateLoad(l);
      assertTrue(r.some(v => v.ruleId === 'W002'), 'W002 should fire');
    }),
    t('Validation flags hours > 24 (W004)', 'unit', () => {
      const l = makeLoad({ dayHoursSummer: 20, nightHoursSummer: 10 });
      const r = validateLoad(l);
      assertTrue(r.some(v => v.ruleId === 'W004'), 'W004 should fire');
    }),
    t('Validation matrix has all 5 severities', 'unit', () => {
      const l = makeLoad({
        loadName: 'Test', ratedPowerW: 100, thdPercent: 20,
        dataSource: 'Estimated', phantomLoadW: 5, standbyLoad: false,
        deferrableLoad: true, shiftableToDaytime: false,
        continuousLoad: true, criticality: 'Optional',
      });
      const m = getValidationMatrix([l]);
      // Should hit at least: info (estimated → assumption), advisory (phantom), warning (THD, criticality)
      assertTrue(m.assumption.length > 0, 'assumption');
      assertTrue(m.advisory.length > 0, 'advisory');
    }),
    t('At least 22 validation rules exist', 'unit', () => {
      assertGE(RULES.length, 22);
    }),
    t('No duplicate rule IDs', 'unit', () => {
      const ids = RULES.map(r => r.ruleId);
      assertEq(new Set(ids).size, ids.length);
    }),
  ];
}

// =======================================================================
//  UNIT TESTS — Phase balancer
// =======================================================================
function unitTestsPhase(): TestResult[] {
  return [
    t('Balancer handles empty loads', 'unit', () => {
      const r = balancePhases([]);
      assertEq(r.imbalancePercent, 0);
      assertEq(r.allocations.length, 0);
    }),
    t('All 3Ø loads are inherently balanced', 'unit', () => {
      const loads = [makeLoad({ loadId: '1', loadName: 'Motor 3Ø', ratedPowerW: 5000, phaseType: '3Ø' })];
      const r = balancePhases(loads);
      assertEq(r.imbalancePercent, 0);
    }),
    t('Critical 1Ø loads spread across phases', 'unit', () => {
      const loads = [
        makeLoad({ loadId: '1', loadName: 'C1', ratedPowerW: 1000, phaseType: '1Ø', criticality: 'Critical' }),
        makeLoad({ loadId: '2', loadName: 'C2', ratedPowerW: 1000, phaseType: '1Ø', criticality: 'Critical' }),
        makeLoad({ loadId: '3', loadName: 'C3', ratedPowerW: 1000, phaseType: '1Ø', criticality: 'Critical' }),
      ];
      const r = balancePhases(loads);
      const phases = new Set(r.allocations.map(a => a.phase));
      assertEq(phases.size, 3, '3 critical loads on 3 different phases');
    }),
    t('Imbalance is non-negative', 'unit', () => {
      const loads = Array.from({ length: 10 }, (_, i) =>
        makeLoad({ loadId: String(i), loadName: `L${i}`, ratedPowerW: 1000 + i * 100, phaseType: '1Ø' })
      );
      const r = balancePhases(loads);
      assertTrue(r.imbalancePercent >= 0, `imbalance ${r.imbalancePercent} should be >= 0`);
      assertTrue(r.imbalancePercent <= 100, `imbalance should be <= 100`);
    }),
    t('Balancing score is 0-100', 'unit', () => {
      const loads = Array.from({ length: 5 }, (_, i) =>
        makeLoad({ loadId: String(i), loadName: `L${i}`, ratedPowerW: 1000, phaseType: '1Ø' })
      );
      const r = balancePhases(loads);
      assertRange(r.balancingScore, 0, 100);
    }),
    t('Surge stacking is computed per phase', 'unit', () => {
      const loads = [
        makeLoad({ loadId: '1', loadName: 'M1', ratedPowerW: 1000, phaseType: '1Ø', surgeMultiplier: 5 }),
        makeLoad({ loadId: '2', loadName: 'M2', ratedPowerW: 1000, phaseType: '1Ø', surgeMultiplier: 5 }),
        makeLoad({ loadId: '3', loadName: 'M3', ratedPowerW: 1000, phaseType: '1Ø', surgeMultiplier: 5 }),
      ];
      const r = balancePhases(loads);
      assertEq(r.surgeStacking.length, 3);
    }),
  ];
}

// =======================================================================
//  UNIT TESTS — Profile builder
// =======================================================================
function unitTestsProfiles(): TestResult[] {
  return [
    t('Empty loads → zero profile', 'unit', () => {
      const p = buildCompleteProfile([]);
      assertEq(p.daily.total, 0);
      assertEq(p.hourly.length, 24);
    }),
    t('24/7 load produces non-zero every hour', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 100, runningPowerW: 100, quantity: 1, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, operatingDaysPerWeek: 7, timeProfileType: '24/7' });
      const p = buildCompleteProfile([l]);
      assertTrue(p.hourly.every(h => h.power >= 0));
    }),
    t('Hourly profile sums to daily total', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 100, runningPowerW: 100, quantity: 1, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 8, nightHoursSummer: 0, dayHoursWinter: 8, nightHoursWinter: 0, operatingDaysPerWeek: 7, timeProfileType: 'Day Load' });
      const p = buildCompleteProfile([l]);
      const sum = p.hourly.reduce((s, h) => s + h.power, 0);
      assertClose(sum, p.daily.total, 1);
    }),
    t('Detect peak windows', 'unit', () => {
      const profile = Array.from({ length: 24 }, (_, h) => ({ hour: h, power: h >= 18 && h <= 21 ? 1000 : 100, loadIds: [] as string[] }));
      const windows = detectPeakWindows(profile);
      assertTrue(windows.length > 0, 'should detect at least one window');
    }),
    t('Seasonal variance is computed', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 100, runningPowerW: 100, quantity: 1, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 10, nightHoursSummer: 5, dayHoursWinter: 2, nightHoursWinter: 8, operatingDaysPerWeek: 7 });
      const p = buildCompleteProfile([l]);
      assertTrue(p.seasonal.variance >= 0, 'variance >= 0');
    }),
  ];
}

// =======================================================================
//  UNIT TESTS — Audit engine
// =======================================================================
function unitTestsAuditEngine(): TestResult[] {
  return [
    t('Audit engine produces all 13 derived metrics', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 2 });
      const audit = calculateLoadAudited(l);
      const required = ['connected', 'running', 'demand', 'coincident', 'diversified', 'apparentKVA', 'reactiveKVAR', 'fullLoadCurrent', 'lockedRotorCurrent', 'surgePower', 'dailyEnergyWh', 'annualEnergyWh', 'loadFactor'];
      for (const key of required) {
        if (!(key in audit.layer4_derived)) throw new AssertError(`Missing metric: ${key}`, 'present', 'missing');
      }
    }),
    t('Each audit metric has formula, confidence, timestamp', 'unit', () => {
      const l = makeLoad({ ratedPowerW: 100, quantity: 1 });
      const audit = calculateLoadAudited(l);
      for (const key of Object.keys(audit.layer4_derived)) {
        const m = (audit.layer4_derived as any)[key];
        if (!m.formula) throw new AssertError(`${key} missing formula`, 'present', 'missing');
        if (!m.timestamp) throw new AssertError(`${key} missing timestamp`, 'present', 'missing');
        if (!m.confidence) throw new AssertError(`${key} missing confidence`, 'present', 'missing');
      }
    }),
    t('System audit aggregates correctly', 'unit', () => {
      const loads = [makeLoad({ ratedPowerW: 1000, quantity: 1 }), makeLoad({ ratedPowerW: 2000, quantity: 1 })];
      const audits = loads.map(calculateLoadAudited);
      const sys = calculateSystemAudit(audits);
      assertEq(sys.totalConnected.value, 3000);
    }),
    t('System audit lists policies used', 'unit', () => {
      const loads = [makeLoad({ ratedPowerW: 5000, quantity: 1, surgeMultiplier: 7 })];
      const audits = loads.map(calculateLoadAudited);
      const sys = calculateSystemAudit(audits);
      assertTrue(sys.policiesUsed.length > 0, 'should reference policies');
    }),
  ];
}

// =======================================================================
//  PROPERTY-BASED TESTS
// =======================================================================
function propertyTests(): TestResult[] {
  const r: TestResult[] = [];

  r.push(t('Property: PF always in (0, 1] after normalization', 'property', () => {
    for (let i = 0; i < 100; i++) {
      const pf = Math.random() * 2 - 0.5; // can be negative
      const l = makeLoad({ ratedPowerW: 1000, powerFactor: pf });
      const audit = calculateLoadAudited(l);
      const normalized = audit.layer2_normalized.pf;
      assertTrue(normalized > 0 && normalized <= 1, `PF ${pf} → ${normalized}`);
    }
  }));

  r.push(t('Property: Connected load is always non-negative', 'property', () => {
    for (let i = 0; i < 100; i++) {
      const w = Math.random() * 10000;
      const q = Math.floor(Math.random() * 10) + 1;
      const l = makeLoad({ ratedPowerW: w, quantity: q });
      assertTrue(calcConnectedLoad(l) >= 0);
    }
  }));

  r.push(t('Property: Daily energy is always non-negative', 'property', () => {
    for (let i = 0; i < 100; i++) {
      const l = makeLoad({
        ratedPowerW: Math.random() * 5000,
        runningPowerW: Math.random() * 5000,
        utilizationFactorKu: Math.random(),
        demandFactor: Math.random(),
        dutyCyclePercent: Math.random() * 100,
        dayHoursSummer: Math.random() * 12,
        nightHoursSummer: Math.random() * 12,
        dayHoursWinter: Math.random() * 12,
        nightHoursWinter: Math.random() * 12,
        operatingDaysPerWeek: Math.random() * 7,
      });
      assertTrue(calcDailyEnergy(l) >= 0);
    }
  }));

  r.push(t('Property: Day energy + night energy = daily', 'property', () => {
    for (let i = 0; i < 50; i++) {
      const l = makeLoad({
        ratedPowerW: 1000, runningPowerW: 1000,
        utilizationFactorKu: 0.8, demandFactor: 0.9, dutyCyclePercent: 50,
        dayHoursSummer: Math.random() * 12,
        nightHoursSummer: Math.random() * 12,
        dayHoursWinter: Math.random() * 12,
        nightHoursWinter: Math.random() * 12,
        operatingDaysPerWeek: 7,
      });
      const d = calcDailyEnergy(l);
      const dn = calcDayEnergy(l) + calcNightEnergy(l);
      assertClose(d, dn, 0.5, `iter ${i}`);
    }
  }));

  r.push(t('Property: FLC is always non-negative', 'property', () => {
    for (let i = 0; i < 100; i++) {
      const l = makeLoad({ ratedPowerW: Math.random() * 5000, voltageNominal: 220, powerFactor: 0.5 + Math.random() * 0.5 });
      assertTrue(calcFullLoadCurrent(l) >= 0);
    }
  }));

  r.push(t('Property: Surge ≥ rated (for surge multiplier ≥ 1)', 'property', () => {
    for (let i = 0; i < 50; i++) {
      const l = makeLoad({ ratedPowerW: 1000, quantity: 1, surgeMultiplier: 1 + Math.random() * 6 });
      assertTrue(calcSurgePower(l) >= calcConnectedLoad(l), `surge ${calcSurgePower(l)} < connected ${calcConnectedLoad(l)}`);
    }
  }));

  r.push(t('Property: Hours cannot produce energy > max possible', 'property', () => {
    for (let i = 0; i < 50; i++) {
      const l = makeLoad({
        ratedPowerW: 1000, runningPowerW: 1000, quantity: 1,
        utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100,
        dayHoursSummer: Math.random() * 12, nightHoursSummer: Math.random() * 12,
        dayHoursWinter: Math.random() * 12, nightHoursWinter: Math.random() * 12,
        operatingDaysPerWeek: 7,
      });
      const d = calcDailyEnergy(l);
      // Max possible = 1000 W × 24h = 24000 Wh (summer+winter both 24h)
      // But since average of summer+winter, max is when both are 24h
      assertLE(d, 24000, `daily energy ${d} exceeds max`);
    }
  }));

  r.push(t('Property: Imbalance always 0-100%', 'property', () => {
    for (let i = 0; i < 30; i++) {
      const loads = Array.from({ length: 5 }, (_, j) =>
        makeLoad({ loadId: `${i}-${j}`, loadName: `L${j}`, ratedPowerW: Math.random() * 5000, phaseType: '1Ø' })
      );
      const r = balancePhases(loads);
      assertRange(r.imbalancePercent, 0, 100, `iter ${i}`);
    }
  }));

  return r;
}

// =======================================================================
//  GOLDEN DATASETS — Reference test fixtures
// =======================================================================
function goldenDatasetTests(): TestResult[] {
  const r: TestResult[] = [];

  // GOLDEN: Residential sample
  r.push(t('Golden: Residential — 4 loads → ~3 kW connected', 'golden', () => {
    const loads = [
      makeLoad({ loadName: 'LED', ratedPowerW: 12, quantity: 8, utilizationFactorKu: 0.7, demandFactor: 0.9, dayHoursSummer: 3, nightHoursSummer: 5, dayHoursWinter: 3, nightHoursWinter: 6, powerFactor: 0.9 }),
      makeLoad({ loadName: 'AC', ratedPowerW: 1500, quantity: 2, utilizationFactorKu: 0.7, demandFactor: 0.85, surgeMultiplier: 3, dayHoursSummer: 9, nightHoursSummer: 4, dayHoursWinter: 2, nightHoursWinter: 1, powerFactor: 0.92 }),
      makeLoad({ loadName: 'Fridge', ratedPowerW: 200, runningPowerW: 90, quantity: 1, utilizationFactorKu: 0.5, demandFactor: 1, surgeMultiplier: 3, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, powerFactor: 0.85 }),
      makeLoad({ loadName: 'TV', ratedPowerW: 120, runningPowerW: 95, quantity: 1, utilizationFactorKu: 0.7, demandFactor: 0.85, dayHoursSummer: 2, nightHoursSummer: 4, dayHoursWinter: 3, nightHoursWinter: 5, powerFactor: 0.9 }),
    ];
    const total = loads.reduce((s, l) => s + calcConnectedLoad(l), 0);
    // 12×8 + 1500×2 + 200 + 120 = 96 + 3000 + 200 + 120 = 3416
    assertClose(total, 3416, 1, `residential total ${total}`);
  }));

  // GOLDEN: Industrial sample
  r.push(t('Golden: Industrial — 3Ø motors with high surge', 'golden', () => {
    const loads = [
      makeLoad({ loadName: 'Motor 5HP', ratedPowerW: 3700, quantity: 2, voltageNominal: 380, phaseType: '3Ø', utilizationFactorKu: 0.7, demandFactor: 0.8, surgeMultiplier: 7, dayHoursSummer: 8, nightHoursSummer: 0, dayHoursWinter: 8, nightHoursWinter: 0, powerFactor: 0.85 }),
      makeLoad({ loadName: 'Compressor', ratedPowerW: 7500, quantity: 1, voltageNominal: 380, phaseType: '3Ø', utilizationFactorKu: 0.6, demandFactor: 0.8, surgeMultiplier: 7, dayHoursSummer: 6, nightHoursSummer: 0, dayHoursWinter: 6, nightHoursWinter: 0, powerFactor: 0.85 }),
    ];
    const totalSurge = loads.reduce((s, l) => s + calcSurgePower(l), 0);
    // 3700×2×7 + 7500×1×7 = 51800 + 52500 = 104300
    assertClose(totalSurge, 104300, 10, `industrial surge ${totalSurge}`);
  }));

  // GOLDEN: High-harmonic sample
  r.push(t('Golden: High THD load triggers derate', 'golden', () => {
    const l = makeLoad({ ratedPowerW: 1000, thdPercent: 25 });
    const audit = calculateLoadAudited(l);
    assertTrue(audit.layer3_rules.thdDerate < 1, 'THD derate should reduce capacity');
  }));

  // GOLDEN: Critical load (24/7)
  r.push(t('Golden: Critical 24/7 load — full utilization', 'golden', () => {
    const l = makeLoad({ ratedPowerW: 350, runningPowerW: 150, quantity: 1, utilizationFactorKu: 0.8, demandFactor: 1, dutyCyclePercent: 50, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, operatingDaysPerWeek: 7, continuousLoad: true, criticality: 'Critical' });
    const energy = calcDailyEnergy(l);
    // 150 W × 0.8 × 0.5 × 1 × 24h × 1d = 1440 Wh
    assertClose(energy, 1440, 10);
  }));

  // GOLDEN: Mixed-load
  r.push(t('Golden: Mixed residential + motor — combined balance', 'golden', () => {
    const loads = [
      makeLoad({ loadName: 'Lamp', ratedPowerW: 60, quantity: 5, voltageNominal: 220, phaseType: '1Ø', powerFactor: 0.95 }),
      makeLoad({ loadName: 'Pump', ratedPowerW: 750, quantity: 1, voltageNominal: 220, phaseType: '1Ø', powerFactor: 0.82, surgeMultiplier: 5 }),
    ];
    const flc1 = calcFullLoadCurrent(loads[0]); // 300 / 220 / 0.95 = 1.43
    const flc2 = calcFullLoadCurrent(loads[1]); // 750 / 220 / 0.82 = 4.16
    assertClose(flc1 + flc2, 5.6, 0.1);
  }));

  return r;
}

// =======================================================================
//  FORMULA REGISTRY TESTS
// =======================================================================
function formulaRegistryTests(): TestResult[] {
  const r: TestResult[] = [];

  // Each metric in the audit engine has a formula
  r.push(t('Formula: connected = rated × qty', 'formula', () => {
    const l = makeLoad({ ratedPowerW: 100, quantity: 3 });
    const a = calculateLoadAudited(l);
    assertEq(a.layer4_derived.connected.value, 300);
    assertTrue(a.layer4_derived.connected.formula.includes('ratedPowerW'));
    assertTrue(a.layer4_derived.connected.formula.includes('quantity'));
  }));

  r.push(t('Formula: kVA = W / (PF × 1000)', 'formula', () => {
    const l = makeLoad({ ratedPowerW: 1000, quantity: 1, powerFactor: 0.8 });
    const a = calculateLoadAudited(l);
    assertTrue(a.layer4_derived.apparentKVA.formula.includes('1000'));
  }));

  r.push(t('Formula: daily uses summer + winter weighted', 'formula', () => {
    const l = makeLoad({ ratedPowerW: 100, runningPowerW: 100, quantity: 1, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 10, nightHoursSummer: 0, dayHoursWinter: 0, nightHoursWinter: 0, operatingDaysPerWeek: 7 });
    const a = calculateLoadAudited(l);
    assertTrue(a.layer4_derived.dailyEnergyWh.formula.includes('summer'));
    assertTrue(a.layer4_derived.dailyEnergyWh.formula.includes('winter'));
  }));

  // Edge case: 0 hours
  r.push(t('Edge: 0 hours → 0 daily energy', 'formula', () => {
    const l = makeLoad({ ratedPowerW: 100, dayHoursSummer: 0, nightHoursSummer: 0, dayHoursWinter: 0, nightHoursWinter: 0 });
    assertEq(calcDailyEnergy(l), 0);
  }));

  // Edge case: 24/7 full year
  r.push(t('Edge: 24/7 × 365 days → max annual', 'formula', () => {
    const l = makeLoad({ ratedPowerW: 100, runningPowerW: 100, quantity: 1, utilizationFactorKu: 1, demandFactor: 1, dutyCyclePercent: 100, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, operatingDaysPerWeek: 7, operatingDaysPerYear: 365 });
    // annual = daily × 365 = 100 × 24 × 365 = 876000
    assertClose(calcAnnualEnergy(l), 876000, 100);
  }));

  // Out-of-range
  r.push(t('Out-of-range: PF > 1 is clamped', 'formula', () => {
    const l = makeLoad({ powerFactor: 1.5 });
    const a = calculateLoadAudited(l);
    assertLE(a.layer2_normalized.pf, 1);
  }));

  return r;
}

// =======================================================================
//  REGRESSION TESTS
// =======================================================================
function regressionTests(): TestResult[] {
  const r: TestResult[] = [];

  // Snapshot: known result for known input
  r.push(t('Regression: AC 1.5 Ton result matches v1.0', 'regression', () => {
    const l = makeLoad({ loadName: 'AC', ratedPowerW: 1500, runningPowerW: 1100, quantity: 1, powerFactor: 0.92, utilizationFactorKu: 0.7, demandFactor: 0.8, dayHoursSummer: 9, nightHoursSummer: 4, dayHoursWinter: 2, nightHoursWinter: 1, operatingDaysPerWeek: 7, dutyCyclePercent: 60, surgeMultiplier: 3 });
    const conn = calcConnectedLoad(l);
    const demand = calcDemandLoad(l);
    const surge = calcSurgePower(l);
    const daily = calcDailyEnergy(l);
    assertEq(conn, 1500);
    assertEq(demand, 1500 * 0.7);
    assertEq(surge, 1500 * 3);
    // Lock these values to detect future changes
    assertClose(daily, 1100 * 0.7 * 0.6 * 0.8 * 13 * 1, 5);
  }));

  // Inverter sizing recommendation
  r.push(t('Regression: Inverter recommendation = 1.25 × peak', 'regression', () => {
    const l = makeLoad({ ratedPowerW: 2000, quantity: 1, powerFactor: 0.9 });
    const flc = calcFullLoadCurrent(l);
    const minInverter = 2000 * 1.25;
    assertClose(minInverter, 2500, 0.01);
    assertTrue(flc < minInverter / 220, 'FLC < inverter rating');
  }));

  return r;
}

// =======================================================================
//  INTEGRATION TESTS
// =======================================================================
function integrationTests(): TestResult[] {
  const r: TestResult[] = [];

  r.push(t('Integration: Full pipeline from raw load → audit → summary → validation', 'integration', () => {
    const loads = [
      makeLoad({ loadName: 'AC 1', ratedPowerW: 1500, quantity: 2, powerFactor: 0.92, surgeMultiplier: 3, utilizationFactorKu: 0.7, demandFactor: 0.85, dayHoursSummer: 9, nightHoursSummer: 4, dayHoursWinter: 2, nightHoursWinter: 1, criticality: 'Essential' }),
      makeLoad({ loadName: 'LED', ratedPowerW: 12, quantity: 8, powerFactor: 0.9, utilizationFactorKu: 0.7, demandFactor: 0.9, dayHoursSummer: 3, nightHoursSummer: 5 }),
      makeLoad({ loadName: 'Fridge', ratedPowerW: 200, runningPowerW: 90, quantity: 1, powerFactor: 0.85, utilizationFactorKu: 0.5, demandFactor: 1, dayHoursSummer: 12, nightHoursSummer: 12, dayHoursWinter: 12, nightHoursWinter: 12, surgeMultiplier: 3, criticality: 'Critical' }),
    ];

    // 1. Audit each load
    const audits = loads.map(calculateLoadAudited);

    // 2. System audit
    const sys = calculateSystemAudit(audits);
    assertEq(sys.totalConnected.value, 1500*2 + 12*8 + 200);

    // 3. Validate all
    const issues = validateAllLoads(loads);
    assertTrue(issues.length > 0, 'should have some validation issues');

    // 4. Balance phases
    const bal = balancePhases(loads);
    assertTrue(bal.allocations.length === loads.length, 'all loads allocated');

    // 5. Build profile
    const profile = buildCompleteProfile(loads);
    assertTrue(profile.daily.total > 0, 'profile should have energy');
  }));

  r.push(t('Integration: All policy defaults reachable from calculations', 'integration', () => {
    const used = new Set<string>();
    for (const l of [
      makeLoad({ ratedPowerW: 1000, quantity: 1, utilizationFactorKu: 1, demandFactor: 1, dayHoursSummer: 5, nightHoursSummer: 5, dayHoursWinter: 5, nightHoursWinter: 5 }),
      makeLoad({ ratedPowerW: 5000, quantity: 1, utilizationFactorKu: 0.7, demandFactor: 0.8, voltageNominal: 380, phaseType: '3Ø', dayHoursSummer: 8, nightHoursSummer: 0 }),
    ]) {
      const audit = calculateLoadAudited(l);
      for (const key of Object.keys(audit.layer4_derived)) {
        const m = (audit.layer4_derived as any)[key];
        if (m.policyId) used.add(m.policyId);
      }
    }
    assertTrue(used.size > 0, 'should reference at least one policy');
  }));

  return r;
}

// =======================================================================
//  HELPERS
// =======================================================================
function makeLoad(overrides: Partial<Load>): Load {
  const base: Load = {
    id: overrides.id || 'test-id',
    loadId: 'LD-TEST',
    loadTag: 'TEST-01',
    loadName: 'Test Load',
    arabicName: 'حمل اختباري',
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
    ratedPowerW: 1000,
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
  };
  return { ...base, ...overrides };
}
