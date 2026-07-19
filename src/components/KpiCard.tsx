import type { LucideIcon } from 'lucide-react';
import { KPI_ACCENT } from '../theme/colors';

// KPI tile bound to the semantic KPI_ACCENT layer (OUTPUT layer).
// `accent` key maps to a token color; value is mono for engineering feel.
export function KpiCard({
  label, value, sub, color = 'connected', icon: Icon, onClick,
}: {
  label: string; value: string; sub?: string; color?: keyof typeof KPI_ACCENT;
  icon?: LucideIcon; onClick?: () => void;
}) {
  const c = KPI_ACCENT[color] ?? KPI_ACCENT.connected;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`kpi text-left ${onClick ? 'cursor-pointer hover:border-accent/40 transition' : 'cursor-default'}`}
    >
      <div className="kpi-bar" style={{ background: c }} />
      <div className="flex items-center justify-between">
        <div className="kpi-label">{label}</div>
        {Icon && <Icon className="w-4 h-4" style={{ color: c }} />}
      </div>
      <div className="kpi-value" style={{ color: c }}>{value}</div>
      {sub && <div className="text-[10px] text-text-tertiary mt-1">{sub}</div>}
    </button>
  );
}
