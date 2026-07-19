// =======================================================================
//  Harmonic Decision Engine
//  THD isn't just a warning — it affects:
//   - usable capacity (derate)
//   - neutral conductor stress
//   - compliance with IEEE 519
//   - filter recommendations
// =======================================================================

import type { Load } from '../../types';
import { getPolicy } from '../assumptions/policy';

export type HarmonicSeverity = 'clean' | 'mild' | 'moderate' | 'severe' | 'critical';

export interface HarmonicAnalysis {
  loadId: string;
  loadName: string;
  thdPercent: number;
  harmonicClass: string;
  severity: HarmonicSeverity;
  capacityDerate: number;       // 0-1, multiplier on usable capacity
  neutralStressFactor: number;   // multiplier for neutral conductor
  filterRequired: boolean;
  filterType: 'none' | 'passive' | 'active' | 'k-rated-transformer';
  filterSize: number;            // kVAr if filter needed
  complianceFlag: 'compliant' | 'warning' | 'non-compliant';
  recommendations: string[];
  policyId: string;
}

export function analyzeHarmonics(load: Load): HarmonicAnalysis {
  const policy = getPolicy('THD-LIMIT-IEEE519');
  const limit = (policy?.defaultValue as number) || 5;
  const thd = load.thdPercent || 0;
  // (derate policy used to factor in capacity reduction)

  // Severity classification
  let severity: HarmonicSeverity = 'clean';
  if (thd > 50) severity = 'critical';
  else if (thd > 30) severity = 'severe';
  else if (thd > 20) severity = 'moderate';
  else if (thd > 8) severity = 'mild';

  // Capacity derate: 1% THD above 5% → 0.5% capacity reduction
  const derate = thd > limit ? Math.max(0.7, 1 - (thd - limit) * 0.005) : 1.0;

  // Neutral stress: 3rd harmonics add in neutral. For single-phase non-linear, neutral can carry 1.73× phase current
  const isNonLinear = load.harmonicClass === 'Nonlinear' || load.harmonicClass === 'High Harmonics';
  const neutralStress = isNonLinear ? Math.min(1.73, 1 + (thd / 100) * 1.5) : 1.0;

  // Filter recommendation
  let filterType: HarmonicAnalysis['filterType'] = 'none';
  let filterSize = 0;
  if (thd > 20) { filterType = 'active'; filterSize = (load.ratedPowerW * load.quantity) / 1000 * 0.15; }
  else if (thd > 8) { filterType = 'passive'; filterSize = (load.ratedPowerW * load.quantity) / 1000 * 0.08; }
  if (load.harmonicClass === 'High Harmonics' && load.ratedPowerW * load.quantity > 1000) {
    filterType = 'k-rated-transformer';
  }

  // Compliance
  let compliance: HarmonicAnalysis['complianceFlag'] = 'compliant';
  if (thd > 25) compliance = 'non-compliant';
  else if (thd > 8) compliance = 'warning';

  const recs: string[] = [];
  if (thd > 8) recs.push(`THD ${thd}% exceeds IEEE 519 recommended ≤${limit}% for individual harmonic`);
  if (isNonLinear) recs.push('Non-linear load — neutral conductor must be sized 1.73× phase current');
  if (thd > 20) recs.push('Active harmonic filter recommended');
  else if (thd > 8) recs.push('Passive filter or K-rated transformer recommended');
  if (derate < 1) recs.push(`Inverter/transformer capacity derated to ${(derate * 100).toFixed(0)}%`);
  if (compliance === 'non-compliant') recs.push('⚠ Non-compliant — corrective action required before energization');

  return {
    loadId: load.id,
    loadName: load.loadName || '(unnamed)',
    thdPercent: thd,
    harmonicClass: load.harmonicClass,
    severity,
    capacityDerate: derate,
    neutralStressFactor: neutralStress,
    filterRequired: filterType !== 'none',
    filterType,
    filterSize,
    complianceFlag: compliance,
    recommendations: recs,
    policyId: policy?.policyId || 'THD-LIMIT-IEEE519',
  };
}

export function analyzeSystemHarmonics(loads: Load[]): {
  perLoad: HarmonicAnalysis[];
  avgTHD: number;
  maxTHD: number;
  totalNonLinear: number;
  totalFilterKvar: number;
  systemLevelWarning: string | null;
  recommendations: string[];
} {
  const perLoad = loads.map(analyzeHarmonics);
  const avgTHD = perLoad.length > 0 ? perLoad.reduce((s, a) => s + a.thdPercent, 0) / perLoad.length : 0;
  const maxTHD = perLoad.length > 0 ? Math.max(...perLoad.map(a => a.thdPercent)) : 0;
  const totalNonLinear = loads.filter(l => l.harmonicClass === 'Nonlinear' || l.harmonicClass === 'High Harmonics').length;
  const totalFilterKvar = perLoad.reduce((s, a) => s + a.filterSize, 0);

  let systemLevelWarning: string | null = null;
  if (maxTHD > 30) systemLevelWarning = `Critical harmonic pollution detected (peak THD ${maxTHD.toFixed(0)}%)`;
  else if (maxTHD > 15) systemLevelWarning = `Elevated harmonic levels (peak THD ${maxTHD.toFixed(0)}%) — consider whole-site filtering`;
  else if (totalNonLinear > loads.length * 0.5) systemLevelWarning = `${((totalNonLinear / Math.max(1, loads.length)) * 100).toFixed(0)}% of loads are non-linear — system-wide mitigation may be needed`;

  const recs: string[] = [];
  if (totalFilterKvar > 0) recs.push(`Install filtering totaling ${totalFilterKvar.toFixed(1)} kVAr`);
  if (totalNonLinear > 3) recs.push('Consider K-rated transformer for the entire distribution');
  if (systemLevelWarning) recs.push(systemLevelWarning);

  return { perLoad, avgTHD, maxTHD, totalNonLinear, totalFilterKvar, systemLevelWarning, recommendations: recs };
}
