// =======================================================================
//  Assumption Override Tracking
//  When a user deviates from a policy, we record the override with
//  reason, timestamp, and who/what was changed.
// =======================================================================

import type { EngineeringPolicy } from './policy';
import { POLICY_BY_ID } from './policy';

export interface AssumptionOverride {
  overrideId: string;
  policyId: string;
  originalValue: number | string;
  newValue: number | string;
  field: string;             // e.g., "loadId.powerFactor"
  loadId?: string;           // null = system-wide
  loadName?: string;
  reason: string;            // user-supplied reason
  timestamp: string;         // ISO
  user?: string;             // optional, for multi-user
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'auto';
  riskLevel: 'low' | 'medium' | 'high';
}

const OVERRIDE_KEY = 'kad-overrides-v1';
const OVERRIDE_LEGACY = 'itel-overrides-v1';

let _overrides: AssumptionOverride[] = [];

try {
  const raw = localStorage.getItem(OVERRIDE_KEY) ?? localStorage.getItem(OVERRIDE_LEGACY);
  if (raw) _overrides = JSON.parse(raw);
  // Migrate legacy data into the clean namespace exactly once.
  if (!localStorage.getItem(OVERRIDE_KEY) && localStorage.getItem(OVERRIDE_LEGACY)) {
    localStorage.setItem(OVERRIDE_KEY, localStorage.getItem(OVERRIDE_LEGACY)!);
    localStorage.removeItem(OVERRIDE_LEGACY);
  }
} catch {}

// =======================================================================
//  CRUD
// =======================================================================
export function recordOverride(o: Omit<AssumptionOverride, 'overrideId' | 'timestamp' | 'reviewStatus'>): AssumptionOverride {
  const policy = POLICY_BY_ID[o.policyId];
  if (!policy) throw new Error(`Unknown policy: ${o.policyId}`);

  // Validate override is allowed
  if (policy.overrideAllowed === 'No') {
    throw new Error(`Policy ${o.policyId} does not allow overrides`);
  }

  // Auto-assess risk
  let risk: 'low' | 'medium' | 'high' = 'low';
  if (typeof o.newValue === 'number' && typeof o.originalValue === 'number') {
    const deviation = Math.abs(o.newValue - o.originalValue) / Math.max(0.01, Math.abs(o.originalValue));
    if (deviation > 0.3) risk = 'high';
    else if (deviation > 0.1) risk = 'medium';
  }

  const record: AssumptionOverride = {
    ...o,
    overrideId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    reviewStatus: 'pending',
    riskLevel: risk,
  };

  _overrides.push(record);
  persist();
  return record;
}

export function getOverrides(): AssumptionOverride[] {
  return [..._overrides].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getOverridesByPolicy(policyId: string): AssumptionOverride[] {
  return _overrides.filter(o => o.policyId === policyId);
}

export function getOverridesByLoad(loadId: string): AssumptionOverride[] {
  return _overrides.filter(o => o.loadId === loadId);
}

export function reviewOverride(overrideId: string, status: 'approved' | 'rejected'): void {
  const o = _overrides.find(x => x.overrideId === overrideId);
  if (o) { o.reviewStatus = status; persist(); }
}

export function clearOverride(overrideId: string): void {
  _overrides = _overrides.filter(x => x.overrideId !== overrideId);
  persist();
}

export function clearAllOverrides(): void {
  _overrides = [];
  persist();
}

function persist() {
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(_overrides)); } catch {}
}

export function getOverrideStats() {
  const all = _overrides;
  return {
    total: all.length,
    pending: all.filter(o => o.reviewStatus === 'pending').length,
    approved: all.filter(o => o.reviewStatus === 'approved').length,
    rejected: all.filter(o => o.reviewStatus === 'rejected').length,
    riskHigh: all.filter(o => o.riskLevel === 'high').length,
    riskMedium: all.filter(o => o.riskLevel === 'medium').length,
    riskLow: all.filter(o => o.riskLevel === 'low').length,
  };
}

export interface PolicyDeviation {
  policy: EngineeringPolicy;
  deviations: { loadId: string; loadName: string; field: string; currentValue: number | string; defaultValue: number | string; deviation: number; reason: string }[];
}

// Detect where user values deviate from defaults
export function detectDeviations(loads: any[], fieldMap: Record<string, { policyId: string; extract: (l: any) => number | string; default: (l: any) => number | string }>): PolicyDeviation[] {
  const result: PolicyDeviation[] = [];
  for (const [field, { policyId, extract, default: defFn }] of Object.entries(fieldMap)) {
    const policy = POLICY_BY_ID[policyId];
    if (!policy) continue;
    const devs: PolicyDeviation['deviations'] = [];
    for (const l of loads) {
      const cur = extract(l);
      const def = defFn(l);
      if (typeof cur === 'number' && typeof def === 'number' && Math.abs(cur - def) > 0.001) {
        devs.push({
          loadId: l.id, loadName: l.loadName || '(unnamed)', field,
          currentValue: cur, defaultValue: def,
          deviation: ((cur - def) / Math.max(0.01, Math.abs(def))) * 100,
          reason: 'User-supplied value differs from policy default',
        });
      }
    }
    if (devs.length > 0) result.push({ policy, deviations: devs });
  }
  return result;
}
