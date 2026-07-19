// =======================================================================
//  Power Factor Decision Engine
//  PF affects:
//   - apparent power (kVA)
//   - current
//   - inverter sizing
//   - cable sizing recommendation
//   - correction capacitor recommendation
// =======================================================================

import type { Load } from '../../types';
import { calcApparentPower, calcFullLoadCurrent } from '../../utils/calculations';

export type PFCorrectionType = 'none' | 'individual-capacitor' | 'bulk-capacitor-bank' | 'active-filter';

export interface PFAnalysis {
  loadId: string;
  loadName: string;
  pf: number;
  pfClass: 'leading' | 'unity' | 'lagging-severe' | 'lagging-moderate' | 'lagging-mild';
  activePowerW: number;
  apparentPowerKVA: number;
  reactivePowerKVAR: number;
  fullLoadCurrent: number;
  currentPenalty: number;       // 1/PF multiplier vs unity
  correctionRequired: boolean;
  correctionType: PFCorrectionType;
  correctionSizeKVAR: number;
  targetPF: number;
  expectedSavingsKVAR: number;
  inverterOversizeFactor: number; // 1.0 to 1.5
  cableUpsizeFactor: number;     // 1.0 to 1.73
  recommendations: string[];
  policyId: string;
}

const TARGET_PF = 0.95;

export function analyzePF(load: Load): PFAnalysis {
  const pf = load.powerFactor || 0.9;
  const apparentKVA = calcApparentPower(load);
  const flc = calcFullLoadCurrent(load);
  const kw = (load.ratedPowerW * load.quantity) / 1000;
  const kvar = Math.sqrt(Math.max(0, apparentKVA * apparentKVA - kw * kw));

  // Classification
  let pfClass: PFAnalysis['pfClass'] = 'lagging-mild';
  if (pf >= 0.98) pfClass = 'unity';
  else if (pf >= 0.9) pfClass = 'lagging-mild';
  else if (pf >= 0.8) pfClass = 'lagging-moderate';
  else if (pf > 0) pfClass = 'lagging-severe';

  const currentPenalty = 1 / Math.max(0.5, pf);

  // Correction
  let correctionRequired = pf < TARGET_PF;
  let correctionType: PFAnalysis['correctionType'] = 'none';
  let correctionSize = 0;
  if (pf < 0.7) correctionType = 'active-filter';
  else if (pf < 0.85) correctionType = 'bulk-capacitor-bank';
  else if (pf < TARGET_PF) correctionType = 'individual-capacitor';

  if (correctionRequired) {
    // kVAr to add to reach target PF
    const targetKvar = kw * Math.tan(Math.acos(TARGET_PF));
    correctionSize = Math.max(0, kvar - targetKvar);
  }

  // Inverter oversize: lower PF → larger inverter needed
  const inverterOversize = 1 / Math.max(0.7, pf);

  // Cable upsize: 1/PF
  const cableUpsize = currentPenalty;

  const recs: string[] = [];
  if (pf < TARGET_PF) {
    recs.push(`PF ${pf.toFixed(2)} below target ${TARGET_PF} — install ${correctionType.replace(/-/g, ' ')}`);
    recs.push(`Add ${correctionSize.toFixed(2)} kVAr capacitive correction`);
    recs.push(`Reduces current by ${((1 - 1/currentPenalty) * 100).toFixed(0)}% — possible cable downsize`);
  }
  if (pf < 0.8) recs.push('⚠ Low PF may incur utility penalty charges');
  if (inverterOversize > 1.3) recs.push(`Inverter must be oversized by ${((inverterOversize - 1) * 100).toFixed(0)}% to handle reactive current`);

  return {
    loadId: load.id,
    loadName: load.loadName || '(unnamed)',
    pf,
    pfClass,
    activePowerW: kw * 1000,
    apparentPowerKVA: apparentKVA,
    reactivePowerKVAR: kvar,
    fullLoadCurrent: flc,
    currentPenalty,
    correctionRequired,
    correctionType,
    correctionSizeKVAR: correctionSize,
    targetPF: TARGET_PF,
    expectedSavingsKVAR: correctionSize,
    inverterOversizeFactor: inverterOversize,
    cableUpsizeFactor: cableUpsize,
    recommendations: recs,
    policyId: 'TARGET-PF-0.95',
  };
}

export function analyzeSystemPF(loads: Load[]): {
  perLoad: PFAnalysis[];
  weightedPF: number;
  totalKvarUncorrected: number;
  totalKvarCorrection: number;
  systemNeedsCorrection: boolean;
  recommendations: string[];
} {
  const perLoad = loads.map(analyzePF);
  const totalW = perLoad.reduce((s, a) => s + a.activePowerW, 0);
  const totalVa = perLoad.reduce((s, a) => s + a.apparentPowerKVA, 0);
  const weightedPF = totalVa > 0 ? totalW / (totalVa * 1000) : 1;
  const totalKvarUncorrected = perLoad.reduce((s, a) => s + a.reactivePowerKVAR, 0);
  const totalKvarCorrection = perLoad.reduce((s, a) => s + a.correctionSizeKVAR, 0);
  const systemNeedsCorrection = weightedPF < TARGET_PF;

  const recs: string[] = [];
  if (systemNeedsCorrection) {
    recs.push(`System weighted PF ${weightedPF.toFixed(3)} below target ${TARGET_PF} — bulk correction recommended`);
    recs.push(`Add ${totalKvarCorrection.toFixed(1)} kVAr of capacitive correction at main distribution`);
  }
  const badPF = perLoad.filter(a => a.pf < 0.8);
  if (badPF.length > 0) recs.push(`${badPF.length} loads have very low PF — consider individual correction`);

  return { perLoad, weightedPF, totalKvarUncorrected, totalKvarCorrection, systemNeedsCorrection, recommendations: recs };
}
