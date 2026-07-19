// =======================================================================
//  Phase Balancing Engine
//  Real optimization algorithm — not a round-robin trick.
//
//  Inputs:  1Ø loads (must assign), 3Ø loads (already balanced), groups,
//           criticality, surge sensitivity, simultaneity
//  Outputs: phase allocation, imbalance %, critical violations,
//           recommendation list, surge stacking analysis
// =======================================================================

import type { Load } from '../../types';
import { calcConnectedLoad, calcSurgePower } from '../../utils/calculations';

export interface PhaseAllocation {
  loadId: string;
  loadName: string;
  phase: 'L1' | 'L2' | 'L3' | '3Ø';
  reasoning: string;
}

export interface BalancingResult {
  allocations: PhaseAllocation[];
  phases: { L1: number; L2: number; L3: number };
  imbalancePercent: number;
  imbalanceStatus: 'excellent' | 'good' | 'acceptable' | 'warning' | 'critical';
  recommendations: string[];
  violations: { loadName: string; reason: string; severity: 'critical' | 'warning' }[];
  surgeStacking: { phase: string; peakSurge: number; stackingRisk: 'low' | 'medium' | 'high' }[];
  totalConnected: number;
  balancingScore: number; // 0-100
}

interface AssignableLoad {
  load: Load;
  weight: number; // connected × qty
  isCritical: boolean;
  hasHighSurge: boolean;
  group?: string;
}

