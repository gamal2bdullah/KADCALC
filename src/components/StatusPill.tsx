import { CRITICALITY, SEVERITY } from '../theme/brand';

// Severity pill (validation matrix). Carries meaning via icon + text + color (a11y).
export function SeverityPill({ severity, count }: { severity: string; count?: number }) {
  const s = SEVERITY[severity] ?? SEVERITY.info;
  return (
    <span className={`pill pill-${s.token}`}>
      <span className="pill-dot" />
      {s.label}{count != null ? ` (${count})` : ''}
    </span>
  );
}

// Criticality badge (inventory / schedule). Maps Critical→error, Essential→warning…
export function CriticalityBadge({ value }: { value: string }) {
  const c = CRITICALITY[value] ?? CRITICALITY.Normal;
  return <span className={`pill pill-crit-${c.token.replace('crit-', '')}`}>{value}</span>;
}
