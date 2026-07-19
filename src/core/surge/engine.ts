// =======================================================================
//  Surge Decision Engine
//  Real surge model — not just a multiplier.
//  Handles: inrush current, locked rotor, soft-start, sequential start,
//  simultaneous start, group start window, startup diversity, VFD behavior.
// =======================================================================

import type { Load } from '../../types';
import { calcFullLoadCurrent } from '../../utils/calculations';
import { getPolicy } from '../assumptions/policy';

export interface SurgeAnalysis {
  loadId: string;
  loadName: string;
  flc: number;             // full-load current (A)
  lra: number;             // locked-rotor current (A)
  hasVFD: boolean;
  hasSoftStarter: boolean;
  effectiveSurgeMultiplier: number; // 1-7
  recommendedStartStrategy: 'simultaneous' | 'sequential' | 'grouped' | 'vfd-controlled';
  sequentialDelaySec: number;     // suggested delay between starts
  groupStartWindowSec: number;    // window for group start
  notes: string[];
  riskLevel: 'low' | 'medium' | 'high';
  policyId: string;
}

const SOFT_STARTER_REDUCTION = 0.35; // 65% reduction
const VFD_REDUCTION = 0.20;          // 80% reduction

export function analyzeSurge(load: Load): SurgeAnalysis {
  const policy = pickSurgePolicy(load);
  const baseMult = policy?.defaultValue as number || 3;
  const flc = calcFullLoadCurrent(load);

  // Detect VFD/soft-starter from notes (heuristic since no explicit field)
  const noteStr = (load.notes || '').toLowerCase();
  const hasVFD = /vfd|inverter.driven|frequency.drive/i.test(noteStr);
  const hasSoftStarter = /soft.start|soft.start|softstarter/i.test(noteStr);

  // Reduce multiplier for VFD/soft-start
  let effMult = baseMult;
  const notes: string[] = [];
  if (hasVFD) { effMult = Math.max(1.5, baseMult * (1 - VFD_REDUCTION)); notes.push('VFD detected — soft-charge limits inrush to ~' + effMult.toFixed(1) + '×'); }
  else if (hasSoftStarter) { effMult = Math.max(1.5, baseMult * (1 - SOFT_STARTER_REDUCTION)); notes.push('Soft-starter detected — reduced inrush to ~' + effMult.toFixed(1) + '×'); }

  // NOTE: `flc` (calcFullLoadCurrent) already incorporates `quantity`, so we must
  // not multiply by quantity again here — that previously inflated LRA/Surge for
  // multi-unit loads.
  const lra = flc * effMult;

  // Recommended strategy
  let strategy: SurgeAnalysis['recommendedStartStrategy'] = 'simultaneous';
  let delay = 0;
  let window = 0;
  if (effMult >= 5 && (load.quantity || 1) > 1) {
    strategy = 'sequential';
    delay = Math.ceil(10 * effMult); // 10s per multiplier
    window = delay * (load.quantity || 1);
    notes.push(`Sequential start recommended: ${delay}s delay between units (window ${window}s)`);
  } else if (effMult >= 3 && (load.quantity || 1) > 2) {
    strategy = 'grouped';
    window = 5;
    notes.push('Group start in 5s window to limit simultaneous inrush');
  } else if (hasVFD || hasSoftStarter) {
    strategy = 'vfd-controlled';
    notes.push('VFD/soft-starter controlled start — no special sequencing needed');
  }

  // Risk
  let risk: 'low' | 'medium' | 'high' = 'low';
  if (effMult >= 6) risk = 'high';
  else if (effMult >= 3) risk = 'medium';
  if (lra > 200) risk = 'high'; // very high LRA

  return {
    loadId: load.id,
    loadName: load.loadName || '(unnamed)',
    flc,
    lra,
    hasVFD,
    hasSoftStarter,
    effectiveSurgeMultiplier: effMult,
    recommendedStartStrategy: strategy,
    sequentialDelaySec: delay,
    groupStartWindowSec: window,
    notes,
    riskLevel: risk,
    policyId: policy?.policyId || 'CUSTOM',
  };
}

export function analyzeSystemSurges(loads: Load[]): {
  perLoad: SurgeAnalysis[];
  totalAggregateLRA: number;       // if all start simultaneously
  worstCaseInrush: number;
  recommendations: string[];
} {
  const perLoad = loads.map(analyzeSurge);
  const totalAggregateLRA = perLoad.reduce((s, a) => s + a.lra, 0);
  // Worst case = top 3 loads' LRA assumed simultaneous
  const worstCaseInrush = [...perLoad].sort((a, b) => b.lra - a.lra).slice(0, 3).reduce((s, a) => s + a.lra, 0);

  const recommendations: string[] = [];
  const highRisk = perLoad.filter(p => p.riskLevel === 'high');
  if (highRisk.length > 0) {
    recommendations.push(`${highRisk.length} loads with HIGH surge risk — size inverter at minimum 1.5× peak demand`);
  }
  const sequentialLoads = perLoad.filter(p => p.recommendedStartStrategy === 'sequential');
  if (sequentialLoads.length > 0) {
    recommendations.push(`${sequentialLoads.length} loads need sequential start — implement PLC or interlock`);
  }
  if (totalAggregateLRA > 500) {
    recommendations.push(`Aggregate LRA ${totalAggregateLRA.toFixed(0)}A if simultaneous — staggering critical`);
  }
  if (perLoad.some(p => p.hasVFD || p.hasSoftStarter)) {
    recommendations.push(`${perLoad.filter(p => p.hasVFD || p.hasSoftStarter).length} loads equipped with VFD/soft-starter — inrush already mitigated`);
  }
  return { perLoad, totalAggregateLRA, worstCaseInrush, recommendations };
}

function pickSurgePolicy(load: Load) {
  // Motor + power-based selection
  if (load.ratedPowerW > 3730) return getPolicy('SURGE-DOL-LARGE');
  if (load.ratedPowerW > 746) return getPolicy('SURGE-CAPACITOR-MED');
  if (load.categoryMain === 'Kitchen' || load.categorySub?.toLowerCase().includes('refrigerator')) {
    return getPolicy('SURGE-COMPRESSOR');
  }
  return getPolicy('SURGE-PSC-SMALL');
}