// =======================================================================
//  THE ALGORITHM — multi-pass greedy + refinement
// =====================================================================
export function balancePhases(loads: Load[]): BalancingResult {
  // Step 1: Separate 3Ø (auto-balanced) from 1Ø (need assignment)
  const threePhase = loads.filter(l => l.phaseType === '3Ø');
  const onePhase = loads.filter(l => l.phaseType === '1Ø');

  // Step 2: Initialize phase loads (3Ø adds equally to all phases)
  const phases: { L1: number; L2: number; L3: number } = { L1: 0, L2: 0, L3: 0 };
  threePhase.forEach(l => {
    const w = calcConnectedLoad(l);
    phases.L1 += w / 3; phases.L2 += w / 3; phases.L3 += w / 3;
  });

  // Step 3: Prepare 1Ø loads for assignment (sort by weight desc)
  const assignable: AssignableLoad[] = onePhase.map(l => ({
    load: l,
    weight: calcConnectedLoad(l),
    isCritical: l.criticality === 'Critical',
    hasHighSurge: l.surgeMultiplier >= 5,
    group: l.simultaneousGroup || undefined,
  })).sort((a, b) => b.weight - a.weight);

  // Step 4: Greedy assignment — always place on lightest phase
  // But critical loads go first, then high-surge, then large
  const sorted = [...assignable].sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
    if (a.hasHighSurge !== b.hasHighSurge) return a.hasHighSurge ? -1 : 1;
    return b.weight - a.weight;
  });

  const allocations: PhaseAllocation[] = threePhase.map(l => ({
    loadId: l.id, loadName: l.loadName, phase: '3Ø',
    reasoning: '3-phase balanced inherently — adds 1/3 to each phase',
  }));

  sorted.forEach(a => {
    // Pick the lightest phase
    const phases_arr: ('L1' | 'L2' | 'L3')[] = ['L1', 'L2', 'L3'];
    const lightest = phases_arr.reduce((min, p) => phases[p] < phases[min] ? p : min, 'L1' as 'L1' | 'L2' | 'L3');

    // Same group: keep on same phase as previous sibling (for simultaneity clarity)
    let chosen = lightest;
    if (a.group) {
      const sibling = allocations.find(al => {
        const origLoad = onePhase.find(l => l.id === al.loadId);
        return origLoad?.simultaneousGroup === a.group;
      });
      if (sibling && sibling.phase !== '3Ø') {
        chosen = sibling.phase as 'L1' | 'L2' | 'L3';
      }
    }

    // Critical → spread: don't put 2 criticals on same phase if avoidable
    if (a.isCritical) {
      const criticalCount = allocations.filter(al => {
        if (al.phase === '3Ø') return false;
        const orig = onePhase.find(l => l.id === al.loadId);
        return orig?.criticality === 'Critical';
      }).map(al => al.phase);
      const used = new Set(criticalCount);
      const available = phases_arr.filter(p => !used.has(p));
      if (available.length > 0) {
        const lightestAvail = available.reduce((min, p) => phases[p] < phases[min] ? p : min, available[0]);
        chosen = lightestAvail;
      }
    }

    phases[chosen] += a.weight;
    allocations.push({
      loadId: a.load.id,
      loadName: a.load.loadName,
      phase: chosen,
      reasoning: a.isCritical ? `Critical load → spread to ${chosen}` :
                a.hasHighSurge ? `High-surge → balanced first, ${chosen}` :
                a.group ? `Group "${a.group}" → co-located on ${chosen}` :
                `Largest-first greedy → placed on ${chosen}`,
    });
  });

  // Step 5: Refinement pass — try swapping pairs to reduce imbalance
  for (let i = 0; i < 50; i++) {
    const phaseArr: ('L1' | 'L2' | 'L3')[] = ['L1', 'L2', 'L3'];
    const max = phaseArr.reduce((m, p) => phases[p] > phases[m] ? p : m, 'L1' as 'L1' | 'L2' | 'L3');
    const min = phaseArr.reduce((m, p) => phases[p] < phases[m] ? p : m, 'L1' as 'L1' | 'L2' | 'L3');
    const diff = phases[max] - phases[min];
    if (diff / Math.max(1, phases[max]) < 0.05) break; // <5% imbalance, good enough

    // Find largest 1Ø load on the heaviest phase
    const candidates = allocations
      .filter(a => a.phase === max)
      .map(a => {
        const orig = onePhase.find(l => l.id === a.loadId);
        return { alloc: a, load: orig };
      })
      .filter(c => c.load && !c.load.criticality.includes('Critical'))
      .sort((a, b) => (b.load ? calcConnectedLoad(b.load) : 0) - (a.load ? calcConnectedLoad(a.load) : 0));

    if (candidates.length === 0) break;

    const candidate = candidates[0];
    if (!candidate.load) break;

    const w = calcConnectedLoad(candidate.load);
    // Only swap if it reduces imbalance
    const newImb = (Math.abs((phases[max] - w) - phases[min])) / Math.max(1, phases[max] - w);
    const oldImb = diff / Math.max(1, phases[max]);
    if (newImb < oldImb) {
      phases[max] -= w;
      phases[min] += w;
      candidate.alloc.phase = min;
      candidate.alloc.reasoning += ` (refined: moved to ${min} to reduce imbalance)`;
    } else break;
  }

  // Step 6: Compute metrics
  const totalConnected = phases.L1 + phases.L2 + phases.L3;
  const max = Math.max(phases.L1, phases.L2, phases.L3);
  const min = Math.min(phases.L1, phases.L2, phases.L3);
  const imbalance = max > 0 ? ((max - min) / max) * 100 : 0;

  const status: BalancingResult['imbalanceStatus'] =
    imbalance < 5 ? 'excellent' :
    imbalance < 10 ? 'good' :
    imbalance < 15 ? 'acceptable' :
    imbalance < 25 ? 'warning' : 'critical';

  // Step 7: Surge stacking analysis per phase
  const surgeStacking: BalancingResult['surgeStacking'] = ['L1', 'L2', 'L3'].map(phase => {
    const loadIds = allocations.filter(a => a.phase === phase).map(a => a.loadId);
    const phaseLoads = loads.filter(l => loadIds.includes(l.id));
    const totalSurge = phaseLoads.reduce((s, l) => s + calcSurgePower(l), 0);
    const peakSurge = Math.max(0, ...phaseLoads.map(l => calcSurgePower(l)));
    const stackedFactor = totalSurge / Math.max(1, peakSurge);
    return {
      phase,
      peakSurge,
      stackingRisk: stackedFactor > 3 ? 'high' : stackedFactor > 2 ? 'medium' : 'low',
    };
  });

  // Step 8: Recommendations
  const recommendations: string[] = [];
  if (imbalance > 15) recommendations.push(`⚠ Imbalance ${imbalance.toFixed(1)}% exceeds 15% policy limit (IEC 60364) — redistribute or move loads to 3Ø`);
  if (imbalance > 10 && imbalance <= 15) recommendations.push(`Imbalance ${imbalance.toFixed(1)}% is acceptable but could be reduced below 10%`);
  if (onePhase.length === 0) recommendations.push(`All loads are 3Ø — imbalance is inherently zero (no action needed)`);
  if (surgeStacking.some(s => s.stackingRisk === 'high')) {
    recommendations.push(`High surge-stacking detected on ${surgeStacking.find(s => s.stackingRisk === 'high')?.phase} — stagger starts to avoid simultaneous inrush`);
  }
  const criticalCount = onePhase.filter(l => l.criticality === 'Critical').length;
  if (criticalCount > 0) {
    recommendations.push(`${criticalCount} critical 1Ø load(s) distributed across phases for redundancy`);
  }

  // Step 9: Violations
  const violations: BalancingResult['violations'] = [];
  if (imbalance > 25) violations.push({ loadName: 'System', reason: `Imbalance ${imbalance.toFixed(1)}% exceeds critical threshold (25%)`, severity: 'critical' });
  else if (imbalance > 15) violations.push({ loadName: 'System', reason: `Imbalance ${imbalance.toFixed(1)}% exceeds policy (15%)`, severity: 'warning' });

  // Step 10: Score
  const balancingScore = Math.max(0, 100 - imbalance * 3 - surgeStacking.filter(s => s.stackingRisk === 'high').length * 10);

  return {
    allocations,
    phases,
    imbalancePercent: imbalance,
    imbalanceStatus: status,
    recommendations,
    violations,
    surgeStacking,
    totalConnected,
    balancingScore,
  };
}
